import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AccountingApiService } from '../../api/accounting-api.service';
import { AccountingEntries, AccountingPlanOption, AccountingRoleAccount, AccountingRoles } from '../../api/building-config.models';
import { FinanceBuildingAccess } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, exportErrorMessage, exportFileName, FinanceErrorKind, GsPipe } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

type Tab = 'entries' | 'roles';

interface OptionGroup {
  name: string;
  items: AccountingPlanOption[];
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = { Cash: 'Caja', Bank: 'Banco', ReserveFund: 'Fondo de reserva' };

// Asientos contables sugeridos para el contador: un asiento de partida doble por cada movimiento del libro (criterio de caja), con la cuenta
// del plan de cada cuenta financiera, el IVA crédito de las compras y el rubro. Son sugeridos: no asientan nada ni cambian saldos. Si falta
// la cuenta del plan de algún renglón, el asiento queda incompleto y se avisa; las cuentas se asignan en la pestaña «Cuentas del plan».
@Component({
  standalone: true,
  selector: 'app-finance-accounting-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Asientos contables</h1>
            <p>Partida doble sugerida a partir del libro, para el contador.</p>
          </div>
        </div>
        <div class="controls">
          <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
          <p-button *ngIf="tab === 'entries'" type="button" label="Exportar a Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true"
                    [loading]="exporting" [disabled]="!entries" (onClick)="download()"></p-button>
        </div>
      </div>

      <app-finance-state [loading]="loading && !roles && !entries" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="buildingId && !noBuilding && !errorKind">
        <nav class="tabs" role="tablist">
          <button type="button" role="tab" [class.active]="tab === 'entries'" (click)="setTab('entries')">Asientos sugeridos</button>
          <button type="button" role="tab" [class.active]="tab === 'roles'" (click)="setTab('roles')">
            Cuentas del plan <span class="dot" *ngIf="roles && !roles.isComplete" title="Faltan cuentas por asignar"></span>
          </button>
        </nav>

        <!-- ══ ASIENTOS ══ -->
        <ng-container *ngIf="tab === 'entries'">
          <div class="filters">
            <label class="field"><span>Desde</span><input type="date" [(ngModel)]="from" (ngModelChange)="reloadEntries()" /></label>
            <label class="field"><span>Hasta</span><input type="date" [(ngModel)]="to" (ngModelChange)="reloadEntries()" /></label>
          </div>
          <p-message *ngIf="entriesError" severity="error" [text]="entriesError"></p-message>
          <p class="app-state" *ngIf="loadingEntries">Cargando...</p>

          <ng-container *ngIf="entries as e">
            <div class="kpis">
              <div class="kpi"><span>Asientos</span><strong>{{ e.entryCount }}</strong></div>
              <div class="kpi" [class.bad]="e.incompleteCount > 0"><span>Incompletos</span><strong>{{ e.incompleteCount }}</strong></div>
              <div class="kpi"><span>Total debe</span><strong>{{ e.totalDebit | gs }}</strong></div>
              <div class="kpi"><span>Total haber</span><strong>{{ e.totalCredit | gs }}</strong></div>
            </div>

            <div class="notice" *ngIf="e.incompleteCount > 0">
              <strong>{{ e.incompleteCount }} asientos están incompletos</strong> porque falta la cuenta del plan de: {{ e.pending.join(', ') }}.
              <button type="button" class="link" (click)="setTab('roles')">Asignar las cuentas</button>
            </div>

            <p class="muted" *ngIf="!e.entries.length">No hay movimientos en el rango, así que no hay asientos.</p>

            <article class="entry" *ngFor="let en of e.entries" [class.incomplete]="!en.isComplete">
              <header>
                <div>
                  <strong>N° {{ en.number }} · {{ en.date | date: 'dd/MM/yyyy' }}</strong>
                  <p-tag *ngIf="!en.isComplete" value="Incompleto" severity="warn" styleClass="tag-sm"></p-tag>
                  <div class="muted small">{{ en.description }}<span *ngIf="en.thirdParty"> · {{ en.thirdParty }}</span><span *ngIf="en.reference"> · {{ en.reference }}</span></div>
                </div>
              </header>
              <table class="t">
                <thead><tr><th>Cuenta</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>
                  <tr *ngFor="let l of en.lines" [class.missing]="l.missing">
                    <td [class.indent]="l.credit > 0 && l.debit === 0">
                      <strong *ngIf="l.code">{{ l.code }}</strong> {{ l.name }}
                      <span class="muted small" *ngIf="l.externalCode">· contador {{ l.externalCode }}</span>
                    </td>
                    <td class="num">{{ l.debit ? (l.debit | gs) : '' }}</td>
                    <td class="num">{{ l.credit ? (l.credit | gs) : '' }}</td>
                  </tr>
                </tbody>
              </table>
            </article>

            <h3 *ngIf="e.totals.length">Sumas por cuenta</h3>
            <div class="table-wrap" *ngIf="e.totals.length">
              <table class="t">
                <thead><tr><th>Cuenta</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead>
                <tbody>
                  <tr *ngFor="let t of e.totals" [class.missing]="t.missing">
                    <td><strong *ngIf="t.code">{{ t.code }}</strong> {{ t.name }}<span class="muted small" *ngIf="t.missing"> (sin cuenta del plan)</span></td>
                    <td class="num">{{ t.debit | gs }}</td>
                    <td class="num">{{ t.credit | gs }}</td>
                    <td class="num">{{ t.debit - t.credit | gs }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="muted small">Criterio de caja: un asiento por cada cobro, gasto, ingreso o nota de crédito del proveedor del libro. No incluye apertura, transferencias entre cuentas propias ni retenciones. El paquete del contador (Excel del ejercicio) trae estas mismas hojas.</p>
          </ng-container>
        </ng-container>

        <!-- ══ CUENTAS DEL PLAN ══ -->
        <ng-container *ngIf="tab === 'roles'">
          <p-message *ngIf="rolesError" severity="error" [text]="rolesError"></p-message>
          <p class="app-state" *ngIf="loadingRoles">Cargando...</p>

          <ng-container *ngIf="roles as r">
            <p class="muted small">
              Cada cuenta financiera del edificio y el IVA crédito necesitan su cuenta del plan (de activo o de fondos) para armar los asientos.
              <span *ngIf="!r.canEdit"> Solo el SuperAdmin y el Administrador de empresa pueden asignarlas.</span>
            </p>
            <div class="notice info" *ngIf="r.isComplete">Todas las cuentas tienen su cuenta del plan.</div>

            <div class="table-wrap">
              <table class="t">
                <thead><tr><th>Cuenta financiera</th><th>Tipo</th><th>Cuenta del plan</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let a of r.accounts" [class.inactive]="!a.isActive" [class.changed]="selection[a.financialAccountId] !== original[a.financialAccountId]">
                    <td><strong>{{ a.name }}</strong> <span class="muted small" *ngIf="!a.isActive">(inactiva)</span></td>
                    <td>{{ typeLabel(a) }}</td>
                    <td>
                      <select class="cell-select" [(ngModel)]="selection[a.financialAccountId]" [disabled]="!r.canEdit">
                        <option [ngValue]="''">Sin asignar</option>
                        <optgroup *ngFor="let g of groups" [label]="g.name">
                          <option *ngFor="let o of g.items" [ngValue]="o.id">{{ o.code }} · {{ o.name }}{{ o.isActive ? '' : ' (inactiva)' }}</option>
                        </optgroup>
                      </select>
                    </td>
                    <td class="num">
                      <button type="button" class="link" *ngIf="r.canEdit && !selection[a.financialAccountId] && a.suggestedCategoryId" (click)="selection[a.financialAccountId] = a.suggestedCategoryId!">
                        Usar {{ optionLabel(a.suggestedCategoryId) }}
                      </button>
                    </td>
                  </tr>
                  <tr [class.changed]="vatSelection !== vatOriginal">
                    <td><strong>IVA crédito fiscal</strong></td>
                    <td>Compras</td>
                    <td>
                      <select class="cell-select" [(ngModel)]="vatSelection" [disabled]="!r.canEdit">
                        <option [ngValue]="''">Sin asignar</option>
                        <optgroup *ngFor="let g of vatGroups" [label]="g.name">
                          <option *ngFor="let o of g.items" [ngValue]="o.id">{{ o.code }} · {{ o.name }}{{ o.isActive ? '' : ' (inactiva)' }}</option>
                        </optgroup>
                      </select>
                    </td>
                    <td class="num">
                      <button type="button" class="link" *ngIf="r.canEdit && !vatSelection && r.suggestedVatCreditCategoryId" (click)="vatSelection = r.suggestedVatCreditCategoryId!">
                        Usar {{ optionLabel(r.suggestedVatCreditCategoryId) }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="actions" *ngIf="r.canEdit">
              <button type="button" class="btn" [disabled]="saving || !changedCount" (click)="saveRoles()">
                {{ saving ? 'Guardando...' : (changedCount ? 'Guardar ' + changedCount + ' cambios' : 'Sin cambios') }}
              </button>
              <button type="button" class="btn secondary" [disabled]="saving || !suggestionCount" (click)="applySuggestions()">Usar todas las sugeridas ({{ suggestionCount }})</button>
            </div>
            <p class="muted small">Las sugeridas salen del nombre y el tipo de cada cuenta; no se aplican solas. Se admiten cuentas del plan inactivas (por ejemplo, el IVA crédito fiscal viene sin activar). Cada cambio queda en el historial del Centro de configuración.</p>
          </ng-container>
        </ng-container>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .controls { display: flex; gap: 0.9rem; align-items: flex-end; flex-wrap: wrap; }
    .tabs { display: flex; gap: 0.25rem; border-bottom: 2px solid rgba(19,133,182,0.1); margin: 0.6rem 0 1rem; }
    .tabs button { background: none; border: none; padding: 0.6rem 1.1rem; cursor: pointer; font: inherit; font-size: 0.92rem; font-weight: 600; color: var(--brand-muted); border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tabs button.active { color: #1385B6; border-bottom-color: #1385B6; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e0a23b; margin-left: 0.3rem; }
    .filters { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin: 0.8rem 0; }
    .kpi { display: grid; gap: 0.25rem; padding: 0.9rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.2rem; color: var(--brand-ink); }
    .kpi.bad { border-color: #e0a23b; background: rgba(224,162,59,0.07); }
    .entry { border: 1px solid var(--brand-border); border-radius: 12px; padding: 0.7rem 1rem 0.4rem; margin-bottom: 0.7rem; }
    .entry.incomplete { border-color: #e0a23b; }
    .entry header { margin-bottom: 0.3rem; }
    .entry table.t td, .entry table.t th { padding: 0.3rem 0.5rem; }
    td.indent { padding-left: 2rem !important; }
    tr.missing td { color: #c9473b; }
    tr.inactive td { opacity: 0.7; }
    tr.changed td { background: rgba(224,162,59,0.1); }
    .cell-select { padding: 0.3rem 0.5rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 8px; font: inherit; font-size: 0.9rem; background: var(--surface-ground, #f8fafc); color: var(--brand-ink); min-width: 22rem; max-width: 100%; }
    .link { background: none; border: none; color: #1385B6; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 0; }
    :host ::ng-deep .tag-sm .p-tag, :host ::ng-deep .tag-sm.p-tag { font-size: 0.68rem; padding: 0.1rem 0.45rem; margin-left: 0.5rem; }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } .cell-select { min-width: 12rem; } }
  `]
})
export class FinanceAccountingPageComponent {
  private readonly api = inject(AccountingApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  buildingName = '';
  tab: Tab = 'entries';
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';
  loading = false;

  // Asientos
  entries: AccountingEntries | null = null;
  from = '';
  to = '';
  loadingEntries = false;
  entriesError = '';
  exporting = false;

  // Cuentas del plan
  roles: AccountingRoles | null = null;
  groups: OptionGroup[] = [];
  vatGroups: OptionGroup[] = [];
  selection: Record<string, string> = {};
  original: Record<string, string> = {};
  vatSelection = '';
  vatOriginal = '';
  loadingRoles = false;
  rolesError = '';
  saving = false;

  get changedCount(): number {
    const accounts = this.roles?.accounts.filter(a => this.selection[a.financialAccountId] !== this.original[a.financialAccountId]).length ?? 0;
    return accounts + (this.vatSelection !== this.vatOriginal ? 1 : 0);
  }

  // Cuentas sin asignar que tienen una sugerida.
  get suggestionCount(): number {
    const accounts = this.roles?.accounts.filter(a => !this.selection[a.financialAccountId] && a.suggestedCategoryId).length ?? 0;
    return accounts + (!this.vatSelection && this.roles?.suggestedVatCreditCategoryId ? 1 : 0);
  }

  typeLabel(a: AccountingRoleAccount): string { return ACCOUNT_TYPE_LABELS[a.type] ?? a.type; }

  optionLabel(id: string | null): string {
    const o = this.roles?.options.find(x => x.id === id);
    return o ? `${o.code} ${o.name}` : '';
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.cdr.markForCheck();
  }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.buildingName = building.buildingName;
    this.from = this.to = '';
    this.entries = null;
    this.roles = null;
    this.errorKind = '';
    this.loadEntries();
    this.loadRoles();
  }

  onError(err: unknown): void { this.setBlockingError(err); }

  reloadEntries(): void { this.loadEntries(); }

  applySuggestions(): void {
    for (const a of this.roles?.accounts ?? []) {
      if (!this.selection[a.financialAccountId] && a.suggestedCategoryId) this.selection[a.financialAccountId] = a.suggestedCategoryId;
    }

    if (!this.vatSelection && this.roles?.suggestedVatCreditCategoryId) this.vatSelection = this.roles.suggestedVatCreditCategoryId;
    this.cdr.markForCheck();
  }

  saveRoles(): void {
    if (!this.roles) return;

    const accounts = this.roles.accounts
      .filter(a => this.selection[a.financialAccountId] !== this.original[a.financialAccountId])
      .map(a => ({ financialAccountId: a.financialAccountId, ledgerCategoryId: this.selection[a.financialAccountId] || null }));
    const vatChanged = this.vatSelection !== this.vatOriginal;

    this.saving = true;
    this.api.updateRoles(this.buildingId, { accounts, setVatCredit: vatChanged, vatCreditCategoryId: vatChanged ? this.vatSelection || null : null })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: roles => {
          this.setRoles(roles);
          this.saving = false;
          this.msg.add({ severity: 'success', summary: 'Cuentas del plan guardadas', life: 3500 });
          // Los asientos dependen de estas cuentas: se vuelven a armar.
          this.loadEntries();
          this.cdr.markForCheck();
        },
        error: err => {
          this.saving = false;
          this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudieron guardar las cuentas del plan.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  download(): void {
    if (this.exporting || !this.entries) return;

    this.exporting = true;
    const fileName = exportFileName('asientos', this.buildingName, `${this.entries.from.split('-').join('')}-${this.entries.to.split('-').join('')}`);
    this.api.downloadEntries(this.buildingId, this.entries.from, this.entries.to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
        this.msg.add({ severity: 'success', summary: 'Excel generado', detail: fileName, life: 4000 });
        this.cdr.markForCheck();
      },
      error: async err => {
        const detail = await exportErrorMessage(err, 'No se pudo generar el Excel.');
        this.exporting = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail, life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private loadEntries(): void {
    this.loadingEntries = true;
    this.entriesError = '';
    this.api.getEntries(this.buildingId, this.from || undefined, this.to || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: entries => {
        this.entries = entries;
        // El backend resuelve las fechas por defecto (el mes en curso): se muestran en los filtros.
        this.from = entries.from;
        this.to = entries.to;
        this.loadingEntries = false;
        this.cdr.markForCheck();
      },
      error: err => {
        const { kind, message } = classifyFinanceError(err, 'No se pudieron armar los asientos.');
        this.entries = null;
        this.loadingEntries = false;
        if (kind === 'other') {
          this.entriesError = message;
        } else {
          this.errorKind = kind;
          this.errorMessage = message;
        }
        this.cdr.markForCheck();
      }
    });
  }

  private loadRoles(): void {
    this.loadingRoles = true;
    this.rolesError = '';
    this.api.getRoles(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: roles => {
        this.setRoles(roles);
        this.loadingRoles = false;
        this.cdr.markForCheck();
      },
      error: err => {
        const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar las cuentas del plan.');
        this.roles = null;
        this.loadingRoles = false;
        if (kind === 'other') this.rolesError = message;
        this.cdr.markForCheck();
      }
    });
  }

  private setRoles(roles: AccountingRoles): void {
    this.roles = roles;
    this.selection = {};
    this.original = {};
    for (const a of roles.accounts) {
      this.selection[a.financialAccountId] = a.ledgerCategoryId ?? '';
      this.original[a.financialAccountId] = a.ledgerCategoryId ?? '';
    }

    this.vatSelection = roles.vatCreditCategoryId ?? '';
    this.vatOriginal = roles.vatCreditCategoryId ?? '';
    this.groups = this.group(roles.options);
    // El IVA crédito es una cuenta de activo (no de fondos).
    this.vatGroups = this.group(roles.options.filter(o => o.type === 'Asset'));
  }

  private group(options: AccountingPlanOption[]): OptionGroup[] {
    const map = new Map<string, AccountingPlanOption[]>();
    for (const o of options) {
      const key = o.groupName || 'Otras cuentas';
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }

    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }

  private setBlockingError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar los asientos.');
    this.entries = null;
    this.roles = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}

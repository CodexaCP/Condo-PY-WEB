import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { VatTreatment, VatTreatmentItem, VatTreatments } from '../../api/building-config.models';
import { classifyFinanceError } from './finance-format';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

interface Row extends VatTreatmentItem {
  original: VatTreatment | null;
}

export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  Vat10: 'IVA 10 %',
  Vat5: 'IVA 5 %',
  Exempt: 'Exento',
  NotApplicable: 'No corresponde'
};

const REGIME_LABELS: Record<string, string> = { General: 'General', Resimple: 'Resimple', Exempt: 'Exento' };

// Impuestos (IVA de las compras): qué tratamiento de IVA tiene cada cuenta de egresos. Con régimen general es obligatorio clasificar todas las
// cuentas; cada gasto toma la tasa de su cuenta (se puede cambiar en el propio gasto) y alimenta el libro de compras. Las facturas que emite el
// edificio siguen siendo exentas.
@Component({
  standalone: true,
  selector: 'app-config-taxes-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Message],
  template: `
    <h2>Impuestos (IVA de las compras)</h2>
    <p class="muted small">
      Cada gasto toma la tasa de IVA de su cuenta y alimenta el libro de compras. El IVA va incluido en el monto de la factura
      (10 % = monto ÷ 11; 5 % = monto ÷ 21).
    </p>

    <p-message *ngIf="error" [severity]="errorKind === 'blocked' ? 'warn' : 'error'" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando...</p>

    <ng-container *ngIf="data as d">
      <p-message *ngIf="!d.financeAvailable" severity="info"
                 text="Las cuentas de egresos son parte del módulo Finanzas del edificio, que no está disponible en este edificio."></p-message>

      <ng-container *ngIf="d.financeAvailable">
        <div class="notice" [class.info]="!d.applies">
          Régimen de IVA del edificio: <strong>{{ d.buildingVatRegime ? regime(d.buildingVatRegime) : 'sin definir' }}</strong>.
          <ng-container *ngIf="d.applies">Con régimen general hay que clasificar todas las cuentas: <strong>{{ d.definedCount }} de {{ d.totalCount }}</strong> clasificadas.</ng-container>
          <ng-container *ngIf="!d.applies">No es obligatorio clasificar las cuentas.</ng-container>
          El régimen se cambia en la <a [routerLink]="['/buildings', d.buildingId]" [queryParams]="{ tab: 'billing' }">ficha del edificio</a>.
        </div>

        <div class="tools" *ngIf="d.canEdit && rows.length">
          <label class="check"><input type="checkbox" [(ngModel)]="onlyUndefined" /> Mostrar solo las sin definir</label>
          <span class="bulk">
            Las sin definir:
            <select [(ngModel)]="bulk">
              <option *ngFor="let t of choices" [ngValue]="t">{{ label(t) }}</option>
            </select>
            <button type="button" class="btn sm secondary" (click)="applyBulk()">Aplicar a las visibles</button>
          </span>
        </div>

        <div class="table-wrap" *ngIf="visible.length">
          <table class="t">
            <thead><tr><th>Cuenta</th><th>Grupo</th><th>Tratamiento de IVA</th></tr></thead>
            <tbody>
              <tr *ngFor="let r of visible" [class.changed]="r.treatment !== r.original" [class.inactive]="!r.isActive">
                <td class="nowrap"><strong>{{ r.code }}</strong> {{ r.name }} <span class="muted small" *ngIf="!r.isActive">(inactiva)</span></td>
                <td class="muted">{{ r.groupName }}</td>
                <td>
                  <select [(ngModel)]="r.treatment" [disabled]="!d.canEdit" class="cell-select">
                    <option [ngValue]="null">Sin definir</option>
                    <option *ngFor="let t of choices" [ngValue]="t">{{ label(t) }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted" *ngIf="!visible.length">{{ rows.length ? 'No hay cuentas sin definir.' : 'El edificio no tiene cuentas finales de egresos.' }}</p>

        <div class="actions" *ngIf="d.canEdit && rows.length">
          <button type="button" class="btn" [disabled]="saving || !changedCount" (click)="save()">
            {{ saving ? 'Guardando...' : (changedCount ? 'Guardar ' + changedCount + ' cambios' : 'Sin cambios') }}
          </button>
        </div>
        <p class="muted small" *ngIf="!d.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden cambiar el tratamiento de IVA.</p>
      </ng-container>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .tools { display: flex; gap: 1.2rem; flex-wrap: wrap; align-items: center; margin: 0.8rem 0; }
    .bulk { display: inline-flex; gap: 0.5rem; align-items: center; font-size: 0.88rem; color: var(--brand-muted); }
    .cell-select { padding: 0.3rem 0.5rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 8px; font: inherit; font-size: 0.9rem; background: var(--surface-ground, #f8fafc); color: var(--brand-ink); }
    tr.changed td { background: rgba(224,162,59,0.1); }
    tr.inactive td { opacity: 0.7; }
  `]
})
export class ConfigTaxesSectionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';

  readonly choices: VatTreatment[] = ['Vat10', 'Vat5', 'Exempt', 'NotApplicable'];

  data: VatTreatments | null = null;
  rows: Row[] = [];
  onlyUndefined = false;
  bulk: VatTreatment = 'Vat10';
  loading = false;
  saving = false;
  error = '';
  errorKind = '';

  label(t: VatTreatment): string { return VAT_TREATMENT_LABELS[t]; }
  regime(r: string): string { return REGIME_LABELS[r] ?? r; }

  get visible(): Row[] {
    return this.onlyUndefined ? this.rows.filter(r => r.treatment === null) : this.rows;
  }

  get changedCount(): number {
    return this.rows.filter(r => r.treatment !== r.original).length;
  }

  ngOnChanges(): void {
    this.load();
  }

  // Asigna el tratamiento elegido a las cuentas visibles que siguen sin definir.
  applyBulk(): void {
    let count = 0;
    for (const r of this.visible) {
      if (r.treatment === null) {
        r.treatment = this.bulk;
        count++;
      }
    }

    if (!count) this.msg.add({ severity: 'info', summary: 'No hay cuentas sin definir entre las visibles.', life: 3500 });
    this.cdr.markForCheck();
  }

  save(): void {
    const items = this.rows.filter(r => r.treatment !== r.original).map(r => ({ categoryId: r.categoryId, treatment: r.treatment }));
    if (!items.length) return;

    this.saving = true;
    this.api.updateVatTreatments(this.buildingId, items).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.apply(data);
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Tratamiento de IVA guardado', detail: `${items.length} cuentas actualizadas.`, life: 3500 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudo guardar el tratamiento de IVA.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private apply(data: VatTreatments): void {
    this.data = data;
    this.rows = data.items.map(i => ({ ...i, original: i.treatment }));
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.errorKind = '';
    this.api.getVatTreatments(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.apply(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el tratamiento de IVA.');
        this.data = null;
        this.loading = false;
        this.errorKind = kind;
        this.error = message;
        this.cdr.markForCheck();
      }
    });
  }
}

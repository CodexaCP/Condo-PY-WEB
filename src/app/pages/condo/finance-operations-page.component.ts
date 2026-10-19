import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceOperationsApiService } from '../../api/finance-operations-api.service';
import {
  CreateFinanceTransferRequest, FinanceTransfer, FinanceTransferAccount, FinanceTransferPreview, FinanceTransfers
} from '../../api/finance-operations.models';
import { FinanceBuildingAccess } from '../../api/models';
import { CONFIG_SECTION_STYLES } from './config-section.styles';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, todayParaguay } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';
import { JournalImpactNoticeComponent } from './journal-impact-notice.component';

type Preset = 'generic' | 'deposit' | 'withdraw' | 'fund';

interface Tile {
  preset: Preset;
  title: string;
  text: string;
}

const TILES: Tile[] = [
  { preset: 'generic', title: 'Mover plata entre cuentas', text: 'De un banco a otro, o de cualquier cuenta a otra.' },
  { preset: 'deposit', title: 'Depositar efectivo en el banco', text: 'Pasa el efectivo de la caja a una cuenta bancaria.' },
  { preset: 'withdraw', title: 'Retirar efectivo del banco', text: 'Pasa plata de una cuenta bancaria a la caja.' },
  { preset: 'fund', title: 'Aporte o retiro del fondo de reserva', text: 'Pide el número de acta o resolución de la asamblea.' }
];

// Operaciones guiadas de Finanzas: mover plata entre las cuentas del edificio (banco, caja, fondo de reserva). No es un ingreso ni un gasto: el
// total del edificio no cambia, y por eso no figura en el flujo, el presupuesto ni el informe de resultados. Mueve el saldo de cada cuenta, figura
// en la conciliación bancaria y genera su asiento en el Libro diario. No se edita: se anula con motivo (y el Libro diario la corrige con un
// contraasiento). La cargan y anulan solo el SuperAdmin y el Administrador de empresa; los demás roles la consultan.
@Component({
  standalone: true,
  selector: 'app-finance-operations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Card, Message, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent, JournalImpactNoticeComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Operaciones</h1>
            <p>Mové plata entre las cuentas del edificio. El sistema actualiza los saldos, la conciliación y el Libro diario juntos.</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
      </div>

      <app-finance-state [loading]="loading && !data" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="data as d">
        <div class="notice info">
          Mover plata entre tus propias cuentas <strong>no es un ingreso ni un gasto</strong>: el total del edificio no cambia. Por eso no aparece en el
          flujo de caja, el presupuesto ni el informe para la asamblea; sí en los saldos de cada cuenta, la conciliación bancaria y el Libro diario.
        </div>
        <p class="muted small" *ngIf="!d.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden cargar y anular operaciones. Acá podés consultarlas.</p>

        <h3>Saldo de cada cuenta</h3>
        <div class="kpis">
          <div class="kpi" *ngFor="let a of d.accounts" [class.inactive]="!a.isActive">
            <span>{{ typeLabel(a) }} · {{ a.name }}<ng-container *ngIf="!a.isActive"> (inactiva)</ng-container></span>
            <strong [class.neg]="a.balance < 0">{{ a.balance | gs }}</strong>
          </div>
          <div class="kpi main">
            <span>Total del edificio</span>
            <strong>{{ d.totalBalance | gs }}</strong>
          </div>
        </div>

        <ng-container *ngIf="d.canEdit">
          <h3>¿Qué querés hacer?</h3>
          <div class="tiles">
            <button type="button" class="tile" *ngFor="let t of tiles" [disabled]="!available(t.preset)" [class.on]="preset === t.preset && mode !== ''"
                    (click)="start(t.preset)">
              <strong>{{ t.title }}</strong>
              <span>{{ available(t.preset) ? t.text : unavailableReason(t.preset) }}</span>
            </button>
          </div>

          <form class="panel" *ngIf="mode === 'form'" (ngSubmit)="review()">
            <h3 class="panel-title">{{ currentTile?.title }}</h3>
            <div class="form">
              <label class="field"><span>Desde *</span>
                <select name="from" [ngModel]="fromId" (ngModelChange)="fromId = $event; preview = null" required>
                  <option value="" disabled>Elegí la cuenta de origen</option>
                  <option *ngFor="let a of fromOptions" [value]="a.id">{{ typeLabel(a) }} · {{ a.name }} ({{ a.balance | gs }})</option>
                </select>
              </label>
              <label class="field"><span>Hacia *</span>
                <select name="to" [ngModel]="toId" (ngModelChange)="toId = $event; preview = null" required>
                  <option value="" disabled>Elegí la cuenta de destino</option>
                  <option *ngFor="let a of toOptions" [value]="a.id">{{ typeLabel(a) }} · {{ a.name }} ({{ a.balance | gs }})</option>
                </select>
              </label>
              <label class="field"><span>Importe (Gs.) *</span>
                <input type="number" name="amount" min="1" step="1" [(ngModel)]="amount" required />
              </label>
              <label class="field"><span>Fecha *</span>
                <input type="date" name="date" [(ngModel)]="date" [max]="today" [min]="d.financeStartDate" required />
              </label>
              <label class="field"><span>Referencia</span>
                <input type="text" name="reference" maxlength="100" [(ngModel)]="reference" placeholder="N° de boleta de depósito, de transferencia..." />
              </label>
              <label class="field"><span>Nota</span>
                <input type="text" name="notes" maxlength="500" [(ngModel)]="notes" />
              </label>
              <label class="field wide" *ngIf="requiresSupport">
                <span>Respaldo: acta o resolución de la asamblea *</span>
                <input type="text" name="support" maxlength="500" [(ngModel)]="support" placeholder="Ej: Acta N° 12/2026 del 05/10/2026" required />
                <span class="hint">Todo movimiento del fondo de reserva exige respaldo. Queda registrado con la operación.</span>
              </label>
            </div>
            <p-message *ngIf="formError" severity="error" [text]="formError"></p-message>
            <div class="actions">
              <button type="submit" class="btn" [disabled]="busy">{{ busy ? 'Revisando...' : 'Revisar' }}</button>
              <button type="button" class="btn secondary" (click)="swap()" [disabled]="busy || !fromId || !toId">Invertir sentido</button>
              <button type="button" class="btn secondary" (click)="cancel()" [disabled]="busy">Cancelar</button>
            </div>
          </form>

          <div class="panel" *ngIf="mode === 'review' && preview as p">
            <h3 class="panel-title">Revisá antes de confirmar</h3>
            <p><strong>{{ p.kind }}</strong> de <strong>{{ amount | gs }}</strong> el {{ date | date: 'dd/MM/yyyy' }}</p>
            <div class="table-wrap">
              <table class="t">
                <thead><tr><th>Cuenta</th><th class="num">Saldo hoy</th><th class="num">Saldo después</th></tr></thead>
                <tbody>
                  <tr><td>{{ p.fromAccountName }} <span class="muted small">(sale)</span></td><td class="num">{{ p.fromBefore | gs }}</td>
                    <td class="num" [class.neg]="p.fromAfter < 0"><strong>{{ p.fromAfter | gs }}</strong></td></tr>
                  <tr><td>{{ p.toAccountName }} <span class="muted small">(entra)</span></td><td class="num">{{ p.toBefore | gs }}</td>
                    <td class="num"><strong>{{ p.toAfter | gs }}</strong></td></tr>
                </tbody>
              </table>
            </div>
            <p class="muted small">El total del edificio no cambia: {{ p.totalBalance | gs }}.</p>
            <p class="small">
              <strong>Asiento del Libro diario:</strong>
              <ng-container *ngIf="p.debitAccount && p.creditAccount; else noEntry">
                Debe {{ p.debitAccount }} · Haber {{ p.creditAccount }}
              </ng-container>
              <ng-template #noEntry><span class="muted">no se puede armar todavía (falta asignar la cuenta del plan, ver el aviso).</span></ng-template>
            </p>
            <div class="notice" *ngFor="let w of p.warnings">{{ w }}</div>
            <label class="check" *ngIf="p.needsNegativeConfirmation">
              <input type="checkbox" [(ngModel)]="confirmNegative" name="confirmNegative" />
              Entiendo que «{{ p.fromAccountName }}» queda con saldo negativo y quiero registrarla igual.
            </label>
            <p-message *ngIf="formError" severity="error" [text]="formError"></p-message>
            <div class="actions">
              <button type="button" class="btn" (click)="confirm()" [disabled]="busy || (p.needsNegativeConfirmation && !confirmNegative)">
                {{ busy ? 'Registrando...' : 'Confirmar y registrar' }}
              </button>
              <button type="button" class="btn secondary" (click)="back()" [disabled]="busy">Volver</button>
            </div>
          </div>
        </ng-container>

        <h3>Historial</h3>
        <p class="muted small" *ngIf="!d.items.length">Todavía no hay operaciones cargadas.</p>
        <div class="table-wrap" *ngIf="d.items.length">
          <table class="t">
            <thead>
              <tr><th>Fecha</th><th>Operación</th><th>Desde → Hacia</th><th class="num">Importe</th><th>Referencia</th><th>Asiento</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let t of d.items">
                <tr [class.voided]="t.status === 'Voided'">
                  <td class="nowrap">{{ t.transferDate | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ t.kind }}
                    <small class="muted" *ngIf="t.notes"><br />{{ t.notes }}</small>
                    <small class="muted" *ngIf="t.supportReference"><br />Respaldo: {{ t.supportReference }}</small>
                  </td>
                  <td>{{ t.fromAccountName }} → {{ t.toAccountName }}</td>
                  <td class="num">{{ t.amount | gs }}</td>
                  <td>{{ t.reference || '—' }}</td>
                  <td>
                    <ng-container *ngIf="t.journalLabels.length; else noJournal">{{ t.journalLabels.join(', ') }}</ng-container>
                    <ng-template #noJournal><span class="muted">{{ t.status === 'Voided' ? '—' : 'Sin asentar' }}</span></ng-template>
                    <small class="warn" *ngIf="t.status === 'Voided' && t.journalLabels.length"><br />Falta asentar el Libro diario para generar el contraasiento.</small>
                  </td>
                  <td>
                    <p-tag *ngIf="t.status === 'Active'" value="Vigente" severity="success"></p-tag>
                    <p-tag *ngIf="t.status === 'Voided'" value="Anulada" severity="danger"></p-tag>
                    <small class="muted"><br />{{ t.createdByName }} · {{ t.createdAtUtc | date: 'dd/MM/yyyy HH:mm' }}</small>
                    <small class="muted" *ngIf="t.status === 'Voided'"><br />Anulada por {{ t.voidedByName }} · {{ t.voidedAtUtc | date: 'dd/MM/yyyy HH:mm' }}<br />Motivo: {{ t.voidReason }}</small>
                  </td>
                  <td class="num">
                    <button type="button" class="btn sm danger" *ngIf="d.canEdit && t.status === 'Active'" (click)="startVoid(t)">Anular</button>
                  </td>
                </tr>
                <tr *ngIf="voidingId === t.id">
                  <td colspan="8">
                    <div class="void-box">
                      <app-journal-impact-notice kind="transfer" [transferId]="t.id"></app-journal-impact-notice>
                      <label class="field"><span>Motivo de la anulación *</span>
                        <input type="text" name="voidReason" maxlength="500" [(ngModel)]="voidReason" placeholder="Ej: Se cargó mal el importe" />
                      </label>
                      <p-message *ngIf="voidError" severity="error" [text]="voidError"></p-message>
                      <div class="actions">
                        <button type="button" class="btn sm danger" (click)="confirmVoid(t)" [disabled]="busy || voidReason.trim().length < 5">{{ busy ? 'Anulando...' : 'Anular la operación' }}</button>
                        <button type="button" class="btn sm secondary" (click)="voidingId = ''" [disabled]="busy">Cancelar</button>
                      </div>
                    </div>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
        <p class="muted small">
          Las operaciones se asientan en el <a class="link" [routerLink]="['/finance/accounting']" [queryParams]="{ buildingId: buildingId }">Libro diario</a>
          cuando se asienta el período{{ d.postedThrough ? ' (asentado hasta el ' + (d.postedThrough | date: 'dd/MM/yyyy') + ')' : '' }}.
          Una operación anulada se corrige con un contraasiento; nunca se borra.
        </p>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .link { color: #1385B6; font-weight: 600; text-decoration: none; }
    .warn { color: #b9741c; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; }
    .kpi { display: grid; gap: 0.3rem; padding: 0.9rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.25rem; color: var(--brand-ink); }
    .kpi.main { background: var(--brand-gradient-soft); border-color: transparent; }
    .kpi.inactive { opacity: 0.65; }
    .kpi .neg, .neg { color: #c9473b; }
    .tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; }
    .tile {
      display: grid; gap: 0.35rem; text-align: left; padding: 1rem 1.1rem; border-radius: 14px; cursor: pointer; font: inherit;
      background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); color: var(--brand-ink);
    }
    .tile strong { font-size: 0.98rem; }
    .tile span { font-size: 0.84rem; color: var(--brand-muted); }
    .tile:hover:not(:disabled), .tile.on { border-color: #1385B6; box-shadow: 0 0 0 2px rgba(19,133,182,0.15); }
    .tile:disabled { opacity: 0.55; cursor: not-allowed; }
    .panel { margin: 1rem 0; padding: 0.2rem 1.2rem 1rem; border: 1px solid var(--brand-border); border-radius: 14px; background: var(--p-content-background, #fff); }
    .panel-title { margin-top: 1rem; }
    tr.voided td { opacity: 0.7; }
    tr.voided td:last-child { opacity: 1; }
    .void-box { padding: 0.4rem 0; display: grid; gap: 0.5rem; max-width: 46rem; }
    :host ::ng-deep .p-tag { font-size: 0.72rem; }
    @media (max-width: 1000px) { .kpis, .tiles { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .kpis, .tiles { grid-template-columns: 1fr; } }
  `]
})
export class FinanceOperationsPageComponent {
  private readonly api = inject(FinanceOperationsApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly tiles = TILES;
  readonly today = todayParaguay();

  buildingId = '';
  data: FinanceTransfers | null = null;
  loading = false;
  busy = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  // Formulario: '' = cerrado, 'form' = cargando los datos, 'review' = resumen previo a confirmar.
  mode: '' | 'form' | 'review' = '';
  preset: Preset = 'generic';
  fromId = '';
  toId = '';
  amount: number | null = null;
  date = todayParaguay();
  reference = '';
  notes = '';
  support = '';
  confirmNegative = false;
  preview: FinanceTransferPreview | null = null;
  formError = '';

  // Anulación.
  voidingId = '';
  voidReason = '';
  voidError = '';

  get currentTile(): Tile | undefined { return this.tiles.find(t => t.preset === this.preset); }

  get activeAccounts(): FinanceTransferAccount[] { return (this.data?.accounts ?? []).filter(a => a.isActive); }

  get fromOptions(): FinanceTransferAccount[] { return this.activeAccounts.filter(a => a.id !== this.toId); }

  get toOptions(): FinanceTransferAccount[] { return this.activeAccounts.filter(a => a.id !== this.fromId); }

  get requiresSupport(): boolean {
    const types = [this.fromId, this.toId].map(id => this.data?.accounts.find(a => a.id === id)?.type);
    return types.includes('ReserveFund');
  }

  typeLabel(a: FinanceTransferAccount): string {
    return a.type === 'Cash' ? 'Caja' : a.type === 'Bank' ? 'Banco' : 'Fondo de reserva';
  }

  private first(type: FinanceTransferAccount['type']): FinanceTransferAccount | undefined {
    return this.activeAccounts.find(a => a.type === type);
  }

  available(preset: Preset): boolean {
    if (this.activeAccounts.length < 2) return false;
    switch (preset) {
      case 'deposit':
      case 'withdraw': return !!this.first('Cash') && !!this.first('Bank');
      case 'fund': return !!this.first('ReserveFund') && this.activeAccounts.length >= 2;
      default: return true;
    }
  }

  unavailableReason(preset: Preset): string {
    if (this.activeAccounts.length < 2) return 'Hacen falta al menos dos cuentas activas (Finanzas → Configuración → Cuentas).';
    return preset === 'fund' ? 'El edificio no tiene una cuenta de fondo de reserva activa.' : 'Necesitás una cuenta de caja y una bancaria activas.';
  }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.cancel();
    this.voidingId = '';
    this.load();
  }

  onError(err: unknown): void { this.setError(err); }

  start(preset: Preset): void {
    this.preset = preset;
    this.mode = 'form';
    this.preview = null;
    this.formError = '';
    this.amount = null;
    this.date = this.today;
    this.reference = '';
    this.notes = '';
    this.support = '';
    this.confirmNegative = false;
    this.voidingId = '';

    const cash = this.first('Cash');
    const bank = this.first('Bank');
    const fund = this.first('ReserveFund');
    const pair: [FinanceTransferAccount | undefined, FinanceTransferAccount | undefined] =
      preset === 'deposit' ? [cash, bank]
        : preset === 'withdraw' ? [bank, cash]
          : preset === 'fund' ? [bank ?? cash, fund]
            : [undefined, undefined];
    this.fromId = pair[0]?.id ?? '';
    this.toId = pair[1]?.id ?? '';
  }

  swap(): void {
    [this.fromId, this.toId] = [this.toId, this.fromId];
    this.preview = null;
  }

  cancel(): void {
    this.mode = '';
    this.preview = null;
    this.formError = '';
    this.cdr.markForCheck();
  }

  back(): void {
    this.mode = 'form';
    this.formError = '';
    this.confirmNegative = false;
  }

  private request(): CreateFinanceTransferRequest {
    return {
      fromAccountId: this.fromId,
      toAccountId: this.toId,
      amount: Number(this.amount),
      transferDate: this.date || null,
      reference: this.reference.trim() || null,
      notes: this.notes.trim() || null,
      supportReference: this.support.trim() || null,
      confirmNegativeBalance: this.confirmNegative
    };
  }

  review(): void {
    this.formError = '';
    if (!this.fromId || !this.toId || !this.amount || this.amount <= 0 || !this.date) {
      this.formError = 'Elegí las dos cuentas e indicá el importe y la fecha.';
      return;
    }

    if (this.requiresSupport && !this.support.trim()) {
      this.formError = 'Un movimiento del fondo de reserva exige el respaldo: número de acta o resolución de la asamblea.';
      return;
    }

    this.busy = true;
    this.api.previewTransfer(this.buildingId, this.request()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: preview => {
        this.busy = false;
        this.preview = preview;
        this.confirmNegative = false;
        this.mode = 'review';
        this.cdr.markForCheck();
      },
      error: err => {
        this.busy = false;
        this.formError = extractApiErrorMessage(err, 'No se pudo revisar la operación.');
        this.cdr.markForCheck();
      }
    });
  }

  confirm(): void {
    this.formError = '';
    this.busy = true;
    this.api.createTransfer(this.buildingId, this.request()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: created => {
        this.busy = false;
        this.msg.add({ severity: 'success', summary: 'Operación registrada', detail: `${created.kind} de ${created.amount.toLocaleString('es-PY')} Gs.`, life: 5000 });
        this.cancel();
        this.load();
      },
      error: err => {
        this.busy = false;
        this.formError = extractApiErrorMessage(err, 'No se pudo registrar la operación.');
        this.cdr.markForCheck();
      }
    });
  }

  startVoid(t: FinanceTransfer): void {
    this.voidingId = t.id;
    this.voidReason = '';
    this.voidError = '';
    this.mode = '';
  }

  confirmVoid(t: FinanceTransfer): void {
    this.voidError = '';
    this.busy = true;
    this.api.voidTransfer(this.buildingId, t.id, this.voidReason.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy = false;
        this.voidingId = '';
        this.msg.add({ severity: 'success', summary: 'Operación anulada', detail: 'Los saldos volvieron a lo que eran antes.', life: 5000 });
        this.load();
      },
      error: err => {
        this.busy = false;
        this.voidError = extractApiErrorMessage(err, 'No se pudo anular la operación.');
        this.cdr.markForCheck();
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.errorKind = '';
    this.api.listTransfers(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar las operaciones.');
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}

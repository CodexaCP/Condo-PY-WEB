import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpensesApiService } from '../../api/building-expenses-api.service';
import { SupplierAccountsSummary, SupplierReceivable } from '../../api/models';
import { SupplierAccountsApiService } from '../../api/supplier-accounts-api.service';
import { GsPipe, todayParaguay } from './finance-format';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

type ReceivableFilter = 'pending' | 'recovered' | 'all';

// Parte «por cobrar» de la pantalla de cuentas por pagar y por cobrar. Dos vistas del mismo edificio:
//  - receivables: las notas de crédito del proveedor sobre gastos ya pagados (devolución de dinero o descuento en su próxima factura), donde
//    se marca la devolución o se registra el descuento que el proveedor ya aplicó.
//  - summary: por proveedor, lo que se le debe, lo que debe y el saldo neto.
@Component({
  standalone: true,
  selector: 'app-supplier-accounts-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Tag, GsPipe],
  template: `
    <!-- Resumen por proveedor -->
    <ng-container *ngIf="view === 'summary'">
      <p class="muted" *ngIf="loaded && !summary?.suppliers?.length">Todavía no hay facturas por pagar ni notas de crédito por cobrar en este edificio.</p>

      <div class="table-wrap" *ngIf="summary?.suppliers?.length">
        <table class="t">
          <thead>
            <tr><th>Proveedor</th><th class="num">Por pagar</th><th class="num">Vencido</th><th class="num">Devolución pendiente</th><th class="num">Descuento pendiente</th><th class="num">Por cobrar</th><th class="num">Saldo neto</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of summary!.suppliers" class="clickable" [class.sel]="supplierName === r.supplierName" (click)="supplierPicked.emit(r.supplierName)">
              <td><strong>{{ r.supplierName || '—' }}</strong></td>
              <td class="num">{{ r.payableTotal | gs }}</td>
              <td class="num"><span [class.neg]="r.payableOverdueTotal > 0">{{ r.payableOverdueTotal | gs }}</span></td>
              <td class="num">{{ r.pendingRefundTotal | gs }}</td>
              <td class="num">{{ r.pendingDiscountTotal | gs }}</td>
              <td class="num"><strong>{{ r.receivableTotal | gs }}</strong></td>
              <td class="num"><strong [class.neg]="r.netBalance < 0">{{ r.netBalance | gs }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small" *ngIf="summary?.suppliers?.length">Saldo neto = por pagar − por cobrar. Tocá un proveedor para ver solo lo suyo en las demás solapas.</p>
    </ng-container>

    <!-- Notas de crédito por cobrar -->
    <ng-container *ngIf="view === 'receivables'">
      <div class="filters">
        <label class="field"><span>Mostrar</span>
          <select [(ngModel)]="filter" (ngModelChange)="load()">
            <option value="pending">Pendientes</option>
            <option value="recovered">Ya recuperadas</option>
            <option value="all">Todas</option>
          </select>
        </label>
      </div>

      <p class="muted" *ngIf="loaded && !receivables.length">No hay notas de crédito por cobrar con esos filtros. Aparecen cuando se registra una nota de crédito de un proveedor sobre un gasto que ya se pagó.</p>

      <div class="table-wrap" *ngIf="receivables.length">
        <table class="t">
          <thead><tr><th>Nota</th><th>Proveedor</th><th>Gasto</th><th>Cómo se recupera</th><th class="num">Importe</th><th class="num">Falta</th><th></th></tr></thead>
          <tbody>
            <ng-container *ngFor="let r of receivables">
              <tr>
                <td class="nowrap">NC {{ r.numero }}<div class="muted small">{{ r.issueDate | date: 'dd/MM/yyyy' }}</div></td>
                <td>{{ r.supplierName }}</td>
                <td>{{ r.expenseDescription }}<div class="muted small">{{ r.expensePeriodName }}</div></td>
                <td>
                  <p-tag [value]="r.recoveryType === 'Refund' ? 'Devolución de dinero' : 'Descuento en próxima factura'" severity="info"></p-tag>
                  <div class="muted small" *ngIf="r.recoveryStatus === 'Recovered' && r.refundedOn">Devuelto el {{ r.refundedOn | date: 'dd/MM/yyyy' }}<span *ngIf="r.refundReference"> · {{ r.refundReference }}</span></div>
                  <div class="muted small" *ngIf="r.discountApplied > 0">Ya descontado: {{ r.discountApplied | gs }}</div>
                </td>
                <td class="num">{{ r.amount | gs }}</td>
                <td class="num">
                  <strong>{{ r.pendingAmount | gs }}</strong>
                  <div class="small" [class.neg]="r.daysPending > 30" *ngIf="r.pendingAmount > 0">hace {{ r.daysPending }} {{ r.daysPending === 1 ? 'día' : 'días' }}</div>
                  <p-tag *ngIf="r.recoveryStatus === 'Recovered'" value="Recuperada" severity="success"></p-tag>
                </td>
                <td class="num">
                  <button type="button" class="btn sm" *ngIf="r.recoveryStatus === 'Pending' && r.recoveryType === 'Refund'" [disabled]="busy" (click)="startRefund(r)">Marcar devuelto</button>
                  <button type="button" class="btn sm" *ngIf="r.recoveryStatus === 'Pending' && r.recoveryType === 'NextInvoiceDiscount'" [disabled]="busy" (click)="startDiscount(r)">Registrar descuento</button>
                </td>
              </tr>
              <tr *ngIf="acting?.id === r.creditNoteId">
                <td colspan="7">
                  <div class="act-box" *ngIf="acting?.kind === 'refund'">
                    <label class="field"><span>Fecha en que devolvió</span><input type="date" [(ngModel)]="actDate" [min]="r.issueDate" [max]="today" /></label>
                    <label class="field"><span>Referencia (opcional)</span><input type="text" maxlength="200" [(ngModel)]="actText" placeholder="Transferencia, cheque..." /></label>
                    <div class="actions">
                      <button type="button" class="btn sm" [disabled]="busy || !actDate" (click)="confirmRefund(r)">Confirmar devolución de {{ r.pendingAmount | gs }}</button>
                      <button type="button" class="btn sm secondary" (click)="acting = null">Cancelar</button>
                    </div>
                  </div>
                  <div class="act-box" *ngIf="acting?.kind === 'discount'">
                    <label class="field"><span>Monto descontado (₲)</span><input type="number" min="1" [max]="r.pendingAmount" step="1" [(ngModel)]="actAmount" /></label>
                    <label class="field"><span>Fecha de la factura</span><input type="date" [(ngModel)]="actDate" [min]="r.issueDate" [max]="today" /></label>
                    <label class="field"><span>Factura donde vino (opcional)</span><input type="text" maxlength="500" [(ngModel)]="actText" placeholder="N° de factura" /></label>
                    <div class="actions">
                      <button type="button" class="btn sm" [disabled]="busy || !actDate || !actAmount || actAmount <= 0 || actAmount > r.pendingAmount" (click)="confirmDiscount(r)">Registrar descuento</button>
                      <button type="button" class="btn sm secondary" (click)="acting = null">Cancelar</button>
                    </div>
                  </div>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .filters { display: flex; gap: 0.8rem; flex-wrap: wrap; margin: 0.4rem 0 1rem; }
    .filters .field input, .filters .field select { padding: 0.5rem 0.75rem; }
    .clickable { cursor: pointer; }
    .clickable:hover td, .sel td { background: var(--brand-gradient-soft); }
    .act-box { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; padding: 0.4rem 0; }
    .act-box .field { min-width: 12rem; }
    .act-box .actions { margin: 0; }
  `]
})
export class SupplierAccountsPanelComponent implements OnChanges {
  private readonly api = inject(SupplierAccountsApiService);
  private readonly expensesApi = inject(BuildingExpensesApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';
  @Input() view: 'receivables' | 'summary' = 'receivables';
  // Filtro de proveedor de toda la pantalla (nombre); vacío = todos.
  @Input() supplierName = '';
  // Se registró una devolución o un descuento: la pantalla recarga sus totales.
  @Output() changed = new EventEmitter<void>();
  // Se tocó un proveedor del resumen: la pantalla lo toma como filtro.
  @Output() supplierPicked = new EventEmitter<string>();
  @Output() failed = new EventEmitter<unknown>();

  readonly today = todayParaguay();

  summary: SupplierAccountsSummary | null = null;
  receivables: SupplierReceivable[] = [];
  filter: ReceivableFilter = 'pending';
  loaded = false;
  busy = false;

  // Devolución o descuento que se está cargando (una fila a la vez).
  acting: { id: string; kind: 'refund' | 'discount' } | null = null;
  actDate = '';
  actText = '';
  actAmount: number | null = null;

  ngOnChanges(): void {
    this.acting = null;
    this.load();
  }

  load(): void {
    if (!this.buildingId) return;
    this.loaded = false;
    if (this.view === 'summary') {
      this.api.getSummary(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: summary => { this.summary = summary; this.loaded = true; this.cdr.markForCheck(); },
        error: err => this.failed.emit(err)
      });
      return;
    }

    this.api.getReceivables(this.buildingId, this.filter, this.supplierName || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { this.receivables = rows; this.loaded = true; this.cdr.markForCheck(); },
      error: err => this.failed.emit(err)
    });
  }

  startRefund(r: SupplierReceivable): void {
    this.acting = { id: r.creditNoteId, kind: 'refund' };
    this.actDate = this.today;
    this.actText = '';
  }

  startDiscount(r: SupplierReceivable): void {
    this.acting = { id: r.creditNoteId, kind: 'discount' };
    this.actDate = this.today;
    this.actText = '';
    this.actAmount = r.pendingAmount;
  }

  confirmRefund(r: SupplierReceivable): void {
    this.run(
      this.expensesApi.markCreditNoteRefunded(r.creditNoteId, { refundedOn: this.actDate, reference: this.actText.trim() || null }),
      'Devolución registrada.');
  }

  confirmDiscount(r: SupplierReceivable): void {
    if (!this.actAmount) return;
    this.run(
      this.expensesApi.addCreditNoteDiscount(r.creditNoteId, { amount: Number(this.actAmount), appliedOn: this.actDate, note: this.actText.trim() || null }),
      'Descuento registrado.');
  }

  private run(call: ReturnType<BuildingExpensesApiService['markCreditNoteRefunded']>, success: string): void {
    this.busy = true;
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy = false;
        this.acting = null;
        this.msg.add({ severity: 'success', summary: success, life: 3500 });
        this.load();
        this.changed.emit();
      },
      error: err => {
        this.busy = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo', detail: extractApiErrorMessage(err, 'No se pudo completar la operación.'), life: 8000 });
        this.cdr.markForCheck();
      }
    });
  }
}

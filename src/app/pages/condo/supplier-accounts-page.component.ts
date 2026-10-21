import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpensesApiService } from '../../api/building-expenses-api.service';
import { FinanceBuildingAccess, SupplierAccountsSummary, SupplierReceivable } from '../../api/models';
import { SupplierAccountsApiService } from '../../api/supplier-accounts-api.service';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, todayParaguay } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

type ReceivableFilter = 'pending' | 'recovered' | 'all';

// Cuentas por pagar y por cobrar por proveedor. «Por pagar» son sus facturas con vencimiento sin pagar; «por cobrar» es lo que el proveedor le
// debe al edificio por notas de crédito de gastos ya pagados: dinero por devolver o descuento acordado en su próxima factura. Acá se marca
// la devolución o se registra el descuento que el proveedor ya aplicó, y se ve qué falta para que nadie lo olvide.
@Component({
  standalone: true,
  selector: 'app-supplier-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Card, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Cuentas por proveedor</h1>
            <p>Lo que el edificio le debe a cada proveedor y lo que cada proveedor le debe al edificio (devoluciones y descuentos pendientes).</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
      </div>

      <app-finance-state [loading]="loading && !summary" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="summary as s">
        <div class="kpis">
          <div class="kpi"><span>Por pagar a proveedores</span><strong>{{ s.payableTotal | gs }}</strong><small>Vencido: {{ s.payableOverdueTotal | gs }}</small></div>
          <div class="kpi main"><span>Por cobrar a proveedores</span><strong>{{ s.receivableTotal | gs }}</strong><small>Devoluciones y descuentos pendientes</small></div>
          <div class="kpi"><span>Devoluciones de dinero pendientes</span><strong>{{ s.pendingRefundTotal | gs }}</strong></div>
          <div class="kpi"><span>Descuentos por ver aplicados</span><strong>{{ s.pendingDiscountTotal | gs }}</strong></div>
        </div>

        <p class="muted" *ngIf="!s.suppliers.length">Todavía no hay facturas por pagar ni notas de crédito por cobrar en este edificio.</p>

        <div class="table-wrap" *ngIf="s.suppliers.length">
          <table class="t">
            <thead>
              <tr><th>Proveedor</th><th class="num">Por pagar</th><th class="num">Vencido</th><th class="num">Devolución pendiente</th><th class="num">Descuento pendiente</th><th class="num">Por cobrar</th><th class="num">Saldo neto</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of s.suppliers" class="clickable" [class.sel]="supplierFilter === r.supplierName" (click)="toggleSupplier(r.supplierName)">
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
        <p class="muted small" *ngIf="s.suppliers.length">Saldo neto = por pagar − por cobrar. Tocá un proveedor para ver solo sus notas de crédito.</p>

        <div class="head-row">
          <h2>Notas de crédito por cobrar<ng-container *ngIf="supplierFilter"> · {{ supplierFilter }}</ng-container></h2>
          <label class="field inline"><span>Mostrar</span>
            <select [(ngModel)]="filter" (ngModelChange)="loadReceivables()">
              <option value="pending">Pendientes</option>
              <option value="recovered">Ya recuperadas</option>
              <option value="all">Todas</option>
            </select>
          </label>
        </div>

        <p class="muted" *ngIf="!receivables.length">No hay notas de crédito con esos filtros.</p>

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
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin: 0.8rem 0; }
    .kpi { display: grid; gap: 0.25rem; padding: 1rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.3rem; color: var(--brand-ink); }
    .kpi small { color: var(--brand-muted); }
    .kpi.main { background: var(--brand-gradient-soft); border-color: transparent; }
    .head-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin: 1.6rem 0 0.6rem; }
    .head-row h2 { margin: 0; font-size: 1.1rem; }
    .field.inline { min-width: 11rem; }
    .clickable { cursor: pointer; }
    .clickable:hover td, .sel td { background: var(--brand-gradient-soft); }
    .act-box { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; padding: 0.4rem 0; }
    .act-box .field { min-width: 12rem; }
    .act-box .actions { margin: 0; }
    @media (max-width: 900px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .kpis { grid-template-columns: 1fr; } }
  `]
})
export class SupplierAccountsPageComponent {
  private readonly api = inject(SupplierAccountsApiService);
  private readonly expensesApi = inject(BuildingExpensesApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly today = todayParaguay();

  buildingId = '';
  summary: SupplierAccountsSummary | null = null;
  receivables: SupplierReceivable[] = [];
  filter: ReceivableFilter = 'pending';
  supplierFilter = '';
  loading = false;
  busy = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  // Devolución o descuento que se está cargando (una fila a la vez).
  acting: { id: string; kind: 'refund' | 'discount' } | null = null;
  actDate = '';
  actText = '';
  actAmount: number | null = null;

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.supplierFilter = '';
    this.filter = 'pending';
    this.acting = null;
    this.load();
  }

  onError(err: unknown): void { this.setError(err); }

  toggleSupplier(name: string): void {
    this.supplierFilter = this.supplierFilter === name ? '' : name;
    this.loadReceivables();
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

  loadReceivables(): void {
    this.api.getReceivables(this.buildingId, this.filter, this.supplierFilter || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { this.receivables = rows; this.cdr.markForCheck(); },
      error: err => this.setError(err)
    });
  }

  private run(call: ReturnType<BuildingExpensesApiService['markCreditNoteRefunded']>, success: string): void {
    this.busy = true;
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy = false;
        this.acting = null;
        this.msg.add({ severity: 'success', summary: success, life: 3500 });
        this.load();
      },
      error: err => {
        this.busy = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo', detail: extractApiErrorMessage(err, 'No se pudo completar la operación.'), life: 8000 });
        this.cdr.markForCheck();
      }
    });
  }

  private load(): void {
    this.loading = true;
    this.errorKind = '';
    this.api.getSummary(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => {
        this.summary = summary;
        this.loading = false;
        this.loadReceivables();
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar las cuentas por proveedor.');
    this.summary = null;
    this.receivables = [];
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}

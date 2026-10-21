import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { catchError, of } from 'rxjs';
import { AccountingApiService } from '../../api/accounting-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpensesApiService } from '../../api/building-expenses-api.service';
import { PayableRow, PayablesPage, PayablesStatusFilter } from '../../api/building-config.models';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess, FinancialAccount, SupplierAccountsSummary } from '../../api/models';
import { SupplierAccountsApiService } from '../../api/supplier-accounts-api.service';
import { SupplierAccountsPanelComponent } from './supplier-accounts-panel.component';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, todayParaguay } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

const PAGE_SIZE = 25;

type PayablesTab = 'payables' | 'receivables' | 'summary';

// Cuentas por pagar y por cobrar a proveedores en una sola pantalla, con un filtro de proveedor y tres solapas:
//  - Por pagar: las facturas de proveedores con vencimiento. Mientras no se pagan no entran a la caja; al registrar el pago entran en la
//    fecha del pago y desde la cuenta elegida. Un mes cerrado no admite registrar ni deshacer pagos de ese mes.
//  - Por cobrar: las notas de crédito del proveedor sobre gastos ya pagados (devolución de dinero o descuento en su próxima factura).
//  - Resumen: por proveedor, lo que se le debe, lo que debe y el saldo neto.
@Component({
  standalone: true,
  selector: 'app-finance-payables-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Card, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent, SupplierAccountsPanelComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Cuentas por pagar y por cobrar</h1>
            <p>Lo que se le debe a cada proveedor y lo que cada proveedor le debe al edificio (devoluciones y descuentos pendientes).</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
      </div>

      <app-finance-state [loading]="loading && !data" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="data as d">
        <div class="kpis">
          <div class="kpi main"><span>A pagar</span><strong>{{ d.summary.pendingTotal | gs }}</strong><small>{{ d.summary.pendingCount }} facturas</small></div>
          <div class="kpi"><span>Vencido</span><strong class="neg">{{ d.summary.overdueTotal | gs }}</strong><small>{{ d.summary.overdueCount }} facturas</small></div>
          <div class="kpi"><span>Vence en 7 días</span><strong>{{ d.summary.dueNext7DaysTotal | gs }}</strong></div>
          <div class="kpi receivable" *ngIf="supplierAccounts as a"><span>Por cobrar a proveedores</span><strong>{{ a.receivableTotal | gs }}</strong><small>Devoluciones {{ a.pendingRefundTotal | gs }} · descuentos {{ a.pendingDiscountTotal | gs }}</small></div>
          <div class="kpi" *ngIf="supplierAccounts as a"><span>Saldo neto</span><strong [class.neg]="a.payableTotal - a.receivableTotal < 0">{{ a.payableTotal - a.receivableTotal | gs }}</strong><small>Por pagar − por cobrar</small></div>
        </div>

        <div class="filters">
          <label class="field"><span>Proveedor</span>
            <select [(ngModel)]="supplierName" (ngModelChange)="onSupplierFilter()">
              <option value="">Todos los proveedores</option>
              <option *ngFor="let s of supplierAccounts?.suppliers" [value]="s.supplierName">{{ s.supplierName }}</option>
            </select>
          </label>
        </div>

        <div class="tabs" role="tablist">
          <button type="button" role="tab" [class.on]="tab === 'payables'" [attr.aria-selected]="tab === 'payables'" (click)="tab = 'payables'">Por pagar</button>
          <button type="button" role="tab" [class.on]="tab === 'receivables'" [attr.aria-selected]="tab === 'receivables'" (click)="tab = 'receivables'">
            Por cobrar a proveedores<span class="badge" *ngIf="supplierAccounts && supplierAccounts.receivableTotal > 0"> · {{ supplierAccounts.receivableTotal | gs }}</span>
          </button>
          <button type="button" role="tab" [class.on]="tab === 'summary'" [attr.aria-selected]="tab === 'summary'" (click)="tab = 'summary'">Resumen por proveedor</button>
        </div>

        <app-supplier-accounts-panel *ngIf="tab !== 'payables'" [buildingId]="buildingId" [view]="tab === 'summary' ? 'summary' : 'receivables'" [supplierName]="supplierName"
          (changed)="loadAccounts()" (supplierPicked)="pickSupplier($event)" (failed)="onError($event)"></app-supplier-accounts-panel>

        <ng-container *ngIf="tab === 'payables'">
        <div class="aging" *ngIf="d.summary.overdueCount">
          <span class="muted">Lo vencido, por antigüedad:</span>
          <span class="chip" *ngFor="let b of d.summary.aging" [class.empty]="!b.count">{{ b.label }}: <strong>{{ b.total | gs }}</strong> ({{ b.count }})</span>
        </div>

        <div class="filters">
          <label class="field"><span>Estado</span>
            <select [(ngModel)]="status" (ngModelChange)="reload()">
              <option value="all">Todas</option>
              <option value="pending">A pagar</option>
              <option value="overdue">Vencidas</option>
              <option value="paid">Pagadas</option>
            </select>
          </label>
          <label class="field"><span>Vencimiento desde</span><input type="date" [(ngModel)]="from" (ngModelChange)="reload()" /></label>
          <label class="field"><span>Hasta</span><input type="date" [(ngModel)]="to" (ngModelChange)="reload()" /></label>
        </div>

        <p class="muted" *ngIf="!d.items.length">No hay facturas con esos filtros. Una factura aparece acá cuando el gasto se carga con fecha de vencimiento.</p>

        <div class="table-wrap" *ngIf="d.items.length">
          <table class="t">
            <thead><tr><th>Vence</th><th>Proveedor</th><th>Detalle</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              <ng-container *ngFor="let r of d.items">
                <tr>
                  <td class="nowrap">{{ r.dueDate | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ r.supplierName || '—' }}<div class="muted small" *ngIf="r.supplierRuc">RUC {{ r.supplierRuc }}</div></td>
                  <td>
                    {{ r.description }}
                    <div class="muted small">
                      <span *ngIf="r.invoiceNumber">Factura {{ r.invoiceNumber }} · </span>del {{ r.expenseDate | date: 'dd/MM/yyyy' }} · {{ r.expensePeriodName }}
                      <span *ngIf="r.ledgerCategoryName"> · {{ r.ledgerCategoryCode }} {{ r.ledgerCategoryName }}</span>
                    </div>
                  </td>
                  <td class="num"><strong>{{ r.amount | gs }}</strong><div class="muted small" *ngIf="r.vatAmount !== null">IVA {{ r.vatAmount | gs }}</div></td>
                  <td>
                    <p-tag [value]="statusLabel(r)" [severity]="statusSeverity(r)"></p-tag>
                    <div class="muted small" *ngIf="r.paidAt">Pagada el {{ r.paidAt | date: 'dd/MM/yyyy' }}<span *ngIf="r.paidFromAccountName"> desde {{ r.paidFromAccountName }}</span></div>
                  </td>
                  <td class="num">
                    <button type="button" class="btn sm" *ngIf="!r.paidAt" [disabled]="busy" (click)="startPay(r)">Registrar pago</button>
                    <button type="button" class="btn sm secondary" *ngIf="r.paidAt" [disabled]="busy" (click)="undo(r)">Deshacer pago</button>
                  </td>
                </tr>
                <tr *ngIf="paying === r.expenseId">
                  <td colspan="6">
                    <div class="pay-box">
                      <label class="field"><span>Fecha de pago</span><input type="date" [(ngModel)]="payDate" [min]="r.expenseDate" [max]="today" /></label>
                      <label class="field"><span>Pagada desde</span>
                        <select [(ngModel)]="payAccountId">
                          <option [ngValue]="''">Cuenta por defecto del edificio</option>
                          <option *ngFor="let a of accounts" [ngValue]="a.id">{{ a.name }}</option>
                        </select>
                      </label>
                      <div class="actions">
                        <button type="button" class="btn sm" [disabled]="busy || !payDate" (click)="confirmPay(r)">Confirmar pago de {{ r.amount | gs }}</button>
                        <button type="button" class="btn sm secondary" (click)="paying = ''">Cancelar</button>
                      </div>
                    </div>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>

        <div class="pager" *ngIf="d.totalCount > d.pageSize">
          <button type="button" class="btn sm secondary" [disabled]="page <= 1" (click)="go(page - 1)">Anterior</button>
          <span class="muted">Página {{ page }} de {{ pages }} · {{ d.totalCount }} facturas</span>
          <button type="button" class="btn sm secondary" [disabled]="page >= pages" (click)="go(page + 1)">Siguiente</button>
        </div>
        </ng-container>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.9rem; margin: 0.8rem 0; }
    .kpi.receivable { background: var(--brand-gradient-soft); border-color: transparent; }
    .tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; border-bottom: 1px solid var(--brand-border); margin: 0.4rem 0 1rem; }
    .tabs button { background: none; border: none; border-bottom: 3px solid transparent; padding: 0.6rem 1rem; font: inherit; font-weight: 600; color: var(--brand-muted); cursor: pointer; }
    .tabs button.on { color: var(--brand-ink); border-bottom-color: var(--p-primary-color, #1385b6); }
    .tabs .badge { font-weight: 500; font-size: 0.85rem; }
    .kpi { display: grid; gap: 0.25rem; padding: 1rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.35rem; color: var(--brand-ink); }
    .kpi small { color: var(--brand-muted); }
    .kpi.main { background: var(--brand-gradient-soft); border-color: transparent; }
    .aging { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; font-size: 0.85rem; }
    .chip { border: 1px solid var(--brand-border); border-radius: 999px; padding: 0.15rem 0.7rem; }
    .chip.empty { opacity: 0.5; }
    .filters { display: flex; gap: 0.8rem; flex-wrap: wrap; margin: 0.4rem 0 1rem; }
    .filters .field input, .filters .field select { padding: 0.5rem 0.75rem; }
    .pay-box { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; padding: 0.4rem 0; }
    .pay-box .field { min-width: 12rem; }
    .pay-box .actions { margin: 0; }
    .pager { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; }
    @media (max-width: 800px) { .kpis { grid-template-columns: 1fr; } }
  `]
})
export class FinancePayablesPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly accountsApi = inject(SupplierAccountsApiService);
  private readonly expensesApi = inject(BuildingExpensesApiService);
  private readonly accountingApi = inject(AccountingApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly today = todayParaguay();

  buildingId = '';
  data: PayablesPage | null = null;
  accounts: FinancialAccount[] = [];
  status: PayablesStatusFilter = 'all';
  tab: PayablesTab = 'payables';
  supplierName = '';
  supplierAccounts: SupplierAccountsSummary | null = null;
  from = '';
  to = '';
  page = 1;
  loading = false;
  busy = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';
  paying = '';
  payDate = '';
  payAccountId = '';

  get pages(): number { return this.data ? Math.max(Math.ceil(this.data.totalCount / this.data.pageSize), 1) : 1; }

  statusLabel(r: PayableRow): string {
    if (r.status === 'Paid') return 'Pagada';
    if (r.status === 'Overdue') return `Vencida hace ${r.daysOverdue} ${r.daysOverdue === 1 ? 'día' : 'días'}`;
    return 'A pagar';
  }

  statusSeverity(r: PayableRow): 'success' | 'danger' | 'warn' {
    return r.status === 'Paid' ? 'success' : r.status === 'Overdue' ? 'danger' : 'warn';
  }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.status = 'all';
    this.tab = 'payables';
    this.supplierName = '';
    this.supplierAccounts = null;
    this.from = this.to = '';
    this.page = 1;
    this.paying = '';
    this.api.getAccounts(building.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: accounts => {
        this.accounts = accounts.filter(a => a.isActive);
        this.cdr.markForCheck();
      },
      error: () => { this.accounts = []; }
    });
    this.load();
    this.loadAccounts();
  }

  onError(err: unknown): void { this.setError(err); }

  // Totales por cobrar y lista de proveedores del filtro (también sirve de recarga después de una devolución o un descuento).
  loadAccounts(): void {
    if (!this.buildingId) return;
    this.accountsApi.getSummary(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => { this.supplierAccounts = summary; this.cdr.markForCheck(); },
      error: () => { this.supplierAccounts = null; this.cdr.markForCheck(); }
    });
  }

  onSupplierFilter(): void {
    this.page = 1;
    this.load();
  }

  // Un proveedor tocado en el resumen pasa a ser el filtro y se abren sus notas por cobrar.
  pickSupplier(name: string): void {
    this.supplierName = this.supplierName === name ? '' : name;
    this.tab = this.supplierName ? 'receivables' : 'summary';
    this.onSupplierFilter();
    this.cdr.markForCheck();
  }

  reload(): void {
    this.page = 1;
    this.load();
  }

  go(page: number): void {
    this.page = page;
    this.load();
  }

  startPay(r: PayableRow): void {
    this.paying = r.expenseId;
    this.payDate = this.today;
    this.payAccountId = '';
  }

  confirmPay(r: PayableRow): void {
    this.run(this.expensesApi.registerPayment(r.expenseId, { paidAt: this.payDate, accountId: this.payAccountId || null }), 'Pago registrado.');
  }

  undo(r: PayableRow): void {
    // Si el gasto ya está asentado en el Libro diario se avisa antes: el asiento no se modifica, se corrige con un contraasiento.
    this.busy = true;
    this.accountingApi.getJournalImpact({ expenseId: r.expenseId }).pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef)).subscribe(impact => {
      this.busy = false;
      this.cdr.markForCheck();
      const warning = impact?.posted
        ? ` Este gasto ya está asentado en el Libro diario (${impact.labels.join(', ')}): el asiento no se modifica, al volver a asentar se genera un contraasiento.`
        : '';
      if (!confirm(`¿Deshacer el pago de ${r.supplierName || 'la factura'}? Vuelve a quedar a pagar y sale de la caja de la fecha en que se registró.${warning}`)) return;
      this.run(this.expensesApi.undoPayment(r.expenseId), 'Pago deshecho.');
    });
  }

  private run(call: ReturnType<BuildingExpensesApiService['undoPayment']>, success: string): void {
    this.busy = true;
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy = false;
        this.paying = '';
        this.msg.add({ severity: 'success', summary: success, life: 3500 });
        this.load();
        this.loadAccounts();
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
    this.api.getPayables(this.buildingId, {
      status: this.status, supplierName: this.supplierName || undefined, from: this.from || undefined, to: this.to || undefined, page: this.page, pageSize: PAGE_SIZE
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar las cuentas por pagar.');
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}

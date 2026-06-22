import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { AccountStatementsApiService } from '../../api/account-statements-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AccountStatementDetail, AccountStatementPeriod, ExpenseChargeType, ExpenseReceipt, PaymentMethod, Unit } from '../../api/models';
import { UnitsApiService } from '../../api/units-api.service';

@Component({
  standalone: true,
  selector: 'app-account-statements-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Estado de cuenta</h1>
            <p>Consulta de deuda, pagos y saldo por unidad y periodo.</p>
          </div>
        </div>
      </div>

      <div class="app-form-grid compact">
        <label class="wide">
          <span>Unidad</span>
          <select [(ngModel)]="selectedUnitId" name="selectedUnitId" (ngModelChange)="loadStatements()" required>
            <option value="" disabled>Selecciona una unidad</option>
            <option *ngFor="let unit of units" [value]="unit.id">{{ unit.code }} · {{ unit.buildingName }}</option>
          </select>
        </label>
      </div>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
      <p class="app-state" *ngIf="loading">Cargando estado de cuenta...</p>
      <p class="app-state" *ngIf="!loading && !errorMessage && !selectedUnitId">Selecciona una unidad para consultar.</p>
      <p class="app-state" *ngIf="!loading && !errorMessage && selectedUnitId && !statements.length">La unidad no tiene movimientos.</p>

      <div class="content-grid" *ngIf="statements.length">
        <section class="statement-list">
          <button type="button" class="statement-card" *ngFor="let item of statements" [class.active]="item.expensePeriodId === selectedExpensePeriodId" (click)="selectPeriod(item)">
            <strong>{{ item.expensePeriodName }}</strong>
            <span>{{ item.startDate }} al {{ item.endDate }}</span>
            <small>Saldo {{ formatCurrency(item.balance) }}</small>
            <p-tag [value]="statusLabel(item.status)" [severity]="statusSeverity(item.status)"></p-tag>
          </button>
        </section>

        <section *ngIf="detail" class="statement-detail">
          <p-card styleClass="detail-panel">
            <div class="detail-head">
              <div>
                <h2>{{ detail.expensePeriodName }}</h2>
                <p>{{ detail.unitCode }} · {{ detail.buildingName }}</p>
              </div>
              <div class="detail-totals">
                <span>Cargos {{ formatCurrency(detail.totalCharges) }}</span>
                <span>Pagos {{ formatCurrency(detail.totalPayments) }}</span>
                <strong>Saldo {{ formatCurrency(detail.balance) }}</strong>
              </div>
            </div>

            <div class="receipt-actions" *ngIf="receipt">
              <p-button type="button" label="Imprimir comprobante" icon="pi pi-print" (onClick)="printReceipt()"></p-button>
            </div>

            <div class="detail-grid">
              <div>
                <h3>Cargos</h3>
                <div class="line-list" *ngIf="detail.charges.length; else noCharges">
                  <div class="line-item" *ngFor="let charge of detail.charges">
                    <div>
                      <strong>{{ charge.concept }}</strong>
                      <small class="charge-type">{{ chargeTypeLabel(charge.chargeType) }}</small>
                      <span>{{ charge.notes || 'Sin notas' }}</span>
                    </div>
                    <strong>{{ formatCurrency(charge.amount) }}</strong>
                  </div>
                </div>
                <ng-template #noCharges>
                  <p class="empty-copy">No hay cargos para este periodo.</p>
                </ng-template>
              </div>

              <div>
                <h3>Pagos</h3>
                <div class="line-list" *ngIf="detail.payments.length; else noPayments">
                  <div class="line-item" *ngFor="let payment of detail.payments">
                    <div>
                      <strong>{{ payment.paymentDate }} · {{ paymentMethodLabel(payment.method) }}</strong>
                      <span>{{ payment.reference || 'Sin referencia' }} · {{ payment.notes || 'Sin notas' }}</span>
                    </div>
                    <strong>{{ formatCurrency(payment.amount) }}</strong>
                  </div>
                </div>
                <ng-template #noPayments>
                  <p class="empty-copy">No hay pagos registrados para este periodo.</p>
                </ng-template>
              </div>
            </div>
          </p-card>
        </section>
      </div>

      <section class="receipt-sheet" *ngIf="receipt" id="expense-receipt-print">
        <div class="receipt-header">
          <div>
            <h2>Comprobante individual de expensas</h2>
            <p>{{ receipt.buildingName }} - {{ receipt.expensePeriodName }}</p>
          </div>
          <div class="receipt-total">
            <span>Total</span>
            <strong>{{ formatCurrency(receipt.totalAmount) }}</strong>
          </div>
        </div>

        <div class="receipt-meta-grid">
          <div><span>Titular</span><strong>{{ receipt.holderName }}</strong></div>
          <div><span>Documento</span><strong>{{ receipt.holderDocumentNumber || 'Sin dato' }}</strong></div>
          <div><span>Unidad</span><strong>{{ receipt.unitCode }}</strong></div>
          <div><span>Coeficiente</span><strong>{{ receipt.unitCoefficient.toFixed(6) }}</strong></div>
          <div><span>Vencimiento</span><strong>{{ receipt.dueDate }}</strong></div>
          <div><span>Periodo</span><strong>{{ receipt.month }}/{{ receipt.year }}</strong></div>
        </div>

        <div class="receipt-lines">
          <div class="receipt-line header">
            <span>Tipo</span>
            <span>Concepto</span>
            <span>Monto</span>
          </div>
          <div class="receipt-line" *ngFor="let charge of receipt.charges">
            <span>{{ chargeTypeLabel(charge.chargeType) }}</span>
            <span>{{ charge.concept }}</span>
            <strong>{{ formatCurrency(charge.amount) }}</strong>
          </div>
        </div>

        <div class="receipt-summary">
          <div><span>Expensa ordinaria</span><strong>{{ formatCurrency(receipt.ordinaryAmount) }}</strong></div>
          <div><span>Fondo de reserva</span><strong>{{ formatCurrency(receipt.reserveFundAmount) }}</strong></div>
          <div><span>Extraordinarios</span><strong>{{ formatCurrency(receipt.extraordinaryAmount) }}</strong></div>
          <div><span>Cargos individuales</span><strong>{{ formatCurrency(receipt.individualAmount) }}</strong></div>
          <div><span>Ajustes</span><strong>{{ formatCurrency(receipt.adjustmentAmount) }}</strong></div>
          <div class="grand-total"><span>Total final</span><strong>{{ formatCurrency(receipt.totalAmount) }}</strong></div>
        </div>
      </section>
    </p-card>
  `,
  styles: [`
    .compact { margin-bottom: 1rem; }
    .content-grid { display:grid; grid-template-columns: 320px minmax(0, 1fr); gap:1rem; }
    .statement-list { display:grid; gap:0.75rem; align-content:start; }
    .statement-card {
      width:100%;
      border:1px solid rgba(19, 133, 182, 0.12);
      background:rgba(255, 255, 255, 0.82);
      border-radius:20px;
      padding:1rem;
      display:grid;
      gap:0.45rem;
      text-align:left;
      cursor:pointer;
    }
    .statement-card.active { border-color:var(--brand-blue); box-shadow:0 10px 24px rgba(19, 133, 182, 0.16); background:var(--brand-gradient-soft); }
    .statement-card strong { color:var(--brand-ink); }
    .statement-card span, .statement-card small { color:var(--brand-muted); }
    .detail-head { display:flex; justify-content:space-between; gap:1rem; align-items:start; margin-bottom:1rem; }
    .detail-head h2 { margin:0; color:var(--brand-ink); }
    .detail-head p { margin:0.3rem 0 0; color:var(--brand-muted); }
    .detail-totals { display:grid; gap:0.35rem; text-align:right; color:var(--brand-ink-soft); }
    .detail-totals strong { color:var(--brand-ink); font-size:1.2rem; }
    .detail-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:1rem; }
    .receipt-actions { margin-bottom: 1rem; display:flex; justify-content:flex-end; }
    .detail-grid h3 { margin:0 0 0.8rem; color:var(--brand-ink); }
    .line-list { display:grid; gap:0.75rem; }
    .line-item {
      display:flex;
      justify-content:space-between;
      gap:1rem;
      align-items:start;
      background:rgba(255, 255, 255, 0.82);
      border-radius:18px;
      padding:0.9rem 1rem;
      border:1px solid rgba(19, 133, 182, 0.08);
    }
    .line-item span { display:block; color:var(--brand-muted); margin-top:0.25rem; }
    .line-item .charge-type { display:block; color:var(--brand-blue); margin-top:0.2rem; font-weight:600; }
    .empty-copy { color:var(--brand-muted); margin:0; }
    .receipt-sheet {
      margin-top: 1.5rem;
      padding: 1.5rem;
      border: 1px solid rgba(19, 133, 182, 0.12);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(243,251,251,0.96) 100%);
    }
    .receipt-header {
      display:flex;
      justify-content:space-between;
      gap:1rem;
      align-items:start;
      margin-bottom:1rem;
    }
    .receipt-header h2 { margin:0; color:var(--brand-ink); }
    .receipt-header p { margin:0.35rem 0 0; color:var(--brand-muted); }
    .receipt-total { text-align:right; }
    .receipt-total span { display:block; color:var(--brand-muted); }
    .receipt-total strong { font-size:1.5rem; color:var(--brand-ink); }
    .receipt-meta-grid {
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap:0.9rem;
      margin-bottom:1rem;
    }
    .receipt-meta-grid div,
    .receipt-summary div {
      padding:0.8rem 0.9rem;
      border-radius:16px;
      background:rgba(255, 255, 255, 0.92);
      border:1px solid rgba(19, 133, 182, 0.12);
    }
    .receipt-meta-grid span,
    .receipt-summary span {
      display:block;
      color:var(--brand-muted);
      font-size:0.82rem;
      margin-bottom:0.25rem;
    }
    .receipt-lines { display:grid; gap:0.5rem; margin-bottom:1rem; }
    .receipt-line {
      display:grid;
      grid-template-columns: 0.9fr 1.6fr 0.7fr;
      gap:1rem;
      align-items:center;
      padding:0.85rem 1rem;
      border-radius:16px;
      background:rgba(255, 255, 255, 0.92);
      border:1px solid rgba(19, 133, 182, 0.12);
    }
    .receipt-line.header {
      background:var(--brand-gradient-soft);
      font-weight:700;
      color:var(--brand-ink);
    }
    .receipt-summary {
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap:0.9rem;
    }
    .receipt-summary .grand-total {
      background:var(--brand-gradient);
      color:white;
      border-color:transparent;
    }
    .receipt-summary .grand-total span,
    .receipt-summary .grand-total strong { color:white; }
    @media (max-width: 1080px) {
      .content-grid { grid-template-columns: 1fr; }
      .receipt-meta-grid,
      .receipt-summary { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 720px) {
      .detail-head, .detail-grid { grid-template-columns: 1fr; display:grid; }
      .detail-totals { text-align:left; }
      .detail-grid { grid-template-columns: 1fr; }
      .receipt-header,
      .receipt-meta-grid,
      .receipt-summary,
      .receipt-line { grid-template-columns: 1fr; display:grid; }
      .receipt-total { text-align:left; }
    }
    @media print {
      :host ::ng-deep .app-page-card > .p-card-body > :not(.receipt-sheet) { display:none !important; }
      .receipt-sheet { border:none; box-shadow:none; margin:0; padding:0; }
    }
  `]
})
export class AccountStatementsPageComponent implements OnInit {
  private readonly accountStatementsApi = inject(AccountStatementsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  units: Unit[] = [];
  statements: AccountStatementPeriod[] = [];
  detail: AccountStatementDetail | null = null;
  receipt: ExpenseReceipt | null = null;
  selectedUnitId = '';
  selectedExpensePeriodId = '';
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.unitsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (units) => {
        this.units = units;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(error, 'No se pudieron cargar las unidades.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadStatements(): void {
    this.errorMessage = '';
    this.detail = null;
    this.receipt = null;
    this.statements = [];
    this.selectedExpensePeriodId = '';

    if (!this.selectedUnitId) {
      return;
    }

    this.loading = true;
    this.accountStatementsApi.getUnitStatements(this.selectedUnitId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (statements) => {
        this.statements = statements;
        this.loading = false;
        if (statements.length) {
          this.selectPeriod(statements[0]);
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el estado de cuenta.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectPeriod(item: AccountStatementPeriod): void {
    this.selectedExpensePeriodId = item.expensePeriodId;
    this.loading = true;
    forkJoin({
      detail: this.accountStatementsApi.getUnitStatementDetail(this.selectedUnitId, item.expensePeriodId),
      receipt: this.accountStatementsApi.getExpenseReceipt(this.selectedUnitId, item.expensePeriodId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ detail, receipt }) => {
          this.detail = detail;
          this.receipt = receipt;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el detalle del periodo.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  statusLabel(status: string): string {
    return status === 'Draft' ? 'Borrador' : status === 'Closed' ? 'Cerrado' : 'Publicado';
  }

  statusSeverity(status: string): 'success' | 'warn' | 'info' {
    return status === 'Published' ? 'success' : status === 'Closed' ? 'info' : 'warn';
  }

  paymentMethodLabel(method: PaymentMethod): string {
    return method === 'Cash'
      ? 'Efectivo'
      : method === 'BankTransfer'
        ? 'Transferencia'
        : method === 'Card'
          ? 'Tarjeta'
          : method === 'Check'
            ? 'Cheque'
            : 'Otro';
  }

  chargeTypeLabel(type: ExpenseChargeType): string {
    return type === 'Ordinary'
      ? 'Expensa ordinaria'
      : type === 'ReserveFund'
        ? 'Fondo de reserva'
        : type === 'Extraordinary'
          ? 'Extraordinario'
          : type === 'Individual'
            ? 'Cargo individual'
            : 'Ajuste';
  }

  printReceipt(): void {
    window.print();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
  }
}

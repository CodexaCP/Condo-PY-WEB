import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { AccountStatementsApiService } from '../../api/account-statements-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AccountStatementDetail, AccountStatementPeriod, ExpenseChargeType, ExpenseReceipt, PaymentMethod, Unit } from '../../api/models';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-account-statements-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Estado de cuenta</h1>
            <p>Consulta de deuda, pagos y saldo acumulado por unidad.</p>
          </div>
        </div>
      </div>

      <div class="unit-selector-bar">
        <div class="selector-icon pi pi-building"></div>
        <div class="field-block" style="flex:1; max-width:480px">
          <span>Seleccionar unidad</span>
          <select [(ngModel)]="selectedUnitId" name="selectedUnitId" (ngModelChange)="loadStatements()" required>
            <option value="" disabled>— Elegir unidad —</option>
            <option *ngFor="let unit of units" [value]="unit.id">{{ unit.code }} · {{ unit.buildingName }}</option>
          </select>
        </div>
        <p class="selector-hint" *ngIf="!selectedUnitId">Elegí una unidad para ver su historial de expensas y saldo acumulado.</p>
      </div>

      <p class="app-state" *ngIf="loading">Cargando estado de cuenta...</p>
      <p class="app-state" *ngIf="!loading && !selectedUnitId">Selecciona una unidad para consultar.</p>
      <p class="app-state" *ngIf="!loading && selectedUnitId && !statements.length">La unidad no tiene movimientos registrados.</p>

      <!-- Summary header -->
      <section class="balance-header" *ngIf="statements.length">
        <div class="balance-chip" [class.chip-debt]="totalRunningBalance > 0" [class.chip-credit]="totalRunningBalance <= 0">
          <span>Saldo acumulado</span>
          <strong>{{ formatCurrency(totalRunningBalance) }}</strong>
        </div>
        <div class="balance-chip">
          <span>Total cargado</span>
          <strong>{{ formatCurrency(totalCharged) }}</strong>
        </div>
        <div class="balance-chip">
          <span>Total pagado</span>
          <strong>{{ formatCurrency(totalPaid) }}</strong>
        </div>
        <div class="balance-actions">
          <a [href]="statementPdfUrl" target="_blank" style="display:contents">
            <p-button label="Exportar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
          </a>
        </div>
      </section>

      <div class="content-grid" *ngIf="statements.length">
        <section class="statement-list">
          <button type="button" class="statement-card" *ngFor="let item of statements"
            [class.active]="item.expensePeriodId === selectedExpensePeriodId"
            [class.card-debt]="item.runningBalance > 0"
            [class.card-ok]="item.runningBalance <= 0"
            (click)="selectPeriod(item)">
            <div class="card-top-row">
              <strong>{{ item.expensePeriodName }}</strong>
              <p-tag [value]="statusLabel(item.status)" [severity]="statusSeverity(item.status)"></p-tag>
            </div>
            <span class="card-dates">Vence {{ item.dueDate }}</span>
            <div class="card-amounts">
              <div class="card-amount-row">
                <small class="amount-label">Cargado</small>
                <small class="amount-value" [class.zero-amount]="item.totalCharges === 0">{{ formatCurrency(item.totalCharges) }}</small>
              </div>
              <div class="card-amount-row">
                <small class="amount-label">Pagado</small>
                <small class="amount-value paid-text">{{ formatCurrency(item.totalPayments) }}</small>
              </div>
              <div class="card-amount-row card-balance-row">
                <small class="amount-label">Saldo periodo</small>
                <small class="amount-value" [class.period-debt]="item.balance > 0" [class.period-ok]="item.balance <= 0">
                  {{ formatCurrency(item.balance) }}
                </small>
              </div>
              <div class="card-amount-row">
                <small class="amount-label running-label">Acumulado</small>
                <small class="amount-value running-label">{{ formatCurrency(item.runningBalance) }}</small>
              </div>
            </div>
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
                <strong [class.debt-text]="detail.balance > 0">Saldo {{ formatCurrency(detail.balance) }}</strong>
              </div>
            </div>

            <div class="detail-grid">
              <div>
                <h3>Cargos</h3>
                <div class="line-list" *ngIf="detail.charges.length; else noCharges">
                  <div class="line-item" [class.reversal-row]="charge.isReversal" *ngFor="let charge of detail.charges">
                    <div>
                      <strong>{{ charge.concept }}</strong>
                      <span class="reversal-badge" *ngIf="charge.isReversal">REVERSIÓN</span>
                      <small class="charge-type" *ngIf="!charge.isReversal">{{ chargeTypeLabel(charge.chargeType) }}</small>
                      <span *ngIf="charge.notes && !isGuidNote(charge.notes)">{{ charge.notes }}</span>
                    </div>
                    <strong [class.negative-amount]="charge.isReversal">{{ formatCurrency(charge.amount) }}</strong>
                  </div>
                </div>
                <ng-template #noCharges>
                  <p class="empty-copy">No hay cargos para este periodo.</p>
                </ng-template>
              </div>

              <div>
                <h3>Pagos</h3>
                <div class="line-list" *ngIf="detail.payments.length; else noPayments">
                  <div class="line-item" [class.reversed-payment]="payment.isReversed" *ngFor="let payment of detail.payments">
                    <div>
                      <strong>{{ payment.paymentDate }} · {{ paymentMethodLabel(payment.method) }}</strong>
                      <span class="revertido-badge" *ngIf="payment.isReversed">REVERTIDO</span>
                      <span *ngIf="payment.reference">{{ payment.reference }}</span>
                      <span *ngIf="payment.notes">{{ payment.notes }}</span>
                    </div>
                    <strong [class.paid-text]="!payment.isReversed" [class.reversed-amount]="payment.isReversed">{{ formatCurrency(payment.amount) }}</strong>
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

      <!-- Receipt sheet (visible on screen + print) -->
      <section class="receipt-sheet" *ngIf="receipt" id="expense-receipt-print">
        <div class="receipt-header">
          <div>
            <h2>Comprobante individual de expensas</h2>
            <p>{{ receipt.buildingName }} &mdash; {{ receipt.expensePeriodName }}</p>
          </div>
          <div class="receipt-total">
            <span>Total cargado</span>
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
          <div class="receipt-line" [class.reversal-row]="charge.isReversal" *ngFor="let charge of receipt.charges">
            <span>{{ charge.isReversal ? 'Reversión' : chargeTypeLabel(charge.chargeType) }}</span>
            <span>{{ charge.concept }} <span class="reversal-badge" *ngIf="charge.isReversal">REVERSIÓN</span></span>
            <strong [class.negative-amount]="charge.isReversal">{{ formatCurrency(charge.amount) }}</strong>
          </div>
        </div>

        <div class="receipt-summary">
          <div><span>Expensa ordinaria</span><strong>{{ formatCurrency(receipt.ordinaryAmount) }}</strong></div>
          <div><span>Fondo de reserva</span><strong>{{ formatCurrency(receipt.reserveFundAmount) }}</strong></div>
          <div><span>Extraordinarios</span><strong>{{ formatCurrency(receipt.extraordinaryAmount) }}</strong></div>
          <div><span>Cargos individuales</span><strong>{{ formatCurrency(receipt.individualAmount) }}</strong></div>
          <div><span>Ajustes</span><strong>{{ formatCurrency(receipt.adjustmentAmount) }}</strong></div>
          <div class="grand-total"><span>Total cargado</span><strong>{{ formatCurrency(receipt.totalAmount) }}</strong></div>
        </div>

        <!-- Payments section in receipt -->
        <ng-container *ngIf="receipt.payments.length">
          <h3 class="receipt-section-title">Pagos registrados</h3>
          <div class="receipt-lines">
            <div class="receipt-line header">
              <span>Fecha</span>
              <span>Metodo / Referencia</span>
              <span>Importe</span>
            </div>
            <div class="receipt-line" [class.reversed-payment]="p.isReversed" *ngFor="let p of receipt.payments">
              <span>{{ p.paymentDate }}</span>
              <span>{{ paymentMethodLabel(p.method) }}{{ p.reference ? ' — ' + p.reference : '' }}<span class="revertido-badge" *ngIf="p.isReversed">REVERTIDO</span></span>
              <strong [class.paid-text]="!p.isReversed" [class.reversed-amount]="p.isReversed">{{ formatCurrency(p.amount) }}</strong>
            </div>
          </div>
          <div class="receipt-balance-row" [class.balance-debt]="receipt.balance > 0" [class.balance-ok]="receipt.balance <= 0">
            <span>Total pagado</span>
            <strong>{{ formatCurrency(receipt.totalPayments) }}</strong>
            <span>Saldo del periodo</span>
            <strong>{{ formatCurrency(receipt.balance) }}</strong>
          </div>
        </ng-container>
      </section>
    </p-card>
  `,
  styles: [`
    /* Unit selector bar */
    .unit-selector-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
      background: rgba(19,133,182,0.04);
      border: 1.5px solid rgba(19,133,182,0.15);
      border-radius: 20px;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .selector-icon {
      width: 46px; height: 46px;
      border-radius: 14px;
      background: rgba(19,133,182,0.12);
      color: #1385b6;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem; flex-shrink: 0;
    }
    .field-block { display: grid; gap: 0.4rem; }
    .field-block > span { font-weight: 700; color: #29484f; font-size: 0.85rem; }
    .field-block select {
      border: 1.5px solid #d7e5e1; border-radius: 12px;
      padding: 0.75rem 1rem; font: inherit;
      background: white; color: #18353a; width: 100%; box-sizing: border-box;
    }
    .field-block select:focus { outline: none; border-color: #1385b6; box-shadow: 0 0 0 3px rgba(19,133,182,0.12); }
    .selector-hint { color: #6b878d; font-size: 0.88rem; margin: 0; }
    .balance-header { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin-bottom:1.25rem; }
    .balance-chip {
      background:rgba(255,255,255,0.84);
      border-radius:20px;
      padding:0.9rem 1.1rem;
      display:grid;
      gap:0.25rem;
      border:1px solid rgba(19,133,182,0.1);
      min-width:160px;
    }
    .balance-chip span { color:var(--brand-muted); font-size:0.82rem; }
    .balance-chip strong { color:var(--brand-ink); font-size:1.4rem; }
    .chip-debt strong { color:#c94d3f; }
    .chip-credit strong { color:#1a7f37; }
    .balance-actions { margin-left:auto; }
    .content-grid { display:grid; grid-template-columns: 320px minmax(0, 1fr); gap:1rem; }
    .statement-list { display:grid; gap:0.75rem; align-content:start; }
    .statement-card {
      width:100%;
      border:1px solid rgba(19,133,182,0.12);
      background:rgba(255,255,255,0.82);
      border-radius:20px;
      padding:1rem;
      display:grid;
      gap:0.4rem;
      text-align:left;
      cursor:pointer;
      transition:box-shadow 0.12s;
    }
    .statement-card.active { border-color:var(--brand-blue); box-shadow:0 10px 24px rgba(19,133,182,0.16); background:var(--brand-gradient-soft); }
    .statement-card strong { color:var(--brand-ink); }
    .card-top-row { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; }
    .card-top-row strong { font-size:0.95rem; }
    .card-dates { color:var(--brand-muted); font-size:0.82rem; }
    .card-amounts { display:grid; gap:0.25rem; margin-top:0.4rem; }
    .card-amount-row { display:flex; justify-content:space-between; align-items:center; font-size:0.83rem; }
    .card-balance-row { border-top:1px solid rgba(0,0,0,0.07); padding-top:0.25rem; margin-top:0.1rem; }
    .amount-label { color:var(--brand-muted); }
    .amount-value { font-weight:600; color:var(--brand-ink); }
    .zero-amount { color:var(--brand-muted) !important; font-weight:400 !important; }
    .period-debt { color:#c94d3f; font-weight:700; }
    .period-ok { color:#1a7f37; font-weight:700; }
    .running-label { color:var(--brand-muted); font-weight:400 !important; font-style:italic; }
    .detail-head { display:flex; justify-content:space-between; gap:1rem; align-items:start; margin-bottom:1rem; }
    .detail-head h2 { margin:0; color:var(--brand-ink); }
    .detail-head p { margin:0.3rem 0 0; color:var(--brand-muted); }
    .detail-totals { display:grid; gap:0.35rem; text-align:right; color:var(--brand-ink-soft); }
    .detail-totals strong { color:var(--brand-ink); font-size:1.2rem; }
    .debt-text { color:#c94d3f !important; }
    .detail-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:1rem; }
    .receipt-actions { margin-bottom:1rem; display:flex; justify-content:flex-end; }
    .detail-grid h3 { margin:0 0 0.8rem; color:var(--brand-ink); }
    .line-list { display:grid; gap:0.75rem; }
    .line-item {
      display:flex;
      justify-content:space-between;
      gap:1rem;
      align-items:start;
      background:rgba(255,255,255,0.82);
      border-radius:18px;
      padding:0.9rem 1rem;
      border:1px solid rgba(19,133,182,0.08);
    }
    .line-item span { display:block; color:var(--brand-muted); margin-top:0.25rem; font-size:0.85rem; }
    .line-item .charge-type { display:block; color:var(--brand-blue); margin-top:0.2rem; font-weight:600; }
    .empty-copy { color:var(--brand-muted); margin:0; }
    .negative-amount { color:#c94d3f; }
    .reversal-row { background: #fff7ed !important; }
    .reversal-badge {
      display: inline-block;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      background: #ea580c;
      color: #fff;
      border-radius: 4px;
      padding: 1px 5px;
      vertical-align: middle;
      margin-left: 6px;
    }
    .paid-text { color:#1a7f37; }
    .reversed-payment { opacity: 0.55; background: #fff7ed !important; }
    .reversed-amount { color: #b45309; text-decoration: line-through; }
    .revertido-badge {
      display: inline-block; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
      background: #b45309; color: #fff; border-radius: 4px; padding: 1px 5px;
      vertical-align: middle; margin-left: 6px;
    }
    /* Receipt */
    .receipt-sheet {
      margin-top:1.5rem;
      padding:1.5rem;
      border:1px solid rgba(19,133,182,0.12);
      border-radius:24px;
      background:linear-gradient(180deg,rgba(255,255,255,0.96) 0%,rgba(243,251,251,0.96) 100%);
    }
    .receipt-header { display:flex; justify-content:space-between; gap:1rem; align-items:start; margin-bottom:1rem; }
    .receipt-header h2 { margin:0; color:var(--brand-ink); }
    .receipt-header p { margin:0.35rem 0 0; color:var(--brand-muted); }
    .receipt-total { text-align:right; }
    .receipt-total span { display:block; color:var(--brand-muted); }
    .receipt-total strong { font-size:1.5rem; color:var(--brand-ink); }
    .receipt-meta-grid {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:0.9rem;
      margin-bottom:1rem;
    }
    .receipt-meta-grid div,.receipt-summary div {
      padding:0.8rem 0.9rem;
      border-radius:16px;
      background:rgba(255,255,255,0.92);
      border:1px solid rgba(19,133,182,0.12);
    }
    .receipt-meta-grid span,.receipt-summary span {
      display:block;
      color:var(--brand-muted);
      font-size:0.82rem;
      margin-bottom:0.25rem;
    }
    .receipt-section-title { margin:1.25rem 0 0.75rem; color:var(--brand-ink); }
    .receipt-lines { display:grid; gap:0.5rem; margin-bottom:1rem; }
    .receipt-line {
      display:grid;
      grid-template-columns:0.9fr 1.6fr 1fr;
      gap:1rem;
      align-items:center;
      padding:0.85rem 1rem;
      border-radius:16px;
      background:rgba(255,255,255,0.92);
      border:1px solid rgba(19,133,182,0.12);
    }
    .receipt-line.header { background:var(--brand-gradient-soft); font-weight:700; color:var(--brand-ink); }
    .receipt-summary {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:0.9rem;
      margin-bottom:1rem;
    }
    .receipt-summary .grand-total { background:var(--brand-gradient); color:white; border-color:transparent; }
    .receipt-summary .grand-total span,.receipt-summary .grand-total strong { color:white; }
    .receipt-balance-row {
      display:grid;
      grid-template-columns:1fr 1fr 1fr 1fr;
      gap:0.9rem;
      padding:1rem;
      border-radius:16px;
      border:2px solid rgba(19,133,182,0.2);
      background:rgba(255,255,255,0.92);
    }
    .receipt-balance-row span { display:block; color:var(--brand-muted); font-size:0.82rem; margin-bottom:0.2rem; }
    .receipt-balance-row strong { font-size:1.1rem; color:var(--brand-ink); }
    .balance-debt { border-color:#fca5a5; }
    .balance-debt strong:last-child { color:#c94d3f; }
    .balance-ok { border-color:#86efac; }
    .balance-ok strong:last-child { color:#1a7f37; }
    @media (max-width: 1080px) {
      .content-grid { grid-template-columns:1fr; }
      .receipt-meta-grid,.receipt-summary { grid-template-columns:1fr 1fr; }
    }
    @media (max-width: 720px) {
      .balance-header { flex-direction:column; }
      .balance-actions { margin-left:0; }
      .detail-head { flex-direction:column; }
      .detail-totals { text-align:left; }
      .detail-grid { grid-template-columns:1fr; }
      .receipt-header,.receipt-meta-grid,.receipt-summary,.receipt-line,.receipt-balance-row { grid-template-columns:1fr; display:grid; }
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
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  units: Unit[] = [];
  statements: AccountStatementPeriod[] = [];
  detail: AccountStatementDetail | null = null;
  receipt: ExpenseReceipt | null = null;
  selectedUnitId = '';
  selectedExpensePeriodId = '';
  loading = true;

  get totalRunningBalance(): number {
    if (!this.statements.length) return 0;
    return this.statements[0].runningBalance; // list is newest first
  }

  get totalCharged(): number {
    return this.statements.reduce((s, x) => s + x.totalCharges, 0);
  }

  get totalPaid(): number {
    return this.statements.reduce((s, x) => s + x.totalPayments, 0);
  }

  ngOnInit(): void {
    this.unitsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (units) => {
        this.units = units;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar las unidades.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadStatements(): void {
    this.detail = null;
    this.receipt = null;
    this.statements = [];
    this.selectedExpensePeriodId = '';

    if (!this.selectedUnitId) return;

    this.loading = true;
    this.accountStatementsApi.getUnitStatements(this.selectedUnitId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (statements) => {
        this.statements = statements;
        this.loading = false;
        if (statements.length) this.selectPeriod(statements[0]);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el estado de cuenta.'), life: 5000 });
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
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ detail, receipt }) => {
        this.detail = detail;
        this.receipt = receipt;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el detalle del periodo.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get statementPdfUrl(): string {
    if (!this.selectedUnitId) return '';
    return this.accountStatementsApi.getStatementPdfUrl(
      this.selectedUnitId,
      this.auth.getToken() ?? ''
    );
  }

  getReceiptPdfUrl(): string {
    if (!this.selectedUnitId || !this.selectedExpensePeriodId) return '';
    return this.accountStatementsApi.getReceiptPdfUrl(
      this.selectedUnitId,
      this.selectedExpensePeriodId,
      this.auth.getToken() ?? ''
    );
  }

  statusLabel(status: string): string {
    return status === 'Draft' ? 'Borrador' : status === 'Closed' ? 'Cerrado' : 'Publicado';
  }

  statusSeverity(status: string): 'success' | 'warn' | 'info' {
    return status === 'Published' ? 'success' : status === 'Closed' ? 'info' : 'warn';
  }

  paymentMethodLabel(method: PaymentMethod): string {
    return method === 'Cash' ? 'Efectivo'
      : method === 'BankTransfer' ? 'Transferencia'
      : method === 'Card' ? 'Tarjeta'
      : method === 'Check' ? 'Cheque'
      : 'Otro';
  }

  chargeTypeLabel(type: ExpenseChargeType): string {
    return type === 'Ordinary' ? 'Expensa ordinaria'
      : type === 'ReserveFund' ? 'Fondo de reserva'
      : type === 'Extraordinary' ? 'Extraordinario'
      : type === 'Individual' ? 'Cargo individual'
      : 'Ajuste';
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  isGuidNote(note: string): boolean {
    return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(note);
  }
}

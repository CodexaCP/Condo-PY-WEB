import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { PaymentsApiService } from '../../api/payments-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import {
  AllocationRequest,
  Building,
  ExpenseCharge,
  ExpenseChargeType,
  ExpensePeriod,
  Payment,
  PaymentMethod,
  Unit
} from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-payments-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Pagos</h1>
            <p>Registro de cobros recibidos por unidad y periodo.</p>
          </div>
        </div>

        <p-button
          *ngIf="!isReadOnly"
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo pago'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <div class="filters-grid">
        <label>
          <span>Filtrar por edificio</span>
          <select [(ngModel)]="filters.buildingId" name="filterBuildingId" (ngModelChange)="onBuildingFilterChange()">
            <option value="">Todos los edificios</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </label>

        <label>
          <span>Filtrar por periodo</span>
          <select [(ngModel)]="filters.expensePeriodId" name="filterPeriodId" (ngModelChange)="applyFilters()">
            <option value="">Todos los periodos</option>
            <option *ngFor="let p of filteredPeriodsForSelector" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
          </select>
        </label>

        <div class="filter-actions">
          <p-button type="button" label="Limpiar filtros" severity="secondary" [text]="true" (onClick)="resetFilters()"></p-button>
        </div>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitPayment()">
        <label>
          <span>Periodo</span>
          <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required (ngModelChange)="onFormContextChange()">
            <option value="" disabled>Selecciona un periodo</option>
            <option *ngFor="let p of periods" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
          </select>
        </label>

        <label>
          <span>Unidad</span>
          <select [(ngModel)]="form.unitId" name="unitId" required (ngModelChange)="onFormContextChange()">
            <option value="" disabled>Selecciona una unidad</option>
            <option *ngFor="let u of availableUnits" [value]="u.id">{{ u.code }} · {{ u.buildingName }}</option>
          </select>
        </label>

        <label>
          <span>Fecha de pago</span>
          <input [(ngModel)]="form.paymentDate" name="paymentDate" type="date" required />
        </label>

        <label>
          <span>Monto</span>
          <input [(ngModel)]="form.amount" name="amount" type="number" min="1" step="0.01" required />
        </label>

        <label>
          <span>Metodo</span>
          <select [(ngModel)]="form.method" name="method" required>
            <option *ngFor="let m of methods" [value]="m">{{ paymentMethodLabel(m) }}</option>
          </select>
        </label>

        <label>
          <span>Referencia</span>
          <input [(ngModel)]="form.reference" name="reference" type="text" maxlength="100" />
        </label>

        <label class="wide">
          <span>Notas</span>
          <input [(ngModel)]="form.notes" name="notes" type="text" maxlength="500" />
        </label>

        <div class="wide charges-panel" *ngIf="pendingCharges.length > 0">
          <div class="charges-panel-header">
            <span>Cargos pendientes de esta unidad</span>
            <small>Total pendiente: {{ formatCurrency(totalPending) }}</small>
          </div>
          <div class="charge-row" *ngFor="let charge of pendingCharges">
            <label class="charge-check">
              <input type="checkbox" [(ngModel)]="charge['_selected']" [ngModelOptions]="{standalone: true}"
                (ngModelChange)="onChargeSelectionChange()" />
              <span>{{ charge.concept }}</span>
              <small>{{ chargeTypeLabel(charge.chargeType) }}</small>
            </label>
            <div class="charge-amounts">
              <span class="charge-pending">{{ formatCurrency(charge.pendingAmount) }}</span>
              <input *ngIf="charge['_selected']"
                type="number"
                [(ngModel)]="charge['_allocAmount']"
                [ngModelOptions]="{standalone: true}"
                min="1"
                [max]="charge.pendingAmount"
                step="0.01"
                class="alloc-input"
                (ngModelChange)="onChargeSelectionChange()" />
            </div>
          </div>
          <div class="charges-panel-footer">
            <span>Asignado: {{ formatCurrency(totalAllocated) }}</span>
            <span [class.credit]="form.amount - totalAllocated > 0">
              Sin asignar: {{ formatCurrency(form.amount - totalAllocated) }}
            </span>
          </div>
        </div>
        <p class="wide app-state" *ngIf="loadingCharges">Cargando cargos pendientes...</p>

        <div class="wide form-actions">
          <p-button
            type="submit"
            [disabled]="!periods.length || !units.length"
            [loading]="isSaving"
            [label]="editingId ? 'Guardar cambios' : 'Registrar pago'">
          </p-button>
          <p-button *ngIf="editingId" type="button" label="Cancelar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>
      </form>

      <!-- Recibo post-cobro -->
      <div class="receipt-panel" *ngIf="receipt">
        <div class="receipt-header">
          <span class="receipt-title">Comprobante de pago</span>
          <p-button type="button" icon="pi pi-print" severity="secondary" [text]="true" label="Imprimir" (onClick)="printReceipt()"></p-button>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="receipt = null"></p-button>
        </div>
        <div class="receipt-body">
          <div class="receipt-row"><span>Comprobante</span><strong>#{{ receipt.id.slice(0,8).toUpperCase() }}</strong></div>
          <div class="receipt-row"><span>Fecha</span><strong>{{ receipt.paymentDate }}</strong></div>
          <div class="receipt-row"><span>Periodo</span><strong>{{ receipt.expensePeriodName }}</strong></div>
          <div class="receipt-row"><span>Edificio</span><strong>{{ receipt.buildingName }}</strong></div>
          <div class="receipt-row"><span>Unidad</span><strong>{{ receipt.unitCode }}</strong></div>
          <div class="receipt-row"><span>Monto cobrado</span><strong>{{ formatCurrency(receipt.amount) }}</strong></div>
          <div class="receipt-row"><span>Metodo</span><strong>{{ paymentMethodLabel(receipt.method) }}</strong></div>
          <div class="receipt-row" *ngIf="receipt.reference"><span>Referencia</span><strong>{{ receipt.reference }}</strong></div>
          <div class="receipt-allocations" *ngIf="receipt.allocations.length > 0">
            <span class="alloc-title">Cargos cubiertos:</span>
            <div class="alloc-row" *ngFor="let a of receipt.allocations">
              <span>{{ a.chargeConcept }}</span>
              <strong>{{ formatCurrency(a.allocatedAmount) }}</strong>
            </div>
          </div>
          <div class="receipt-row credit-row" *ngIf="receipt.amount - receipt.allocatedAmount > 0.01">
            <span>Credito a favor</span>
            <strong>{{ formatCurrency(receipt.amount - receipt.allocatedAmount) }}</strong>
          </div>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando pagos...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay pagos cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header payments-grid">
          <span>Fecha</span>
          <span>Periodo · Edificio</span>
          <span>Unidad</span>
          <span>Metodo</span>
          <span>Monto</span>
          <span>Asignado</span>
          <span class="actions-head" *ngIf="!isReadOnly">Acciones</span>
        </div>

        <div class="app-row payments-grid" *ngFor="let item of items">
          <strong>{{ item.paymentDate }}</strong>
          <span>{{ item.expensePeriodName }} · {{ item.buildingName }}</span>
          <span>{{ item.unitCode }}</span>
          <span>{{ paymentMethodLabel(item.method) }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <span [class.partial]="item.allocatedAmount < item.amount && item.allocatedAmount > 0"
                [class.unallocated]="item.allocatedAmount === 0">
            {{ formatCurrency(item.allocatedAmount) }}
            <small *ngIf="item.allocations.length > 0"> ({{ item.allocations.length }} cargos)</small>
          </span>
          <div class="app-actions" *ngIf="!isReadOnly">
            <p-button type="button" icon="pi pi-file" severity="secondary" [rounded]="true" [text]="true" pTooltip="Ver comprobante" (onClick)="showReceipt(item)"></p-button>
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving" (onClick)="deletePayment(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .filters-grid {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 1rem;
      align-items: end;
      margin-bottom: 1rem;
    }
    .payments-grid { grid-template-columns: 0.7fr 1.2fr 0.7fr 0.8fr 0.8fr 0.9fr 0.5fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .filter-actions { display:flex; justify-content:flex-end; }
    .actions-head { text-align:right; }

    .charges-panel {
      border: 1px solid var(--p-surface-border, #e5e7eb);
      border-radius: 6px;
      padding: 0.75rem;
      background: var(--p-surface-50, #f9fafb);
    }
    .charges-panel-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 0.9em;
    }
    .charge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.35rem 0;
      border-bottom: 1px solid var(--p-surface-border, #f0f0f0);
      gap: 1rem;
    }
    .charge-check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      cursor: pointer;
    }
    .charge-check small { color: #6b7280; font-size: 0.8em; }
    .charge-amounts { display: flex; align-items: center; gap: 0.5rem; }
    .charge-pending { font-weight: 600; min-width: 80px; text-align: right; }
    .alloc-input { width: 100px; padding: 2px 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9em; }
    .charges-panel-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1.5rem;
      margin-top: 0.5rem;
      font-size: 0.88em;
      color: #374151;
    }
    .credit { color: #059669; font-weight: 600; }

    .receipt-panel {
      border: 2px solid var(--p-primary-color, #3b82f6);
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
      background: var(--p-surface-0, #fff);
      max-width: 480px;
    }
    .receipt-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .receipt-title { font-weight: 700; font-size: 1.05em; flex: 1; }
    .receipt-body { display: flex; flex-direction: column; gap: 0.4rem; }
    .receipt-row { display: flex; justify-content: space-between; font-size: 0.9em; }
    .receipt-allocations { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; }
    .alloc-title { font-size: 0.85em; color: #6b7280; display: block; margin-bottom: 0.3rem; }
    .alloc-row { display: flex; justify-content: space-between; font-size: 0.88em; padding: 0.15rem 0; }
    .credit-row strong { color: #059669; }

    .partial { color: #f59e0b; }
    .unallocated { color: #9ca3af; }
    small { font-size: 0.8em; color: #6b7280; }

    @media (max-width: 900px) {
      .filters-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class PaymentsPageComponent implements OnInit {
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  items: Payment[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  pendingCharges: (ExpenseCharge & { _selected?: boolean; _allocAmount?: number })[] = [];
  loadingCharges = false;
  receipt: Payment | null = null;
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  readonly methods: PaymentMethod[] = ['Cash', 'BankTransfer', 'Card', 'Check', 'Other'];
  filters = { buildingId: '', expensePeriodId: '' };
  form = this.createInitialForm();

  get filteredPeriodsForSelector(): ExpensePeriod[] {
    return this.filters.buildingId
      ? this.periods.filter((p) => p.buildingId === this.filters.buildingId)
      : this.periods;
  }

  get availableUnits(): Unit[] {
    const selectedPeriod = this.periods.find((p) => p.id === this.form.expensePeriodId);
    return selectedPeriod ? this.units.filter((u) => u.buildingId === selectedPeriod.buildingId) : this.units;
  }

  get totalPending(): number {
    return this.pendingCharges.reduce((sum, c) => sum + c.pendingAmount, 0);
  }

  get totalAllocated(): number {
    return this.pendingCharges
      .filter((c) => c['_selected'])
      .reduce((sum, c) => sum + Number(c['_allocAmount'] || 0), 0);
  }

  ngOnInit(): void {
    this.loadData();
  }

  toggleForm(): void {
    if (this.showForm && this.editingId) {
      this.cancelEdit();
      return;
    }
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.form = this.createInitialForm();
      this.pendingCharges = [];
    }
  }

  onFormContextChange(): void {
    if (this.form.expensePeriodId && this.form.unitId) {
      this.loadPendingCharges();
    } else {
      this.pendingCharges = [];
    }
  }

  onChargeSelectionChange(): void {
    const selectedTotal = this.totalAllocated;
    if (this.form.amount !== selectedTotal && selectedTotal > 0) {
      this.form.amount = selectedTotal;
    }
  }

  startEdit(item: Payment): void {
    this.editingId = item.id;
    this.showForm = true;
    this.form = {
      expensePeriodId: item.expensePeriodId,
      unitId: item.unitId,
      paymentDate: item.paymentDate,
      amount: item.amount,
      method: item.method,
      reference: item.reference,
      notes: item.notes
    };
    this.loadPendingCharges(item.allocations.map((a) => ({ chargeId: a.expenseChargeId, amount: a.allocatedAmount })));
    this.receipt = null;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
    this.pendingCharges = [];
  }

  onBuildingFilterChange(): void {
    const periodStillMatches = this.filteredPeriodsForSelector.some((p) => p.id === this.filters.expensePeriodId);
    if (!periodStillMatches) {
      this.filters.expensePeriodId = '';
    }
    this.applyFilters();
  }

  applyFilters(): void {
    this.loading = true;
    this.paymentsApi.getAll({
      buildingId: this.filters.buildingId || undefined,
      expensePeriodId: this.filters.expensePeriodId || undefined
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items = items;
          this.sortItems();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar los pagos.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  resetFilters(): void {
    this.filters = { buildingId: '', expensePeriodId: '' };
    this.applyFilters();
  }

  submitPayment(): void {
    this.isSaving = true;

    const allocations: AllocationRequest[] = this.pendingCharges
      .filter((c) => c['_selected'] && Number(c['_allocAmount']) > 0)
      .map((c) => ({ expenseChargeId: c.id, amount: Number(c['_allocAmount']) }));

    const request = {
      expensePeriodId: this.form.expensePeriodId,
      unitId: this.form.unitId,
      paymentDate: this.form.paymentDate,
      amount: Number(this.form.amount),
      method: this.form.method,
      reference: this.form.reference.trim(),
      notes: this.form.notes.trim(),
      allocations
    };

    const operation = this.editingId
      ? this.paymentsApi.update(this.editingId, request)
      : this.paymentsApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (payment) => {
        this.items = this.editingId
          ? this.items.map((item) => item.id === payment.id ? payment : item)
          : [payment, ...this.items];
        this.sortItems();
        this.receipt = payment;
        this.form = this.createInitialForm();
        this.pendingCharges = [];
        this.isSaving = false;
        this.showForm = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Pago actualizado.' : 'Pago registrado. Ver comprobante abajo.', life: 4000 });
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, this.editingId ? 'No se pudo actualizar el pago.' : 'No se pudo registrar el pago.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  showReceipt(item: Payment): void {
    this.receipt = item;
    this.showForm = false;
    this.cdr.markForCheck();
  }

  printReceipt(): void {
    window.print();
  }

  deletePayment(item: Payment): void {
    this.isSaving = true;

    this.paymentsApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        if (this.receipt?.id === item.id) {
          this.receipt = null;
        }
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Pago eliminado correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar el pago.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  chargeTypeLabel(type: ExpenseChargeType): string {
    return ({ Ordinary: 'Ordinaria', ReserveFund: 'Fondo reserva', Extraordinary: 'Extraordinario', Individual: 'Individual', Adjustment: 'Ajuste' })[type];
  }

  paymentMethodLabel(method: PaymentMethod): string {
    return ({ Cash: 'Efectivo', BankTransfer: 'Transferencia', Card: 'Tarjeta', Check: 'Cheque', Other: 'Otro' })[method];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadPendingCharges(preSelected?: { chargeId: string; amount: number }[]): void {
    if (!this.form.expensePeriodId || !this.form.unitId) return;
    this.loadingCharges = true;

    this.paymentsApi.getPendingCharges(this.form.expensePeriodId, this.form.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (charges) => {
          this.pendingCharges = charges
            .filter((c) => !c.isReversal && !c.isReversed && c.pendingAmount > 0)
            .map((c) => {
              const pre = preSelected?.find((p) => p.chargeId === c.id);
              return Object.assign(c, {
                _selected: !!pre,
                _allocAmount: pre?.amount ?? c.pendingAmount
              });
            });
          this.loadingCharges = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingCharges = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadData(): void {
    forkJoin({
      payments: this.paymentsApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll(),
      units: this.unitsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ payments, buildings, periods, units }) => {
          this.items = payments;
          this.buildings = buildings;
          this.periods = periods;
          this.units = units;
          this.sortItems();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar los pagos.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      b.paymentDate.localeCompare(a.paymentDate) ||
      a.buildingName.localeCompare(b.buildingName) ||
      a.unitCode.localeCompare(b.unitCode));
  }

  private createInitialForm() {
    return {
      expensePeriodId: '',
      unitId: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      method: 'BankTransfer' as PaymentMethod,
      reference: '',
      notes: ''
    };
  }
}

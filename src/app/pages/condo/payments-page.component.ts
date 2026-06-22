import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { PaymentsApiService } from '../../api/payments-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { ExpensePeriod, Payment, PaymentMethod, Unit } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-payments-page',
  imports: [CommonModule, FormsModule, Button, Card, Message],
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
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo pago'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitPayment()">
        <label>
          <span>Periodo</span>
          <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required>
            <option value="" disabled>Selecciona un periodo</option>
            <option *ngFor="let period of periods" [value]="period.id">{{ period.name }} · {{ period.buildingName }}</option>
          </select>
        </label>

        <label>
          <span>Unidad</span>
          <select [(ngModel)]="form.unitId" name="unitId" required>
            <option value="" disabled>Selecciona una unidad</option>
            <option *ngFor="let unit of availableUnits" [value]="unit.id">{{ unit.code }} · {{ unit.buildingName }}</option>
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
            <option *ngFor="let method of methods" [value]="method">{{ paymentMethodLabel(method) }}</option>
          </select>
        </label>

        <label>
          <span>Referencia</span>
          <input [(ngModel)]="form.reference" name="reference" type="text" />
        </label>

        <label class="wide">
          <span>Notas</span>
          <input [(ngModel)]="form.notes" name="notes" type="text" />
        </label>

        <div class="wide form-actions">
          <p-button
            type="submit"
            [disabled]="!periods.length || !units.length"
            [loading]="isSaving"
            [label]="editingId ? 'Guardar cambios' : 'Guardar pago'">
          </p-button>
          <p-button *ngIf="editingId" type="button" label="Cancelar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>
      </form>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
      <p-message *ngIf="successMessage" severity="success" [text]="successMessage"></p-message>
      <p class="app-state" *ngIf="loading">Cargando pagos...</p>
      <p class="app-state" *ngIf="!loading && !errorMessage && !items.length">No hay pagos cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header payments-grid">
          <span>Fecha</span>
          <span>Periodo</span>
          <span>Unidad</span>
          <span>Metodo</span>
          <span>Monto</span>
          <span class="actions-head">Acciones</span>
        </div>

        <div class="app-row payments-grid" *ngFor="let item of items">
          <strong>{{ item.paymentDate }}</strong>
          <span>{{ item.expensePeriodName }}</span>
          <span>{{ item.unitCode }} · {{ item.buildingName }}</span>
          <span>{{ paymentMethodLabel(item.method) }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving" (onClick)="deletePayment(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .payments-grid { grid-template-columns: 0.8fr 1fr 1.2fr 0.8fr 0.8fr 0.45fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .actions-head { text-align:right; }
  `]
})
export class PaymentsPageComponent implements OnInit {
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  items: Payment[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  errorMessage = '';
  successMessage = '';
  readonly methods: PaymentMethod[] = ['Cash', 'BankTransfer', 'Card', 'Check', 'Other'];
  form = this.createInitialForm();

  get availableUnits(): Unit[] {
    const selectedPeriod = this.periods.find((item) => item.id === this.form.expensePeriodId);
    return selectedPeriod ? this.units.filter((item) => item.buildingId === selectedPeriod.buildingId) : this.units;
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
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.showForm) {
      this.form = this.createInitialForm();
    }
  }

  startEdit(item: Payment): void {
    this.editingId = item.id;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.form = {
      expensePeriodId: item.expensePeriodId,
      unitId: item.unitId,
      paymentDate: item.paymentDate,
      amount: item.amount,
      method: item.method,
      reference: item.reference,
      notes: item.notes
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
    this.errorMessage = '';
  }

  submitPayment(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSaving = true;

    const request = {
      expensePeriodId: this.form.expensePeriodId,
      unitId: this.form.unitId,
      paymentDate: this.form.paymentDate,
      amount: Number(this.form.amount),
      method: this.form.method,
      reference: this.form.reference,
      notes: this.form.notes
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
        this.form = this.createInitialForm();
        this.isSaving = false;
        this.showForm = false;
        this.successMessage = this.editingId ? 'Pago actualizado correctamente.' : 'Pago registrado correctamente.';
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(
          error,
          this.editingId ? 'No se pudo actualizar el pago.' : 'No se pudo guardar el pago.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deletePayment(item: Payment): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSaving = true;

    this.paymentsApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.isSaving = false;
        this.successMessage = 'Pago eliminado correctamente.';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(error, 'No se pudo eliminar el pago.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
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

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadData(): void {
    forkJoin({
      payments: this.paymentsApi.getAll(),
      periods: this.periodsApi.getAll(),
      units: this.unitsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ payments, periods, units }) => {
          this.items = payments;
          this.periods = periods;
          this.units = units;
          this.sortItems();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el listado de pagos.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      b.paymentDate.localeCompare(a.paymentDate) ||
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

import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { ExpenseChargesApiService } from '../../api/expense-charges-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import { ExpenseCharge, ExpenseChargeType, ExpensePeriod, Unit } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-expense-charges-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Cargos</h1>
            <p>Emision de expensas por unidad dentro de cada periodo.</p>
          </div>
        </div>

        <p-button
          *ngIf="!isReadOnly"
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo cargo'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitCharge()">
        <label>
          <span>Periodo</span>
          <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required>
            <option value="" disabled>Selecciona un periodo</option>
            <option *ngFor="let period of draftPeriods" [value]="period.id">{{ period.name }} · {{ period.buildingName }}</option>
          </select>
        </label>

        <label>
          <span>Unidad</span>
          <select [(ngModel)]="form.unitId" name="unitId" required>
            <option value="" disabled>Selecciona una unidad</option>
            <option *ngFor="let unit of availableUnits" [value]="unit.id">{{ unit.code }} · {{ unit.buildingName }}</option>
          </select>
        </label>

        <label class="wide">
          <span>Concepto</span>
          <input [(ngModel)]="form.concept" name="concept" type="text" required />
        </label>

        <label>
          <span>Tipo</span>
          <select [(ngModel)]="form.chargeType" name="chargeType" required>
            <option *ngFor="let type of chargeTypes" [value]="type">{{ chargeTypeLabel(type) }}</option>
          </select>
        </label>

        <label>
          <span>Monto</span>
          <input [(ngModel)]="form.amount" name="amount" type="number" min="1" step="0.01" required />
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
            [label]="editingId ? 'Guardar cambios' : 'Guardar cargo'">
          </p-button>
          <p-button *ngIf="editingId" type="button" label="Cancelar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>
      </form>

      <p class="app-state" *ngIf="loading">Cargando cargos...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay cargos cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header charges-grid">
          <span>Concepto</span>
          <span>Tipo</span>
          <span>Periodo</span>
          <span>Unidad</span>
          <span>Edificio</span>
          <span>Monto</span>
          <span class="actions-head" *ngIf="!isReadOnly">Acciones</span>
        </div>

        <div class="app-row charges-grid" *ngFor="let item of items">
          <strong>{{ item.concept }}</strong>
          <span>{{ chargeTypeLabel(item.chargeType) }}</span>
          <span>{{ item.expensePeriodName }}</span>
          <span>{{ item.unitCode }}</span>
          <span>{{ item.buildingName }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <div class="app-actions" *ngIf="!isReadOnly">
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" [disabled]="!isDraftPeriod(item.expensePeriodId)" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving || !isDraftPeriod(item.expensePeriodId)" (onClick)="deleteCharge(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .charges-grid { grid-template-columns: 1.1fr 0.8fr 1fr 0.7fr 1fr 0.8fr 0.45fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .actions-head { text-align:right; }
  `]
})
export class ExpenseChargesPageComponent implements OnInit {
  private readonly chargesApi = inject(ExpenseChargesApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  items: ExpenseCharge[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  readonly chargeTypes: ExpenseChargeType[] = ['Ordinary', 'ReserveFund', 'Extraordinary', 'Individual', 'Adjustment'];
  form = this.createInitialForm();

  get draftPeriods(): ExpensePeriod[] {
    return this.periods.filter((item) => item.status === 'Draft');
  }

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
    if (!this.showForm) {
      this.form = this.createInitialForm();
    }
  }

  startEdit(item: ExpenseCharge): void {
    this.editingId = item.id;
    this.showForm = true;
    this.form = {
      expensePeriodId: item.expensePeriodId,
      unitId: item.unitId,
      chargeType: item.chargeType,
      concept: item.concept,
      amount: item.amount,
      notes: item.notes
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
  }

  submitCharge(): void {
    this.isSaving = true;

    const request = {
      expensePeriodId: this.form.expensePeriodId,
      unitId: this.form.unitId,
      chargeType: this.form.chargeType,
      concept: this.form.concept,
      amount: Number(this.form.amount),
      notes: this.form.notes
    };

    const operation = this.editingId
      ? this.chargesApi.update(this.editingId, request)
      : this.chargesApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (charge) => {
        this.items = this.editingId
          ? this.items.map((item) => item.id === charge.id ? charge : item)
          : [charge, ...this.items];
        this.sortItems();
        this.form = this.createInitialForm();
        this.isSaving = false;
        this.showForm = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Cargo actualizado correctamente.' : 'Cargo creado correctamente.', life: 4000 });
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(
          error,
          this.editingId ? 'No se pudo actualizar el cargo.' : 'No se pudo guardar el cargo.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteCharge(item: ExpenseCharge): void {
    this.isSaving = true;

    this.chargesApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Cargo eliminado correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar el cargo.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  chargeTypeLabel(type: ExpenseChargeType): string {
    return type === 'Ordinary'
      ? 'Ordinaria'
      : type === 'ReserveFund'
        ? 'Fondo reserva'
        : type === 'Extraordinary'
          ? 'Extraordinario'
          : type === 'Individual'
            ? 'Individual'
            : 'Ajuste';
  }

  isDraftPeriod(expensePeriodId: string): boolean {
    return this.periods.some((item) => item.id === expensePeriodId && item.status === 'Draft');
  }

  private loadData(): void {
    forkJoin({
      charges: this.chargesApi.getAll(),
      periods: this.periodsApi.getAll(),
      units: this.unitsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ charges, periods, units }) => {
          this.items = charges;
          this.periods = periods;
          this.units = units;
          this.sortItems();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de cargos.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      a.buildingName.localeCompare(b.buildingName) ||
      a.expensePeriodName.localeCompare(b.expensePeriodName) ||
      a.unitCode.localeCompare(b.unitCode));
  }

  private createInitialForm() {
    return {
      expensePeriodId: '',
      unitId: '',
      chargeType: 'Ordinary' as ExpenseChargeType,
      concept: '',
      amount: 0,
      notes: ''
    };
  }
}

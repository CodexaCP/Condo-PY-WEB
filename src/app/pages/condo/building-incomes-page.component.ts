import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingIncomesApiService } from '../../api/building-incomes-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import {
  Building,
  BuildingIncome,
  BuildingIncomeCategory,
  CreateBuildingIncomeRequest,
  ExpensePeriod
} from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-building-incomes-page',
  imports: [CommonModule, FormsModule, Button, Card, Message],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Ingresos del edificio</h1>
            <p>Compensaciones e ingresos que reducen o ajustan la liquidacion comun.</p>
          </div>
        </div>

        <p-button
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo ingreso'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <div class="filters-grid">
        <label>
          <span>Filtrar por edificio</span>
          <select [(ngModel)]="filters.buildingId" name="filterBuildingId" (ngModelChange)="onBuildingFilterChange()">
            <option value="">Todos los edificios</option>
            <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
          </select>
        </label>

        <label>
          <span>Filtrar por periodo</span>
          <select [(ngModel)]="filters.expensePeriodId" name="filterExpensePeriodId" (ngModelChange)="applyFilters()">
            <option value="">Todos los periodos</option>
            <option *ngFor="let period of filteredPeriodsForSelector" [value]="period.id">{{ period.name }} - {{ period.buildingName }}</option>
          </select>
        </label>

        <div class="filter-actions">
          <p-button type="button" label="Limpiar filtros" severity="secondary" [text]="true" (onClick)="resetFilters()"></p-button>
        </div>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitIncome()">
        <label>
          <span>Edificio</span>
          <select [(ngModel)]="form.buildingId" name="buildingId" required (ngModelChange)="onFormBuildingChange()">
            <option value="" disabled>Selecciona un edificio</option>
            <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
          </select>
        </label>

        <label>
          <span>Periodo</span>
          <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required>
            <option value="" disabled>Selecciona un periodo</option>
            <option *ngFor="let period of availablePeriods" [value]="period.id">{{ period.name }}</option>
          </select>
        </label>

        <label>
          <span>Categoria</span>
          <select [(ngModel)]="form.category" name="category" required>
            <option *ngFor="let category of categories" [value]="category">{{ categoryLabel(category) }}</option>
          </select>
        </label>

        <label>
          <span>Fecha del ingreso</span>
          <input [(ngModel)]="form.incomeDate" name="incomeDate" type="date" required />
        </label>

        <label>
          <span>Monto</span>
          <input [(ngModel)]="form.amount" name="amount" type="number" min="1" step="0.01" required />
        </label>

        <label class="wide">
          <span>Descripcion</span>
          <input [(ngModel)]="form.description" name="description" type="text" required />
        </label>

        <label class="wide">
          <span>Notas</span>
          <input [(ngModel)]="form.notes" name="notes" type="text" />
        </label>

        <div class="wide form-actions">
          <p-button
            type="submit"
            [disabled]="!buildings.length || !periods.length"
            [loading]="isSaving"
            [label]="editingId ? 'Guardar cambios' : 'Guardar ingreso'">
          </p-button>
          <p-button *ngIf="editingId" type="button" label="Cancelar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>
      </form>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
      <p-message *ngIf="successMessage" severity="success" [text]="successMessage"></p-message>
      <p class="app-state" *ngIf="loading">Cargando ingresos del edificio...</p>
      <p class="app-state" *ngIf="!loading && !errorMessage && !items.length">No hay ingresos cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header incomes-grid">
          <span>Fecha</span>
          <span>Descripcion</span>
          <span>Periodo</span>
          <span>Categoria</span>
          <span>Monto</span>
          <span class="actions-head">Acciones</span>
        </div>

        <div class="app-row incomes-grid" *ngFor="let item of items">
          <strong>{{ item.incomeDate }}</strong>
          <span>{{ item.description }}</span>
          <span>{{ item.expensePeriodName }} - {{ item.buildingName }}</span>
          <span>{{ categoryLabel(item.category) }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving" (onClick)="deleteIncome(item)"></p-button>
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
    .incomes-grid { grid-template-columns: 0.7fr 1.4fr 1.2fr 0.9fr 0.7fr 0.45fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .filter-actions { display:flex; justify-content:flex-end; }
    .actions-head { text-align:right; }
    @media (max-width: 900px) {
      .filters-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BuildingIncomesPageComponent implements OnInit {
  private readonly incomesApi = inject(BuildingIncomesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  items: BuildingIncome[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  errorMessage = '';
  successMessage = '';
  readonly categories: BuildingIncomeCategory[] = ['AccumulatedBalance', 'CommonAreaRental', 'Interest', 'OperationalFund', 'CreditAdjustment', 'Other'];
  filters = { buildingId: '', expensePeriodId: '' };
  form = this.createInitialForm();

  get filteredPeriodsForSelector(): ExpensePeriod[] {
    return this.filters.buildingId
      ? this.periods.filter((item) => item.buildingId === this.filters.buildingId)
      : this.periods;
  }

  get availablePeriods(): ExpensePeriod[] {
    return this.form.buildingId
      ? this.periods.filter((item) => item.buildingId === this.form.buildingId)
      : this.periods;
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

  startEdit(item: BuildingIncome): void {
    this.editingId = item.id;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.form = {
      buildingId: item.buildingId,
      expensePeriodId: item.expensePeriodId,
      category: item.category,
      description: item.description,
      incomeDate: item.incomeDate,
      amount: item.amount,
      notes: item.notes
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
    this.errorMessage = '';
  }

  onFormBuildingChange(): void {
    const periodStillMatches = this.availablePeriods.some((item) => item.id === this.form.expensePeriodId);
    if (!periodStillMatches) {
      this.form.expensePeriodId = '';
    }
  }

  onBuildingFilterChange(): void {
    const periodStillMatches = this.filteredPeriodsForSelector.some((item) => item.id === this.filters.expensePeriodId);
    if (!periodStillMatches) {
      this.filters.expensePeriodId = '';
    }

    this.applyFilters();
  }

  applyFilters(): void {
    this.loading = true;
    this.errorMessage = '';

    this.incomesApi.getAll({
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
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el listado de ingresos del edificio.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  resetFilters(): void {
    this.filters = { buildingId: '', expensePeriodId: '' };
    this.applyFilters();
  }

  submitIncome(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSaving = true;

    const request: CreateBuildingIncomeRequest = {
      buildingId: this.form.buildingId,
      expensePeriodId: this.form.expensePeriodId,
      category: this.form.category,
      description: this.form.description,
      incomeDate: this.form.incomeDate,
      amount: Number(this.form.amount),
      notes: this.form.notes
    };

    const operation = this.editingId
      ? this.incomesApi.update(this.editingId, request)
      : this.incomesApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (income) => {
        this.upsertLocalItem(income);
        this.form = this.createInitialForm();
        this.isSaving = false;
        this.showForm = false;
        this.successMessage = this.editingId ? 'Ingreso actualizado correctamente.' : 'Ingreso creado correctamente.';
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(
          error,
          this.editingId ? 'No se pudo actualizar el ingreso.' : 'No se pudo guardar el ingreso.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteIncome(item: BuildingIncome): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSaving = true;

    this.incomesApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.isSaving = false;
        this.successMessage = 'Ingreso eliminado correctamente.';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(error, 'No se pudo eliminar el ingreso.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  categoryLabel(category: BuildingIncomeCategory): string {
    return ({
      AccumulatedBalance: 'Saldo acumulado',
      CommonAreaRental: 'Alquiler area comun',
      Interest: 'Interes',
      OperationalFund: 'Fondo operativo',
      CreditAdjustment: 'Ajuste a favor',
      Other: 'Otro'
    })[category];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadData(): void {
    forkJoin({
      incomes: this.incomesApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ incomes, buildings, periods }) => {
          this.items = incomes;
          this.buildings = buildings;
          this.periods = periods;
          this.sortItems();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el listado de ingresos del edificio.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private upsertLocalItem(income: BuildingIncome): void {
    const matchesFilters =
      (!this.filters.buildingId || income.buildingId === this.filters.buildingId) &&
      (!this.filters.expensePeriodId || income.expensePeriodId === this.filters.expensePeriodId);

    if (!matchesFilters) {
      this.items = this.items.filter((item) => item.id !== income.id);
      return;
    }

    this.items = this.editingId
      ? this.items.map((item) => item.id === income.id ? income : item)
      : [income, ...this.items];

    this.sortItems();
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      b.incomeDate.localeCompare(a.incomeDate) ||
      a.buildingName.localeCompare(b.buildingName) ||
      a.description.localeCompare(b.description));
  }

  private createInitialForm() {
    return {
      buildingId: '',
      expensePeriodId: '',
      category: 'OperationalFund' as BuildingIncomeCategory,
      description: '',
      incomeDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      notes: ''
    };
  }
}

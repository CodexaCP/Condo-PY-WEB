import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpensesApiService } from '../../api/building-expenses-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import {
  Building,
  BuildingExpense,
  BuildingExpenseCategory,
  BuildingExpenseDistributionType,
  CreateBuildingExpenseRequest,
  ExpensePeriod,
  Unit
} from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-building-expenses-page',
  imports: [CommonModule, FormsModule, Button, Card, Message],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Gastos del edificio</h1>
            <p>Registro formal de facturas, servicios y egresos a distribuir por periodo.</p>
          </div>
        </div>

        <p-button
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo gasto'"
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

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitExpense()">
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
          <span>Fecha del gasto</span>
          <input [(ngModel)]="form.expenseDate" name="expenseDate" type="date" required />
        </label>

        <label>
          <span>Proveedor</span>
          <input [(ngModel)]="form.supplierName" name="supplierName" type="text" maxlength="160" />
        </label>

        <label>
          <span>Monto</span>
          <input [(ngModel)]="form.amount" name="amount" type="number" min="1" step="0.01" required />
        </label>

        <label class="wide">
          <span>Descripcion</span>
          <input [(ngModel)]="form.description" name="description" type="text" required maxlength="200" />
        </label>

        <label>
          <span>Distribucion</span>
          <select [(ngModel)]="form.distributionType" name="distributionType" required (ngModelChange)="onDistributionTypeChange()">
            <option *ngFor="let distribution of distributionTypes" [value]="distribution">{{ distributionTypeLabel(distribution) }}</option>
          </select>
        </label>

        <label>
          <span>Unidad destino</span>
          <select [(ngModel)]="form.targetUnitId" name="targetUnitId" [required]="requiresTargetUnit">
            <option value="">Sin unidad</option>
            <option *ngFor="let unit of availableUnits" [value]="unit.id">{{ unit.code }}</option>
          </select>
        </label>

        <label class="wide">
          <span>Notas</span>
          <input [(ngModel)]="form.notes" name="notes" type="text" maxlength="500" />
        </label>

        <div class="wide form-actions">
          <p-button
            type="submit"
            [disabled]="!buildings.length || !periods.length"
            [loading]="isSaving"
            [label]="editingId ? 'Guardar cambios' : 'Guardar gasto'">
          </p-button>
          <p-button *ngIf="editingId" type="button" label="Cancelar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>
      </form>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
      <p-message *ngIf="successMessage" severity="success" [text]="successMessage"></p-message>
      <p class="app-state" *ngIf="loading">Cargando gastos del edificio...</p>
      <p class="app-state" *ngIf="!loading && !errorMessage && !items.length">No hay gastos cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header expenses-grid">
          <span>Fecha</span>
          <span>Descripcion</span>
          <span>Periodo</span>
          <span>Distribucion</span>
          <span>Monto</span>
          <span class="actions-head">Acciones</span>
        </div>

        <div class="app-row expenses-grid" *ngFor="let item of items">
          <strong>{{ item.expenseDate }}</strong>
          <span>{{ item.description }}<small *ngIf="item.supplierName"> - {{ item.supplierName }}</small></span>
          <span>{{ item.expensePeriodName }} - {{ item.buildingName }}</span>
          <span>{{ distributionSummary(item) }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" [disabled]="!isDraftPeriod(item.expensePeriodId)" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving || !isDraftPeriod(item.expensePeriodId)" (onClick)="deleteExpense(item)"></p-button>
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
    .expenses-grid { grid-template-columns: 0.7fr 1.4fr 1.2fr 1fr 0.7fr 0.45fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .filter-actions { display:flex; justify-content:flex-end; }
    .actions-head { text-align:right; }
    small { color:#6d8487; }
    @media (max-width: 900px) {
      .filters-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BuildingExpensesPageComponent implements OnInit {
  private readonly expensesApi = inject(BuildingExpensesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  items: BuildingExpense[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  errorMessage = '';
  successMessage = '';
  readonly categories: BuildingExpenseCategory[] = ['Utilities', 'Cleaning', 'Security', 'Maintenance', 'Elevator', 'Insurance', 'Payroll', 'Taxes', 'Administration', 'ReserveFund', 'Extraordinary', 'Supplies', 'Other'];
  readonly distributionTypes: BuildingExpenseDistributionType[] = ['ByCoefficient', 'FixedPerUnit', 'IndividualUnit', 'NonDistributed'];
  filters = { buildingId: '', expensePeriodId: '' };
  form = this.createInitialForm();

  get filteredPeriodsForSelector(): ExpensePeriod[] {
    return this.filters.buildingId
      ? this.periods.filter((item) => item.buildingId === this.filters.buildingId)
      : this.periods;
  }

  get availablePeriods(): ExpensePeriod[] {
    return this.form.buildingId
      ? this.periods.filter((item) => item.buildingId === this.form.buildingId && item.status === 'Draft')
      : this.periods.filter((item) => item.status === 'Draft');
  }

  get availableUnits(): Unit[] {
    return this.form.buildingId
      ? this.units.filter((item) => item.buildingId === this.form.buildingId)
      : this.units;
  }

  get requiresTargetUnit(): boolean {
    return this.form.distributionType === 'IndividualUnit';
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

  startEdit(item: BuildingExpense): void {
    this.editingId = item.id;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.form = {
      buildingId: item.buildingId,
      expensePeriodId: item.expensePeriodId,
      category: item.category,
      supplierName: item.supplierName,
      description: item.description,
      expenseDate: item.expenseDate,
      amount: item.amount,
      distributionType: item.distributionType,
      targetUnitId: item.targetUnitId ?? '',
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

    const unitStillMatches = this.availableUnits.some((item) => item.id === this.form.targetUnitId);
    if (!unitStillMatches) {
      this.form.targetUnitId = '';
    }
  }

  onDistributionTypeChange(): void {
    if (!this.requiresTargetUnit) {
      this.form.targetUnitId = '';
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

    this.expensesApi.getAll({
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
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el listado de gastos del edificio.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  resetFilters(): void {
    this.filters = { buildingId: '', expensePeriodId: '' };
    this.applyFilters();
  }

  submitExpense(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const request: CreateBuildingExpenseRequest = {
      buildingId: this.form.buildingId,
      expensePeriodId: this.form.expensePeriodId,
      category: this.form.category,
      supplierName: this.form.supplierName.trim(),
      description: this.form.description.trim(),
      expenseDate: this.form.expenseDate,
      amount: Number(this.form.amount),
      distributionType: this.form.distributionType,
      targetUnitId: this.requiresTargetUnit ? this.form.targetUnitId || null : null,
      notes: this.form.notes.trim()
    };

    const validationError = this.validateForm(request);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isSaving = true;

    const operation = this.editingId
      ? this.expensesApi.update(this.editingId, request)
      : this.expensesApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (expense) => {
        this.upsertLocalItem(expense);
        this.form = this.createInitialForm();
        this.isSaving = false;
        this.showForm = false;
        this.successMessage = this.editingId ? 'Gasto actualizado correctamente.' : 'Gasto creado correctamente.';
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(
          error,
          this.editingId ? 'No se pudo actualizar el gasto.' : 'No se pudo guardar el gasto.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteExpense(item: BuildingExpense): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSaving = true;

    this.expensesApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.isSaving = false;
        this.successMessage = 'Gasto eliminado correctamente.';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(error, 'No se pudo eliminar el gasto.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  categoryLabel(category: BuildingExpenseCategory): string {
    return ({
      Utilities: 'Servicios',
      Cleaning: 'Limpieza',
      Security: 'Seguridad',
      Maintenance: 'Mantenimiento',
      Elevator: 'Ascensor',
      Insurance: 'Seguro',
      Payroll: 'Salarios',
      Taxes: 'Impuestos',
      Administration: 'Administracion',
      ReserveFund: 'Fondo de reserva',
      Extraordinary: 'Extraordinario',
      Supplies: 'Insumos',
      Other: 'Otro'
    })[category];
  }

  distributionTypeLabel(type: BuildingExpenseDistributionType): string {
    return ({
      ByCoefficient: 'Por coeficiente',
      FixedPerUnit: 'Monto fijo por unidad',
      IndividualUnit: 'Unidad individual',
      ManualGroup: 'Grupo manual',
      NonDistributed: 'No distribuido'
    })[type];
  }

  distributionSummary(item: BuildingExpense): string {
    const base = this.distributionTypeLabel(item.distributionType);
    return item.targetUnitCode ? `${base} - ${item.targetUnitCode}` : base;
  }

  isDraftPeriod(expensePeriodId: string): boolean {
    return this.periods.some((item) => item.id === expensePeriodId && item.status === 'Draft');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadData(): void {
    forkJoin({
      expenses: this.expensesApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll(),
      units: this.unitsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ expenses, buildings, periods, units }) => {
          this.items = expenses;
          this.buildings = buildings;
          this.periods = periods;
          this.units = units;
          this.sortItems();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el listado de gastos del edificio.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private upsertLocalItem(expense: BuildingExpense): void {
    const matchesFilters =
      (!this.filters.buildingId || expense.buildingId === this.filters.buildingId) &&
      (!this.filters.expensePeriodId || expense.expensePeriodId === this.filters.expensePeriodId);

    if (!matchesFilters) {
      this.items = this.items.filter((item) => item.id !== expense.id);
      return;
    }

    this.items = this.editingId
      ? this.items.map((item) => item.id === expense.id ? expense : item)
      : [expense, ...this.items];

    this.sortItems();
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      b.expenseDate.localeCompare(a.expenseDate) ||
      a.buildingName.localeCompare(b.buildingName) ||
      a.description.localeCompare(b.description));
  }

  private createInitialForm() {
    return {
      buildingId: '',
      expensePeriodId: '',
      category: 'Utilities' as BuildingExpenseCategory,
      supplierName: '',
      description: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      distributionType: 'ByCoefficient' as BuildingExpenseDistributionType,
      targetUnitId: '',
      notes: ''
    };
  }

  private validateForm(form: CreateBuildingExpenseRequest): string | null {
    if (!form.buildingId) {
      return 'El edificio es obligatorio.';
    }

    if (!form.expensePeriodId) {
      return 'El periodo es obligatorio.';
    }

    if (!form.description) {
      return 'La descripcion es obligatoria.';
    }

    if (form.description.length > 200) {
      return 'La descripcion no puede superar los 200 caracteres.';
    }

    if (form.supplierName.length > 160) {
      return 'El proveedor no puede superar los 160 caracteres.';
    }

    if (form.notes.length > 500) {
      return 'Las notas no pueden superar los 500 caracteres.';
    }

    if (form.amount <= 0) {
      return 'El monto debe ser mayor que cero.';
    }

    if (form.distributionType === 'ManualGroup') {
      return 'La distribucion por grupo manual todavia no esta disponible.';
    }

    if (form.distributionType === 'IndividualUnit' && !form.targetUnitId) {
      return 'La unidad destino es obligatoria cuando la distribucion es por unidad individual.';
    }

    if (form.distributionType !== 'IndividualUnit' && form.targetUnitId) {
      return 'La unidad destino solo se permite cuando la distribucion es por unidad individual.';
    }

    const period = this.periods.find((item) => item.id === form.expensePeriodId);
    if (!period) {
      return 'El periodo seleccionado no existe.';
    }

    if (period.buildingId !== form.buildingId) {
      return 'El periodo seleccionado no pertenece al edificio indicado.';
    }

    if (period.status !== 'Draft') {
      return 'Solo puedes registrar gastos en periodos en borrador.';
    }

    if (form.expenseDate < period.startDate || form.expenseDate > period.endDate) {
      return 'La fecha del gasto debe estar dentro del rango del periodo seleccionado.';
    }

    if (form.targetUnitId) {
      const unit = this.units.find((item) => item.id === form.targetUnitId);
      if (!unit || unit.buildingId !== form.buildingId) {
        return 'La unidad destino debe pertenecer al edificio seleccionado.';
      }
    }

    return null;
  }
}

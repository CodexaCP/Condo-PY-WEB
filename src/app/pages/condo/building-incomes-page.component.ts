import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingIncomesApiService } from '../../api/building-incomes-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { AuthService } from '../../auth/auth.service';
import {
  Building,
  BuildingIncome,
  BuildingIncomeCategory,
  CreateBuildingIncomeRequest,
  ExpensePeriod,
  RolloverIncomeResult
} from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-building-incomes-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Ingresos del edificio</h1>
            <p>Compensaciones e ingresos que reducen o ajustan la liquidacion comun.</p>
          </div>
        </div>

        <div style="display:flex;gap:0.5rem;" *ngIf="!isReadOnly">
          <p-button
            label="Rollover saldo anterior"
            icon="pi pi-refresh"
            severity="secondary"
            (onClick)="toggleRolloverSection()">
          </p-button>
          <p-button
            [label]="showForm ? 'Cerrar formulario' : 'Nuevo ingreso'"
            [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
            (onClick)="toggleForm()">
          </p-button>
        </div>
      </div>

      <!-- PANEL ROLLOVER -->
      <div class="action-box" *ngIf="showRolloverSection">
        <div class="action-head">
          <div>
            <strong>Rollover saldo anterior</strong>
            <span>Calcula el saldo neto del periodo origen (Ingresos − Gastos) y lo registra como ingreso en el periodo destino.</span>
          </div>
          <p-button type="button" label="Cerrar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="toggleRolloverSection()"></p-button>
        </div>

        <form class="app-form-grid compact" (ngSubmit)="applyRollover()">
          <label>
            <span>Edificio</span>
            <select [(ngModel)]="rollover.buildingId" name="rolloverBuilding" required (ngModelChange)="onRolloverBuildingChange()">
              <option value="" disabled>Selecciona un edificio</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </label>

          <label>
            <span>Periodo origen (cerrado)</span>
            <select [(ngModel)]="rollover.sourcePeriodId" name="rolloverSource" required>
              <option value="" disabled>Selecciona un periodo origen</option>
              <option *ngFor="let p of rolloverSourcePeriods" [value]="p.id">{{ p.name }}</option>
            </select>
          </label>

          <label>
            <span>Periodo destino (borrador)</span>
            <select [(ngModel)]="rollover.targetPeriodId" name="rolloverTarget" required>
              <option value="" disabled>Selecciona un periodo destino</option>
              <option *ngFor="let p of rolloverTargetPeriods" [value]="p.id">{{ p.name }}</option>
            </select>
          </label>

          <div class="wide form-actions">
            <p-button
              type="submit"
              label="Calcular y aplicar rollover"
              icon="pi pi-play"
              severity="success"
              [loading]="isRollingOver"
              [disabled]="!rollover.buildingId || !rollover.sourcePeriodId || !rollover.targetPeriodId">
            </p-button>
          </div>
        </form>

        <div class="rollover-result" *ngIf="rolloverResult">
          <div class="result-row">
            <span class="result-label">Ingresos del periodo origen</span>
            <span class="result-value positive">{{ formatCurrency(rolloverResult.totalIngresos) }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Gastos del periodo origen</span>
            <span class="result-value negative">{{ formatCurrency(rolloverResult.totalGastos) }}</span>
          </div>
          <div class="result-row total">
            <span class="result-label">Saldo neto</span>
            <span class="result-value" [class.positive]="rolloverResult.saldo > 0" [class.negative]="rolloverResult.saldo < 0">
              {{ formatCurrency(rolloverResult.saldo) }}
            </span>
          </div>
          <p class="result-msg success" *ngIf="rolloverResult.rolloverCreated">
            ✓ Se creó el ingreso "Saldo anterior período {{ rolloverResult.sourcePeriodName }}" en el periodo "{{ rolloverResult.targetPeriodName }}".
          </p>
          <p class="result-msg warning" *ngIf="!rolloverResult.rolloverCreated">
            El periodo origen tiene déficit o saldo cero — no se generó ningún ingreso de rollover.
          </p>
        </div>
      </div>

      <!-- FILTROS -->
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

      <!-- FORMULARIO NUEVO INGRESO -->
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

      <p class="app-state" *ngIf="loading">Cargando ingresos del edificio...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay ingresos cargados.</p>

      <!-- LISTA DE INGRESOS -->
      <div class="app-list" *ngIf="items.length">
        <div class="app-row header incomes-grid">
          <span>Fecha</span>
          <span>Descripcion</span>
          <span>Periodo</span>
          <span>Categoria</span>
          <span>Monto</span>
          <span class="actions-head" *ngIf="!isReadOnly">Acciones</span>
        </div>

        <div class="app-row incomes-grid" *ngFor="let item of items">
          <strong>{{ item.incomeDate }}</strong>
          <span>{{ item.description }}</span>
          <span>{{ item.expensePeriodName }} - {{ item.buildingName }}</span>
          <span>{{ categoryLabel(item.category) }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <div class="app-actions" *ngIf="!isReadOnly">
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
    .compact { margin-top:0; }
    .action-box {
      margin-bottom: 1rem;
      padding: 1.1rem;
      border-radius: 22px;
      background: #f5faf9;
      border: 1px solid #dbe7e3;
    }
    .action-head {
      display:flex;
      justify-content:space-between;
      gap:1rem;
      align-items:start;
      margin-bottom:0.75rem;
    }
    .action-head strong { display:block; color:#14363d; }
    .action-head span { color:#6b878d; }
    .rollover-result {
      margin-top: 1rem;
      padding: 0.9rem 1rem;
      border-radius: 14px;
      background: #fff;
      border: 1px solid #dbe7e3;
    }
    .result-row {
      display:flex;
      justify-content:space-between;
      padding: 0.3rem 0;
      border-bottom: 1px solid #f0f4f3;
    }
    .result-row.total {
      border-bottom: none;
      padding-top: 0.6rem;
      font-weight: 600;
    }
    .result-label { color:#4d6a6e; }
    .result-value { font-weight:500; }
    .result-value.positive { color:#1a8c5b; }
    .result-value.negative { color:#c0392b; }
    .result-msg { margin: 0.7rem 0 0; padding: 0.55rem 0.9rem; border-radius:10px; font-size:0.9rem; }
    .result-msg.success { background:#d4f4e6; color:#0e5c3a; }
    .result-msg.warning { background:#fef6e0; color:#7d5a00; }
    @media (max-width: 900px) {
      .filters-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BuildingIncomesPageComponent implements OnInit {
  private readonly incomesApi = inject(BuildingIncomesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  items: BuildingIncome[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  loading = true;
  isSaving = false;
  isRollingOver = false;
  showForm = false;
  showRolloverSection = false;
  editingId: string | null = null;
  rolloverResult: RolloverIncomeResult | null = null;
  rollover = { buildingId: '', sourcePeriodId: '', targetPeriodId: '' };

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

  get rolloverSourcePeriods(): ExpensePeriod[] {
    if (!this.rollover.buildingId) return [];
    return this.periods.filter(
      (p) => p.buildingId === this.rollover.buildingId && p.id !== this.rollover.targetPeriodId
    );
  }

  get rolloverTargetPeriods(): ExpensePeriod[] {
    if (!this.rollover.buildingId) return [];
    return this.periods.filter(
      (p) => p.buildingId === this.rollover.buildingId && p.status === 'Draft' && p.id !== this.rollover.sourcePeriodId
    );
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

  toggleRolloverSection(): void {
    this.showRolloverSection = !this.showRolloverSection;
    if (!this.showRolloverSection) {
      this.rolloverResult = null;
      this.rollover = { buildingId: '', sourcePeriodId: '', targetPeriodId: '' };
    }
  }

  onRolloverBuildingChange(): void {
    this.rollover.sourcePeriodId = '';
    this.rollover.targetPeriodId = '';
    this.rolloverResult = null;
  }

  startEdit(item: BuildingIncome): void {
    this.editingId = item.id;
    this.showForm = true;
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
    this.incomesApi.getAll({
      buildingId: this.filters.buildingId || undefined,
      expensePeriodId: this.filters.expensePeriodId || undefined
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.items = items;
        this.sortItems();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de ingresos del edificio.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  resetFilters(): void {
    this.filters = { buildingId: '', expensePeriodId: '' };
    this.applyFilters();
  }

  applyRollover(): void {
    this.isRollingOver = true;
    this.rolloverResult = null;
    this.incomesApi.rollover({
      buildingId: this.rollover.buildingId,
      sourcePeriodId: this.rollover.sourcePeriodId,
      targetPeriodId: this.rollover.targetPeriodId
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.rolloverResult = result;
        this.isRollingOver = false;
        if (result.rolloverCreated && result.createdIncome) {
          const income = result.createdIncome;
          const matchesFilters =
            (!this.filters.buildingId || income.buildingId === this.filters.buildingId) &&
            (!this.filters.expensePeriodId || income.expensePeriodId === this.filters.expensePeriodId);
          if (matchesFilters) {
            this.items = [income, ...this.items];
            this.sortItems();
          }
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Rollover aplicado: ${this.formatCurrency(result.saldo)} al periodo "${result.targetPeriodName}".`, life: 5000 });
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo aplicar el rollover.'), life: 5000 });
        this.isRollingOver = false;
        this.cdr.markForCheck();
      }
    });
  }

  submitIncome(): void {
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
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Ingreso actualizado correctamente.' : 'Ingreso creado correctamente.', life: 4000 });
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, this.editingId ? 'No se pudo actualizar el ingreso.' : 'No se pudo guardar el ingreso.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteIncome(item: BuildingIncome): void {
    this.isSaving = true;
    this.incomesApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Ingreso eliminado correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar el ingreso.'), life: 5000 });
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
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ incomes, buildings, periods }) => {
        this.items = incomes;
        this.buildings = buildings;
        this.periods = periods;
        this.sortItems();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de ingresos del edificio.'), life: 5000 });
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

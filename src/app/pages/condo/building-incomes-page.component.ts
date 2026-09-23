import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { InputNumber } from 'primeng/inputnumber';
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
  imports: [CommonModule, FormsModule, Button, Card, Tag, Tooltip, InputNumber],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Ingresos del edificio</h1>
            <p>Compensaciones e ingresos que reducen o ajustan la liquidación común.</p>
          </div>
        </div>

        <div class="toolbar-btns" *ngIf="!isReadOnly">
          <p-button label="Rollover saldo anterior" icon="pi pi-refresh" severity="secondary" (onClick)="toggleRolloverSection()"></p-button>
          <p-button [label]="showForm ? 'Cerrar' : 'Nuevo ingreso'" [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'" (onClick)="toggleForm()"></p-button>
        </div>
      </div>

      <!-- ROLLOVER -->
      <div class="panel-box rec-panel" *ngIf="showRolloverSection">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon rec-icon pi pi-refresh"></span>
            <div>
              <strong>Rollover saldo anterior</strong>
              <small>Calcula el saldo neto del período origen (ingresos − gastos) y lo registra como ingreso en el período destino</small>
            </div>
          </div>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="toggleRolloverSection()"></p-button>
        </div>

        <form class="income-form" (ngSubmit)="applyRollover()">
          <div class="form-row">
            <label class="field-block">
              <span>Edificio *</span>
              <select [(ngModel)]="rollover.buildingId" name="rolloverBuilding" required (ngModelChange)="onRolloverBuildingChange()">
                <option value="" disabled>— Seleccionar —</option>
                <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Período origen (cerrado) *</span>
              <select [(ngModel)]="rollover.sourcePeriodId" name="rolloverSource" required>
                <option value="" disabled>— Seleccionar —</option>
                <option *ngFor="let p of rolloverSourcePeriods" [value]="p.id">{{ p.name }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Período destino (borrador) *</span>
              <select [(ngModel)]="rollover.targetPeriodId" name="rolloverTarget" required>
                <option value="" disabled>— Seleccionar —</option>
                <option *ngFor="let p of rolloverTargetPeriods" [value]="p.id">{{ p.name }}</option>
              </select>
            </label>
          </div>
          <div class="form-actions">
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
            <span class="result-label">Ingresos del período origen</span>
            <span class="result-value positive">{{ formatCurrency(rolloverResult.totalIngresos) }}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Gastos del período origen</span>
            <span class="result-value negative">{{ formatCurrency(rolloverResult.totalGastos) }}</span>
          </div>
          <div class="result-row total">
            <span class="result-label">Saldo neto</span>
            <span class="result-value" [class.positive]="rolloverResult.saldo > 0" [class.negative]="rolloverResult.saldo < 0">
              {{ formatCurrency(rolloverResult.saldo) }}
            </span>
          </div>
          <p class="result-msg success" *ngIf="rolloverResult.rolloverCreated">
            <i class="pi pi-check-circle"></i> Se creó el ingreso "Saldo anterior período {{ rolloverResult.sourcePeriodName }}" en el período "{{ rolloverResult.targetPeriodName }}".
          </p>
          <p class="result-msg warning" *ngIf="!rolloverResult.rolloverCreated">
            <i class="pi pi-info-circle"></i> El período origen tiene déficit o saldo cero — no se generó ningún ingreso de rollover.
          </p>
        </div>
      </div>

      <!-- FILTROS -->
      <div class="filters-bar">
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filters.buildingId" name="filterBuildingId" (ngModelChange)="onBuildingFilterChange()">
            <option value="">Todos los edificios</option>
            <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Período</span>
          <select [(ngModel)]="filters.expensePeriodId" name="filterExpensePeriodId" (ngModelChange)="applyFilters()">
            <option value="">Todos los períodos</option>
            <option *ngFor="let period of filteredPeriodsForSelector" [value]="period.id">{{ period.name }} · {{ period.buildingName }}</option>
          </select>
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [text]="true" (onClick)="resetFilters()"></p-button>
      </div>

      <!-- FORMULARIO NUEVO INGRESO -->
      <div class="panel-box form-panel" *ngIf="showForm">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon pi pi-wallet"></span>
            <div>
              <strong>{{ editingId ? 'Editar ingreso' : 'Registrar ingreso' }}</strong>
              <small>Completá los datos del ingreso del edificio</small>
            </div>
          </div>
          <p-button *ngIf="editingId" type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>

        <form class="income-form" (ngSubmit)="submitIncome()">
          <div class="form-row">
            <label class="field-block">
              <span>Edificio *</span>
              <select [(ngModel)]="form.buildingId" name="buildingId" required (ngModelChange)="onFormBuildingChange()">
                <option value="" disabled>— Seleccionar —</option>
                <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Período *</span>
              <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required>
                <option value="" disabled>— Seleccionar —</option>
                <option *ngFor="let period of availablePeriods" [value]="period.id">{{ period.name }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Categoría *</span>
              <select [(ngModel)]="form.category" name="category" required>
                <option *ngFor="let category of categories" [value]="category">{{ categoryLabel(category) }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Fecha del ingreso *</span>
              <input [(ngModel)]="form.incomeDate" name="incomeDate" type="date" required />
            </label>
          </div>
          <div class="form-row">
            <label class="field-block wide2">
              <span>Descripción *</span>
              <input [(ngModel)]="form.description" name="description" type="text" required placeholder="Ej: Saldo a favor, alquiler SUM..." />
            </label>
            <label class="field-block">
              <span>Monto *</span>
              <p-inputnumber [(ngModel)]="form.amount" name="amount" [useGrouping]="true" prefix="₲ " [min]="1" [minFractionDigits]="0" [maxFractionDigits]="0" [required]="true" styleClass="w-full"></p-inputnumber>
            </label>
          </div>
          <div class="form-row">
            <label class="field-block wide2">
              <span>Notas</span>
              <input [(ngModel)]="form.notes" name="notes" type="text" />
            </label>
          </div>
          <div class="form-actions">
            <p-button *ngIf="editingId" type="button" label="Cancelar" severity="secondary" [text]="true" (onClick)="cancelEdit()"></p-button>
            <p-button
              type="submit"
              [disabled]="!buildings.length || !periods.length"
              [loading]="isSaving"
              [label]="editingId ? 'Guardar cambios' : 'Guardar ingreso'"
              icon="pi pi-check">
            </p-button>
          </div>
        </form>
      </div>

      <p class="app-state" *ngIf="loading">Cargando ingresos del edificio...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay ingresos cargados.</p>

      <!-- LISTA DE INGRESOS -->
      <div class="app-list" *ngIf="items.length">
        <div class="app-row header incomes-grid">
          <span>Fecha</span>
          <span>Descripción</span>
          <span>Período</span>
          <span>Categoría</span>
          <span>Monto</span>
          <span class="actions-head" *ngIf="!isReadOnly">Acciones</span>
        </div>

        <div class="app-row incomes-grid" *ngFor="let item of items">
          <strong>{{ item.incomeDate | date:'dd/MM/yyyy' }}</strong>
          <span>
            {{ item.description }}
            <small class="sub-text" *ngIf="item.notes">{{ item.notes }}</small>
          </span>
          <span>{{ item.expensePeriodName }} <small class="sub-text">{{ item.buildingName }}</small></span>
          <p-tag [value]="categoryLabel(item.category)" severity="info"></p-tag>
          <strong class="amount-cell">{{ formatCurrency(item.amount) }}</strong>
          <div class="app-actions" *ngIf="!isReadOnly">
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startEdit(item)" pTooltip="Editar" tooltipPosition="top"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving" (onClick)="deleteIncome(item)" pTooltip="Eliminar" tooltipPosition="top"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .toolbar-btns { display: flex; gap: 0.5rem; }

    /* Panel boxes */
    .panel-box {
      margin-bottom: 1.25rem;
      padding: 1.5rem;
      border-radius: 22px;
      background: white;
      border: 1.5px solid #dbe7e3;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    .form-panel { border-color: rgba(19,133,182,0.25); background: rgba(19,133,182,0.02); }
    .rec-panel { border-color: rgba(108,117,125,0.2); }

    .panel-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
    .panel-title { display: flex; align-items: center; gap: 0.85rem; }
    .panel-icon {
      width: 42px; height: 42px; border-radius: 14px;
      background: rgba(19,133,182,0.1); color: #1385b6;
      display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
    }
    .rec-icon { background: rgba(108,117,125,0.1); color: #495057; }
    .panel-title strong { display: block; color: #14363d; font-size: 1rem; }
    .panel-title small { color: #6b878d; font-size: 0.82rem; }

    /* Filters bar */
    .filters-bar {
      display: flex;
      gap: 1rem;
      align-items: flex-end;
      margin-bottom: 1.25rem;
      padding: 1rem 1.25rem;
      background: #f5faf9;
      border-radius: 16px;
      border: 1px solid #e5eeec;
    }
    .filters-bar .field-block { flex: 1; }

    /* Form */
    .income-form { display: grid; gap: 1rem; }
    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; align-items: end; }
    .wide2 { grid-column: span 2; }

    .field-block { display: grid; gap: 0.4rem; }
    .field-block > span { font-weight: 700; color: #29484f; font-size: 0.85rem; }
    .field-block select,
    .field-block input {
      border: 1.5px solid #d7e5e1; border-radius: 12px;
      padding: 0.75rem 1rem; font: inherit;
      background: white; color: #18353a; width: 100%; box-sizing: border-box;
    }
    .field-block select:focus, .field-block input:focus {
      outline: none; border-color: #1385b6; box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.25rem; }

    /* Rollover result */
    .rollover-result {
      margin-top: 1.25rem;
      padding: 1rem 1.25rem;
      border-radius: 16px;
      background: #f8fbfa;
      border: 1px solid #dbe7e3;
    }
    .result-row {
      display: flex; justify-content: space-between;
      padding: 0.35rem 0;
      border-bottom: 1px solid #eaf1ef;
    }
    .result-row.total { border-bottom: none; padding-top: 0.6rem; font-weight: 700; }
    .result-label { color: #4d6a6e; }
    .result-value { font-weight: 600; }
    .result-value.positive { color: #1a8c5b; }
    .result-value.negative { color: #c0392b; }
    .result-msg { display: flex; align-items: center; gap: 0.5rem; margin: 0.85rem 0 0; padding: 0.6rem 0.9rem; border-radius: 12px; font-size: 0.88rem; }
    .result-msg.success { background: #d4f4e6; color: #0e5c3a; }
    .result-msg.warning { background: #fef6e0; color: #7d5a00; }

    /* List */
    .incomes-grid { grid-template-columns: 0.7fr 1.6fr 1.3fr 0.9fr 0.8fr 0.5fr; }
    .actions-head { text-align: right; }
    .sub-text { display: block; font-size: 0.78rem; color: #6b878d; }
    .amount-cell { font-variant-numeric: tabular-nums; }

    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .form-row { grid-template-columns: 1fr; }
      .wide2 { grid-column: span 1; }
      .incomes-grid { grid-template-columns: 1fr; }
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
  private allItems: BuildingIncome[] = [];
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
    this.items = this.allItems.filter(item =>
      (!this.filters.buildingId || item.buildingId === this.filters.buildingId) &&
      (!this.filters.expensePeriodId || item.expensePeriodId === this.filters.expensePeriodId)
    );
    this.sortItems();
    this.cdr.markForCheck();
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
          this.allItems = [income, ...this.allItems];
          this.applyFilters();
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
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadData(): void {
    forkJoin({
      incomes: this.incomesApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ incomes, buildings, periods }) => {
        this.allItems = incomes;
        this.buildings = buildings;
        this.periods = periods;
        this.loading = false;
        this.applyFilters();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de ingresos del edificio.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private upsertLocalItem(income: BuildingIncome): void {
    this.allItems = this.editingId
      ? this.allItems.map(item => item.id === income.id ? income : item)
      : [income, ...this.allItems];
    this.applyFilters();
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

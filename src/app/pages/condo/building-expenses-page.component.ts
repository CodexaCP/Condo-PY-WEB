import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpensesApiService } from '../../api/building-expenses-api.service';
import { RecurringBuildingExpensesApiService } from '../../api/recurring-building-expenses-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import {
  ApplyRecurringExpensesResult,
  Building,
  BuildingExpense,
  BuildingExpenseCategory,
  BuildingExpenseDistributionType,
  CreateBuildingExpenseRequest,
  ExpensePeriod,
  RecurringBuildingExpense,
  RecurringBuildingExpenseUpsertRequest,
  Unit
} from '../../api/models';
import { API_BASE_URL } from '../../config/api.config';

@Component({
  standalone: true,
  selector: 'app-building-expenses-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Gastos del edificio</h1>
            <p>Registro formal de facturas, servicios y egresos a distribuir por periodo.</p>
          </div>
        </div>

        <div style="display:flex;gap:0.5rem;" *ngIf="!isReadOnly">
          <p-button
            label="Plantillas recurrentes"
            icon="pi pi-sync"
            severity="secondary"
            (onClick)="toggleRecurringSection()">
          </p-button>
          <p-button
            [label]="showForm ? 'Cerrar formulario' : 'Nuevo gasto'"
            [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
            (onClick)="toggleForm()">
          </p-button>
        </div>
      </div>

      <!-- PLANTILLAS RECURRENTES -->
      <div class="action-box" *ngIf="showRecurringSection">
        <div class="action-head">
          <div>
            <strong>Plantillas de gastos recurrentes</strong>
            <span>Gastos fijos mensuales del edificio. Aplicalos a cualquier periodo con un clic.</span>
          </div>
          <p-button type="button" label="Cerrar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="toggleRecurringSection()"></p-button>
        </div>

        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;align-items:center;">
          <select [(ngModel)]="recurringBuildingFilter" name="recurringBuildingFilter" style="flex:1;" (ngModelChange)="onRecurringBuildingChange()">
            <option value="">Todos los edificios</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
          <p-button *ngIf="!isReadOnly" label="Nueva plantilla" icon="pi pi-plus" severity="secondary" (onClick)="toggleRecurringForm()"></p-button>
        </div>

        <form class="app-form-grid compact" *ngIf="showRecurringForm" (ngSubmit)="submitRecurring()">
          <label>
            <span>Edificio</span>
            <select [(ngModel)]="recurringForm.buildingId" name="recBuildingId" required>
              <option value="" disabled>Selecciona un edificio</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </label>

          <label>
            <span>Categoria</span>
            <select [(ngModel)]="recurringForm.category" name="recCategory" required>
              <option *ngFor="let c of categories" [value]="c">{{ categoryLabel(c) }}</option>
            </select>
          </label>

          <label>
            <span>Proveedor</span>
            <input [(ngModel)]="recurringForm.supplierName" name="recSupplier" type="text" maxlength="160" />
          </label>

          <label>
            <span>Monto</span>
            <input [(ngModel)]="recurringForm.amount" name="recAmount" type="number" min="1" step="0.01" required />
          </label>

          <label class="wide">
            <span>Descripcion</span>
            <input [(ngModel)]="recurringForm.description" name="recDescription" type="text" required maxlength="200" />
          </label>

          <label>
            <span>Distribucion</span>
            <select [(ngModel)]="recurringForm.distributionType" name="recDistribution" required>
              <option *ngFor="let d of distributionTypes" [value]="d">{{ distributionTypeLabel(d) }}</option>
            </select>
          </label>

          <label>
            <span>Activa</span>
            <select [(ngModel)]="recurringForm.isActive" name="recIsActive">
              <option [ngValue]="true">Sí</option>
              <option [ngValue]="false">No</option>
            </select>
          </label>

          <div class="wide form-actions">
            <p-button type="submit" [loading]="isSavingRecurring" [label]="editingRecurringId ? 'Guardar plantilla' : 'Agregar plantilla'"></p-button>
            <p-button *ngIf="editingRecurringId" type="button" label="Cancelar" severity="secondary" [text]="true" (onClick)="cancelRecurringEdit()"></p-button>
          </div>
        </form>

        <p class="app-state" *ngIf="!recurringItems.length && !loadingRecurring">No hay plantillas cargadas para este edificio.</p>
        <p class="app-state" *ngIf="loadingRecurring">Cargando plantillas...</p>

        <div class="app-list" *ngIf="recurringItems.length">
          <div class="app-row header recurring-grid">
            <span>Descripcion</span>
            <span>Proveedor</span>
            <span>Categoria</span>
            <span>Distribucion</span>
            <span>Monto</span>
            <span>Activa</span>
            <span class="actions-head">Acciones</span>
          </div>

          <div class="app-row recurring-grid" *ngFor="let item of recurringItems">
            <strong>{{ item.description }}</strong>
            <span>{{ item.supplierName || '—' }}</span>
            <span>{{ categoryLabel(item.category) }}</span>
            <span>{{ distributionTypeLabel(item.distributionType) }}</span>
            <span>{{ formatCurrency(item.amount) }}</span>
            <p-tag [value]="item.isActive ? 'Activa' : 'Inactiva'" [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
            <div class="app-actions">
              <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startRecurringEdit(item)" pTooltip="Editar"></p-button>
              <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSavingRecurring" (onClick)="deleteRecurring(item)" pTooltip="Eliminar"></p-button>
            </div>
          </div>
        </div>

        <div class="apply-recurring-box" *ngIf="recurringItems.length">
          <strong>Aplicar al periodo</strong>
          <select [(ngModel)]="applyRecurringPeriodId" name="applyPeriodId">
            <option value="">Selecciona un periodo Draft</option>
            <option *ngFor="let p of draftPeriodsByBuilding" [value]="p.id">{{ p.name }} – {{ p.buildingName }}</option>
          </select>
          <p-button
            label="Aplicar recurrentes"
            icon="pi pi-play"
            severity="success"
            [loading]="isApplyingRecurring"
            [disabled]="!applyRecurringPeriodId"
            (onClick)="applyRecurring()">
          </p-button>
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

      <!-- FORMULARIO NUEVO GASTO -->
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

      <p class="app-state" *ngIf="loading">Cargando gastos del edificio...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay gastos cargados.</p>

      <!-- LISTA DE GASTOS -->
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
          <span>{{ item.description }}<small *ngIf="item.supplierName"> – {{ item.supplierName }}</small></span>
          <span>{{ item.expensePeriodName }} - {{ item.buildingName }}</span>
          <span>{{ distributionSummary(item) }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <div class="app-actions">
            <a
              *ngIf="item.hasReceipt"
              [href]="getReceiptUrl(item.id)"
              target="_blank"
              title="{{ item.receiptFileName }}"
              class="receipt-link">
              <p-button type="button" icon="pi pi-file" severity="info" [rounded]="true" [text]="true" pTooltip="{{ item.receiptFileName }}"></p-button>
            </a>
            <p-button
              *ngIf="!isReadOnly && !item.hasReceipt"
              type="button"
              icon="pi pi-paperclip"
              severity="secondary"
              [rounded]="true"
              [text]="true"
              pTooltip="Adjuntar comprobante"
              (onClick)="triggerReceiptUpload(item)">
            </p-button>
            <p-button
              *ngIf="!isReadOnly && item.hasReceipt"
              type="button"
              icon="pi pi-times-circle"
              severity="warn"
              [rounded]="true"
              [text]="true"
              pTooltip="Quitar comprobante"
              (onClick)="removeReceipt(item)">
            </p-button>
            <p-button *ngIf="!isReadOnly" type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" [disabled]="!isDraftPeriod(item.expensePeriodId)" (onClick)="startEdit(item)" pTooltip="Editar"></p-button>
            <p-button *ngIf="!isReadOnly" type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving || !isDraftPeriod(item.expensePeriodId)" (onClick)="deleteExpense(item)" pTooltip="Eliminar"></p-button>
          </div>
        </div>
      </div>

      <input #receiptInput type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" (change)="onReceiptFileSelected($event)" />
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
    .expenses-grid { grid-template-columns: 0.65fr 1.4fr 1.2fr 1fr 0.65fr 0.6fr; }
    .recurring-grid { grid-template-columns: 1.2fr 1fr 0.9fr 1fr 0.7fr 0.5fr 0.45fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .filter-actions { display:flex; justify-content:flex-end; }
    .actions-head { text-align:right; }
    small { color:#6d8487; }
    .compact { margin-top: 0.8rem; }
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
    .apply-recurring-box {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      padding-top: 0.9rem;
      margin-top: 0.9rem;
      border-top: 1px solid #dbe7e3;
    }
    .apply-recurring-box strong { color:#14363d; white-space:nowrap; }
    .apply-recurring-box select { flex:1; }
    .receipt-link { display:contents; }
    @media (max-width: 900px) {
      .filters-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BuildingExpensesPageComponent implements OnInit {
  private readonly expensesApi = inject(BuildingExpensesApiService);
  private readonly recurringApi = inject(RecurringBuildingExpensesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  items: BuildingExpense[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  recurringItems: RecurringBuildingExpense[] = [];
  loading = true;
  loadingRecurring = false;
  isSaving = false;
  isSavingRecurring = false;
  isApplyingRecurring = false;
  showForm = false;
  showRecurringSection = false;
  showRecurringForm = false;
  editingId: string | null = null;
  editingRecurringId: string | null = null;
  recurringBuildingFilter = '';
  applyRecurringPeriodId = '';
  pendingReceiptExpense: BuildingExpense | null = null;

  readonly categories: BuildingExpenseCategory[] = ['Utilities', 'Cleaning', 'Security', 'Maintenance', 'Elevator', 'Insurance', 'Payroll', 'Taxes', 'Administration', 'ReserveFund', 'Extraordinary', 'Supplies', 'Other'];
  readonly distributionTypes: BuildingExpenseDistributionType[] = ['ByCoefficient', 'FixedPerUnit', 'IndividualUnit', 'NonDistributed'];
  filters = { buildingId: '', expensePeriodId: '' };
  form = this.createInitialForm();
  recurringForm = this.createInitialRecurringForm();

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

  get draftPeriodsByBuilding(): ExpensePeriod[] {
    const buildingId = this.recurringBuildingFilter;
    return buildingId
      ? this.periods.filter((p) => p.buildingId === buildingId && p.status === 'Draft')
      : this.periods.filter((p) => p.status === 'Draft');
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

  toggleRecurringSection(): void {
    this.showRecurringSection = !this.showRecurringSection;
    if (this.showRecurringSection && !this.recurringItems.length) {
      this.loadRecurring();
    }
  }

  toggleRecurringForm(): void {
    this.showRecurringForm = !this.showRecurringForm;
    if (!this.showRecurringForm) {
      this.cancelRecurringEdit();
    }
  }

  startEdit(item: BuildingExpense): void {
    this.editingId = item.id;
    this.showForm = true;
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
  }

  startRecurringEdit(item: RecurringBuildingExpense): void {
    this.editingRecurringId = item.id;
    this.showRecurringForm = true;
    this.recurringForm = {
      buildingId: item.buildingId,
      category: item.category,
      supplierName: item.supplierName,
      description: item.description,
      amount: item.amount,
      distributionType: item.distributionType,
      targetUnitId: item.targetUnitId ?? '',
      notes: item.notes,
      isActive: item.isActive
    };
  }

  cancelRecurringEdit(): void {
    this.editingRecurringId = null;
    this.recurringForm = this.createInitialRecurringForm();
  }

  onFormBuildingChange(): void {
    if (!this.availablePeriods.some((item) => item.id === this.form.expensePeriodId)) {
      this.form.expensePeriodId = '';
    }
    if (!this.availableUnits.some((item) => item.id === this.form.targetUnitId)) {
      this.form.targetUnitId = '';
    }
  }

  onDistributionTypeChange(): void {
    if (!this.requiresTargetUnit) {
      this.form.targetUnitId = '';
    }
  }

  onBuildingFilterChange(): void {
    if (!this.filteredPeriodsForSelector.some((item) => item.id === this.filters.expensePeriodId)) {
      this.filters.expensePeriodId = '';
    }
    this.applyFilters();
  }

  onRecurringBuildingChange(): void {
    this.applyRecurringPeriodId = '';
    this.loadRecurring();
  }

  applyFilters(): void {
    this.loading = true;
    this.expensesApi.getAll({
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
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de gastos.'), life: 5000 });
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
      this.msg.add({ severity: 'error', summary: 'Error', detail: validationError, life: 5000 });
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
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Gasto actualizado.' : 'Gasto creado.', life: 4000 });
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo guardar el gasto.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  submitRecurring(): void {
    const request: RecurringBuildingExpenseUpsertRequest = {
      buildingId: this.recurringForm.buildingId,
      category: this.recurringForm.category,
      supplierName: this.recurringForm.supplierName.trim(),
      description: this.recurringForm.description.trim(),
      amount: Number(this.recurringForm.amount),
      distributionType: this.recurringForm.distributionType,
      targetUnitId: null,
      notes: this.recurringForm.notes.trim(),
      isActive: this.recurringForm.isActive
    };

    if (!request.buildingId) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El edificio es obligatorio.', life: 5000 });
      return;
    }
    if (!request.description) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La descripcion es obligatoria.', life: 5000 });
      return;
    }
    if (request.amount <= 0) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El monto debe ser mayor que cero.', life: 5000 });
      return;
    }

    this.isSavingRecurring = true;
    const operation = this.editingRecurringId
      ? this.recurringApi.update(this.editingRecurringId, request)
      : this.recurringApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (item) => {
        this.recurringItems = this.editingRecurringId
          ? this.recurringItems.map((r) => r.id === item.id ? item : r)
          : [...this.recurringItems, item];
        this.isSavingRecurring = false;
        this.showRecurringForm = false;
        this.cancelRecurringEdit();
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingRecurringId ? 'Plantilla actualizada.' : 'Plantilla creada.', life: 4000 });
        this.editingRecurringId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo guardar la plantilla.'), life: 5000 });
        this.isSavingRecurring = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteRecurring(item: RecurringBuildingExpense): void {
    if (!confirm(`¿Eliminar la plantilla "${item.description}"?`)) {
      return;
    }
    this.isSavingRecurring = true;
    this.recurringApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.recurringItems = this.recurringItems.filter((r) => r.id !== item.id);
        this.isSavingRecurring = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Plantilla eliminada.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar la plantilla.'), life: 5000 });
        this.isSavingRecurring = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyRecurring(): void {
    if (!this.applyRecurringPeriodId) {
      return;
    }
    this.isApplyingRecurring = true;
    this.recurringApi.apply({ expensePeriodId: this.applyRecurringPeriodId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: ApplyRecurringExpensesResult) => {
          this.isApplyingRecurring = false;
          this.applyRecurringPeriodId = '';
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Se aplicaron ${result.applied} gasto(s) recurrentes al periodo "${result.expensePeriodName}".`, life: 5000 });
          this.applyFilters();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron aplicar los gastos recurrentes.'), life: 5000 });
          this.isApplyingRecurring = false;
          this.cdr.markForCheck();
        }
      });
  }

  deleteExpense(item: BuildingExpense): void {
    this.isSaving = true;
    this.expensesApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Gasto eliminado.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar el gasto.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  triggerReceiptUpload(item: BuildingExpense): void {
    this.pendingReceiptExpense = item;
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input?.click();
  }

  onReceiptFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.pendingReceiptExpense) {
      return;
    }

    const expense = this.pendingReceiptExpense;
    this.pendingReceiptExpense = null;
    input.value = '';

    this.expensesApi.uploadReceipt(expense.id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.items = this.items.map((item) => item.id === updated.id ? updated : item);
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Comprobante "${file.name}" adjuntado.`, life: 4000 });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo adjuntar el comprobante.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  removeReceipt(item: BuildingExpense): void {
    if (!confirm(`¿Quitar el comprobante "${item.receiptFileName}" de este gasto?`)) {
      return;
    }
    this.expensesApi.deleteReceipt(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items = this.items.map((current) =>
            current.id === item.id ? { ...current, hasReceipt: false, receiptFileName: null } : current
          );
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Comprobante eliminado.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo quitar el comprobante.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  getReceiptUrl(id: string): string {
    const token = this.auth.getToken();
    return `${API_BASE_URL}/building-expenses/${id}/receipt?access_token=${token}`;
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
    return item.targetUnitCode ? `${base} – ${item.targetUnitCode}` : base;
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
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de gastos.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadRecurring(): void {
    this.loadingRecurring = true;
    this.recurringApi.getAll(this.recurringBuildingFilter || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.recurringItems = items;
          this.loadingRecurring = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingRecurring = false;
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

  private createInitialRecurringForm() {
    return {
      buildingId: this.recurringBuildingFilter,
      category: 'Utilities' as BuildingExpenseCategory,
      supplierName: '',
      description: '',
      amount: 0,
      distributionType: 'ByCoefficient' as BuildingExpenseDistributionType,
      targetUnitId: '',
      notes: '',
      isActive: true
    };
  }

  private validateForm(form: CreateBuildingExpenseRequest): string | null {
    if (!form.buildingId) return 'El edificio es obligatorio.';
    if (!form.expensePeriodId) return 'El periodo es obligatorio.';
    if (!form.description) return 'La descripcion es obligatoria.';
    if (form.description.length > 200) return 'La descripcion no puede superar los 200 caracteres.';
    if (form.supplierName.length > 160) return 'El proveedor no puede superar los 160 caracteres.';
    if (form.notes.length > 500) return 'Las notas no pueden superar los 500 caracteres.';
    if (form.amount <= 0) return 'El monto debe ser mayor que cero.';
    if (form.distributionType === 'ManualGroup') return 'La distribucion por grupo manual todavia no esta disponible.';
    if (form.distributionType === 'IndividualUnit' && !form.targetUnitId) return 'La unidad destino es obligatoria cuando la distribucion es por unidad individual.';
    const period = this.periods.find((item) => item.id === form.expensePeriodId);
    if (!period) return 'El periodo seleccionado no existe.';
    if (period.buildingId !== form.buildingId) return 'El periodo seleccionado no pertenece al edificio indicado.';
    if (period.status !== 'Draft') return 'Solo puedes registrar gastos en periodos en borrador.';
    if (form.expenseDate < period.startDate || form.expenseDate > period.endDate) return 'La fecha del gasto debe estar dentro del rango del periodo.';
    return null;
  }
}

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
import { InputNumber } from 'primeng/inputnumber';
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
  RecurringBuildingExpenseCreateForAllRequest,
  RecurringBuildingExpenseUpsertRequest,
  Unit
} from '../../api/models';
import { API_BASE_URL } from '../../config/api.config';

interface BuildingExpensesGroup {
  periodId: string;
  periodName: string;
  buildingName: string;
  total: number;
  items: BuildingExpense[];
}

@Component({
  standalone: true,
  selector: 'app-building-expenses-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, Tooltip, InputNumber],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Gastos del edificio</h1>
            <p>Registro de facturas, servicios y egresos por periodo.</p>
          </div>
        </div>
        <div class="toolbar-btns">
          <p-button label="Plantillas recurrentes" icon="pi pi-sync" severity="secondary" (onClick)="toggleRecurringSection()"></p-button>
          <p-button [label]="showForm ? 'Cerrar' : 'Nuevo gasto'" [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'" (onClick)="toggleForm()"></p-button>
        </div>
      </div>

      <!-- PLANTILLAS RECURRENTES -->
      <div class="panel-box recurring-panel" *ngIf="showRecurringSection">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon rec-icon pi pi-sync"></span>
            <div>
              <strong>Plantillas recurrentes</strong>
              <small>Gastos fijos mensuales — aplicalos a un periodo con un clic</small>
            </div>
          </div>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="toggleRecurringSection()"></p-button>
        </div>

        <div class="rec-toolbar">
          <div class="field-block" style="flex:1">
            <span>Filtrar por edificio</span>
            <select [(ngModel)]="recurringBuildingFilter" name="recurringBuildingFilter" (ngModelChange)="onRecurringBuildingChange()">
              <option value="">Todos los edificios</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </div>
          <p-button label="Nueva plantilla" icon="pi pi-plus" severity="secondary" (onClick)="toggleRecurringForm()"></p-button>
        </div>

        <div class="panel-box inner-form" *ngIf="showRecurringForm">
          <form class="expense-form" (ngSubmit)="submitRecurring()">
            <div class="form-row">
              <label class="field-block" *ngIf="editingRecurringId">
                <span>Edificio *</span>
                <select [(ngModel)]="recurringForm.buildingId" name="recBuildingId" required>
                  <option value="" disabled>— Seleccionar —</option>
                  <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
                </select>
              </label>
              <label class="field-block">
                <span>Categoría *</span>
                <select [(ngModel)]="recurringForm.category" name="recCategory" required>
                  <option *ngFor="let c of categories" [value]="c">{{ categoryLabel(c) }}</option>
                </select>
              </label>
              <label class="field-block">
                <span>Distribución *</span>
                <select [(ngModel)]="recurringForm.distributionType" name="recDistribution" required>
                  <option *ngFor="let d of distributionTypes" [value]="d" [disabled]="!editingRecurringId && d === 'IndividualUnit'">{{ distributionTypeLabel(d) }}</option>
                </select>
              </label>
              <label class="field-block">
                <span>Activa</span>
                <select [(ngModel)]="recurringForm.isActive" name="recIsActive">
                  <option [ngValue]="true">Sí</option>
                  <option [ngValue]="false">No</option>
                </select>
              </label>
            </div>

            <!-- Al crear (no al editar): elegis uno o varios edificios con checkbox, o marcas "Todos". -->
            <div class="field-block building-checks-block" *ngIf="!editingRecurringId">
              <span>Edificios *</span>
              <label class="check-row check-all">
                <input type="checkbox" [(ngModel)]="recurringSelectAll" name="recSelectAll" [ngModelOptions]="{ standalone: true }" />
                Todos los edificios
              </label>
              <div class="building-checks">
                <label class="check-row" *ngFor="let b of buildings">
                  <input type="checkbox" [checked]="recurringSelectAll || isRecurringBuildingSelected(b.id)"
                         [disabled]="recurringSelectAll" (change)="toggleRecurringBuilding(b.id)" />
                  {{ b.name }}
                </label>
              </div>
            </div>

            <div class="form-row">
              <label class="field-block wide2">
                <span>Descripción *</span>
                <input [(ngModel)]="recurringForm.description" name="recDescription" type="text" required maxlength="200" placeholder="Ej: Sueldo encargado, Servicio de limpieza..." />
              </label>
              <label class="field-block">
                <span>Proveedor</span>
                <input [(ngModel)]="recurringForm.supplierName" name="recSupplier" type="text" maxlength="160" />
              </label>
              <label class="field-block">
                <span>Monto *</span>
                <p-inputnumber [(ngModel)]="recurringForm.amount" name="recAmount" [useGrouping]="true" prefix="₲ " [min]="1" [minFractionDigits]="0" [maxFractionDigits]="0" [required]="true" styleClass="w-full"></p-inputnumber>
              </label>
            </div>
            <div class="form-actions">
              <p-button *ngIf="editingRecurringId" type="button" label="Cancelar" severity="secondary" [text]="true" (onClick)="cancelRecurringEdit()"></p-button>
              <p-button type="submit" [loading]="isSavingRecurring" [label]="editingRecurringId ? 'Guardar plantilla' : 'Agregar plantilla'" icon="pi pi-check"></p-button>
            </div>
          </form>
        </div>

        <p class="app-state" *ngIf="!recurringItems.length && !loadingRecurring">No hay plantillas para este edificio.</p>
        <p class="app-state" *ngIf="loadingRecurring">Cargando plantillas...</p>

        <div class="app-list" *ngIf="recurringItems.length">
          <div class="app-row header recurring-grid">
            <span>Descripción</span><span>Proveedor</span><span>Categoría</span><span>Distribución</span><span>Monto</span><span>Estado</span><span class="txt-right">Acciones</span>
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

        <div class="apply-box" *ngIf="recurringItems.length">
          <span class="pi pi-play-circle apply-icon"></span>
          <div class="field-block" style="flex:1">
            <span>Aplicar al periodo</span>
            <select [(ngModel)]="applyRecurringPeriodId" name="applyPeriodId">
              <option value="">— Seleccionar periodo borrador —</option>
              <option *ngFor="let p of draftPeriodsByBuilding" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
            </select>
          </div>
          <p-button label="Aplicar" icon="pi pi-play" severity="success" [loading]="isApplyingRecurring" [disabled]="!applyRecurringPeriodId" (onClick)="applyRecurring()"></p-button>
        </div>
      </div>

      <!-- FILTROS -->
      <div class="filters-bar">
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filters.buildingId" name="filterBuildingId" (ngModelChange)="onBuildingFilterChange()">
            <option value="">Todos los edificios</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Periodo</span>
          <select [(ngModel)]="filters.expensePeriodId" name="filterExpensePeriodId" (ngModelChange)="applyFilters()">
            <option value="">Todos los periodos</option>
            <option *ngFor="let p of filteredPeriodsForSelector" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
          </select>
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [text]="true" (onClick)="resetFilters()"></p-button>
      </div>

      <!-- FORMULARIO NUEVO GASTO -->
      <div class="panel-box form-panel" *ngIf="showForm">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon pi pi-receipt"></span>
            <div>
              <strong>{{ editingId ? 'Editar gasto' : 'Registrar gasto' }}</strong>
              <small>Completá los datos del egreso del edificio</small>
            </div>
          </div>
          <p-button *ngIf="editingId" type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>
        <form class="expense-form" (ngSubmit)="submitExpense()">
          <div class="form-row">
            <label class="field-block">
              <span>Edificio *</span>
              <select [(ngModel)]="form.buildingId" name="buildingId" required (ngModelChange)="onFormBuildingChange()">
                <option value="" disabled>— Seleccionar —</option>
                <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Periodo *</span>
              <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required>
                <option value="" disabled>— Seleccionar —</option>
                <option *ngFor="let p of availablePeriods" [value]="p.id">{{ p.name }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Categoría *</span>
              <select [(ngModel)]="form.category" name="category" required>
                <option *ngFor="let c of categories" [value]="c">{{ categoryLabel(c) }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Fecha *</span>
              <input [(ngModel)]="form.expenseDate" name="expenseDate" type="date" required />
            </label>
          </div>
          <div class="form-row">
            <label class="field-block wide2">
              <span>Descripción *</span>
              <input [(ngModel)]="form.description" name="description" type="text" required maxlength="200" placeholder="Ej: Factura luz mes de junio..." />
            </label>
            <label class="field-block">
              <span>Proveedor</span>
              <input [(ngModel)]="form.supplierName" name="supplierName" type="text" maxlength="160" placeholder="Nombre del proveedor..." />
            </label>
            <label class="field-block">
              <span>Monto *</span>
              <p-inputnumber [(ngModel)]="form.amount" name="amount" [useGrouping]="true" prefix="₲ " [min]="1" [minFractionDigits]="0" [maxFractionDigits]="0" [required]="true" styleClass="w-full"></p-inputnumber>
            </label>
          </div>
          <div class="form-row">
            <label class="field-block">
              <span>Distribución *</span>
              <select [(ngModel)]="form.distributionType" name="distributionType" required (ngModelChange)="onDistributionTypeChange()">
                <option *ngFor="let d of distributionTypes" [value]="d">{{ distributionTypeLabel(d) }}</option>
              </select>
            </label>
            <label class="field-block" *ngIf="requiresTargetUnit">
              <span>Unidad destino *</span>
              <select [(ngModel)]="form.targetUnitId" name="targetUnitId" [required]="requiresTargetUnit">
                <option value="">— Sin unidad —</option>
                <option *ngFor="let u of availableUnits" [value]="u.id">{{ u.code }} · {{ u.buildingName }}</option>
              </select>
            </label>
            <label class="field-block wide2">
              <span>Notas</span>
              <input [(ngModel)]="form.notes" name="notes" type="text" maxlength="500" placeholder="Observaciones opcionales..." />
            </label>
          </div>
          <div class="form-actions">
            <p-button type="submit" [disabled]="!buildings.length || !periods.length" [loading]="isSaving" [label]="editingId ? 'Guardar cambios' : 'Registrar gasto'" icon="pi pi-check"></p-button>
          </div>
        </form>
      </div>

      <p class="app-state" *ngIf="loading">Cargando gastos...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay gastos registrados.</p>

      <!-- LISTA DE GASTOS -->
      <div class="period-group" *ngFor="let group of groups; trackBy: trackGroup">
        <button type="button" class="group-head" (click)="toggleGroup(group.periodId)" [attr.aria-expanded]="isGroupOpen(group.periodId)">
          <span class="pi" [ngClass]="isGroupOpen(group.periodId) ? 'pi-chevron-down' : 'pi-chevron-right'"></span>
          <span class="group-title">
            <strong>{{ group.periodName }}</strong>
            <small>{{ group.buildingName }}</small>
          </span>
          <span class="group-count">{{ group.items.length }} {{ group.items.length === 1 ? 'gasto' : 'gastos' }}</span>
          <strong class="group-total">{{ formatCurrency(group.total) }}</strong>
        </button>
      <div class="app-list" *ngIf="isGroupOpen(group.periodId)">
        <div class="app-row header expenses-grid">
          <span>Fecha</span><span>Descripción</span><span>Periodo · Edificio</span><span>Distribución</span><span>Monto</span><span class="txt-right">Acciones</span>
        </div>
        <div class="app-row expenses-grid" *ngFor="let item of group.items">
          <span class="expense-date">{{ item.expenseDate }}</span>
          <div>
            <strong>{{ item.description }}</strong>
            <small *ngIf="item.supplierName" class="supplier-tag">{{ item.supplierName }}</small>
          </div>
          <div>
            <span>{{ item.expensePeriodName }}</span>
            <small class="building-tag">{{ item.buildingName }}</small>
          </div>
          <span>{{ distributionSummary(item) }}</span>
          <strong class="amount">{{ formatCurrency(item.amount) }}</strong>
          <div class="app-actions">
            <a *ngIf="item.hasReceipt" [href]="getReceiptUrl(item.id)" target="_blank" class="receipt-link">
              <p-button type="button" icon="pi pi-file-pdf" severity="info" [rounded]="true" [text]="true" [pTooltip]="item.receiptFileName ?? 'Ver comprobante'"></p-button>
            </a>
            <p-button *ngIf="!item.hasReceipt" type="button" icon="pi pi-paperclip" severity="secondary" [rounded]="true" [text]="true" pTooltip="Adjuntar comprobante" (onClick)="triggerReceiptUpload(item)"></p-button>
            <p-button *ngIf="item.hasReceipt" type="button" icon="pi pi-times-circle" severity="warn" [rounded]="true" [text]="true" pTooltip="Quitar comprobante" (onClick)="removeReceipt(item)"></p-button>
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" [disabled]="!isDraftPeriod(item.expensePeriodId)" (onClick)="startEdit(item)" pTooltip="Editar"></p-button>
            <p-button *ngIf="!isOperator" type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving || !isDraftPeriod(item.expensePeriodId)" (onClick)="deleteExpense(item)" pTooltip="Eliminar"></p-button>
          </div>
        </div>
      </div>
      </div>

      <input #receiptInput type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" (change)="onReceiptFileSelected($event)" />
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
    .recurring-panel { border-color: rgba(108,117,125,0.2); }
    .inner-form { margin: 1rem 0 0; padding: 1.25rem; background: #f8fbfa; border-color: #dbe7e3; box-shadow: none; }

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

    /* Recurring toolbar */
    .rec-toolbar { display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1rem; }

    /* Form */
    .expense-form { display: grid; gap: 1rem; }
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
    .field-hint { font-size: 0.78rem; color: #6b878d; }
    .building-checks-block { margin-top: -0.25rem; }
    .check-row {
      display: flex; align-items: center; gap: 0.5rem;
      font-weight: 400; font-size: 0.9rem; color: #18353a;
      padding: 0.15rem 0; cursor: pointer;
    }
    .check-row input { width: auto; }
    .check-all { font-weight: 700; margin-bottom: 0.4rem; }
    .building-checks {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.1rem 1rem;
      max-height: 180px; overflow-y: auto;
      padding: 0.6rem 0.75rem; border: 1.5px solid #d7e5e1; border-radius: 12px; background: #fff;
    }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.25rem; }

    /* Apply recurring box */
    .apply-box {
      display: flex; gap: 1rem; align-items: flex-end;
      margin-top: 1rem; padding-top: 1rem;
      border-top: 1px dashed #c5ddd8;
    }
    .apply-icon { font-size: 1.5rem; color: #16a34a; align-self: center; }

    /* Period groups */
    .period-group { margin-bottom: 0.75rem; }
    .group-head {
      width: 100%; display: flex; align-items: center; gap: 0.85rem;
      padding: 0.9rem 1.25rem; border-radius: 16px; cursor: pointer;
      background: #f5faf9; border: 1px solid #e5eeec; font: inherit; color: #14363d; text-align: left;
    }
    .group-head:hover { background: #eaf4f2; }
    .group-title { flex: 1; display: grid; }
    .group-title small { color: #6b878d; font-size: 0.8rem; }
    .group-count { color: #6b878d; font-size: 0.85rem; }
    .group-total { min-width: 8rem; text-align: right; }
    .period-group .app-list { margin-top: 0.5rem; }

    /* Expense list */
    .expenses-grid { grid-template-columns: 0.6fr 1.6fr 1.2fr 1fr 0.8fr 0.55fr; }
    .recurring-grid { grid-template-columns: 1.3fr 1fr 0.9fr 1fr 0.7fr 0.5fr 0.4fr; }
    .txt-right { text-align: right; }

    .expense-date { font-size: 0.88rem; color: #5f787d; font-weight: 600; }
    .supplier-tag { display: block; font-size: 0.78rem; color: #6b878d; margin-top: 0.15rem; }
    .building-tag { display: block; font-size: 0.78rem; color: #6b878d; margin-top: 0.15rem; }
    .amount { color: #14363d; }
    .receipt-link { display: contents; }

    @media (max-width: 860px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .form-row { grid-template-columns: 1fr; }
      .wide2 { grid-column: span 1; }
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


  get isOperator(): boolean { return this.auth.hasRole('CompanyOperator'); }

  items: BuildingExpense[] = [];
  groups: BuildingExpensesGroup[] = [];
  private openGroups = new Set<string>();
  private allItems: BuildingExpense[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  recurringItems: RecurringBuildingExpense[] = [];
  recurringSelectedBuildingIds: string[] = [];
  recurringSelectAll = false;
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

  readonly categories: BuildingExpenseCategory[] = ['Utilities', 'Cleaning', 'Security', 'Maintenance', 'Elevator', 'Insurance', 'Payroll', 'Taxes', 'Administration', 'ReserveFund', 'Extraordinary', 'Supplies', 'Ande', 'Essap', 'InternetPhone', 'Other'];
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

  isRecurringBuildingSelected(buildingId: string): boolean {
    return this.recurringSelectedBuildingIds.includes(buildingId);
  }

  toggleRecurringBuilding(buildingId: string): void {
    this.recurringSelectedBuildingIds = this.isRecurringBuildingSelected(buildingId)
      ? this.recurringSelectedBuildingIds.filter((id) => id !== buildingId)
      : [...this.recurringSelectedBuildingIds, buildingId];
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
    this.recurringSelectedBuildingIds = [];
    this.recurringSelectAll = false;
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
    this.items = this.allItems.filter(item =>
      (!this.filters.buildingId || item.buildingId === this.filters.buildingId) &&
      (!this.filters.expensePeriodId || item.expensePeriodId === this.filters.expensePeriodId)
    );
    this.sortItems();
    this.buildGroups();
    this.cdr.markForCheck();
  }

  isGroupOpen(periodId: string): boolean {
    return this.openGroups.has(periodId);
  }

  toggleGroup(periodId: string): void {
    if (!this.openGroups.delete(periodId)) {
      this.openGroups.add(periodId);
    }
  }

  trackGroup(_: number, group: { periodId: string }): string {
    return group.periodId;
  }

  private buildGroups(): void {
    const map = new Map<string, BuildingExpensesGroup>();
    for (const item of this.items) {
      let group = map.get(item.expensePeriodId);
      if (!group) {
        group = { periodId: item.expensePeriodId, periodName: item.expensePeriodName, buildingName: item.buildingName, total: 0, items: [] };
        map.set(item.expensePeriodId, group);
      }
      group.items.push(item);
      group.total += item.amount ?? 0;
    }
    const startOf = (id: string) => this.periods.find((p) => p.id === id)?.startDate ?? '';
    this.groups = [...map.values()].sort((a, b) => startOf(b.periodId).localeCompare(startOf(a.periodId)));
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
    if (!this.editingRecurringId) {
      this.submitRecurringForAll();
      return;
    }

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
    this.recurringApi.update(this.editingRecurringId, request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (item) => {
        this.recurringItems = this.recurringItems.map((r) => r.id === item.id ? item : r);
        this.isSavingRecurring = false;
        this.showRecurringForm = false;
        this.cancelRecurringEdit();
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Plantilla actualizada.', life: 4000 });
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

  private submitRecurringForAll(): void {
    if (!this.recurringSelectAll && this.recurringSelectedBuildingIds.length === 0) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Elegí al menos un edificio, o marcá "Todos los edificios".', life: 5000 });
      return;
    }

    const request: RecurringBuildingExpenseCreateForAllRequest = {
      buildingIds: this.recurringSelectAll ? [] : this.recurringSelectedBuildingIds,
      category: this.recurringForm.category,
      supplierName: this.recurringForm.supplierName.trim(),
      description: this.recurringForm.description.trim(),
      amount: Number(this.recurringForm.amount),
      distributionType: this.recurringForm.distributionType,
      notes: this.recurringForm.notes.trim(),
      isActive: this.recurringForm.isActive
    };

    if (!request.description) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La descripcion es obligatoria.', life: 5000 });
      return;
    }
    if (request.amount <= 0) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El monto debe ser mayor que cero.', life: 5000 });
      return;
    }

    this.isSavingRecurring = true;
    this.recurringApi.createForAll(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.isSavingRecurring = false;
        this.showRecurringForm = false;
        this.cancelRecurringEdit();
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Plantilla creada para ${items.length} edificio(s).`, life: 4000 });
        this.loadRecurring();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo crear la plantilla para todos los edificios.'), life: 5000 });
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
          this.reloadExpenses();
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
        this.allItems = this.allItems.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Gasto eliminado.', life: 4000 });
        this.applyFilters();
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
          this.allItems = this.allItems.map((item) => item.id === updated.id ? updated : item);
          this.applyFilters();
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Comprobante "${file.name}" adjuntado.`, life: 4000 });
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
          this.allItems = this.allItems.map((current) =>
            current.id === item.id ? { ...current, hasReceipt: false, receiptFileName: null } : current
          );
          this.applyFilters();
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Comprobante eliminado.', life: 4000 });
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
      Ande: 'ANDE',
      Essap: 'ESSAP',
      InternetPhone: 'Internet y telefonía',
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
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private reloadExpenses(): void {
    this.loading = true;
    this.expensesApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.allItems = items;
        this.loading = false;
        this.applyFilters();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de gastos.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadData(): void {
    forkJoin({
      expenses: this.expensesApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll(),
      units: this.unitsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ expenses, buildings, periods, units }) => {
        this.allItems = expenses;
        this.buildings = buildings;
        this.periods = periods;
        this.units = units;
        this.loading = false;
        this.applyFilters();
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
    this.allItems = this.editingId
      ? this.allItems.map(item => item.id === expense.id ? expense : item)
      : [expense, ...this.allItems];
    this.applyFilters();
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

import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { InputNumber } from 'primeng/inputnumber';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { ExpenseChargesApiService } from '../../api/expense-charges-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import { Building, ExpenseCharge, ExpenseChargeType, ExpensePeriod, Unit } from '../../api/models';

type ChargeRow =
  | { kind: 'single'; charge: ExpenseCharge }
  | { kind: 'group'; key: string; unitId: string; unitCode: string; buildingName: string; expensePeriodName: string;
      expensePeriodId: string; charges: ExpenseCharge[]; totalAmount: number; expanded: boolean };

interface UnitGroup {
  unitId: string;
  unitCode: string;
  buildingName: string;
  rows: ChargeRow[];
  chargeCount: number;
  totalAmount: number;
  expanded: boolean;
}

@Component({
  standalone: true,
  selector: 'app-expense-charges-page',
  imports: [CommonModule, FormsModule, Button, Card, InputNumber, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Cargos</h1>
            <p>Emisión de expensas por unidad dentro de cada periodo.</p>
          </div>
        </div>
        <p-button
          *ngIf="!isReadOnly"
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo cargo'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <!-- Quick search -->
      <div class="quick-search">
        <span class="pi pi-search quick-search-icon"></span>
        <input type="text" [(ngModel)]="searchText" name="searchText" (ngModelChange)="applyFilters()"
               placeholder="Buscar por unidad, edificio o concepto..." />
        <button type="button" class="quick-search-clear" *ngIf="searchText" (click)="searchText=''; applyFilters()">
          <span class="pi pi-times"></span>
        </button>
      </div>

      <!-- Filters bar -->
      <div class="filters-bar">
        <span class="pi pi-filter filters-icon"></span>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filters.buildingId" name="filterBuildingId" (ngModelChange)="onBuildingFilterChange()">
            <option value="">Todos</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Periodo</span>
          <select [(ngModel)]="filters.expensePeriodId" name="filterPeriodId" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option *ngFor="let p of filteredPeriodsForSelector" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
          </select>
        </div>
        <div class="field-block unit-filter">
          <span>Unidades</span>
          <div class="unit-picker" (click)="unitInput.focus()">
            <span class="unit-chip" *ngFor="let u of selectedUnitsForFilter">
              {{ u.code }}
              <button type="button" (click)="removeUnitFilter(u.id); $event.stopPropagation()" aria-label="Quitar unidad"><span class="pi pi-times"></span></button>
            </span>
            <input #unitInput type="text" [(ngModel)]="unitQuery" name="unitQuery"
                   (focus)="unitDropdownOpen = true" (blur)="closeUnitDropdown()"
                   (keydown.enter)="addFirstUnitSuggestion(); $event.preventDefault()"
                   (keydown.backspace)="onUnitBackspace()"
                   [placeholder]="filters.unitIds.length ? '' : 'Escribí para buscar unidades...'" autocomplete="off" />
          </div>
          <div class="unit-dropdown" *ngIf="unitDropdownOpen && unitSuggestions.length">
            <button type="button" class="unit-option" *ngFor="let u of unitSuggestions" (mousedown)="addUnitFilter(u.id); $event.preventDefault()">
              <strong>{{ u.code }}</strong> <small>{{ u.buildingName }}</small>
            </button>
          </div>
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" size="small" (onClick)="resetFilters()"></p-button>
      </div>

      <!-- New charge form -->
      <form class="panel-box form-panel" *ngIf="showForm" (ngSubmit)="submitCharge()">
        <div class="panel-box-title">
          <span class="pi pi-receipt"></span>
          {{ editingId ? 'Editar cargo' : 'Nuevo cargo' }}
        </div>
        <div class="charge-form">
          <div class="field-block">
            <span>Periodo <em>*</em></span>
            <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required (ngModelChange)="onFormPeriodChange()">
              <option value="" disabled>— Seleccionar —</option>
              <option *ngFor="let period of draftPeriods" [value]="period.id">{{ period.name }} · {{ period.buildingName }}</option>
            </select>
          </div>

          <div class="field-block">
            <span>Unidad <em>*</em></span>
            <select [(ngModel)]="form.unitId" name="unitId" required>
              <option value="" disabled>— Seleccionar —</option>
              <option *ngFor="let unit of availableUnits" [value]="unit.id">{{ unit.code }} · {{ unit.buildingName }}</option>
            </select>
          </div>

          <div class="field-block">
            <span>Tipo <em>*</em></span>
            <select [(ngModel)]="form.chargeType" name="chargeType" required>
              <option *ngFor="let type of chargeTypes" [value]="type">{{ chargeTypeLabel(type) }}</option>
            </select>
          </div>

          <div class="field-block">
            <span>Monto <em>*</em></span>
            <p-inputnumber [(ngModel)]="form.amount" name="amount" [useGrouping]="true" prefix="₲ " [min]="1" [minFractionDigits]="0" [maxFractionDigits]="0" [required]="true" styleClass="w-full"></p-inputnumber>
          </div>

          <div class="field-block wide2">
            <span>Concepto <em>*</em></span>
            <input [(ngModel)]="form.concept" name="concept" type="text" required maxlength="200" placeholder="Ej: Expensa ordinaria Junio 2026" />
          </div>

          <div class="field-block wide2">
            <span>Notas opcionales</span>
            <input [(ngModel)]="form.notes" name="notes" type="text" placeholder="Observaciones, referencias, etc." />
          </div>
        </div>

        <div class="form-footer">
          <p class="form-hint" *ngIf="!draftPeriods.length">No hay periodos en borrador disponibles.</p>
          <div class="form-actions">
            <p-button *ngIf="editingId" type="button" label="Cancelar" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="cancelEdit()"></p-button>
            <p-button
              type="submit"
              [disabled]="!draftPeriods.length || !availableUnits.length"
              [loading]="isSaving"
              [icon]="editingId ? 'pi pi-check' : 'pi pi-plus'"
              [label]="editingId ? 'Guardar cambios' : 'Agregar cargo'">
            </p-button>
          </div>
        </div>
      </form>

      <p class="app-state" *ngIf="loading">Cargando cargos...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay cargos cargados.</p>
      <p class="app-state" *ngIf="!loading && items.length && !unitGroups.length">Ningún resultado coincide con la búsqueda.</p>

      <div class="app-list" *ngIf="unitGroups.length">
        <div class="app-row header charges-grid">
          <span>Concepto</span>
          <span>Tipo</span>
          <span>Periodo · Edificio</span>
          <span>Unidad</span>
          <span>Monto</span>
          <span class="actions-head" *ngIf="!isReadOnly">Acciones</span>
        </div>

        <ng-container *ngFor="let unitGroup of pagedUnitGroups">

          <!-- Fila resumen por unidad -->
          <div class="app-row charges-grid unit-row" (click)="toggleUnitGroup(unitGroup)">
            <span>
              <strong>{{ unitGroup.unitCode }}</strong>
              <small> · {{ unitGroup.chargeCount }} cargo{{ unitGroup.chargeCount !== 1 ? 's' : '' }}</small>
            </span>
            <span></span>
            <span>{{ unitGroup.buildingName }}</span>
            <span></span>
            <span [class.negative-amount]="unitGroup.totalAmount < 0"><strong>{{ formatCurrency(unitGroup.totalAmount) }}</strong></span>
            <div class="app-actions">
              <span class="pi" [class.pi-chevron-down]="!unitGroup.expanded" [class.pi-chevron-up]="unitGroup.expanded"></span>
            </div>
          </div>

          <ng-container *ngIf="unitGroup.expanded">
          <ng-container *ngFor="let row of unitGroup.rows">

          <!-- Fila resumen para recargos de mora agrupados -->
          <div class="app-row charges-grid group-row" *ngIf="row.kind === 'group'" (click)="toggleGroupRow(row); $event.stopPropagation()">
            <span>
              <strong>Recargos por mora ({{ row.charges.length }} cuotas)</strong>
              <small> · clic para ver el detalle</small>
            </span>
            <span>Ajuste</span>
            <span>{{ row.expensePeriodName }} · {{ row.buildingName }}</span>
            <span>{{ row.unitCode }}</span>
            <span [class.negative-amount]="row.totalAmount < 0">{{ formatCurrency(row.totalAmount) }}</span>
            <div class="app-actions">
              <span class="pi" [class.pi-chevron-down]="!row.expanded" [class.pi-chevron-up]="row.expanded"></span>
            </div>
          </div>

          <!-- Cuotas individuales del grupo, solo si está expandido -->
          <div class="app-row charges-grid group-detail-row"
               [class.is-reversal]="charge.isReversal" [class.is-reversed]="charge.isReversed"
               *ngFor="let charge of (row.kind === 'group' && row.expanded ? row.charges : [])">
            <span>
              <strong>{{ charge.concept }}</strong>
              <span class="badge-reversal" *ngIf="charge.isReversal">REVERSIÓN</span>
              <span class="badge-reversed" *ngIf="charge.isReversed">REVERTIDO</span>
            </span>
            <span>{{ chargeTypeLabel(charge.chargeType) }}</span>
            <span>{{ charge.expensePeriodName }} · {{ charge.buildingName }}</span>
            <span>{{ charge.unitCode }}</span>
            <span [class.negative-amount]="charge.amount < 0">{{ formatCurrency(charge.amount) }}</span>
            <div class="app-actions" *ngIf="!isReadOnly">
              <p-button
                *ngIf="!charge.isReversal && !charge.isReversed"
                type="button" icon="pi pi-replay" severity="warn"
                [rounded]="true" [text]="true"
                pTooltip="Revertir cargo — genera un ajuste negativo que anula este importe en el mismo periodo"
                tooltipPosition="top"
                [disabled]="isSaving"
                (onClick)="reverseCharge(charge)">
              </p-button>
              <p-button
                *ngIf="!charge.isReversal"
                type="button" icon="pi pi-trash" severity="danger"
                [rounded]="true" [text]="true"
                [disabled]="isSaving || !isDraftPeriod(charge.expensePeriodId)"
                (onClick)="deleteCharge(charge)">
              </p-button>
            </div>
          </div>

          <!-- Fila normal (no es parte de un grupo de mora) -->
          <div class="app-row charges-grid" [class.is-reversal]="row.charge.isReversal" [class.is-reversed]="row.charge.isReversed" *ngIf="row.kind === 'single'">
            <span>
              <strong>{{ row.charge.concept }}</strong>
              <small *ngIf="row.charge.sourceBuildingExpenseDescription"> · Origen: {{ row.charge.sourceBuildingExpenseDescription }}</small>
              <small *ngIf="row.charge.sourceSettlementName && !row.charge.sourceBuildingExpenseDescription"> · Liquidación: {{ row.charge.sourceSettlementName }}</small>
              <span class="badge-reversal" *ngIf="row.charge.isReversal">REVERSIÓN</span>
              <span class="badge-reversed" *ngIf="row.charge.isReversed">REVERTIDO</span>
            </span>
            <span>{{ chargeTypeLabel(row.charge.chargeType) }}</span>
            <span>{{ row.charge.expensePeriodName }} · {{ row.charge.buildingName }}</span>
            <span>{{ row.charge.unitCode }}</span>
            <span [class.negative-amount]="row.charge.amount < 0">{{ formatCurrency(row.charge.amount) }}</span>
            <div class="app-actions" *ngIf="!isReadOnly">
              <p-button
                *ngIf="!row.charge.isReversal && !row.charge.isReversed"
                type="button" icon="pi pi-pencil" severity="secondary"
                [rounded]="true" [text]="true"
                [disabled]="!isDraftPeriod(row.charge.expensePeriodId)"
                (onClick)="startEdit(row.charge)">
              </p-button>
              <p-button
                *ngIf="!row.charge.isReversal && !row.charge.isReversed"
                type="button" icon="pi pi-replay" severity="warn"
                [rounded]="true" [text]="true"
                pTooltip="Revertir cargo — genera un ajuste negativo que anula este importe en el mismo periodo"
                tooltipPosition="top"
                [disabled]="isSaving"
                (onClick)="reverseCharge(row.charge)">
              </p-button>
              <p-button
                *ngIf="!row.charge.isReversal"
                type="button" icon="pi pi-trash" severity="danger"
                [rounded]="true" [text]="true"
                [disabled]="isSaving || !isDraftPeriod(row.charge.expensePeriodId)"
                (onClick)="deleteCharge(row.charge)">
              </p-button>
            </div>
          </div>
          </ng-container>
          </ng-container>
        </ng-container>
      </div>

      <!-- Pagination -->
      <div class="pagination-bar" *ngIf="unitGroups.length">
        <div class="page-size-picker">
          <span>Por página:</span>
          <select [(ngModel)]="pageSize" name="pageSize" (ngModelChange)="currentPage = 1">
            <option [ngValue]="10">10</option>
            <option [ngValue]="25">25</option>
            <option [ngValue]="50">50</option>
            <option [ngValue]="100">100</option>
          </select>
        </div>
        <div class="page-nav">
          <p-button type="button" icon="pi pi-angle-left" severity="secondary" [text]="true" [rounded]="true"
                    [disabled]="currentPage <= 1" (onClick)="currentPage = currentPage - 1"></p-button>
          <span class="page-indicator">Unidad {{ (currentPage - 1) * pageSize + 1 }}–{{ pageRangeEnd }} de {{ unitGroups.length }}</span>
          <p-button type="button" icon="pi pi-angle-right" severity="secondary" [text]="true" [rounded]="true"
                    [disabled]="currentPage >= totalPages" (onClick)="currentPage = currentPage + 1"></p-button>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    /* Quick search */
    .quick-search {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.6rem 1rem; margin-bottom: 0.75rem;
      background: #fff; border: 1.5px solid rgba(20,54,61,0.15); border-radius: 12px;
    }
    .quick-search-icon { color: var(--brand-muted); }
    .quick-search input {
      flex: 1; border: none; outline: none; font-size: 0.95rem; color: var(--brand-ink); background: transparent;
    }
    .quick-search-clear { background: none; border: none; cursor: pointer; color: var(--brand-muted); padding: 0.2rem; }
    .quick-search-clear:hover { color: var(--brand-ink); }

    /* Unit grouping */
    .unit-row { cursor: pointer; background: rgba(19,133,182,0.05); font-weight: 600; }
    .unit-row:hover { background: rgba(19,133,182,0.1); }
    .unit-row .pi-chevron-down, .unit-row .pi-chevron-up { color: var(--brand-muted); }

    /* Pagination */
    .pagination-bar {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;
      padding: 0.9rem 0.25rem 0.25rem;
    }
    .page-size-picker { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--brand-muted); }
    .page-size-picker select { border: 1.5px solid rgba(20,54,61,0.18); border-radius: 8px; padding: 0.3rem 0.5rem; font-size: 0.85rem; }
    .page-nav { display: flex; align-items: center; gap: 0.5rem; }
    .page-indicator { font-size: 0.85rem; color: var(--brand-muted); min-width: 160px; text-align: center; }

    /* Filters bar */
    .filters-bar {
      display: flex;
      align-items: flex-end;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: rgba(20,54,61,0.04);
      border: 1px solid rgba(20,54,61,0.1);
      border-radius: 14px;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }
    .filters-icon { color: var(--brand-muted); font-size: 1rem; margin-bottom: 0.35rem; }

    /* Unit multi-select autocomplete */
    .unit-filter { position: relative; flex: 1; min-width: 260px; }
    .unit-picker {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem;
      min-height: 2.4rem; padding: 0.25rem 0.5rem; background: #fff; cursor: text;
      border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px;
    }
    .unit-picker:focus-within { border-color: var(--brand-blue); }
    .unit-picker input {
      flex: 1; min-width: 120px; border: 0 !important; outline: none; padding: 0.25rem !important;
      background: transparent !important; width: auto !important; font-size: 0.92rem;
    }
    .unit-chip {
      display: inline-flex; align-items: center; gap: 0.3rem;
      background: rgba(19,133,182,0.12); color: #0f5f82; font-weight: 700; font-size: 0.82rem;
      border-radius: 999px; padding: 0.15rem 0.35rem 0.15rem 0.65rem; text-transform: none; letter-spacing: 0;
    }
    .unit-chip button { border: 0; background: none; cursor: pointer; color: inherit; padding: 0.1rem 0.25rem; line-height: 1; }
    .unit-dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 20; margin-top: 0.25rem;
      max-height: 15rem; overflow-y: auto; background: #fff;
      border: 1px solid rgba(20,54,61,0.15); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .unit-option {
      display: flex; justify-content: space-between; gap: 1rem; width: 100%; text-align: left;
      padding: 0.5rem 0.85rem; border: 0; background: none; cursor: pointer; font: inherit; color: var(--brand-ink);
    }
    .unit-option:hover { background: rgba(19,133,182,0.08); }

    /* Panel box */
    .panel-box {
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
    }
    .form-panel { border: 1.5px solid rgba(19,133,182,0.25); background: rgba(235,247,255,0.45); }
    .panel-box-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--brand-ink);
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .panel-box-title .pi { color: var(--brand-blue); }

    /* Field blocks */
    .field-block {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .field-block span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block em { color: #e53e3e; font-style: normal; }
    .field-block select,
    .field-block input[type="text"] {
      border: 1.5px solid rgba(20,54,61,0.18);
      border-radius: 10px;
      padding: 0.5rem 0.75rem;
      font-size: 0.92rem;
      color: var(--brand-ink);
      background: #fff;
      outline: none;
      transition: border-color 0.15s;
      width: 100%;
    }
    .field-block select:focus,
    .field-block input[type="text"]:focus { border-color: var(--brand-blue); }

    /* Charge form grid */
    .charge-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .wide2 { grid-column: span 2; }

    /* Form footer */
    .form-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 1rem;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(20,54,61,0.1);
    }
    .form-hint { color: #b45309; font-size: 0.85rem; margin: 0; flex: 1; }
    .form-actions { display: flex; gap: 0.75rem; }

    /* List */
    .charges-grid { grid-template-columns: 1.6fr 0.8fr 1.2fr 0.6fr 0.8fr 0.55fr; }
    .actions-head { text-align: right; }
    small { color: #6d8487; font-size: 0.82em; }
    .badge-reversal {
      display: inline-block; margin-left: 0.5rem;
      font-size: 0.72em; font-weight: 600;
      background: #fef3c7; color: #92400e;
      border: 1px solid #f59e0b; border-radius: 3px;
      padding: 0 4px;
    }
    .badge-reversed {
      display: inline-block; margin-left: 0.5rem;
      font-size: 0.72em; font-weight: 600;
      background: #fee2e2; color: #991b1b;
      border: 1px solid #ef4444; border-radius: 3px;
      padding: 0 4px;
    }
    .is-reversal { opacity: 0.75; }
    .is-reversed { opacity: 0.65; }
    .negative-amount { color: #dc2626; }
    .group-row { cursor: pointer; background: rgba(245,158,11,0.06); }
    .group-row:hover { background: rgba(245,158,11,0.12); }
    .group-row .pi-chevron-down, .group-row .pi-chevron-up { color: var(--brand-muted); }
    .group-detail-row { background: rgba(20,54,61,0.02); }
    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .charge-form { grid-template-columns: 1fr; }
      .wide2 { grid-column: span 1; }
    }
  `]
})
export class ExpenseChargesPageComponent implements OnInit {
  private readonly chargesApi = inject(ExpenseChargesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  items: ExpenseCharge[] = [];
  displayRows: ChargeRow[] = [];
  unitGroups: UnitGroup[] = [];
  private allItems: ExpenseCharge[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  readonly chargeTypes: ExpenseChargeType[] = ['Ordinary', 'ReserveFund', 'Extraordinary', 'Individual', 'Adjustment'];
  filters = { buildingId: '', expensePeriodId: '', unitIds: [] as string[] };
  unitQuery = '';
  unitDropdownOpen = false;
  searchText = '';
  pageSize = 25;
  currentPage = 1;
  form = this.createInitialForm();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.unitGroups.length / this.pageSize));
  }

  get pageRangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.unitGroups.length);
  }

  get pagedUnitGroups(): UnitGroup[] {
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const start = (this.currentPage - 1) * this.pageSize;
    return this.unitGroups.slice(start, start + this.pageSize);
  }

  get filteredPeriodsForSelector(): ExpensePeriod[] {
    return this.filters.buildingId
      ? this.periods.filter((p) => p.buildingId === this.filters.buildingId)
      : this.periods;
  }

  get selectedUnitsForFilter(): Unit[] {
    return this.filters.unitIds
      .map((id) => this.units.find((u) => u.id === id))
      .filter((u): u is Unit => !!u);
  }

  get unitSuggestions(): Unit[] {
    const q = this.unitQuery.trim().toLowerCase();
    return this.units
      .filter((u) =>
        (!this.filters.buildingId || u.buildingId === this.filters.buildingId) &&
        !this.filters.unitIds.includes(u.id) &&
        (!q || u.code.toLowerCase().includes(q) || u.buildingName.toLowerCase().includes(q)))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .slice(0, 50);
  }

  addUnitFilter(id: string): void {
    if (!this.filters.unitIds.includes(id)) {
      this.filters.unitIds = [...this.filters.unitIds, id];
    }
    this.unitQuery = '';
    this.applyFilters();
  }

  addFirstUnitSuggestion(): void {
    const first = this.unitSuggestions[0];
    if (first) this.addUnitFilter(first.id);
  }

  removeUnitFilter(id: string): void {
    this.filters.unitIds = this.filters.unitIds.filter((x) => x !== id);
    this.applyFilters();
  }

  onUnitBackspace(): void {
    if (!this.unitQuery && this.filters.unitIds.length) {
      this.removeUnitFilter(this.filters.unitIds[this.filters.unitIds.length - 1]);
    }
  }

  closeUnitDropdown(): void {
    setTimeout(() => { this.unitDropdownOpen = false; this.cdr.markForCheck(); }, 150);
  }

  get draftPeriods(): ExpensePeriod[] {
    return this.periods.filter((p) => p.status === 'Draft');
  }

  get availableUnits(): Unit[] {
    const selectedPeriod = this.periods.find((p) => p.id === this.form.expensePeriodId);
    return selectedPeriod ? this.units.filter((u) => u.buildingId === selectedPeriod.buildingId) : this.units;
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

  onFormPeriodChange(): void {
    const unitStillMatches = this.availableUnits.some((u) => u.id === this.form.unitId);
    if (!unitStillMatches) {
      this.form.unitId = '';
    }
  }

  onBuildingFilterChange(): void {
    const periodStillMatches = this.filteredPeriodsForSelector.some((p) => p.id === this.filters.expensePeriodId);
    if (!periodStillMatches) {
      this.filters.expensePeriodId = '';
    }
    if (this.filters.buildingId) {
      this.filters.unitIds = this.filters.unitIds.filter((id) =>
        this.units.find((u) => u.id === id)?.buildingId === this.filters.buildingId);
    }
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.searchText.trim().toLowerCase();
    this.items = this.allItems.filter(item =>
      (!this.filters.buildingId || item.buildingId === this.filters.buildingId) &&
      (!this.filters.expensePeriodId || item.expensePeriodId === this.filters.expensePeriodId) &&
      (!this.filters.unitIds.length || this.filters.unitIds.includes(item.unitId)) &&
      (!search ||
        item.unitCode.toLowerCase().includes(search) ||
        item.buildingName.toLowerCase().includes(search) ||
        item.concept.toLowerCase().includes(search))
    );
    this.sortItems();
    this.buildDisplayRows();
    this.buildUnitGroups();
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  toggleGroupRow(row: ChargeRow): void {
    if (row.kind !== 'group') return;
    row.expanded = !row.expanded;
    this.cdr.markForCheck();
  }

  toggleUnitGroup(group: UnitGroup): void {
    group.expanded = !group.expanded;
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.filters = { buildingId: '', expensePeriodId: '', unitIds: [] };
    this.unitQuery = '';
    this.searchText = '';
    this.applyFilters();
  }

  submitCharge(): void {
    this.isSaving = true;

    const request = {
      expensePeriodId: this.form.expensePeriodId,
      unitId: this.form.unitId,
      chargeType: this.form.chargeType,
      concept: this.form.concept.trim(),
      amount: Number(this.form.amount),
      notes: this.form.notes.trim()
    };

    const operation = this.editingId
      ? this.chargesApi.update(this.editingId, request)
      : this.chargesApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (charge) => {
        this.allItems = this.editingId
          ? this.allItems.map((item) => item.id === charge.id ? charge : item)
          : [charge, ...this.allItems];
        this.applyFilters();
        this.form = this.createInitialForm();
        this.isSaving = false;
        this.showForm = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Cargo actualizado correctamente.' : 'Cargo creado correctamente.', life: 4000 });
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, this.editingId ? 'No se pudo actualizar el cargo.' : 'No se pudo guardar el cargo.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  reverseCharge(item: ExpenseCharge): void {
    this.isSaving = true;

    this.chargesApi.reverse(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (reversal) => {
        const updatedOriginal: ExpenseCharge = { ...item, isReversed: true };
        this.allItems = this.allItems.map((c) => c.id === item.id ? updatedOriginal : c);
        this.allItems = [reversal, ...this.allItems];
        this.applyFilters();
        this.sortItems();
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Cargo revertido. Se creó un ajuste negativo en el mismo periodo.', life: 5000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo revertir el cargo.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteCharge(item: ExpenseCharge): void {
    this.isSaving = true;

    this.chargesApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.allItems = this.allItems.filter((current) => current.id !== item.id);
        this.items = this.items.filter((current) => current.id !== item.id);
        this.buildDisplayRows();
        this.buildUnitGroups();
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

  chargeTypeLabel(type: ExpenseChargeType): string {
    return ({
      Ordinary: 'Ordinaria',
      ReserveFund: 'Fondo reserva',
      Extraordinary: 'Extraordinario',
      Individual: 'Individual',
      Adjustment: 'Ajuste'
    })[type];
  }

  isDraftPeriod(expensePeriodId: string): boolean {
    return this.periods.some((p) => p.id === expensePeriodId && p.status === 'Draft');
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadData(): void {
    forkJoin({
      charges: this.chargesApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll(),
      units: this.unitsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ charges, buildings, periods, units }) => {
          this.allItems = charges;
          this.buildings = buildings;
          this.periods = periods;
          this.units = units;
          this.loading = false;
          this.applyFilters();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de cargos.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private buildDisplayRows(): void {
    const groups = new Map<string, ExpenseCharge[]>();
    for (const item of this.items) {
      if (!item.isLateFee) continue;
      const key = `${item.unitId}|${item.expensePeriodId}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(item);
    }

    const consumedKeys = new Set<string>();
    const rows: ChargeRow[] = [];

    for (const item of this.items) {
      if (item.isLateFee) {
        const key = `${item.unitId}|${item.expensePeriodId}`;
        const group = groups.get(key)!;
        if (group.length > 1) {
          if (consumedKeys.has(key)) continue;
          consumedKeys.add(key);
          rows.push({
            kind: 'group',
            key,
            unitId: item.unitId,
            unitCode: item.unitCode,
            buildingName: item.buildingName,
            expensePeriodName: item.expensePeriodName,
            expensePeriodId: item.expensePeriodId,
            charges: group,
            totalAmount: group.reduce((sum, c) => sum + c.amount, 0),
            expanded: false
          });
          continue;
        }
      }
      rows.push({ kind: 'single', charge: item });
    }

    this.displayRows = rows;
  }

  private buildUnitGroups(): void {
    const previousExpanded = new Set(this.unitGroups.filter((g) => g.expanded).map((g) => g.unitId));

    const byUnit = new Map<string, ChargeRow[]>();
    for (const row of this.displayRows) {
      const unitId = row.kind === 'single' ? row.charge.unitId : row.unitId;
      if (!byUnit.has(unitId)) byUnit.set(unitId, []);
      byUnit.get(unitId)!.push(row);
    }

    const groups: UnitGroup[] = [];
    for (const [unitId, rows] of byUnit) {
      const first = rows[0].kind === 'single' ? rows[0].charge : rows[0];
      const chargeCount = rows.reduce((sum, r) => sum + (r.kind === 'single' ? 1 : r.charges.length), 0);
      const totalAmount = rows.reduce((sum, r) => sum + (r.kind === 'single' ? r.charge.amount : r.totalAmount), 0);
      groups.push({
        unitId,
        unitCode: first.unitCode,
        buildingName: first.buildingName,
        rows,
        chargeCount,
        totalAmount,
        expanded: previousExpanded.has(unitId)
      });
    }

    this.unitGroups = groups;
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      b.expensePeriodName.localeCompare(a.expensePeriodName) ||
      a.buildingName.localeCompare(b.buildingName) ||
      a.unitCode.localeCompare(b.unitCode) ||
      a.concept.localeCompare(b.concept));
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

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

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header charges-grid">
          <span>Concepto</span>
          <span>Tipo</span>
          <span>Periodo · Edificio</span>
          <span>Unidad</span>
          <span>Monto</span>
          <span class="actions-head" *ngIf="!isReadOnly">Acciones</span>
        </div>

        <div class="app-row charges-grid" [class.is-reversal]="item.isReversal" [class.is-reversed]="item.isReversed" *ngFor="let item of items">
          <span>
            <strong>{{ item.concept }}</strong>
            <small *ngIf="item.sourceBuildingExpenseDescription"> · Origen: {{ item.sourceBuildingExpenseDescription }}</small>
            <small *ngIf="item.sourceSettlementName && !item.sourceBuildingExpenseDescription"> · Liquidación: {{ item.sourceSettlementName }}</small>
            <span class="badge-reversal" *ngIf="item.isReversal">REVERSIÓN</span>
            <span class="badge-reversed" *ngIf="item.isReversed">REVERTIDO</span>
          </span>
          <span>{{ chargeTypeLabel(item.chargeType) }}</span>
          <span>{{ item.expensePeriodName }} · {{ item.buildingName }}</span>
          <span>{{ item.unitCode }}</span>
          <span [class.negative-amount]="item.amount < 0">{{ formatCurrency(item.amount) }}</span>
          <div class="app-actions" *ngIf="!isReadOnly">
            <p-button
              *ngIf="!item.isReversal && !item.isReversed"
              type="button" icon="pi pi-pencil" severity="secondary"
              [rounded]="true" [text]="true"
              [disabled]="!isDraftPeriod(item.expensePeriodId)"
              (onClick)="startEdit(item)">
            </p-button>
            <p-button
              *ngIf="!item.isReversal && !item.isReversed"
              type="button" icon="pi pi-replay" severity="warn"
              [rounded]="true" [text]="true"
              pTooltip="Revertir cargo — genera un ajuste negativo que anula este importe en el mismo periodo"
              tooltipPosition="top"
              [disabled]="isSaving"
              (onClick)="reverseCharge(item)">
            </p-button>
            <p-button
              *ngIf="!item.isReversal"
              type="button" icon="pi pi-trash" severity="danger"
              [rounded]="true" [text]="true"
              [disabled]="isSaving || !isDraftPeriod(item.expensePeriodId)"
              (onClick)="deleteCharge(item)">
            </p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
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
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  readonly chargeTypes: ExpenseChargeType[] = ['Ordinary', 'ReserveFund', 'Extraordinary', 'Individual', 'Adjustment'];
  filters = { buildingId: '', expensePeriodId: '' };
  form = this.createInitialForm();

  get filteredPeriodsForSelector(): ExpensePeriod[] {
    return this.filters.buildingId
      ? this.periods.filter((p) => p.buildingId === this.filters.buildingId)
      : this.periods;
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
    this.applyFilters();
  }

  applyFilters(): void {
    this.loading = true;
    this.chargesApi.getAll({
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
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de cargos.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  resetFilters(): void {
    this.filters = { buildingId: '', expensePeriodId: '' };
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
        this.items = this.items.map((c) => c.id === item.id ? updatedOriginal : c);
        this.items = [reversal, ...this.items];
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
          this.items = charges;
          this.buildings = buildings;
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

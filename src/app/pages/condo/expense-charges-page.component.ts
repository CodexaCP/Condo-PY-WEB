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
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import { Building, ExpenseCharge, ExpenseChargeType, ExpensePeriod, Unit } from '../../api/models';

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

      <div class="filters-grid">
        <label>
          <span>Filtrar por edificio</span>
          <select [(ngModel)]="filters.buildingId" name="filterBuildingId" (ngModelChange)="onBuildingFilterChange()">
            <option value="">Todos los edificios</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </label>

        <label>
          <span>Filtrar por periodo</span>
          <select [(ngModel)]="filters.expensePeriodId" name="filterPeriodId" (ngModelChange)="applyFilters()">
            <option value="">Todos los periodos</option>
            <option *ngFor="let p of filteredPeriodsForSelector" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
          </select>
        </label>

        <div class="filter-actions">
          <p-button type="button" label="Limpiar filtros" severity="secondary" [text]="true" (onClick)="resetFilters()"></p-button>
        </div>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitCharge()">
        <label>
          <span>Periodo</span>
          <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required (ngModelChange)="onFormPeriodChange()">
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
          <input [(ngModel)]="form.concept" name="concept" type="text" required maxlength="200" />
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
            [disabled]="!draftPeriods.length || !availableUnits.length"
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
              type="button"
              icon="pi pi-pencil"
              severity="secondary"
              [rounded]="true"
              [text]="true"
              [disabled]="!isDraftPeriod(item.expensePeriodId)"
              (onClick)="startEdit(item)">
            </p-button>
            <p-button
              *ngIf="!item.isReversal && !item.isReversed"
              type="button"
              icon="pi pi-replay"
              severity="warn"
              [rounded]="true"
              [text]="true"
              pTooltip="Revertir cargo"
              [disabled]="isSaving"
              (onClick)="reverseCharge(item)">
            </p-button>
            <p-button
              *ngIf="!item.isReversal"
              type="button"
              icon="pi pi-trash"
              severity="danger"
              [rounded]="true"
              [text]="true"
              [disabled]="isSaving || !isDraftPeriod(item.expensePeriodId)"
              (onClick)="deleteCharge(item)">
            </p-button>
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
    .charges-grid { grid-template-columns: 1.6fr 0.8fr 1.2fr 0.6fr 0.8fr 0.55fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .filter-actions { display:flex; justify-content:flex-end; }
    .actions-head { text-align:right; }
    small { color:#6d8487; font-size:0.82em; }
    .badge-reversal {
      display:inline-block; margin-left:0.5rem;
      font-size:0.72em; font-weight:600;
      background:#fef3c7; color:#92400e;
      border:1px solid #f59e0b; border-radius:3px;
      padding:0 4px;
    }
    .badge-reversed {
      display:inline-block; margin-left:0.5rem;
      font-size:0.72em; font-weight:600;
      background:#fee2e2; color:#991b1b;
      border:1px solid #ef4444; border-radius:3px;
      padding:0 4px;
    }
    .is-reversal { opacity:0.75; }
    .is-reversed { opacity:0.65; }
    .negative-amount { color:#dc2626; }
    @media (max-width: 900px) {
      .filters-grid { grid-template-columns: 1fr; }
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
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
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

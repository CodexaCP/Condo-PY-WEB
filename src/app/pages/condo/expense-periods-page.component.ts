import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import {
  ApplyLateFeesResult,
  Building,
  ExpensePeriod,
  ExpensePeriodOperationalAlertItem,
  ExpensePeriodStatus,
  ExpenseSettlementChargePreview,
  ExpenseSettlementStatus,
  ExpenseSettlementSummary,
  GenerateExpenseChargesMode
} from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-expense-periods-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Periodos de expensas</h1>
            <p>Apertura, cierre y control de ciclos mensuales por edificio.</p>
          </div>
        </div>

        <p-button
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo periodo'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitPeriod()">
        <label class="wide">
          <span>Edificio</span>
          <select [(ngModel)]="form.buildingId" name="buildingId" required>
            <option value="" disabled>Selecciona un edificio</option>
            <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
          </select>
        </label>

        <label>
          <span>Anio</span>
          <input [(ngModel)]="form.year" name="year" type="number" min="2000" max="2100" required />
        </label>

        <label>
          <span>Mes</span>
          <input [(ngModel)]="form.month" name="month" type="number" min="1" max="12" required />
        </label>

        <label>
          <span>Nombre</span>
          <input [(ngModel)]="form.name" name="name" type="text" required maxlength="120" />
        </label>

        <label>
          <span>Inicio</span>
          <input [(ngModel)]="form.startDate" name="startDate" type="date" required />
        </label>

        <label>
          <span>Fin</span>
          <input [(ngModel)]="form.endDate" name="endDate" type="date" required />
        </label>

        <label>
          <span>Vencimiento</span>
          <input [(ngModel)]="form.dueDate" name="dueDate" type="date" required />
        </label>

        <label>
          <span>Estado inicial</span>
          <input value="Draft" type="text" readonly />
        </label>

        <label class="wide">
          <span>Notas</span>
          <input [(ngModel)]="form.notes" name="notes" type="text" maxlength="500" />
        </label>

        <div class="wide form-actions">
          <p-button
            type="submit"
            [disabled]="!buildings.length"
            [loading]="isSaving"
            [label]="editingId ? 'Guardar cambios' : 'Guardar periodo'">
          </p-button>
          <p-button
            *ngIf="editingId"
            type="button"
            label="Cancelar"
            icon="pi pi-times"
            severity="secondary"
            [text]="true"
            (onClick)="cancelEdit()">
          </p-button>
        </div>
      </form>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
      <p-message *ngIf="successMessage" severity="success" [text]="successMessage"></p-message>

      <div class="action-box" *ngIf="alerts.length">
        <div class="action-head">
          <div>
            <strong>Alertas operativas</strong>
            <span>{{ alerts.length }} alertas activas de vencimiento, mora o publicacion pendiente</span>
          </div>
        </div>

        <div class="app-list">
          <div class="app-row header alerts-grid">
            <span>Tipo</span>
            <span>Periodo</span>
            <span>Edificio</span>
            <span>Vencimiento</span>
            <span>Saldo</span>
          </div>

          <div class="app-row alerts-grid" *ngFor="let alert of alerts">
            <p-tag [value]="alertTypeLabel(alert)" [severity]="alertSeverity(alert)"></p-tag>
            <div class="alert-copy">
              <strong>{{ alert.expensePeriodName }}</strong>
              <span>{{ alert.message }}</span>
            </div>
            <span>{{ alert.buildingName }}</span>
            <span>{{ alert.dueDate }}</span>
            <span>{{ formatCurrency(alert.pendingAmount) }}</span>
          </div>
        </div>
      </div>

      <div class="action-box" *ngIf="generatorPeriod">
        <div class="action-head">
          <div>
            <strong>Liquidacion masiva</strong>
            <span>{{ generatorPeriod.name }} - {{ generatorPeriod.buildingName }}</span>
          </div>
          <p-button type="button" label="Cerrar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="cancelGenerator()"></p-button>
        </div>

        <form class="app-form-grid compact" (ngSubmit)="generateCharges()">
          <label>
            <span>Modo</span>
            <select [(ngModel)]="generatorForm.mode" name="generatorMode" required>
              <option *ngFor="let mode of generationModes" [value]="mode">{{ generationModeLabel(mode) }}</option>
            </select>
          </label>

          <label>
            <span>{{ generatorForm.mode === 'FixedAmount' ? 'Monto por unidad' : 'Monto total a distribuir' }}</span>
            <input [(ngModel)]="generatorForm.amount" name="generatorAmount" type="number" min="1" step="0.01" required />
          </label>

          <label class="wide">
            <span>Concepto</span>
            <input [(ngModel)]="generatorForm.concept" name="generatorConcept" type="text" required />
          </label>

          <label class="wide">
            <span>Notas</span>
            <input [(ngModel)]="generatorForm.notes" name="generatorNotes" type="text" />
          </label>

          <div class="wide form-actions">
            <p-button type="submit" [loading]="isGenerating" label="Generar cargos"></p-button>
          </div>
        </form>
      </div>

      <div class="action-box" *ngIf="settlementPeriod && settlementSummary">
        <div class="action-head">
          <div>
            <strong>Liquidacion consolidada</strong>
            <span>{{ settlementPeriod.name }} - {{ settlementPeriod.buildingName }}</span>
          </div>
          <p-button type="button" label="Cerrar" icon="pi pi-times" severity="secondary" [text]="true" (onClick)="closeSettlement()"></p-button>
        </div>

        <div class="settlement-grid">
          <div class="settlement-item">
            <span>Estado del periodo</span>
            <strong>{{ statusLabel(settlementSummary.periodStatus) }}</strong>
          </div>
          <div class="settlement-item">
            <span>Estado</span>
            <strong>{{ settlementStatusLabel(settlementSummary.status, settlementSummary.isCalculated) }}</strong>
          </div>
          <div class="settlement-item">
            <span>Total gastos</span>
            <strong>{{ formatCurrency(settlementSummary.totalBuildingExpenses) }}</strong>
          </div>
          <div class="settlement-item">
            <span>Total ingresos</span>
            <strong>{{ formatCurrency(settlementSummary.totalBuildingIncomes) }}</strong>
          </div>
          <div class="settlement-item">
            <span>Neto comun</span>
            <strong>{{ formatCurrency(settlementSummary.netCommonAmount) }}</strong>
          </div>
          <div class="settlement-item">
            <span>Fondo de reserva</span>
            <strong>{{ formatCurrency(settlementSummary.reserveFundAmount) }}</strong>
          </div>
          <div class="settlement-item">
            <span>Extraordinarios</span>
            <strong>{{ formatCurrency(settlementSummary.extraordinaryAmount) }}</strong>
          </div>
          <div class="settlement-item">
            <span>Cargos emitidos</span>
            <strong>{{ settlementSummary.generatedChargeCount }}</strong>
          </div>
        </div>

        <p class="settlement-meta" *ngIf="settlementSummary.generatedAtUtc">
          Ultimo calculo: {{ settlementSummary.generatedAtUtc }}<span *ngIf="settlementSummary.generatedByUserName"> por {{ settlementSummary.generatedByUserName }}</span>
        </p>
        <p class="settlement-meta" *ngIf="settlementSummary.approvedAtUtc">
          Aprobada: {{ settlementSummary.approvedAtUtc }}<span *ngIf="settlementSummary.approvedByUserName"> por {{ settlementSummary.approvedByUserName }}</span>
        </p>
        <p class="settlement-meta" *ngIf="settlementSummary.publishedAtUtc">
          Publicada: {{ settlementSummary.publishedAtUtc }}<span *ngIf="settlementSummary.publishedByUserName"> por {{ settlementSummary.publishedByUserName }}</span>
        </p>
        <p class="settlement-meta" *ngIf="!settlementSummary.generatedAtUtc">
          Resumen preliminar. Aun no existe una liquidacion consolidada persistida para este periodo.
        </p>

        <div class="form-actions">
          <p-button
            type="button"
            [label]="settlementSummary.isCalculated ? 'Recalcular liquidacion' : 'Calcular liquidacion'"
            [loading]="isCalculatingSettlement"
            [disabled]="settlementPeriod.status !== 'Draft'"
            (onClick)="calculateSettlement()">
          </p-button>
          <p-button
            type="button"
            label="Aprobar liquidacion"
            severity="info"
            [loading]="isApprovingSettlement"
            [disabled]="!canApproveSettlement()"
            (onClick)="approveSettlement()">
          </p-button>
          <p-button
            type="button"
            label="Ver vista previa"
            severity="secondary"
            [text]="true"
            [loading]="isLoadingSettlementPreview"
            [disabled]="!settlementSummary.isCalculated"
            (onClick)="loadSettlementPreview()">
          </p-button>
          <p-button
            type="button"
            label="Publicar comprobantes"
            severity="contrast"
            [loading]="isPublishingSettlement"
            [disabled]="!canPublishSettlement()"
            (onClick)="publishSettlement()">
          </p-button>
          <p-button
            type="button"
            label="Registrar recargos"
            severity="warn"
            [text]="true"
            [disabled]="!canApplyLateFees()"
            (onClick)="toggleLateFeeForm()">
          </p-button>
        </div>

        <form class="app-form-grid compact late-fee-box" *ngIf="showLateFeeForm" (ngSubmit)="applyLateFees()">
          <label>
            <span>% recargo</span>
            <input [(ngModel)]="lateFeeForm.ratePercentage" name="lateFeeRate" type="number" min="0.01" step="0.01" required />
          </label>

          <label>
            <span>Fecha de referencia</span>
            <input [(ngModel)]="lateFeeForm.referenceDate" name="lateFeeReferenceDate" type="date" />
          </label>

          <label class="wide">
            <span>Concepto</span>
            <input [(ngModel)]="lateFeeForm.concept" name="lateFeeConcept" type="text" required />
          </label>

          <label class="wide">
            <span>Notas</span>
            <input [(ngModel)]="lateFeeForm.notes" name="lateFeeNotes" type="text" />
          </label>

          <div class="wide form-actions">
            <p-button type="submit" severity="warn" [loading]="isApplyingLateFees" label="Aplicar recargos"></p-button>
          </div>
        </form>

        <div class="preview-box" *ngIf="settlementPreview">
          <div class="preview-head">
            <strong>Vista previa de cargos</strong>
            <span>{{ settlementPreview.chargeCount }} cargos · {{ settlementPreview.unitsAffected }} unidades · {{ formatCurrency(settlementPreview.totalGeneratedAmount) }}</span>
          </div>

          <div class="app-list" *ngIf="settlementPreview.items.length">
            <div class="app-row header preview-grid">
              <span>Unidad</span>
              <span>Concepto</span>
              <span>Monto</span>
            </div>

            <div class="app-row preview-grid" *ngFor="let item of settlementPreview.items">
              <strong>{{ item.unitCode }}</strong>
              <span>{{ item.concept }}</span>
              <span>{{ formatCurrency(item.amount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando periodos...</p>
      <p class="app-state" *ngIf="!loading && !errorMessage && !items.length">No hay periodos cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header periods-grid">
          <span>Periodo</span>
          <span>Edificio</span>
          <span>Vigencia</span>
          <span>Vencimiento</span>
          <span>Estado</span>
          <span class="actions-head">Operacion</span>
        </div>

        <div class="app-row periods-grid" *ngFor="let item of items">
          <strong>{{ item.name }}</strong>
          <span>{{ item.buildingName }}</span>
          <span>{{ item.startDate }} al {{ item.endDate }}</span>
          <span>{{ item.dueDate }}</span>
          <p-tag [value]="statusLabel(item.status)" [severity]="statusSeverity(item.status)"></p-tag>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-calculator" severity="info" [rounded]="true" [text]="true" [disabled]="isSaving || isGenerating || isCalculatingSettlement" (onClick)="openSettlement(item)"></p-button>
            <p-button type="button" icon="pi pi-bolt" severity="success" [rounded]="true" [text]="true" [disabled]="item.status !== 'Draft' || isSaving || isGenerating" (onClick)="openGenerator(item)"></p-button>
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" [disabled]="item.status !== 'Draft'" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving || item.status !== 'Draft'" (onClick)="deletePeriod(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .periods-grid { grid-template-columns: 1fr 1fr 1.1fr 0.8fr 0.7fr 0.55fr; }
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .actions-head { text-align:right; }
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
      margin-bottom:0.4rem;
    }
    .action-head strong { display:block; color:#14363d; }
    .action-head span { color:#6b878d; }
    .settlement-grid {
      display:grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.9rem;
      margin-top: 0.8rem;
      margin-bottom: 0.8rem;
    }
    .settlement-item {
      padding: 0.9rem 1rem;
      border-radius: 18px;
      background: white;
      border: 1px solid #dbe7e3;
    }
    .settlement-item span {
      display:block;
      color:#6b878d;
      font-size:0.85rem;
      margin-bottom:0.3rem;
    }
    .settlement-item strong {
      color:#14363d;
      font-size:1.05rem;
    }
    .settlement-meta {
      margin: 0 0 0.9rem;
      color:#5f787d;
    }
    .preview-box {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #dbe7e3;
    }
    .late-fee-box {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #dbe7e3;
    }
    .preview-head {
      display:flex;
      justify-content:space-between;
      gap:1rem;
      margin-bottom:0.75rem;
      color:#5f787d;
    }
    .preview-grid { grid-template-columns: 0.7fr 1.5fr 0.8fr; }
    .alerts-grid { grid-template-columns: 0.8fr 1.5fr 1fr 0.7fr 0.7fr; }
    .alert-copy {
      display:grid;
      gap:0.2rem;
    }
    .alert-copy span {
      color:#6b878d;
    }
  `]
})
export class ExpensePeriodsPageComponent implements OnInit {
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  items: ExpensePeriod[] = [];
  buildings: Building[] = [];
  loading = true;
  isSaving = false;
  isGenerating = false;
  isCalculatingSettlement = false;
  isLoadingSettlementPreview = false;
  isApplyingSettlement = false;
  isApprovingSettlement = false;
  isPublishingSettlement = false;
  isApplyingLateFees = false;
  showForm = false;
  showLateFeeForm = false;
  editingId: string | null = null;
  errorMessage = '';
  successMessage = '';
  readonly generationModes: GenerateExpenseChargesMode[] = ['FixedAmount', 'ByCoefficient'];
  alerts: ExpensePeriodOperationalAlertItem[] = [];
  generatorPeriod: ExpensePeriod | null = null;
  settlementPeriod: ExpensePeriod | null = null;
  settlementSummary: ExpenseSettlementSummary | null = null;
  settlementPreview: ExpenseSettlementChargePreview | null = null;
  form = this.createInitialForm();
  generatorForm = this.createInitialGeneratorForm();
  lateFeeForm = this.createInitialLateFeeForm();

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

  startEdit(item: ExpensePeriod): void {
    this.editingId = item.id;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.form = {
      buildingId: item.buildingId,
      year: item.year,
      month: item.month,
      name: item.name,
      startDate: item.startDate,
      endDate: item.endDate,
      dueDate: item.dueDate,
      notes: item.notes
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
    this.errorMessage = '';
  }

  openGenerator(item: ExpensePeriod): void {
    this.generatorPeriod = item;
    this.generatorForm = {
      mode: 'FixedAmount',
      concept: `Expensa ${item.name}`,
      amount: 0,
      notes: ''
    };
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelGenerator(): void {
    this.generatorPeriod = null;
    this.generatorForm = this.createInitialGeneratorForm();
  }

  openSettlement(item: ExpensePeriod): void {
    this.settlementPeriod = item;
    this.settlementSummary = null;
    this.settlementPreview = null;
    this.showLateFeeForm = false;
    this.lateFeeForm = this.createInitialLateFeeForm(item);
    this.errorMessage = '';
    this.successMessage = '';
    this.isCalculatingSettlement = true;

    this.periodsApi.getSettlement(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.settlementSummary = summary;
          this.isCalculatingSettlement = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar la liquidacion del periodo.');
          this.isCalculatingSettlement = false;
          this.settlementPeriod = null;
          this.cdr.markForCheck();
        }
      });
  }

  closeSettlement(): void {
    this.settlementPeriod = null;
    this.settlementSummary = null;
    this.settlementPreview = null;
    this.showLateFeeForm = false;
  }

  submitPeriod(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const request = {
      buildingId: this.form.buildingId,
      year: Number(this.form.year),
      month: Number(this.form.month),
      name: this.form.name.trim(),
      startDate: this.form.startDate,
      endDate: this.form.endDate,
      dueDate: this.form.dueDate,
      status: 'Draft' as ExpensePeriodStatus,
      notes: this.form.notes.trim()
    };

    const validationError = this.validatePeriodForm(request);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isSaving = true;

    const operation = this.editingId
      ? this.periodsApi.update(this.editingId, request)
      : this.periodsApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (period) => {
        this.items = this.editingId
          ? this.items.map((item) => item.id === period.id ? period : item)
          : [...this.items, period];
        this.sortItems();
        this.form = this.createInitialForm();
        this.isSaving = false;
        this.showForm = false;
        this.successMessage = this.editingId ? 'Periodo actualizado correctamente.' : 'Periodo creado correctamente.';
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(
          error,
          this.editingId ? 'No se pudo actualizar el periodo.' : 'No se pudo guardar el periodo.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  generateCharges(): void {
    if (!this.generatorPeriod) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isGenerating = true;

    this.periodsApi.generateCharges(this.generatorPeriod.id, {
      mode: this.generatorForm.mode,
      concept: this.generatorForm.concept,
      amount: Number(this.generatorForm.amount),
      notes: this.generatorForm.notes
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isGenerating = false;
          this.successMessage =
            `Se generaron ${result.unitsAffected} cargos por ${this.formatCurrency(result.totalGeneratedAmount)} en ${result.expensePeriodName}.`;
          this.cancelGenerator();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudieron generar los cargos masivos.');
          this.isGenerating = false;
          this.cdr.markForCheck();
        }
      });
  }

  calculateSettlement(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isCalculatingSettlement = true;

    this.periodsApi.calculateSettlement(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.settlementSummary = summary;
          this.syncPeriodStatus(summary.expensePeriodId, summary.periodStatus);
          this.settlementPreview = null;
          this.successMessage = `Liquidacion consolidada calculada por ${this.formatCurrency(summary.netCommonAmount)} en ${summary.expensePeriodName}.`;
          this.isCalculatingSettlement = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo calcular la liquidacion del periodo.');
          this.isCalculatingSettlement = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadSettlementPreview(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.errorMessage = '';
    this.isLoadingSettlementPreview = true;

    this.periodsApi.getSettlementChargePreview(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.settlementPreview = preview;
          this.isLoadingSettlementPreview = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo generar la vista previa de cargos.');
          this.isLoadingSettlementPreview = false;
          this.cdr.markForCheck();
        }
      });
  }

  deletePeriod(item: ExpensePeriod): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSaving = true;

    this.periodsApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter((current) => current.id !== item.id);
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        if (this.generatorPeriod?.id === item.id) {
          this.cancelGenerator();
        }
        if (this.settlementPeriod?.id === item.id) {
          this.closeSettlement();
        }
        this.isSaving = false;
        this.successMessage = 'Periodo eliminado correctamente.';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = extractApiErrorMessage(error, 'No se pudo eliminar el periodo.');
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  approveSettlement(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isApprovingSettlement = true;

    this.periodsApi.approveSettlement(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.settlementSummary = summary;
          this.syncPeriodStatus(summary.expensePeriodId, summary.periodStatus);
          this.successMessage = `Liquidacion aprobada y deuda emitida para ${summary.expensePeriodName}.`;
          this.isApprovingSettlement = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo aprobar la liquidacion.');
          this.isApprovingSettlement = false;
          this.cdr.markForCheck();
        }
      });
  }

  publishSettlement(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isPublishingSettlement = true;

    this.periodsApi.publish(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.settlementSummary = summary;
          this.syncPeriodStatus(summary.expensePeriodId, summary.periodStatus);
          this.successMessage = `Comprobantes publicados para ${summary.expensePeriodName}.`;
          this.isPublishingSettlement = false;
          this.loadAlerts();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudieron publicar los comprobantes.');
          this.isPublishingSettlement = false;
          this.cdr.markForCheck();
        }
      });
  }

  toggleLateFeeForm(): void {
    this.showLateFeeForm = !this.showLateFeeForm;
  }

  applyLateFees(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    const lateFeeError = this.validateLateFeeForm();
    if (lateFeeError) {
      this.errorMessage = lateFeeError;
      return;
    }

    this.isApplyingLateFees = true;

    this.periodsApi.applyLateFees(this.settlementPeriod.id, {
      ratePercentage: Number(this.lateFeeForm.ratePercentage),
      referenceDate: this.lateFeeForm.referenceDate || null,
      concept: this.lateFeeForm.concept,
      notes: this.lateFeeForm.notes
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.handleLateFeesApplied(result);
          this.isApplyingLateFees = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudieron registrar los recargos por mora.');
          this.isApplyingLateFees = false;
          this.cdr.markForCheck();
        }
      });
  }

  statusLabel(status: ExpensePeriodStatus): string {
    return status === 'Draft' ? 'Borrador' : status === 'Closed' ? 'Cerrado' : 'Publicado';
  }

  statusSeverity(status: ExpensePeriodStatus): 'success' | 'warn' | 'info' {
    return status === 'Published' ? 'success' : status === 'Closed' ? 'info' : 'warn';
  }

  generationModeLabel(mode: GenerateExpenseChargesMode): string {
    return mode === 'FixedAmount' ? 'Monto fijo por unidad' : 'Prorrateo por coeficiente';
  }

  settlementStatusLabel(status: ExpenseSettlementStatus | null, isCalculated: boolean): string {
    if (!isCalculated || !status) {
      return 'Resumen preliminar';
    }

    return status === 'Draft'
      ? 'Borrador'
      : status === 'Calculated'
        ? 'Calculada'
        : status === 'Approved'
          ? 'Aprobada'
          : 'Aplicada';
  }

  alertTypeLabel(alert: ExpensePeriodOperationalAlertItem): string {
    return alert.alertType === 'DueSoon'
      ? 'Vence pronto'
      : alert.alertType === 'OverdueBalance'
        ? 'Mora activa'
        : alert.alertType === 'ReadyToPublish'
          ? 'Listo para publicar'
          : alert.alertType;
  }

  alertSeverity(alert: ExpensePeriodOperationalAlertItem): 'danger' | 'warn' | 'info' | 'success' {
    return alert.alertType === 'OverdueBalance'
      ? 'danger'
      : alert.alertType === 'DueSoon'
        ? 'warn'
        : alert.alertType === 'ReadyToPublish'
          ? 'info'
          : 'success';
  }

  canApproveSettlement(): boolean {
    return !!this.settlementSummary &&
      this.settlementSummary.status === 'Calculated' &&
      this.settlementSummary.periodStatus === 'Draft';
  }

  canPublishSettlement(): boolean {
    return !!this.settlementSummary &&
      (this.settlementSummary.status === 'Approved' || this.settlementSummary.status === 'Applied') &&
      this.settlementSummary.periodStatus !== 'Published' &&
      this.settlementSummary.generatedChargeCount > 0;
  }

  canApplyLateFees(): boolean {
    return !!this.settlementSummary &&
      this.settlementSummary.periodStatus === 'Published';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadData(): void {
    forkJoin({
      periods: this.periodsApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      alerts: this.periodsApi.getOperationalAlerts()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ periods, buildings, alerts }) => {
          this.items = periods;
          this.buildings = buildings;
          this.alerts = alerts.items;
          this.sortItems();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el listado de periodos.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      b.year - a.year || b.month - a.month || a.buildingName.localeCompare(b.buildingName));
  }

  private createInitialForm() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const monthText = `${month}`.padStart(2, '0');
    const startDate = `${year}-${monthText}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
    const dueDate = new Date(year, month, 10).toISOString().slice(0, 10);

    return {
      buildingId: '',
      year,
      month,
      name: `${this.monthName(month)} ${year}`,
      startDate,
      endDate,
      dueDate,
      notes: ''
    };
  }

  private createInitialGeneratorForm() {
    return {
      mode: 'FixedAmount' as GenerateExpenseChargesMode,
      concept: '',
      amount: 0,
      notes: ''
    };
  }

  private createInitialLateFeeForm(period?: ExpensePeriod) {
    const referenceDate = new Date().toISOString().slice(0, 10);

    return {
      ratePercentage: 5,
      referenceDate,
      concept: period ? `Recargo por mora ${period.name}` : 'Recargo por mora',
      notes: ''
    };
  }

  private syncPeriodStatus(expensePeriodId: string, status: ExpensePeriodStatus): void {
    this.items = this.items.map((item) => item.id === expensePeriodId ? { ...item, status } : item);

    if (this.settlementPeriod?.id === expensePeriodId) {
      this.settlementPeriod = { ...this.settlementPeriod, status };
    }
  }

  private handleLateFeesApplied(result: ApplyLateFeesResult): void {
    if (this.settlementSummary) {
      this.settlementSummary = {
        ...this.settlementSummary,
        generatedChargeCount: this.settlementSummary.generatedChargeCount + result.chargesCreated
      };
    }

    this.showLateFeeForm = false;
    this.successMessage =
      `Se registraron ${result.chargesCreated} recargos por ${this.formatCurrency(result.totalLateFeeAmount)} en ${result.expensePeriodName}.`;
    this.loadAlerts();
  }

  private loadAlerts(): void {
    this.periodsApi.getOperationalAlerts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (alerts) => {
          this.alerts = alerts.items;
          this.cdr.markForCheck();
        },
        error: () => {
          this.alerts = [];
          this.cdr.markForCheck();
        }
      });
  }

  private monthName(month: number): string {
    return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1] ?? 'Periodo';
  }

  private validatePeriodForm(form: {
    buildingId: string;
    year: number;
    month: number;
    name: string;
    startDate: string;
    endDate: string;
    dueDate: string;
    notes: string;
  }): string | null {
    if (!form.buildingId) {
      return 'El edificio es obligatorio.';
    }

    if (!Number.isInteger(form.year) || form.year < 2000 || form.year > 2100) {
      return 'El anio debe estar entre 2000 y 2100.';
    }

    if (!Number.isInteger(form.month) || form.month < 1 || form.month > 12) {
      return 'El mes debe estar entre 1 y 12.';
    }

    if (!form.name) {
      return 'El nombre del periodo es obligatorio.';
    }

    if (form.name.length > 120) {
      return 'El nombre del periodo no puede superar los 120 caracteres.';
    }

    if (!form.startDate || !form.endDate || !form.dueDate) {
      return 'Las fechas de inicio, fin y vencimiento son obligatorias.';
    }

    if (form.startDate > form.endDate) {
      return 'La fecha de inicio no puede ser posterior a la fecha de fin.';
    }

    if (form.dueDate < form.endDate) {
      return 'La fecha de vencimiento no puede ser anterior a la fecha de fin del periodo.';
    }

    if (form.notes.length > 500) {
      return 'Las notas no pueden superar los 500 caracteres.';
    }

    return null;
  }

  private validateLateFeeForm(): string | null {
    if (!this.lateFeeForm.concept.trim()) {
      return 'El concepto del recargo es obligatorio.';
    }

    if (Number(this.lateFeeForm.ratePercentage) <= 0) {
      return 'El porcentaje de recargo debe ser mayor que cero.';
    }

    return null;
  }
}

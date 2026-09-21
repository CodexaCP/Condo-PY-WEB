import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { InputNumber } from 'primeng/inputnumber';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { AuthService } from '../../auth/auth.service';
import {
  ApplyLateFeesResult,
  BulkCreateExpensePeriodsResult,
  Building,
  CloneExpensePeriodResult,
  ExpensePeriod,
  ExpensePeriodOperationalAlertItem,
  ExpensePeriodStatus,
  BuildingExpenseCategory,
  ExpenseSettlementStatus,
  ExpenseSettlementSummary,
  GenerateExpenseChargesMode,
  VoidSettlementResult
} from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-expense-periods-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, Tooltip, InputNumber],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Periodos de expensas</h1>
            <p>Apertura, cierre y control de ciclos mensuales por edificio.</p>
          </div>
        </div>
        <div class="toolbar-btns" *ngIf="!isOperator">
          <p-button label="Crear para todos" icon="pi pi-th-large" severity="secondary" (onClick)="toggleBulkForm()"></p-button>
          <p-button [label]="showForm ? 'Cerrar' : 'Nuevo periodo'" [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'" (onClick)="toggleForm()"></p-button>
        </div>
      </div>

      <!-- New / Edit period form -->
      <div class="panel-box form-panel" *ngIf="showForm">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon pi pi-calendar-plus"></span>
            <div>
              <strong>{{ editingId ? 'Editar periodo' : 'Nuevo periodo' }}</strong>
              <small>Completá los datos del ciclo mensual</small>
            </div>
          </div>
          <p-button *ngIf="editingId" type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="cancelEdit()"></p-button>
        </div>
        <form class="period-form" (ngSubmit)="submitPeriod()">
          <div class="form-row-wide">
            <label class="field-block">
              <span>Edificio *</span>
              <select [(ngModel)]="form.buildingId" name="buildingId" required>
                <option value="" disabled>— Seleccionar edificio —</option>
                <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
              </select>
            </label>
          </div>
          <div class="form-row">
            <label class="field-block">
              <span>Año *</span>
              <input [(ngModel)]="form.year" name="year" type="number" min="2000" max="2100" required />
            </label>
            <label class="field-block">
              <span>Mes *</span>
              <input [(ngModel)]="form.month" name="month" type="number" min="1" max="12" required />
            </label>
            <label class="field-block">
              <span>Nombre *</span>
              <input [(ngModel)]="form.name" name="name" type="text" required maxlength="120" />
            </label>
          </div>
          <div class="form-row">
            <label class="field-block">
              <span>Inicio *</span>
              <input [(ngModel)]="form.startDate" name="startDate" type="date" required />
            </label>
            <label class="field-block">
              <span>Fin *</span>
              <input [(ngModel)]="form.endDate" name="endDate" type="date" required />
            </label>
            <label class="field-block">
              <span>Vencimiento *</span>
              <input [(ngModel)]="form.dueDate" name="dueDate" type="date" required />
            </label>
            <label class="field-block">
              <span>Corte mora <small>(opcional)</small></span>
              <input [(ngModel)]="form.lateFeeDate" name="lateFeeDate" type="date" />
            </label>
          </div>
          <div class="form-row-wide">
            <label class="field-block">
              <span>Notas</span>
              <input [(ngModel)]="form.notes" name="notes" type="text" maxlength="500" placeholder="Observaciones opcionales..." />
            </label>
          </div>
          <div class="form-actions">
            <p-button type="submit" [disabled]="!buildings.length" [loading]="isSaving" [label]="editingId ? 'Guardar cambios' : 'Crear periodo'" icon="pi pi-check"></p-button>
          </div>
        </form>
      </div>

      <!-- Bulk create -->
      <div class="panel-box bulk-panel" *ngIf="showBulkForm">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon pi pi-th-large"></span>
            <div>
              <strong>Crear para todos los edificios</strong>
              <small>Se omiten los que ya tienen periodo para ese mes</small>
            </div>
          </div>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="toggleBulkForm()"></p-button>
        </div>
        <form class="period-form" (ngSubmit)="submitBulkCreate()">
          <div class="form-row">
            <label class="field-block">
              <span>Año *</span>
              <input [(ngModel)]="bulkForm.year" name="bulkYear" type="number" min="2000" max="2100" required />
            </label>
            <label class="field-block">
              <span>Mes *</span>
              <input [(ngModel)]="bulkForm.month" name="bulkMonth" type="number" min="1" max="12" required />
            </label>
            <label class="field-block">
              <span>Nombre <small>(auto si vacío)</small></span>
              <input [(ngModel)]="bulkForm.name" name="bulkName" type="text" maxlength="120" />
            </label>
          </div>
          <div class="form-row">
            <label class="field-block">
              <span>Inicio *</span>
              <input [(ngModel)]="bulkForm.startDate" name="bulkStart" type="date" required />
            </label>
            <label class="field-block">
              <span>Fin *</span>
              <input [(ngModel)]="bulkForm.endDate" name="bulkEnd" type="date" required />
            </label>
            <label class="field-block">
              <span>Vencimiento *</span>
              <input [(ngModel)]="bulkForm.dueDate" name="bulkDue" type="date" required />
            </label>
            <label class="field-block">
              <span>Corte mora <small>(opcional)</small></span>
              <input [(ngModel)]="bulkForm.lateFeeDate" name="bulkLateFee" type="date" />
            </label>
          </div>
          <div class="form-actions">
            <p-button type="submit" [loading]="isBulkCreating" label="Crear periodos" icon="pi pi-check"></p-button>
          </div>
        </form>
      </div>

      <!-- Operational alerts -->
      <div class="panel-box alerts-panel" *ngIf="alerts.length">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon alert-icon pi pi-bell"></span>
            <div>
              <strong>Alertas operativas</strong>
              <small>{{ alerts.length }} alertas activas</small>
            </div>
          </div>
        </div>
        <div class="app-list">
          <div class="app-row header alerts-grid">
            <span>Tipo</span><span>Periodo</span><span>Edificio</span><span>Vence</span><span>Saldo</span>
          </div>
          <div class="app-row alerts-grid" *ngFor="let a of alerts">
            <p-tag [value]="alertTypeLabel(a)" [severity]="alertSeverity(a)"></p-tag>
            <div><strong>{{ a.expensePeriodName }}</strong><br><small style="color:#6b878d">{{ a.message }}</small></div>
            <span>{{ a.buildingName }}</span>
            <span>{{ a.dueDate }}</span>
            <span>{{ formatCurrency(a.pendingAmount) }}</span>
          </div>
        </div>
      </div>

      <!-- Charge generator -->
      <div class="panel-box generator-panel" *ngIf="generatorPeriod">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon gen-icon pi pi-bolt"></span>
            <div>
              <strong>Generar cargos masivos</strong>
              <small>{{ generatorPeriod.name }} · {{ generatorPeriod.buildingName }}</small>
            </div>
          </div>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="cancelGenerator()"></p-button>
        </div>
        <form class="period-form" (ngSubmit)="generateCharges()">
          <div class="form-row">
            <label class="field-block">
              <span>Modo</span>
              <select [(ngModel)]="generatorForm.mode" name="generatorMode" required>
                <option *ngFor="let mode of generationModes" [value]="mode">{{ generationModeLabel(mode) }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>{{ generatorForm.mode === 'FixedAmount' ? 'Monto por unidad' : 'Monto total a distribuir' }}</span>
              <p-inputnumber [(ngModel)]="generatorForm.amount" name="generatorAmount" [useGrouping]="true" prefix="₲ " [min]="1" [minFractionDigits]="0" [maxFractionDigits]="0" [required]="true" styleClass="w-full"></p-inputnumber>
            </label>
            <label class="field-block">
              <span>Concepto *</span>
              <input [(ngModel)]="generatorForm.concept" name="generatorConcept" type="text" required />
            </label>
          </div>
          <div class="form-actions">
            <p-button type="submit" severity="success" [loading]="isGenerating" label="Generar cargos" icon="pi pi-bolt"></p-button>
          </div>
        </form>
      </div>

      <!-- Settlement panel -->
      <div class="panel-box settlement-panel" *ngIf="settlementPeriod && settlementSummary">
        <div class="panel-head">
          <div class="panel-title">
            <span class="panel-icon settle-icon pi pi-calculator"></span>
            <div>
              <strong>Liquidación consolidada</strong>
              <small>{{ settlementPeriod.name }} · {{ settlementPeriod.buildingName }}</small>
            </div>
          </div>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="closeSettlement()"></p-button>
        </div>

        <div class="settlement-metrics">
          <div class="metric-card">
            <span>Estado periodo</span>
            <strong>{{ statusLabel(settlementSummary.periodStatus) }}</strong>
          </div>
          <div class="metric-card">
            <span>Liquidación</span>
            <strong>{{ settlementStatusLabel(settlementSummary.status, settlementSummary.isCalculated) }}</strong>
          </div>
          <div class="metric-card highlight">
            <span>Total gastos</span>
            <strong>{{ formatCurrency(settlementSummary.totalBuildingExpenses) }}</strong>
          </div>
          <div class="metric-card">
            <span>Total ingresos</span>
            <strong>{{ formatCurrency(settlementSummary.totalBuildingIncomes) }}</strong>
          </div>
          <div class="metric-card highlight">
            <span>Neto común</span>
            <strong>{{ formatCurrency(settlementSummary.netCommonAmount) }}</strong>
          </div>
          <div class="metric-card">
            <span>Fondo reserva</span>
            <strong>{{ formatCurrency(settlementSummary.reserveFundAmount) }}</strong>
          </div>
          <div class="metric-card">
            <span>Extraordinarios</span>
            <strong>{{ formatCurrency(settlementSummary.extraordinaryAmount) }}</strong>
          </div>
          <div class="metric-card">
            <span>Cargos emitidos</span>
            <strong>{{ settlementSummary.generatedChargeCount }}</strong>
          </div>
        </div>

        <div class="settlement-trail" *ngIf="settlementSummary.generatedAtUtc || settlementSummary.approvedAtUtc || settlementSummary.publishedAtUtc || !settlementSummary.generatedAtUtc">
          <span *ngIf="!settlementSummary.generatedAtUtc" class="trail-item pending"><span class="pi pi-info-circle"></span> Resumen preliminar — sin liquidación persistida aún.</span>
          <span *ngIf="settlementSummary.generatedAtUtc" class="trail-item"><span class="pi pi-check-circle"></span> Calculada: {{ settlementSummary.generatedAtUtc }}<span *ngIf="settlementSummary.generatedByUserName"> por {{ settlementSummary.generatedByUserName }}</span></span>
          <span *ngIf="settlementSummary.approvedAtUtc" class="trail-item"><span class="pi pi-check-circle"></span> Aprobada: {{ settlementSummary.approvedAtUtc }}<span *ngIf="settlementSummary.approvedByUserName"> por {{ settlementSummary.approvedByUserName }}</span></span>
          <span *ngIf="settlementSummary.publishedAtUtc" class="trail-item"><span class="pi pi-check-circle"></span> Publicada: {{ settlementSummary.publishedAtUtc }}<span *ngIf="settlementSummary.publishedByUserName"> por {{ settlementSummary.publishedByUserName }}</span></span>
        </div>

        <div class="settlement-actions">
          <p-button type="button" [label]="settlementSummary.isCalculated ? 'Recalcular' : 'Calcular liquidación'" icon="pi pi-calculator" [loading]="isCalculatingSettlement" [disabled]="settlementPeriod.status !== 'Draft'" (onClick)="calculateSettlement()"></p-button>
          <p-button *ngIf="canApproveRole" type="button" label="Aprobar" icon="pi pi-check" severity="info" [loading]="isApprovingSettlement" [disabled]="!canApproveSettlement()" (onClick)="approveSettlement()"></p-button>
          <p-button *ngIf="canPublishRole" type="button" label="Publicar comprobantes" icon="pi pi-send" severity="contrast" [loading]="isPublishingSettlement" [disabled]="!canPublishSettlement()" (onClick)="publishSettlement()"></p-button>
          <a *ngIf="settlementSummary.isCalculated" [href]="getSettlementPdfUrl()" target="_blank" style="display:contents">
            <p-button type="button" label="PDF" icon="pi pi-file-pdf" severity="secondary" [text]="true"></p-button>
          </a>
          <p-button *ngIf="canApproveRole" type="button" label="Recargos por mora" icon="pi pi-percentage" severity="warn" [text]="true" [disabled]="!canApplyLateFees()" (onClick)="toggleLateFeeForm()"></p-button>
          <p-button *ngIf="canApproveRole && canVoidSettlement()" type="button" label="Anular" icon="pi pi-undo" severity="danger" [text]="true" [loading]="isVoidingSettlement" (onClick)="voidSettlement()"></p-button>
        </div>

        <form class="period-form late-fee-form" *ngIf="showLateFeeForm" (ngSubmit)="applyLateFees()">
          <div class="form-row">
            <label class="field-block">
              <span>% recargo *</span>
              <input [(ngModel)]="lateFeeForm.ratePercentage" name="lateFeeRate" type="number" min="0.01" step="0.01" required />
            </label>
            <label class="field-block">
              <span>Fecha de referencia</span>
              <input [(ngModel)]="lateFeeForm.referenceDate" name="lateFeeReferenceDate" type="date" />
            </label>
            <label class="field-block">
              <span>Concepto *</span>
              <input [(ngModel)]="lateFeeForm.concept" name="lateFeeConcept" type="text" required />
            </label>
          </div>
          <div class="form-actions">
            <p-button type="submit" severity="warn" [loading]="isApplyingLateFees" label="Aplicar recargos" icon="pi pi-percentage"></p-button>
          </div>
        </form>

        <div class="preview-box" *ngIf="settlementSummary.categoryTotals.length">
          <div class="preview-head">
            <strong>Gastos comunes por categoría</strong>
            <span>{{ settlementCategoryExpenseCount }} gastos · {{ settlementSummary.categoryTotals.length }} categorías · {{ formatCurrency(settlementCategoryTotalAmount) }}</span>
          </div>
          <div class="app-list">
            <div class="app-row header preview-grid"><span>Categoría</span><span>Gastos</span><span>Monto</span></div>
            <div class="app-row preview-grid" *ngFor="let row of settlementSummary.categoryTotals">
              <strong>{{ settlementCategoryLabel(row.category) }}</strong>
              <span>{{ row.expenseCount }}</span>
              <span>{{ formatCurrency(row.amount) }}</span>
            </div>
            <div class="app-row preview-grid">
              <strong>Total gastos comunes</strong>
              <strong>{{ settlementCategoryExpenseCount }}</strong>
              <strong>{{ formatCurrency(settlementCategoryTotalAmount) }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Period cards -->
      <p class="app-state" *ngIf="loading">Cargando periodos...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay periodos creados todavía.</p>

      <div class="period-cards" *ngIf="items.length">
        <div class="period-card" *ngFor="let item of items" [class.card-published]="item.status === 'Published'" [class.card-closed]="item.status === 'Closed'">
          <div class="card-top">
            <div class="card-period-name">{{ item.name }}</div>
            <p-tag [value]="statusLabel(item.status)" [severity]="statusSeverity(item.status)"></p-tag>
          </div>
          <div class="card-building">
            <span class="pi pi-building"></span> {{ item.buildingName }}
          </div>
          <div class="card-dates">
            <div class="card-date-item">
              <small>Vigencia</small>
              <span>{{ item.startDate }} — {{ item.endDate }}</span>
            </div>
            <div class="card-date-item">
              <small>Vencimiento</small>
              <span>{{ item.dueDate }}</span>
            </div>
          </div>
          <div class="card-actions">
            <p-button type="button" icon="pi pi-calculator" severity="info" [rounded]="true" [text]="true" [disabled]="isSaving || isGenerating || isCalculatingSettlement" (onClick)="openSettlement(item)" pTooltip="Liquidación"></p-button>
            <p-button *ngIf="!isOperator" type="button" icon="pi pi-bolt" severity="success" [rounded]="true" [text]="true" [disabled]="item.status !== 'Draft' || isSaving || isGenerating" (onClick)="openGenerator(item)" pTooltip="Generar cargos"></p-button>
            <p-button *ngIf="!isOperator" type="button" icon="pi pi-copy" severity="secondary" [rounded]="true" [text]="true" [disabled]="isSaving || isCloning" (onClick)="clonePeriod(item)" pTooltip="Clonar al mes siguiente"></p-button>
            <p-button *ngIf="!isOperator" type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" [disabled]="item.status !== 'Draft'" (onClick)="startEdit(item)" pTooltip="Editar"></p-button>
            <p-button *ngIf="!isOperator" type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving || item.status !== 'Draft'" (onClick)="deletePeriod(item)" pTooltip="Eliminar"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .toolbar-btns { display: flex; gap: 0.5rem; }

    /* Shared panel box */
    .panel-box {
      margin-bottom: 1.25rem;
      padding: 1.5rem;
      border-radius: 22px;
      background: white;
      border: 1.5px solid #dbe7e3;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
    }
    .form-panel { border-color: rgba(19,133,182,0.25); background: rgba(19,133,182,0.02); }
    .bulk-panel { border-color: rgba(108,117,125,0.25); }
    .alerts-panel { border-color: rgba(220,160,0,0.3); background: rgba(255,248,230,0.6); }
    .generator-panel { border-color: rgba(34,197,94,0.3); background: rgba(240,253,244,0.8); }
    .settlement-panel { border-color: rgba(59,130,246,0.25); background: rgba(239,246,255,0.6); }

    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
    }
    .panel-title {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .panel-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: rgba(19,133,182,0.1);
      color: #1385b6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }
    .alert-icon { background: rgba(220,160,0,0.12); color: #b08000; }
    .gen-icon { background: rgba(34,197,94,0.12); color: #16a34a; }
    .settle-icon { background: rgba(59,130,246,0.12); color: #2563eb; }
    .panel-title strong { display: block; color: #14363d; font-size: 1rem; }
    .panel-title small { color: #6b878d; font-size: 0.82rem; }

    /* Form layout */
    .period-form { display: grid; gap: 1rem; }
    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
    .form-row-wide { display: grid; }
    .field-block { display: grid; gap: 0.4rem; }
    .field-block > span { font-weight: 700; color: #29484f; font-size: 0.85rem; }
    .field-block > span small { font-weight: 400; color: #6b878d; }
    .field-block select,
    .field-block input {
      border: 1.5px solid #d7e5e1;
      border-radius: 12px;
      padding: 0.75rem 1rem;
      font: inherit;
      background: white;
      color: #18353a;
      width: 100%;
      box-sizing: border-box;
    }
    .field-block select:focus,
    .field-block input:focus {
      outline: none;
      border-color: #1385b6;
      box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }
    .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.25rem; }

    .late-fee-form {
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px dashed #c5ddd8;
    }

    /* Alerts list */
    .alerts-grid { grid-template-columns: 0.8fr 1.5fr 1fr 0.7fr 0.8fr; }

    /* Settlement metrics */
    .settlement-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .metric-card {
      padding: 0.85rem 1rem;
      border-radius: 16px;
      background: white;
      border: 1px solid #dbe7e3;
    }
    .metric-card.highlight {
      border-color: rgba(19,133,182,0.3);
      background: rgba(19,133,182,0.04);
    }
    .metric-card span { display: block; color: #6b878d; font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.3rem; }
    .metric-card strong { color: #14363d; font-size: 1rem; }

    .settlement-trail {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .trail-item {
      font-size: 0.82rem;
      color: #4a7a72;
      background: rgba(15,160,144,0.08);
      border-radius: 20px;
      padding: 0.3rem 0.75rem;
    }
    .trail-item.pending { color: #8a6800; background: rgba(220,160,0,0.1); }
    .trail-item .pi { margin-right: 0.3rem; }

    .settlement-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .preview-box {
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px dashed #c5ddd8;
    }
    .preview-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
      color: #14363d;
      font-weight: 600;
    }
    .preview-head span { font-weight: 400; color: #6b878d; }
    .preview-grid { grid-template-columns: 0.7fr 1.5fr 0.8fr; }

    /* Period cards */
    .period-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .period-card {
      background: white;
      border: 1.5px solid #dbe7e3;
      border-radius: 20px;
      padding: 1.25rem;
      display: grid;
      gap: 0.75rem;
      transition: box-shadow 0.15s, border-color 0.15s;
    }
    .period-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.08); border-color: #b0ccca; }
    .card-published { border-color: rgba(34,197,94,0.3); background: rgba(240,253,244,0.6); }
    .card-closed { border-color: rgba(59,130,246,0.25); background: rgba(239,246,255,0.5); }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .card-period-name {
      font-size: 1.15rem;
      font-weight: 800;
      color: #14363d;
      line-height: 1.2;
    }
    .card-building {
      font-size: 0.88rem;
      color: #6b878d;
      font-weight: 600;
    }
    .card-building .pi { margin-right: 0.3rem; font-size: 0.82rem; }
    .card-dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
    .card-date-item { display: grid; gap: 0.15rem; }
    .card-date-item small { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #9ab0ae; }
    .card-date-item span { font-size: 0.83rem; color: #2a4e55; }
    .card-actions {
      display: flex;
      gap: 0.25rem;
      border-top: 1px solid #edf2f1;
      padding-top: 0.75rem;
      margin-top: 0.25rem;
    }
  `]
})
export class ExpensePeriodsPageComponent implements OnInit {
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);


  // CompanyOperator solo calcula; BuildingManager ademas aprueba; CompanyAdmin (presidente) ademas publica.
  get canApproveRole(): boolean { return this.auth.hasRole('SuperAdmin', 'CompanyAdmin', 'BuildingManager'); }
  get canPublishRole(): boolean { return this.auth.hasRole('SuperAdmin', 'CompanyAdmin'); }
  get isOperator(): boolean { return this.auth.hasRole('CompanyOperator'); }

  items: ExpensePeriod[] = [];
  buildings: Building[] = [];
  loading = true;
  isSaving = false;
  isGenerating = false;
  isCalculatingSettlement = false;
  isApplyingSettlement = false;
  isApprovingSettlement = false;
  isPublishingSettlement = false;
  isApplyingLateFees = false;
  isVoidingSettlement = false;
  isBulkCreating = false;
  isCloning = false;
  showForm = false;
  showBulkForm = false;
  showLateFeeForm = false;
  editingId: string | null = null;
  readonly generationModes: GenerateExpenseChargesMode[] = ['FixedAmount', 'ByCoefficient'];
  alerts: ExpensePeriodOperationalAlertItem[] = [];
  generatorPeriod: ExpensePeriod | null = null;
  settlementPeriod: ExpensePeriod | null = null;
  settlementSummary: ExpenseSettlementSummary | null = null;
  form = this.createInitialForm();
  bulkForm = this.createInitialBulkForm();
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
    if (!this.showForm) {
      this.form = this.createInitialForm();
    }
  }

  startEdit(item: ExpensePeriod): void {
    this.editingId = item.id;
    this.showForm = true;
    this.form = {
      buildingId: item.buildingId,
      year: item.year,
      month: item.month,
      name: item.name,
      startDate: item.startDate,
      endDate: item.endDate,
      dueDate: item.dueDate,
      lateFeeDate: item.lateFeeDate ?? '',
      notes: item.notes
    };
  }

  toggleBulkForm(): void {
    this.showBulkForm = !this.showBulkForm;
    if (!this.showBulkForm) {
      this.bulkForm = this.createInitialBulkForm();
    }
  }

  submitBulkCreate(): void {
    this.isBulkCreating = true;

    this.periodsApi.bulkCreate({
      buildingIds: [],
      year: Number(this.bulkForm.year),
      month: Number(this.bulkForm.month),
      name: this.bulkForm.name.trim(),
      startDate: this.bulkForm.startDate,
      endDate: this.bulkForm.endDate,
      dueDate: this.bulkForm.dueDate,
      lateFeeDate: this.bulkForm.lateFeeDate || null,
      notes: this.bulkForm.notes.trim()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result: BulkCreateExpensePeriodsResult) => {
        this.isBulkCreating = false;
        this.showBulkForm = false;
        this.bulkForm = this.createInitialBulkForm();
        const detail = result.created > 0
          ? `Se crearon ${result.created} periodo(s).${result.skipped > 0 ? ` Se omitieron ${result.skipped} (ya existían).` : ''}`
          : `No se creó ningún periodo. Todos los edificios ya tienen periodo para ese mes.`;
        this.msg.add({ severity: result.created > 0 ? 'success' : 'info', summary: result.created > 0 ? 'Éxito' : 'Sin cambios', detail, life: 5000 });
        this.loadData();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron crear los periodos masivos.'), life: 5000 });
        this.isBulkCreating = false;
        this.cdr.markForCheck();
      }
    });
  }

  clonePeriod(item: ExpensePeriod): void {
    const targetMonth = item.month === 12 ? 1 : item.month + 1;
    const targetYear = item.month === 12 ? item.year + 1 : item.year;
    const targetName = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    if (!confirm(`¿Clonar "${item.name}" al período ${targetName}? Se copiarán los gastos del edificio como base.`)) {
      return;
    }

    this.isCloning = true;

    this.periodsApi.clone(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result: CloneExpensePeriodResult) => {
        this.items = [...this.items, result.period];
        this.sortItems();
        this.isCloning = false;
        const expMsg = result.copiedExpenses > 0 ? ` Se copiaron ${result.copiedExpenses} gasto(s) como base.` : '';
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Período ${result.period.name} creado.${expMsg}`, life: 5000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo clonar el periodo.'), life: 5000 });
        this.isCloning = false;
        this.cdr.markForCheck();
      }
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
  }

  openGenerator(item: ExpensePeriod): void {
    this.generatorPeriod = item;
    this.generatorForm = {
      mode: 'FixedAmount',
      concept: `Expensa ${item.name}`,
      amount: 0,
      notes: ''
    };
  }

  cancelGenerator(): void {
    this.generatorPeriod = null;
    this.generatorForm = this.createInitialGeneratorForm();
  }

  openSettlement(item: ExpensePeriod): void {
    this.settlementPeriod = item;
    this.settlementSummary = null;
    this.showLateFeeForm = false;
    this.lateFeeForm = this.createInitialLateFeeForm(item);
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
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar la liquidacion del periodo.'), life: 5000 });
          this.isCalculatingSettlement = false;
          this.settlementPeriod = null;
          this.cdr.markForCheck();
        }
      });
  }

  closeSettlement(): void {
    this.settlementPeriod = null;
    this.settlementSummary = null;
    this.showLateFeeForm = false;
  }

  submitPeriod(): void {
    const request = {
      buildingId: this.form.buildingId,
      year: Number(this.form.year),
      month: Number(this.form.month),
      name: this.form.name.trim(),
      startDate: this.form.startDate,
      endDate: this.form.endDate,
      dueDate: this.form.dueDate,
      lateFeeDate: this.form.lateFeeDate || null,
      status: 'Draft' as ExpensePeriodStatus,
      notes: this.form.notes.trim()
    };

    const validationError = this.validatePeriodForm(request);
    if (validationError) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: validationError, life: 5000 });
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
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Periodo actualizado correctamente.' : 'Periodo creado correctamente.', life: 4000 });
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, this.editingId ? 'No se pudo actualizar el periodo.' : 'No se pudo guardar el periodo.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  generateCharges(): void {
    if (!this.generatorPeriod) {
      return;
    }

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
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Se generaron ${result.unitsAffected} cargos por ${this.formatCurrency(result.totalGeneratedAmount)} en ${result.expensePeriodName}.`, life: 4000 });
          this.cancelGenerator();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron generar los cargos masivos.'), life: 5000 });
          this.isGenerating = false;
          this.cdr.markForCheck();
        }
      });
  }

  calculateSettlement(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.isCalculatingSettlement = true;

    this.periodsApi.calculateSettlement(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.settlementSummary = summary;
          this.syncPeriodStatus(summary.expensePeriodId, summary.periodStatus);
                this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Liquidacion consolidada calculada por ${this.formatCurrency(summary.netCommonAmount)} en ${summary.expensePeriodName}.`, life: 4000 });
          this.isCalculatingSettlement = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo calcular la liquidacion del periodo.'), life: 5000 });
          this.isCalculatingSettlement = false;
          this.cdr.markForCheck();
        }
      });
  }

  get settlementCategoryExpenseCount(): number {
    return (this.settlementSummary?.categoryTotals ?? []).reduce((acc, x) => acc + x.expenseCount, 0);
  }

  get settlementCategoryTotalAmount(): number {
    return (this.settlementSummary?.categoryTotals ?? []).reduce((acc, x) => acc + x.amount, 0);
  }

  settlementCategoryLabel(category: BuildingExpenseCategory): string {
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
    })[category] ?? category;
  }

  deletePeriod(item: ExpensePeriod): void {
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
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Periodo eliminado correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar el periodo.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  approveSettlement(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.isApprovingSettlement = true;

    this.periodsApi.approveSettlement(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.settlementSummary = summary;
          this.syncPeriodStatus(summary.expensePeriodId, summary.periodStatus);
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Liquidacion aprobada y deuda emitida para ${summary.expensePeriodName}.`, life: 4000 });
          this.isApprovingSettlement = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo aprobar la liquidacion.'), life: 5000 });
          this.isApprovingSettlement = false;
          this.cdr.markForCheck();
        }
      });
  }

  publishSettlement(): void {
    if (!this.settlementPeriod) {
      return;
    }

    this.isPublishingSettlement = true;

    this.periodsApi.publish(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.settlementSummary = summary;
          this.syncPeriodStatus(summary.expensePeriodId, summary.periodStatus);
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Comprobantes publicados para ${summary.expensePeriodName}.`, life: 4000 });
          this.isPublishingSettlement = false;
          this.loadAlerts();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron publicar los comprobantes.'), life: 5000 });
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

    const lateFeeError = this.validateLateFeeForm();
    if (lateFeeError) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: lateFeeError, life: 5000 });
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
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron registrar los recargos por mora.'), life: 5000 });
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

  canVoidSettlement(): boolean {
    return !!this.settlementSummary &&
      this.settlementSummary.status === 'Approved' &&
      this.settlementSummary.periodStatus === 'Closed';
  }

  getSettlementPdfUrl(): string {
    if (!this.settlementPeriod) return '';
    return this.periodsApi.getSettlementPdfUrl(this.settlementPeriod.id, this.auth.getToken() ?? '');
  }

  voidSettlement(): void {
    if (!this.settlementPeriod) return;
    if (!confirm(`¿Anular la liquidación de "${this.settlementPeriod.name}"? Se eliminarán los cargos generados y el período volverá a Borrador.`)) {
      return;
    }
    this.isVoidingSettlement = true;
    this.periodsApi.voidSettlement(this.settlementPeriod.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: VoidSettlementResult) => {
          this.isVoidingSettlement = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Liquidación anulada. Se eliminaron ${result.deletedChargeCount} cargos. El período volvió a Borrador.`, life: 6000 });
          const period = this.items.find((p) => p.id === this.settlementPeriod!.id);
          if (period) {
            period.status = 'Draft';
            this.settlementPeriod = { ...this.settlementPeriod!, status: 'Draft' };
          }
          this.openSettlement(this.settlementPeriod!);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo anular la liquidación.'), life: 5000 });
          this.isVoidingSettlement = false;
          this.cdr.markForCheck();
        }
      });
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
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
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el listado de periodos.'), life: 5000 });
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
      lateFeeDate: '',
      notes: ''
    };
  }

  private createInitialBulkForm() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const monthText = `${month}`.padStart(2, '0');
    const startDate = `${year}-${monthText}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
    const dueDate = new Date(year, month, 10).toISOString().slice(0, 10);

    return {
      year,
      month,
      name: '',
      startDate,
      endDate,
      dueDate,
      lateFeeDate: '',
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
    this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Se registraron ${result.chargesCreated} recargos por ${this.formatCurrency(result.totalLateFeeAmount)} en ${result.expensePeriodName}.`, life: 4000 });
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

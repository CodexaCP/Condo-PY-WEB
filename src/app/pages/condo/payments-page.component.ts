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
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { PaymentsApiService } from '../../api/payments-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import {
  AllocationRequest,
  Building,
  ExpenseCharge,
  ExpenseChargeType,
  ExpensePeriod,
  Payment,
  PaymentMethod,
  Unit
} from '../../api/models';

interface PaymentsGroup {
  periodId: string;
  periodName: string;
  buildingName: string;
  total: number;
  items: Payment[];
}

@Component({
  standalone: true,
  selector: 'app-payments-page',
  imports: [CommonModule, FormsModule, Button, Card, InputNumber, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Pagos</h1>
            <p>Registro de cobros recibidos por unidad y periodo.</p>
          </div>
        </div>

        <p-button
          *ngIf="!isReadOnly"
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo pago'"
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
        <div class="field-block">
          <span>Unidad</span>
          <select [(ngModel)]="filters.unitId" name="filterUnitId" (ngModelChange)="applyFilters()">
            <option value="">Todas</option>
            <option *ngFor="let u of filteredUnitsForSelector" [value]="u.id">{{ u.code }} · {{ u.buildingName }}</option>
          </select>
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" size="small" (onClick)="resetFilters()"></p-button>
      </div>

      <!-- Payment form -->
      <form class="panel-box form-panel" *ngIf="showForm" (ngSubmit)="submitPayment()">
        <div class="panel-box-title">
          <span class="pi pi-wallet"></span>
          {{ editingId ? 'Editar pago' : 'Registrar pago' }}
        </div>

        <!-- Row 1: context -->
        <div class="payment-form">
          <div class="field-block">
            <span>Periodo <em>*</em></span>
            <select [(ngModel)]="form.expensePeriodId" name="expensePeriodId" required (ngModelChange)="onFormContextChange()">
              <option value="" disabled>— Seleccionar —</option>
              <option *ngFor="let p of periods" [value]="p.id">{{ p.name }} · {{ p.buildingName }}</option>
            </select>
          </div>

          <div class="field-block">
            <span>Unidad <em>*</em></span>
            <select [(ngModel)]="form.unitId" name="unitId" required (ngModelChange)="onFormContextChange()">
              <option value="" disabled>— Seleccionar —</option>
              <option *ngFor="let u of availableUnits" [value]="u.id">{{ u.code }} · {{ u.buildingName }}</option>
            </select>
          </div>

          <div class="field-block">
            <span>Fecha <em>*</em></span>
            <input [(ngModel)]="form.paymentDate" name="paymentDate" type="date" required />
          </div>

          <div class="field-block">
            <span>Método <em>*</em></span>
            <select [(ngModel)]="form.method" name="method" required>
              <option *ngFor="let m of methods" [value]="m">{{ paymentMethodLabel(m) }}</option>
            </select>
          </div>

          <div class="field-block">
            <span>Monto <em>*</em></span>
            <p-inputnumber [(ngModel)]="form.amount" name="amount" [useGrouping]="true" prefix="₲ " [min]="1" [minFractionDigits]="0" [maxFractionDigits]="0" [required]="true" styleClass="w-full"></p-inputnumber>
          </div>

          <div class="field-block">
            <span>Referencia / N° comprobante</span>
            <input [(ngModel)]="form.reference" name="reference" type="text" maxlength="100" placeholder="Ej: TRF-00123" />
          </div>

          <div class="field-block wide2">
            <span>Notas opcionales</span>
            <input [(ngModel)]="form.notes" name="notes" type="text" maxlength="500" placeholder="Observaciones adicionales" />
          </div>
        </div>

        <!-- Pending charges allocation -->
        <div class="charges-panel" *ngIf="pendingCharges.length > 0">
          <div class="charges-panel-header charges-panel-header-clickable" (click)="chargesExpanded = !chargesExpanded">
            <span class="pi pi-list-check"></span>
            <strong>Imputar a cargos pendientes ({{ pendingCharges.length }})</strong>
            <span class="pending-total">Pendiente total: <strong>{{ formatCurrency(totalPending) }}</strong></span>
            <span class="pi" [class.pi-chevron-down]="!chargesExpanded" [class.pi-chevron-up]="chargesExpanded"></span>
          </div>

          <div class="charges-body" *ngIf="chargesExpanded">
            <label class="select-all-row">
              <input type="checkbox" [checked]="allChargesSelected" (change)="toggleSelectAll($any($event.target).checked)" />
              <span>Seleccionar todos</span>
            </label>

            <div class="charge-row" *ngFor="let charge of visibleCharges">
              <label class="charge-check">
                <input type="checkbox" [(ngModel)]="charge['_selected']" [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="onChargeSelectionChange()" />
                <div class="charge-info">
                  <span>{{ charge.concept }}</span>
                  <small>{{ chargeTypeLabel(charge.chargeType) }}</small>
                </div>
              </label>
              <div class="charge-amounts">
                <span class="charge-pending">{{ formatCurrency(charge.pendingAmount) }}</span>
                <input *ngIf="charge['_selected']"
                  type="number"
                  [(ngModel)]="charge['_allocAmount']"
                  [ngModelOptions]="{standalone: true}"
                  min="1"
                  [max]="charge.pendingAmount"
                  class="alloc-input"
                  placeholder="Importe"
                  (ngModelChange)="onChargeSelectionChange()" />
              </div>
            </div>

            <!-- Recargos por mora agrupados en una sola fila -->
            <div class="charge-row late-fee-group-row" *ngIf="hasLateFeeGroup" (click)="lateFeeGroupExpanded = !lateFeeGroupExpanded; $event.stopPropagation()">
              <label class="charge-check" (click)="$event.stopPropagation()">
                <input type="checkbox" [checked]="allLateFeeSelected" (change)="toggleLateFeeGroup($any($event.target).checked)" />
                <div class="charge-info">
                  <span>Recargos por mora ({{ lateFeeCharges.length }} cuotas)</span>
                  <small>Ajuste · clic para ver el detalle</small>
                </div>
              </label>
              <div class="charge-amounts">
                <span class="charge-pending">{{ formatCurrency(lateFeeTotalPending) }}</span>
                <span class="pi" [class.pi-chevron-down]="!lateFeeGroupExpanded" [class.pi-chevron-up]="lateFeeGroupExpanded"></span>
              </div>
            </div>
            <div class="charge-row charge-row-nested" *ngFor="let charge of (lateFeeGroupExpanded ? lateFeeCharges : [])">
              <label class="charge-check">
                <input type="checkbox" [(ngModel)]="charge['_selected']" [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="onChargeSelectionChange()" />
                <div class="charge-info">
                  <span>{{ charge.concept }}</span>
                  <small>{{ chargeTypeLabel(charge.chargeType) }}</small>
                </div>
              </label>
              <div class="charge-amounts">
                <span class="charge-pending">{{ formatCurrency(charge.pendingAmount) }}</span>
                <input *ngIf="charge['_selected']"
                  type="number"
                  [(ngModel)]="charge['_allocAmount']"
                  [ngModelOptions]="{standalone: true}"
                  min="1"
                  [max]="charge.pendingAmount"
                  class="alloc-input"
                  placeholder="Importe"
                  (ngModelChange)="onChargeSelectionChange()" />
              </div>
            </div>
          </div>
          <p class="charges-collapsed-hint" *ngIf="!chargesExpanded">
            {{ selectedChargesCount }} de {{ pendingCharges.length }} seleccionados — clic arriba para ver el detalle.
          </p>

          <div class="charges-panel-footer">
            <div class="alloc-stat">
              <span>Imputado</span>
              <strong>{{ formatCurrency(totalAllocated) }}</strong>
            </div>
            <div class="alloc-stat" [class.credit]="form.amount - totalAllocated > 0">
              <span>Sin imputar</span>
              <strong>{{ formatCurrency(form.amount - totalAllocated) }}</strong>
            </div>
          </div>
        </div>
        <p class="app-state" *ngIf="loadingCharges">Cargando cargos pendientes...</p>

        <div class="form-footer">
          <div class="form-actions">
            <p-button *ngIf="editingId" type="button" label="Cancelar" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="cancelEdit()"></p-button>
            <p-button
              type="submit"
              [disabled]="!periods.length || !units.length"
              [loading]="isSaving"
              [icon]="editingId ? 'pi pi-check' : 'pi pi-wallet'"
              [label]="editingId ? 'Guardar cambios' : 'Registrar pago'">
            </p-button>
          </div>
        </div>
      </form>

      <!-- Recibo post-cobro -->
      <div class="receipt-panel" *ngIf="receipt">
        <div class="receipt-header">
          <span class="pi pi-check-circle receipt-icon"></span>
          <span class="receipt-title">Comprobante de pago</span>
          <a [href]="getReceiptPdfUrl(receipt.id)" target="_blank" style="display:contents">
            <p-button type="button" label="Descargar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" size="small"></p-button>
          </a>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="receipt = null"></p-button>
        </div>
        <div class="receipt-body">
          <div class="receipt-row"><span>Comprobante</span><strong>#{{ receipt.id.slice(0,8).toUpperCase() }}</strong></div>
          <div class="receipt-row"><span>Fecha</span><strong>{{ receipt.paymentDate }}</strong></div>
          <div class="receipt-row"><span>Periodo</span><strong>{{ receipt.expensePeriodName }}</strong></div>
          <div class="receipt-row"><span>Edificio</span><strong>{{ receipt.buildingName }}</strong></div>
          <div class="receipt-row"><span>Unidad</span><strong>{{ receipt.unitCode }}</strong></div>
          <div class="receipt-row receipt-amount"><span>Monto cobrado</span><strong>{{ formatCurrency(receipt.amount) }}</strong></div>
          <div class="receipt-row"><span>Método</span><strong>{{ paymentMethodLabel(receipt.method) }}</strong></div>
          <div class="receipt-row" *ngIf="receipt.reference"><span>Referencia</span><strong>{{ receipt.reference }}</strong></div>
          <div class="receipt-allocations" *ngIf="receipt.allocations.length > 0">
            <span class="alloc-title">Cargos cubiertos ({{ receipt.allocations.length }})</span>
            <div class="alloc-row" *ngFor="let a of receiptRegularAllocations">
              <span>{{ a.chargeConcept }}</span>
              <strong>{{ formatCurrency(a.allocatedAmount) }}</strong>
            </div>
            <ng-container *ngIf="receiptLateFeeAllocations.length">
              <button type="button" class="alloc-row alloc-group" (click)="receiptLateFeesExpanded = !receiptLateFeesExpanded" [attr.aria-expanded]="receiptLateFeesExpanded">
                <span>
                  <span class="pi" [ngClass]="receiptLateFeesExpanded ? 'pi-chevron-down' : 'pi-chevron-right'"></span>
                  Recargos por mora ({{ receiptLateFeeAllocations.length }} cuotas)
                </span>
                <strong>{{ formatCurrency(receiptLateFeeTotal) }}</strong>
              </button>
              <div class="alloc-nested" *ngIf="receiptLateFeesExpanded">
                <div class="alloc-row" *ngFor="let a of receiptLateFeeAllocations">
                  <span>{{ a.chargeConcept }}</span>
                  <strong>{{ formatCurrency(a.allocatedAmount) }}</strong>
                </div>
              </div>
            </ng-container>
          </div>
          <div class="receipt-row credit-row" *ngIf="receipt.amount - receipt.allocatedAmount > 0.01">
            <span>Crédito a favor</span>
            <strong>{{ formatCurrency(receipt.amount - receipt.allocatedAmount) }}</strong>
          </div>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando pagos...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay pagos cargados.</p>

      <div class="period-group" *ngFor="let group of groups; trackBy: trackGroup">
        <button type="button" class="group-head" (click)="toggleGroup(group.periodId)" [attr.aria-expanded]="isGroupOpen(group.periodId)">
          <span class="pi" [ngClass]="isGroupOpen(group.periodId) ? 'pi-chevron-down' : 'pi-chevron-right'"></span>
          <span class="group-title">
            <strong>{{ group.periodName }}</strong>
            <small>{{ group.buildingName }}</small>
          </span>
          <span class="group-count">{{ group.items.length }} {{ group.items.length === 1 ? 'pago' : 'pagos' }}</span>
          <strong class="group-total">{{ formatCurrency(group.total) }}</strong>
        </button>
      <div class="app-list" *ngIf="isGroupOpen(group.periodId)">
        <div class="app-row header payments-grid">
          <span>Fecha</span>
          <span>Periodo · Edificio</span>
          <span>Unidad</span>
          <span>Metodo</span>
          <span>Monto</span>
          <span>Asignado</span>
          <span class="actions-head" *ngIf="!isReadOnly || canRevert">Acciones</span>
        </div>

        <div class="app-row payments-grid" [class.reversed-row]="item.isReversed" *ngFor="let item of group.items">
          <strong>{{ item.paymentDate }}</strong>
          <span>
            {{ item.expensePeriodName }} · {{ item.buildingName }}
            <span class="badge-reversed" *ngIf="item.isReversed">REVERTIDO</span>
          </span>
          <span>{{ item.unitCode }}</span>
          <span>{{ paymentMethodLabel(item.method) }}</span>
          <span>{{ formatCurrency(item.amount) }}</span>
          <span [class.partial]="item.allocatedAmount < item.amount && item.allocatedAmount > 0"
                [class.unallocated]="item.allocatedAmount === 0">
            {{ formatCurrency(item.allocatedAmount) }}
            <small *ngIf="item.allocations.length > 0"> ({{ item.allocations.length }} cargos)</small>
          </span>
          <div class="app-actions" *ngIf="!isReadOnly || canRevert">
            <p-button type="button" icon="pi pi-file" severity="secondary" [rounded]="true" [text]="true" pTooltip="Ver comprobante" (onClick)="showReceipt(item)"></p-button>
            <a [href]="getReceiptPdfUrl(item.id)" target="_blank" style="display:contents">
              <p-button type="button" icon="pi pi-file-pdf" severity="secondary" [rounded]="true" [text]="true" pTooltip="Descargar PDF"></p-button>
            </a>
            <p-button *ngIf="!isReadOnly && !item.isReversed" type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startEdit(item)"></p-button>
            <p-button *ngIf="canRevert" type="button" icon="pi pi-undo" severity="warn" [rounded]="true" [text]="true"
              [disabled]="isSaving || item.isReversed"
              [pTooltip]="item.isReversed ? 'Ya revertido' : 'Revertir pago'"
              (onClick)="revertPayment(item)"></p-button>
          </div>
        </div>
      </div>
      </div>
    </p-card>
  `,
  styles: [`
    /* Filters bar */
    .filters-bar {
      display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;
      padding: 0.75rem 1rem;
      background: rgba(20,54,61,0.04);
      border: 1px solid rgba(20,54,61,0.1);
      border-radius: 14px;
      margin-bottom: 1.25rem;
    }
    .filters-icon { color: var(--brand-muted); font-size: 1rem; margin-bottom: 0.35rem; }

    /* Panel box */
    .panel-box { border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
    .form-panel { border: 1.5px solid rgba(19,133,182,0.25); background: rgba(235,247,255,0.45); }
    .panel-box-title {
      font-weight: 700; font-size: 0.95rem; color: var(--brand-ink);
      margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;
    }
    .panel-box-title .pi { color: var(--brand-blue); }

    /* Field blocks */
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-block span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block em { color: #e53e3e; font-style: normal; }
    .field-block select,
    .field-block input[type="text"],
    .field-block input[type="date"] {
      border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px;
      padding: 0.5rem 0.75rem; font-size: 0.92rem; color: var(--brand-ink);
      background: #fff; outline: none; transition: border-color 0.15s; width: 100%;
    }
    .field-block select:focus,
    .field-block input:focus { border-color: var(--brand-blue); }

    /* Payment form grid */
    .payment-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .wide2 { grid-column: span 2; }

    /* Charges allocation panel */
    .charges-panel {
      border: 1.5px solid rgba(26,140,91,0.25);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      background: rgba(240,252,246,0.6);
      margin-bottom: 1rem;
    }
    .charges-panel-header {
      display: flex; align-items: center; gap: 0.6rem;
      margin-bottom: 0.75rem; font-size: 0.9rem;
    }
    .charges-panel-header-clickable { cursor: pointer; user-select: none; }
    .charges-panel-header .pi { color: #1a8c5b; }
    .charges-panel-header strong { color: var(--brand-ink); flex: 1; }
    .pending-total { font-size: 0.85rem; color: var(--brand-muted); }
    .pending-total strong { color: var(--brand-ink); }
    .charges-collapsed-hint { margin: 0 0 0.5rem; font-size: 0.85rem; color: var(--brand-muted); font-style: italic; }
    .select-all-row {
      display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
      padding: 0.4rem 0; font-size: 0.85rem; font-weight: 600; color: var(--brand-ink);
      border-bottom: 1px solid rgba(26,140,91,0.15); margin-bottom: 0.25rem;
    }
    .select-all-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: #1a8c5b; cursor: pointer; }
    .late-fee-group-row { cursor: pointer; background: rgba(245,158,11,0.06); border-radius: 8px; }
    .late-fee-group-row:hover { background: rgba(245,158,11,0.12); }
    .late-fee-group-row .pi-chevron-down, .late-fee-group-row .pi-chevron-up { color: var(--brand-muted); }
    .charge-row-nested { padding-left: 1.5rem; background: rgba(20,54,61,0.02); }
    .charge-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0; border-bottom: 1px solid rgba(26,140,91,0.12); gap: 1rem;
    }
    .charge-row:last-of-type { border-bottom: none; }
    .charge-check { display: flex; align-items: center; gap: 0.6rem; flex: 1; cursor: pointer; }
    .charge-check input[type="checkbox"] { width: 16px; height: 16px; accent-color: #1a8c5b; cursor: pointer; }
    .charge-info { display: flex; flex-direction: column; gap: 0.1rem; }
    .charge-info span { font-size: 0.9rem; color: var(--brand-ink); }
    .charge-info small { font-size: 0.78rem; color: var(--brand-muted); }
    .charge-amounts { display: flex; align-items: center; gap: 0.75rem; }
    .charge-pending { font-weight: 700; font-size: 0.9rem; color: var(--brand-ink); min-width: 90px; text-align: right; }
    .alloc-input {
      width: 110px; padding: 0.35rem 0.6rem;
      border: 1.5px solid rgba(26,140,91,0.3); border-radius: 8px;
      font-size: 0.88rem; color: var(--brand-ink); background: #fff; outline: none;
    }
    .alloc-input:focus { border-color: #1a8c5b; }
    .charges-panel-footer {
      display: flex; justify-content: flex-end; gap: 1.5rem;
      margin-top: 0.75rem; padding-top: 0.75rem;
      border-top: 1px solid rgba(26,140,91,0.15);
    }
    .alloc-stat { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; }
    .alloc-stat span { font-size: 0.75rem; color: var(--brand-muted); text-transform: uppercase; }
    .alloc-stat strong { font-size: 0.95rem; color: var(--brand-ink); }
    .credit .alloc-stat strong, .credit strong { color: #1a8c5b; }

    /* Form footer */
    .form-footer {
      display: flex; justify-content: flex-end;
      padding-top: 1rem; border-top: 1px solid rgba(20,54,61,0.1);
    }
    .form-actions { display: flex; gap: 0.75rem; }

    /* Receipt panel */
    .receipt-panel {
      border: 2px solid #1a8c5b; border-radius: 16px;
      padding: 1.25rem 1.5rem; margin-bottom: 1.25rem;
      background: rgba(240,252,246,0.7); max-width: 520px;
    }
    .receipt-header {
      display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem;
    }
    .receipt-icon { font-size: 1.3rem; color: #1a8c5b; }
    .receipt-title { font-weight: 700; font-size: 1rem; color: var(--brand-ink); flex: 1; }
    .receipt-body { display: flex; flex-direction: column; gap: 0.45rem; }
    .receipt-row { display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--brand-ink); }
    .receipt-row span { color: var(--brand-muted); }
    .receipt-amount strong { font-size: 1.1rem; color: #1a8c5b; }
    .receipt-allocations { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(26,140,91,0.2); }
    .alloc-title { font-size: 0.78rem; color: var(--brand-muted); text-transform: uppercase; display: block; margin-bottom: 0.4rem; }
    .alloc-row { display: flex; justify-content: space-between; font-size: 0.88rem; padding: 0.2rem 0; color: var(--brand-ink); }
    .credit-row strong { color: #1a8c5b; }
    .alloc-group {
      width: 100%; background: rgba(245,158,11,0.08); border: 0; border-radius: 8px;
      padding: 0.4rem 0.6rem; margin-top: 0.25rem; cursor: pointer; font: inherit; text-align: left;
    }
    .alloc-group:hover { background: rgba(245,158,11,0.15); }
    .alloc-group .pi { font-size: 0.75rem; margin-right: 0.35rem; color: var(--brand-muted); }
    .alloc-nested {
      max-height: 14rem; overflow-y: auto; margin: 0.25rem 0 0 1rem; padding-left: 0.6rem;
      border-left: 2px solid rgba(245,158,11,0.3);
    }
    .alloc-nested .alloc-row { font-size: 0.82rem; color: var(--brand-muted); }

    /* Period groups */
    .period-group { margin-bottom: 0.75rem; }
    .group-head {
      width: 100%; display: flex; align-items: center; gap: 0.85rem;
      padding: 0.9rem 1.25rem; border-radius: 16px; cursor: pointer;
      background: #f5faf9; border: 1px solid #e5eeec; font: inherit; color: #14363d; text-align: left;
    }
    .group-head:hover { background: #eaf4f2; }
    .group-title { flex: 1; display: grid; }
    .group-count { color: #6b878d; font-size: 0.85rem; }
    .group-total { min-width: 8rem; text-align: right; }
    .period-group .app-list { margin-top: 0.5rem; }

    /* List */
    .payments-grid { grid-template-columns: 0.7fr 1.2fr 0.7fr 0.8fr 0.8fr 0.9fr 0.5fr; }
    .actions-head { text-align: right; }
    .partial { color: #f59e0b; }
    .unallocated { color: #9ca3af; }
    small { font-size: 0.8em; color: #6b7280; }
    .reversed-row { opacity: 0.55; }
    .badge-reversed {
      display: inline-block; margin-left: 0.4rem;
      font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em;
      color: #b45309; background: #fef3c7;
      border: 1px solid #f59e0b; border-radius: 6px;
      padding: 0.05rem 0.4rem; vertical-align: middle;
    }

    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .payment-form { grid-template-columns: 1fr; }
      .wide2 { grid-column: span 1; }
    }
  `]
})
export class PaymentsPageComponent implements OnInit {
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }
  get canRevert(): boolean { return !this.auth.hasRole('Resident') && !this.auth.hasRole('Owner') && !this.auth.hasRole('Porter'); }

  items: Payment[] = [];
  groups: PaymentsGroup[] = [];
  private openGroups = new Set<string>();
  private allItems: Payment[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  units: Unit[] = [];
  pendingCharges: (ExpenseCharge & { _selected?: boolean; _allocAmount?: number })[] = [];
  loadingCharges = false;
  chargesExpanded = false;
  lateFeeGroupExpanded = false;
  receipt: Payment | null = null;
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  readonly methods: PaymentMethod[] = ['Cash', 'BankTransfer', 'Card', 'Check', 'Other'];
  filters = { buildingId: '', expensePeriodId: '', unitId: '' };
  form = this.createInitialForm();

  get filteredPeriodsForSelector(): ExpensePeriod[] {
    return this.filters.buildingId
      ? this.periods.filter((p) => p.buildingId === this.filters.buildingId)
      : this.periods;
  }

  get filteredUnitsForSelector(): Unit[] {
    return this.filters.buildingId
      ? this.units.filter((u) => u.buildingId === this.filters.buildingId)
      : this.units;
  }

  get availableUnits(): Unit[] {
    const selectedPeriod = this.periods.find((p) => p.id === this.form.expensePeriodId);
    return selectedPeriod ? this.units.filter((u) => u.buildingId === selectedPeriod.buildingId) : this.units;
  }

  get totalPending(): number {
    return this.pendingCharges.reduce((sum, c) => sum + c.pendingAmount, 0);
  }

  get totalAllocated(): number {
    return this.pendingCharges
      .filter((c) => c['_selected'])
      .reduce((sum, c) => sum + Number(c['_allocAmount'] || 0), 0);
  }

  get selectedChargesCount(): number {
    return this.pendingCharges.filter((c) => c['_selected']).length;
  }

  get allChargesSelected(): boolean {
    return this.pendingCharges.length > 0 && this.pendingCharges.every((c) => c['_selected']);
  }

  get lateFeeCharges(): (ExpenseCharge & { _selected?: boolean; _allocAmount?: number })[] {
    return this.pendingCharges.filter((c) => c.isLateFee);
  }

  get visibleCharges(): (ExpenseCharge & { _selected?: boolean; _allocAmount?: number })[] {
    return this.hasLateFeeGroup ? this.pendingCharges.filter((c) => !c.isLateFee) : this.pendingCharges;
  }

  get hasLateFeeGroup(): boolean {
    return this.lateFeeCharges.length > 1;
  }

  get lateFeeTotalPending(): number {
    return this.lateFeeCharges.reduce((sum, c) => sum + c.pendingAmount, 0);
  }

  get allLateFeeSelected(): boolean {
    return this.lateFeeCharges.length > 0 && this.lateFeeCharges.every((c) => c['_selected']);
  }

  receiptLateFeesExpanded = false;

  get receiptLateFeeAllocations() {
    return (this.receipt?.allocations ?? []).filter((a) => /^mora/i.test(a.chargeConcept));
  }

  get receiptRegularAllocations() {
    return (this.receipt?.allocations ?? []).filter((a) => !/^mora/i.test(a.chargeConcept));
  }

  get receiptLateFeeTotal(): number {
    return this.receiptLateFeeAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  }

  toggleSelectAll(checked: boolean): void {
    for (const charge of this.pendingCharges) {
      charge['_selected'] = checked;
      charge['_allocAmount'] = checked ? (charge['_allocAmount'] || charge.pendingAmount) : charge['_allocAmount'];
    }
    this.onChargeSelectionChange();
  }

  toggleLateFeeGroup(checked: boolean): void {
    for (const charge of this.lateFeeCharges) {
      charge['_selected'] = checked;
      charge['_allocAmount'] = checked ? (charge['_allocAmount'] || charge.pendingAmount) : charge['_allocAmount'];
    }
    this.onChargeSelectionChange();
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
      this.pendingCharges = [];
    }
  }

  onFormContextChange(): void {
    if (this.form.expensePeriodId && this.form.unitId) {
      this.loadPendingCharges();
    } else {
      this.pendingCharges = [];
    }
  }

  onChargeSelectionChange(): void {
    const selectedTotal = this.totalAllocated;
    if (this.form.amount !== selectedTotal && selectedTotal > 0) {
      this.form.amount = selectedTotal;
    }
  }

  startEdit(item: Payment): void {
    this.editingId = item.id;
    this.showForm = true;
    this.form = {
      expensePeriodId: item.expensePeriodId,
      unitId: item.unitId,
      paymentDate: item.paymentDate,
      amount: item.amount,
      method: item.method,
      reference: item.reference,
      notes: item.notes
    };
    this.loadPendingCharges(item.allocations.map((a) => ({ chargeId: a.expenseChargeId, amount: a.allocatedAmount })));
    this.receipt = null;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
    this.pendingCharges = [];
  }

  onBuildingFilterChange(): void {
    if (!this.filteredPeriodsForSelector.some((p) => p.id === this.filters.expensePeriodId))
      this.filters.expensePeriodId = '';
    if (!this.filteredUnitsForSelector.some((u) => u.id === this.filters.unitId))
      this.filters.unitId = '';
    this.applyFilters();
  }

  applyFilters(): void {
    this.items = this.allItems.filter(item =>
      (!this.filters.buildingId || item.buildingId === this.filters.buildingId) &&
      (!this.filters.expensePeriodId || item.expensePeriodId === this.filters.expensePeriodId) &&
      (!this.filters.unitId || item.unitId === this.filters.unitId)
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
    const map = new Map<string, PaymentsGroup>();
    for (const item of this.items) {
      let group = map.get(item.expensePeriodId);
      if (!group) {
        group = { periodId: item.expensePeriodId, periodName: item.expensePeriodName, buildingName: item.buildingName, total: 0, items: [] };
        map.set(item.expensePeriodId, group);
      }
      group.items.push(item);
      if (!item.isReversed) {
        group.total += item.amount ?? 0;
      }
    }
    const startOf = (id: string) => this.periods.find((p) => p.id === id)?.startDate ?? '';
    this.groups = [...map.values()].sort((a, b) => startOf(b.periodId).localeCompare(startOf(a.periodId)));
  }

  resetFilters(): void {
    this.filters = { buildingId: '', expensePeriodId: '', unitId: '' };
    this.applyFilters();
  }

  submitPayment(): void {
    this.isSaving = true;

    const allocations: AllocationRequest[] = this.pendingCharges
      .filter((c) => c['_selected'] && Number(c['_allocAmount']) > 0)
      .map((c) => ({ expenseChargeId: c.id, amount: Number(c['_allocAmount']) }));

    const request = {
      expensePeriodId: this.form.expensePeriodId,
      unitId: this.form.unitId,
      paymentDate: this.form.paymentDate,
      amount: Number(this.form.amount),
      method: this.form.method,
      reference: this.form.reference.trim(),
      notes: this.form.notes.trim(),
      allocations
    };

    const operation = this.editingId
      ? this.paymentsApi.update(this.editingId, request)
      : this.paymentsApi.create(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (payment) => {
        this.allItems = this.editingId
          ? this.allItems.map((item) => item.id === payment.id ? payment : item)
          : [payment, ...this.allItems];
        this.applyFilters();
        this.receipt = payment;
        this.receiptLateFeesExpanded = false;
        this.form = this.createInitialForm();
        this.pendingCharges = [];
        this.isSaving = false;
        this.showForm = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.editingId ? 'Pago actualizado.' : 'Pago registrado. Ver comprobante abajo.', life: 4000 });
        this.editingId = null;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, this.editingId ? 'No se pudo actualizar el pago.' : 'No se pudo registrar el pago.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  showReceipt(item: Payment): void {
    this.receipt = item;
    this.receiptLateFeesExpanded = false;
    this.showForm = false;
    this.cdr.markForCheck();
  }

  getReceiptPdfUrl(paymentId: string): string {
    return this.paymentsApi.getReceiptPdfUrl(paymentId, this.auth.getToken() ?? '');
  }

  revertPayment(item: Payment): void {
    this.isSaving = true;

    this.paymentsApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.allItems = this.allItems.map((current) =>
          current.id === item.id ? { ...current, isReversed: true, reversedAt: new Date().toISOString() } : current
        );
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        if (this.receipt?.id === item.id) {
          this.receipt = null;
        }
        this.isSaving = false;
        this.msg.add({ severity: 'warn', summary: 'Revertido', detail: 'El pago fue revertido. Los cargos imputados quedaron liberados.', life: 5000 });
        this.applyFilters();
      },
      error: (error) => {
        const status = (error as any)?.status;
        const detail = status === 409
          ? 'Este pago ya fue revertido anteriormente.'
          : extractApiErrorMessage(error, 'No se pudo revertir el pago.');
        this.msg.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
        if (status === 409) {
          this.allItems = this.allItems.map((current) =>
            current.id === item.id ? { ...current, isReversed: true } : current
          );
          this.applyFilters();
        }
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  chargeTypeLabel(type: ExpenseChargeType): string {
    return ({ Ordinary: 'Ordinaria', ReserveFund: 'Fondo reserva', Extraordinary: 'Extraordinario', Individual: 'Individual', Adjustment: 'Ajuste' })[type];
  }

  paymentMethodLabel(method: PaymentMethod): string {
    return ({ Cash: 'Efectivo', BankTransfer: 'Transferencia', Card: 'Tarjeta', Check: 'Cheque', Other: 'Otro' })[method];
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private loadPendingCharges(preSelected?: { chargeId: string; amount: number }[]): void {
    if (!this.form.expensePeriodId || !this.form.unitId) return;
    this.loadingCharges = true;
    this.chargesExpanded = false;
    this.lateFeeGroupExpanded = false;

    this.paymentsApi.getPendingCharges(this.form.expensePeriodId, this.form.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (charges) => {
          this.pendingCharges = charges
            .filter((c) => !c.isReversal && !c.isReversed && c.pendingAmount > 0)
            .map((c) => {
              const pre = preSelected?.find((p) => p.chargeId === c.id);
              return Object.assign(c, {
                _selected: !!pre,
                _allocAmount: pre?.amount ?? c.pendingAmount
              });
            });
          this.loadingCharges = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingCharges = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadData(): void {
    forkJoin({
      payments: this.paymentsApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll(),
      units: this.unitsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ payments, buildings, periods, units }) => {
          this.allItems = payments;
          this.buildings = buildings;
          this.periods = periods;
          this.units = units;
          this.loading = false;
          this.applyFilters();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar los pagos.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private sortItems(): void {
    this.items = [...this.items].sort((a, b) =>
      b.paymentDate.localeCompare(a.paymentDate) ||
      a.buildingName.localeCompare(b.buildingName) ||
      a.unitCode.localeCompare(b.unitCode));
  }

  private createInitialForm() {
    return {
      expensePeriodId: '',
      unitId: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      method: 'BankTransfer' as PaymentMethod,
      reference: '',
      notes: ''
    };
  }
}

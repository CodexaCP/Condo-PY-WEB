import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceApiService } from '../../api/finance-api.service';
import { LedgerPlanApplyMode, LedgerPlanApplyResult, LedgerPlanImpact } from '../../api/models';

// Aplica el plan genérico de CondoPY a un edificio: agrega solo las cuentas que faltan (no borra nada) o reemplaza el plan entero.
// Reemplazar desvincula el rubro de los gastos e ingresos que ya lo tenían y borra el presupuesto cargado: por eso muestra
// cuánto se pierde y pide confirmación expresa. Los gastos, ingresos, pagos y liquidaciones no se tocan.
@Component({
  standalone: true,
  selector: 'app-finance-plan-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Message],
  template: `
    <div class="ov-backdrop" (click)="close()"></div>
    <div class="ov-panel" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Plan de cuentas genérico de CondoPY</strong>
        <button class="ov-close" type="button" (click)="close()">✕</button>
      </div>

      <p class="confirm-text">
        Es el plan base de CondoPY: 5 clases (activo, pasivo, patrimonio, ingresos y egresos), 30 grupos y 162 cuentas finales. Solo las 54 cuentas recomendadas
        nacen activas; después activás o desactivás las que el edificio usa.
      </p>

      <label class="radio">
        <input type="radio" name="mode" value="AddMissing" [(ngModel)]="mode" />
        <span>
          <strong>Agregar las cuentas que faltan</strong>
          <small>No borra ni cambia nada de lo que ya existe: solo suma las cuentas del plan genérico que el edificio todavía no tiene (por código).</small>
        </span>
      </label>
      <label class="radio">
        <input type="radio" name="mode" value="Replace" [(ngModel)]="mode" />
        <span>
          <strong>Reemplazar todo el plan</strong>
          <small>Sustituye el plan del edificio por el genérico. Se pierde el plan actual.</small>
        </span>
      </label>

      <p class="app-state" *ngIf="loadingImpact">Calculando lo que se perdería...</p>
      <p-message *ngIf="error" severity="error" [text]="error"></p-message>

      <ng-container *ngIf="mode === 'Replace' && impact">
        <p-message severity="warn" styleClass="impact">
          <div>
            Se reemplazan <strong>{{ impact.categories }}</strong> cuentas del plan actual.
            <ul *ngIf="impact.hasImpact">
              <li *ngIf="impact.expenses"><strong>{{ impact.expenses }}</strong> gastos quedan <em>sin rubro</em> (el gasto sigue cargado, solo pierde la cuenta).</li>
              <li *ngIf="impact.incomes"><strong>{{ impact.incomes }}</strong> ingresos quedan sin rubro.</li>
              <li *ngIf="impact.recurringExpenses"><strong>{{ impact.recurringExpenses }}</strong> plantillas de gastos recurrentes quedan sin rubro.</li>
              <li *ngIf="impact.budgetLines"><strong>{{ impact.budgetLines }}</strong> renglones de presupuesto se borran.</li>
            </ul>
            <span *ngIf="!impact.hasImpact">No hay gastos, ingresos ni presupuesto que dependan de las cuentas actuales.</span>
          </div>
        </p-message>
        <label class="check" *ngIf="impact.hasImpact">
          <input type="checkbox" [(ngModel)]="confirmReplace" name="confirmReplace" />
          <span>Entiendo que se pierde esto y quiero reemplazar el plan.</span>
        </label>
      </ng-container>

      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="close()"></p-button>
        <p-button [label]="mode === 'Replace' ? 'Reemplazar el plan' : 'Agregar lo que falta'" icon="pi pi-check" [loading]="saving"
                  [severity]="mode === 'Replace' ? 'danger' : 'primary'" [disabled]="!canApply" (onClick)="apply()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(540px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001; box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .confirm-text { margin: 0 0 1rem; color: var(--brand-ink); line-height: 1.6; }
    .radio { display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.7rem 0.9rem; border: 1px solid rgba(19,133,182,0.2); border-radius: 12px; margin-bottom: 0.6rem; cursor: pointer; }
    .radio span { display: grid; gap: 0.15rem; }
    .radio small { color: var(--brand-muted); line-height: 1.4; }
    .radio input { margin-top: 0.25rem; }
    .check { display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 0.7rem; color: var(--brand-ink); }
    :host ::ng-deep .impact ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.2rem; }
  `]
})
export class FinancePlanTemplateComponent implements OnInit {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() applied = new EventEmitter<LedgerPlanApplyResult>();

  mode: LedgerPlanApplyMode = 'AddMissing';
  impact: LedgerPlanImpact | null = null;
  loadingImpact = false;
  confirmReplace = false;
  saving = false;
  error = '';

  ngOnInit(): void {
    this.loadingImpact = true;
    this.api.getReplaceImpact(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: impact => { this.impact = impact; this.loadingImpact = false; this.cdr.markForCheck(); },
      error: err => { this.error = extractApiErrorMessage(err, 'No se pudo calcular lo que se perdería al reemplazar el plan.'); this.loadingImpact = false; this.cdr.markForCheck(); }
    });
  }

  get canApply(): boolean {
    if (this.saving) return false;
    if (this.mode === 'AddMissing') return true;
    return !!this.impact && (!this.impact.hasImpact || this.confirmReplace);
  }

  close(): void { if (!this.saving) this.closed.emit(); }

  apply(): void {
    if (!this.canApply) return;
    this.saving = true;
    this.error = '';
    this.api.applyTemplate({ buildingId: this.buildingId, mode: this.mode, confirmReplace: this.confirmReplace })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => { this.saving = false; this.applied.emit(result); },
        error: err => { this.saving = false; this.error = extractApiErrorMessage(err, 'No se pudo aplicar el plan genérico.'); this.cdr.markForCheck(); }
      });
  }
}

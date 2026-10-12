import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { BudgetAlerts } from '../../api/building-config.models';

// Umbral del semáforo del presupuesto vs. real: hasta ese desvío (%) el renglón queda en amarillo y más allá, en rojo. Lo edita quien puede
// configurar el edificio (SuperAdmin y Administrador); el resto lo ve. Cada cambio queda en el historial del Centro de configuración.
@Component({
  standalone: true,
  selector: 'app-finance-budget-alerts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="alerts" *ngIf="alerts as a">
      <span class="label">Umbral del semáforo (amarillo hasta ese desvío, rojo más allá):</span>
      <ng-container *ngIf="a.canEdit; else readonly">
        <input type="number" min="1" max="100" step="1" [(ngModel)]="value" aria-label="Umbral del semáforo en porcentaje" />
        <span>%</span>
        <button type="button" class="btn" [disabled]="saving || value === a.warnPercent" (click)="save()">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
      </ng-container>
      <ng-template #readonly><strong>{{ a.warnPercent }} %</strong></ng-template>
    </div>
  `,
  styles: [`
    .alerts { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin: 0.4rem 0 0.8rem; font-size: 0.88rem; color: var(--brand-muted); }
    .alerts input { width: 5rem; padding: 0.35rem 0.6rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 8px; font: inherit; color: var(--brand-ink); background: var(--surface-ground, #f8fafc); }
    .btn { padding: 0.3rem 0.8rem; border-radius: 8px; border: none; background: var(--brand-gradient); color: #fff; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  `]
})
export class FinanceBudgetAlertsComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';
  // Se guardó un umbral nuevo: la pantalla que lo muestra tiene que recalcular el semáforo.
  @Output() saved = new EventEmitter<void>();

  alerts: BudgetAlerts | null = null;
  value = 10;
  saving = false;

  ngOnChanges(): void {
    if (!this.buildingId) return;

    this.api.getBudgetAlerts(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alerts => {
        this.alerts = alerts.financeAvailable ? alerts : null;
        this.value = alerts.warnPercent;
        this.cdr.markForCheck();
      },
      // Sin permiso o sin módulo, el control simplemente no se muestra.
      error: () => {
        this.alerts = null;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    if (!Number.isInteger(this.value) || this.value < 1 || this.value > 100) {
      this.msg.add({ severity: 'warn', summary: 'Revisá el dato', detail: 'El umbral del semáforo debe ser un número entero entre 1 y 100.', life: 5000 });
      return;
    }

    this.saving = true;
    this.api.updateBudgetAlerts(this.buildingId, this.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alerts => {
        this.alerts = alerts;
        this.value = alerts.warnPercent;
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Umbral guardado', life: 3000 });
        this.saved.emit();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudo guardar el umbral.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }
}

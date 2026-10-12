import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { ClosingMonth, PeriodClosing } from '../../api/building-config.models';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

// Período y cierre: con el cierre encendido, el administrador cierra mes a mes (solo meses terminados y en orden) y un mes cerrado
// no admite cargar, editar ni eliminar gastos, ingresos, pagos, notas de crédito ni presupuesto de ese mes. Se puede reabrir con motivo.
@Component({
  standalone: true,
  selector: 'app-config-closing-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Message, Tag],
  template: `
    <h2>Período y cierre</h2>
    <p class="muted small">Cerrar un mes lo protege: ya no se pueden cargar, editar ni eliminar gastos, ingresos, pagos, notas de crédito ni presupuesto de ese mes.</p>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando...</p>

    <ng-container *ngIf="data as d">
      <p-message *ngIf="!d.financeAvailable" severity="info"
                 text="El cierre de período depende del módulo Finanzas del edificio, que no está disponible en este edificio."></p-message>

      <ng-container *ngIf="d.financeAvailable">
        <div class="switch-row">
          <p-tag [value]="d.enabled ? 'Cierre activo' : 'Cierre apagado'" [severity]="d.enabled ? 'success' : 'secondary'"></p-tag>
          <button type="button" class="btn sm" [class.secondary]="d.enabled" *ngIf="d.canEdit" [disabled]="busy" (click)="toggle(!d.enabled)">
            {{ d.enabled ? 'Apagar cierre' : 'Activar cierre' }}
          </button>
        </div>
        <p class="muted small" *ngIf="!d.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden activarlo, cerrar y reabrir meses.</p>
        <p class="muted small" *ngIf="d.canEdit && !d.enabled">Está apagado: hoy cualquier mes se puede modificar. Al encenderlo, los meses se cierran de a uno, en orden.</p>

        <h3>Meses</h3>
        <p class="muted small" *ngIf="!d.months.length">Todavía no hay meses: el módulo arranca {{ d.financeStartDate | date: 'dd/MM/yyyy' }}.</p>
        <div class="table-wrap" *ngIf="d.months.length">
          <table class="t">
            <thead><tr><th>Mes</th><th>Estado</th><th>Cerrado</th><th></th></tr></thead>
            <tbody>
              <ng-container *ngFor="let m of monthsDesc">
                <tr>
                  <td class="nowrap"><strong>{{ m.label }}</strong></td>
                  <td><p-tag [value]="statusLabel(m)" [severity]="statusSeverity(m)"></p-tag></td>
                  <td>
                    <span *ngIf="m.closedAtUtc">{{ m.closedAtUtc | date: 'dd/MM/yyyy HH:mm' }} · {{ m.closedByName }}</span>
                    <span class="muted small" *ngIf="!m.closedAtUtc && m.cannotCloseReason">{{ m.cannotCloseReason }}</span>
                  </td>
                  <td class="num">
                    <button type="button" class="btn sm" *ngIf="d.canEdit && m.canClose" [disabled]="busy" (click)="close(m)">Cerrar mes</button>
                    <button type="button" class="btn sm secondary" *ngIf="d.canEdit && m.canReopen" [disabled]="busy" (click)="startReopen(m)">Reabrir</button>
                  </td>
                </tr>
                <tr *ngIf="reopening === key(m)">
                  <td colspan="4">
                    <div class="reopen">
                      <label class="field">
                        <span>Motivo de la reapertura (obligatorio, queda en el historial)</span>
                        <textarea rows="2" maxlength="500" [(ngModel)]="reason"></textarea>
                      </label>
                      <div class="actions">
                        <button type="button" class="btn sm" [disabled]="busy || !reason.trim()" (click)="reopen(m)">Reabrir {{ m.label }}</button>
                        <button type="button" class="btn sm secondary" (click)="reopening = ''">Cancelar</button>
                      </div>
                    </div>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>

        <ng-container *ngIf="d.history.length">
          <h3>Historial de cierres</h3>
          <div class="table-wrap">
            <table class="t">
              <thead><tr><th>Mes</th><th>Cerrado</th><th>Reabierto</th><th>Motivo</th></tr></thead>
              <tbody>
                <tr *ngFor="let h of d.history">
                  <td class="nowrap">{{ h.label }}</td>
                  <td>{{ h.closedAtUtc | date: 'dd/MM/yyyy HH:mm' }} · {{ h.closedByName }}</td>
                  <td><span *ngIf="h.reopenedAtUtc">{{ h.reopenedAtUtc | date: 'dd/MM/yyyy HH:mm' }} · {{ h.reopenedByName }}</span><span *ngIf="!h.reopenedAtUtc" class="muted">Vigente</span></td>
                  <td>{{ h.reopenReason || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>
      </ng-container>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `.reopen { padding: 0.4rem 0; } .switch-row { display: flex; gap: 0.8rem; align-items: center; margin: 0.6rem 0; }`]
})
export class ConfigClosingSectionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';

  data: PeriodClosing | null = null;
  monthsDesc: ClosingMonth[] = [];
  loading = false;
  busy = false;
  error = '';
  reopening = '';
  reason = '';

  key(m: ClosingMonth): string { return `${m.year}-${m.month}`; }

  statusLabel(m: ClosingMonth): string {
    return m.status === 'Closed' ? 'Cerrado' : m.status === 'Current' ? 'En curso' : 'Abierto';
  }

  statusSeverity(m: ClosingMonth): 'success' | 'info' | 'secondary' {
    return m.status === 'Closed' ? 'success' : m.status === 'Current' ? 'info' : 'secondary';
  }

  ngOnChanges(): void {
    this.load();
  }

  toggle(enabled: boolean): void {
    const question = enabled
      ? 'Se activa el cierre de período: los meses se cerrarán de a uno, en orden, y un mes cerrado no admitirá cambios. ¿Continuar?'
      : 'Se apaga el cierre de período: los meses ya cerrados dejarán de estar protegidos hasta que lo vuelvas a activar. ¿Continuar?';
    if (!confirm(question)) return;

    this.run(this.api.setClosingEnabled(this.buildingId, enabled), enabled ? 'Cierre de período activado.' : 'Cierre de período apagado.');
  }

  close(m: ClosingMonth): void {
    if (!confirm(`¿Cerrar ${m.label}? Después no se podrán cargar, editar ni eliminar movimientos de ese mes (se puede reabrir con un motivo).`)) return;
    this.run(this.api.closeMonth(this.buildingId, m.year, m.month), `${m.label} cerrado.`);
  }

  startReopen(m: ClosingMonth): void {
    this.reopening = this.key(m);
    this.reason = '';
  }

  reopen(m: ClosingMonth): void {
    this.run(this.api.reopenMonth(this.buildingId, m.year, m.month, this.reason.trim()), `${m.label} reabierto.`);
  }

  private run(call: ReturnType<BuildingConfigApiService['getClosing']>, success: string): void {
    this.busy = true;
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.apply(data);
        this.busy = false;
        this.reopening = '';
        this.msg.add({ severity: 'success', summary: 'Listo', detail: success, life: 3500 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.busy = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo', detail: extractApiErrorMessage(err, 'No se pudo completar la operación.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private apply(data: PeriodClosing): void {
    this.data = data;
    this.monthsDesc = [...data.months].reverse();
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getClosing(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.apply(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.data = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el cierre de período.');
        this.cdr.markForCheck();
      }
    });
  }
}

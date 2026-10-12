import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';

// Exoneración de mora de una unidad (Centro de configuración): mientras esté marcada, la unidad no acumula mora automática. Exige un motivo
// y queda en el historial del edificio. La marcan el SuperAdmin y el Administrador de empresa.
@Component({
  standalone: true,
  selector: 'app-unit-late-fee-exemption',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="exemption">
      <label class="check">
        <input type="checkbox" [(ngModel)]="exemptValue" name="lateFeeExempt" />
        <span>Exonerar esta unidad de la mora</span>
      </label>
      <div class="reason" *ngIf="exemptValue">
        <label for="lateFeeReason">Motivo <span class="req">*</span></label>
        <input id="lateFeeReason" type="text" maxlength="300" [(ngModel)]="reasonValue" name="lateFeeReason" placeholder="Ej. convenio de pago, unidad del edificio, error de facturación" />
      </div>
      <div>
        <button type="button" class="btn" [disabled]="saving || !changed" (click)="save()">{{ saving ? 'Guardando...' : 'Guardar exoneración' }}</button>
      </div>
      <small class="hint">No se guarda con el resto del formulario. Lo ya cobrado no se modifica; la unidad deja de sumar mora desde el siguiente cálculo.</small>
    </div>
  `,
  styles: [`
    .exemption { display: flex; flex-direction: column; gap: 0.6rem; }
    .check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.92rem; color: var(--brand-ink); font-weight: 500; }
    .reason { display: flex; flex-direction: column; gap: 0.3rem; max-width: 34rem; }
    .reason label { font-size: 0.88rem; font-weight: 500; color: var(--brand-ink); }
    .req { color: #c9473b; }
    .reason input { padding: 0.55rem 0.8rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px; font: inherit; color: var(--brand-ink); background: var(--surface-ground, #f8fafc); }
    .btn { padding: 0.45rem 1rem; border-radius: 10px; border: none; background: var(--brand-gradient); color: #fff; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .hint { color: var(--brand-muted); font-size: 0.8rem; }
  `]
})
export class UnitLateFeeExemptionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) unitId = '';
  @Input() exempt = false;
  @Input() reason: string | null = null;
  // Se guardó: la pantalla que la contiene actualiza su copia de la unidad.
  @Output() saved = new EventEmitter<{ exempt: boolean; reason: string | null }>();

  exemptValue = false;
  reasonValue = '';
  saving = false;
  private savedExempt = false;
  private savedReason = '';

  get changed(): boolean {
    return this.exemptValue !== this.savedExempt || (this.exemptValue && this.reasonValue.trim() !== this.savedReason);
  }

  ngOnChanges(): void {
    this.savedExempt = this.exempt;
    this.savedReason = this.reason ?? '';
    this.exemptValue = this.exempt;
    this.reasonValue = this.reason ?? '';
  }

  save(): void {
    const reason = this.reasonValue.trim();
    if (this.exemptValue && !reason) {
      this.msg.add({ severity: 'warn', summary: 'Falta el motivo', detail: 'Indicá por qué se exonera la unidad de la mora.', life: 5000 });
      return;
    }

    this.saving = true;
    this.api.setUnitLateFeeExemption(this.unitId, { exempt: this.exemptValue, reason: this.exemptValue ? reason : null })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: unit => {
          this.savedExempt = !!unit.lateFeeExempt;
          this.savedReason = unit.lateFeeExemptReason ?? '';
          this.exemptValue = this.savedExempt;
          this.reasonValue = this.savedReason;
          this.saving = false;
          this.msg.add({ severity: 'success', summary: this.savedExempt ? 'Unidad exonerada de mora' : 'Exoneración quitada', life: 4000 });
          this.saved.emit({ exempt: this.savedExempt, reason: unit.lateFeeExemptReason ?? null });
          this.cdr.markForCheck();
        },
        error: err => {
          this.saving = false;
          this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudo guardar la exoneración.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }
}

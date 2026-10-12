import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { LateFeeFrequencyValue, LateFeePolicy } from '../../api/building-config.models';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

// Política de mora completa: tasa y cada cuánto se suma, días de gracia, tope, mínimo, qué cargos entran en la base y cuántas unidades
// están exoneradas. Guardarla es revisarla: con la tasa vacía queda como decisión explícita de «este edificio no cobra mora».
@Component({
  standalone: true,
  selector: 'app-config-late-fee-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Message],
  template: `
    <h2>Política de mora</h2>
    <p class="muted small">Cómo se calcula el interés de los pagos atrasados. Los cambios rigen para el cálculo siguiente; lo ya cobrado no se recalcula.</p>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando...</p>

    <ng-container *ngIf="policy as p">
      <div class="notice" *ngIf="!p.confirmed">
        Todavía no revisaste esta política. Al guardarla queda confirmada; si dejás la tasa vacía, significa que <strong>este edificio no cobra mora</strong>.
      </div>

      <form class="form" (ngSubmit)="save()" #f="ngForm">
        <label class="field">
          <span>Tasa de interés (%)</span>
          <input type="number" name="rate" min="0" max="100" step="0.01" [(ngModel)]="form.ratePercentage" [disabled]="!p.canEdit" />
          <span class="hint">Vacío o en cero: el edificio no cobra mora.</span>
        </label>
        <label class="field">
          <span>Se suma cada</span>
          <select name="frequency" [(ngModel)]="form.frequency" [disabled]="!p.canEdit || !form.ratePercentage">
            <option [ngValue]="null">—</option>
            <option *ngFor="let o of frequencies" [ngValue]="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="field">
          <span>Días de gracia</span>
          <input type="number" name="grace" min="0" max="365" step="1" [(ngModel)]="form.graceDays" [disabled]="!p.canEdit" />
          <span class="hint">La mora arranca vencimiento + gracia. Rige para los períodos que se creen desde ahora.</span>
        </label>
        <label class="field">
          <span>Tope acumulado (% de la base)</span>
          <input type="number" name="cap" min="0" step="0.01" [(ngModel)]="form.capPercentage" [disabled]="!p.canEdit" />
          <span class="hint">Por unidad y período. Vacío: sin tope.</span>
        </label>
        <label class="field">
          <span>Mora mínima por intervalo (Gs.)</span>
          <input type="number" name="min" min="0" step="1" [(ngModel)]="form.minAmount" [disabled]="!p.canEdit" />
          <span class="hint">Vacío: sin mínimo.</span>
        </label>

        <div class="field wide">
          <span>Cargos que entran en la base de cálculo</span>
          <div class="checks">
            <label class="check"><input type="checkbox" checked disabled /> Expensas ordinarias y ajustes (siempre)</label>
            <label class="check"><input type="checkbox" name="reserve" [(ngModel)]="form.appliesToReserve" [disabled]="!p.canEdit" /> Aporte al fondo de reserva</label>
            <label class="check"><input type="checkbox" name="extra" [(ngModel)]="form.appliesToExtraordinary" [disabled]="!p.canEdit" /> Aportes extraordinarios</label>
            <label class="check"><input type="checkbox" name="indiv" [(ngModel)]="form.appliesToIndividual" [disabled]="!p.canEdit" /> Cargos individuales</label>
          </div>
        </div>

        <div class="actions wide" style="grid-column: 1 / -1" *ngIf="p.canEdit">
          <button type="submit" class="btn" [disabled]="saving">{{ saving ? 'Guardando...' : (p.confirmed ? 'Guardar cambios' : 'Guardar y confirmar') }}</button>
        </div>
        <p class="muted small" style="grid-column: 1 / -1" *ngIf="!p.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden editar la política de mora.</p>
      </form>

      <p class="muted small">
        Unidades exoneradas de mora: <strong>{{ p.exemptUnitCount }}</strong>.
        La exoneración se marca desde cada unidad (<a routerLink="/units">Unidades</a>) y queda con su motivo.
      </p>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES]
})
export class ConfigLateFeeSectionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';

  readonly frequencies: { value: LateFeeFrequencyValue; label: string }[] = [
    { value: 'Daily', label: 'Día' },
    { value: 'Weekly', label: 'Semana' },
    { value: 'Biweekly', label: 'Quincena' }
  ];

  policy: LateFeePolicy | null = null;
  form = this.emptyForm();
  loading = false;
  saving = false;
  error = '';

  private emptyForm() {
    return {
      ratePercentage: null as number | null, frequency: null as LateFeeFrequencyValue | null, graceDays: null as number | null,
      capPercentage: null as number | null, minAmount: null as number | null,
      appliesToReserve: true, appliesToExtraordinary: true, appliesToIndividual: true
    };
  }

  ngOnChanges(): void {
    this.load();
  }

  save(): void {
    const f = this.form;
    if (f.ratePercentage !== null && (f.ratePercentage < 0 || f.ratePercentage > 100)) return this.warn('La tasa de interés debe estar entre 0 y 100.');
    if (f.ratePercentage && !f.frequency) return this.warn('Elegí cada cuánto se suma la mora (día, semana o quincena).');
    if (f.graceDays !== null && (f.graceDays < 0 || f.graceDays > 365)) return this.warn('Los días de gracia deben estar entre 0 y 365.');
    if (f.capPercentage !== null && f.capPercentage < 0) return this.warn('El tope no puede ser negativo.');
    if (f.minAmount !== null && f.minAmount < 0) return this.warn('La mora mínima no puede ser negativa.');

    this.saving = true;
    this.api.updateLateFee(this.buildingId, {
      ratePercentage: f.ratePercentage || null,
      frequency: f.ratePercentage ? f.frequency : null,
      graceDays: f.graceDays || null,
      capPercentage: f.capPercentage || null,
      minAmount: f.minAmount || null,
      appliesToReserve: f.appliesToReserve,
      appliesToExtraordinary: f.appliesToExtraordinary,
      appliesToIndividual: f.appliesToIndividual
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: policy => {
        this.apply(policy);
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Política de mora guardada', life: 3500 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudo guardar la política de mora.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private warn(detail: string): void {
    this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail, life: 5000 });
  }

  private apply(policy: LateFeePolicy): void {
    this.policy = policy;
    this.form = {
      ratePercentage: policy.ratePercentage, frequency: policy.frequency, graceDays: policy.graceDays,
      capPercentage: policy.capPercentage, minAmount: policy.minAmount,
      appliesToReserve: policy.appliesToReserve, appliesToExtraordinary: policy.appliesToExtraordinary, appliesToIndividual: policy.appliesToIndividual
    };
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getLateFee(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: policy => {
        this.apply(policy);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.policy = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar la política de mora.');
        this.cdr.markForCheck();
      }
    });
  }
}

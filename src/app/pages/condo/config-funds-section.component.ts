import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { FundPolicy, IncomeTreatmentValue, ReserveUsePolicy } from '../../api/building-config.models';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

// Política de fondos: qué porcentaje de las expensas va al fondo de reserva y a aportes extraordinarios, qué se hace con los ingresos propios
// del edificio y quién tiene que aprobar el uso del fondo. Guardarla es revisarla: sin aportes queda como «este edificio no tiene fondos».
@Component({
  standalone: true,
  selector: 'app-config-funds-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Message],
  template: `
    <h2>Fondos</h2>
    <p class="muted small">Aportes al fondo de reserva y extraordinarios, destino de los ingresos propios del edificio y política de uso del fondo.</p>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando...</p>

    <ng-container *ngIf="policy as p">
      <div class="notice" *ngIf="!p.confirmed">
        Todavía no revisaste esta política. Al guardarla queda confirmada; si no cargás aportes, significa que <strong>este edificio no tiene aportes a fondos</strong>.
      </div>

      <form class="form" (ngSubmit)="save()">
        <label class="field">
          <span>Fondo de reserva (% de las expensas)</span>
          <input type="number" name="reserve" min="0" max="100" step="0.01" [(ngModel)]="form.reserveFundPercentage" [disabled]="!p.canEdit" />
          <span class="hint">Vacío o en cero: sin aporte al fondo de reserva.</span>
        </label>
        <label class="field">
          <span>Aporte extraordinario (%)</span>
          <input type="number" name="extra" min="0" max="100" step="0.01" [(ngModel)]="form.extraordinaryPercentage" [disabled]="!p.canEdit" />
          <span class="hint">Vacío o en cero: sin aporte extraordinario.</span>
        </label>
        <label class="field wide">
          <span>Ingresos propios del edificio (alquileres, intereses, otros)</span>
          <select name="income" [(ngModel)]="form.incomeTreatment" [disabled]="!p.canEdit">
            <option *ngFor="let o of incomeOptions" [ngValue]="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="field">
          <span>Uso del fondo de reserva</span>
          <select name="use" [(ngModel)]="form.reserveUsePolicy" [disabled]="!p.canEdit">
            <option *ngFor="let o of useOptions" [ngValue]="o.value">{{ o.label }}</option>
          </select>
        </label>
        <label class="field" *ngIf="form.reserveUsePolicy !== 'FreeUse'">
          <span>Aprobación desde (Gs.)</span>
          <input type="number" name="threshold" min="0" step="1" [(ngModel)]="form.reserveUseThreshold" [disabled]="!p.canEdit" />
          <span class="hint">Vacío: la aprobación rige para cualquier monto.</span>
        </label>

        <div class="actions" style="grid-column: 1 / -1" *ngIf="p.canEdit">
          <button type="submit" class="btn" [disabled]="saving">{{ saving ? 'Guardando...' : (p.confirmed ? 'Guardar cambios' : 'Guardar y confirmar') }}</button>
        </div>
        <p class="muted small" style="grid-column: 1 / -1" *ngIf="!p.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden editar la política de fondos.</p>
      </form>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES]
})
export class ConfigFundsSectionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';

  readonly incomeOptions: { value: IncomeTreatmentValue; label: string }[] = [
    { value: 'CreditToOwners', label: 'Acreditar a los propietarios (descuento en la expensa)' },
    { value: 'ToReserveFund', label: 'Van al fondo de reserva (no reducen la expensa)' }
  ];

  readonly useOptions: { value: ReserveUsePolicy; label: string }[] = [
    { value: 'FreeUse', label: 'Uso libre del administrador' },
    { value: 'RequiresPresidentApproval', label: 'Requiere aprobación del presidente' },
    { value: 'RequiresAssemblyApproval', label: 'Requiere aprobación de la asamblea' }
  ];

  policy: FundPolicy | null = null;
  form = {
    incomeTreatment: 'CreditToOwners' as IncomeTreatmentValue,
    reserveFundPercentage: null as number | null,
    extraordinaryPercentage: null as number | null,
    reserveUsePolicy: 'FreeUse' as ReserveUsePolicy,
    reserveUseThreshold: null as number | null
  };
  loading = false;
  saving = false;
  error = '';

  ngOnChanges(): void {
    this.load();
  }

  save(): void {
    const f = this.form;
    if (f.reserveFundPercentage !== null && (f.reserveFundPercentage < 0 || f.reserveFundPercentage > 100)) return this.warn('El porcentaje de fondo de reserva debe estar entre 0 y 100.');
    if (f.extraordinaryPercentage !== null && (f.extraordinaryPercentage < 0 || f.extraordinaryPercentage > 100)) return this.warn('El porcentaje de aporte extraordinario debe estar entre 0 y 100.');
    if (f.reserveUseThreshold !== null && f.reserveUseThreshold < 0) return this.warn('El monto desde el que rige la aprobación no puede ser negativo.');

    this.saving = true;
    this.api.updateFundPolicy(this.buildingId, {
      incomeTreatment: f.incomeTreatment,
      reserveFundPercentage: f.reserveFundPercentage || null,
      extraordinaryPercentage: f.extraordinaryPercentage || null,
      reserveUsePolicy: f.reserveUsePolicy,
      reserveUseThreshold: f.reserveUsePolicy === 'FreeUse' ? null : (f.reserveUseThreshold || null)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: policy => {
        this.apply(policy);
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Política de fondos guardada', life: 3500 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudo guardar la política de fondos.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private warn(detail: string): void {
    this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail, life: 5000 });
  }

  private apply(policy: FundPolicy): void {
    this.policy = policy;
    this.form = {
      incomeTreatment: policy.incomeTreatment,
      reserveFundPercentage: policy.reserveFundPercentage,
      extraordinaryPercentage: policy.extraordinaryPercentage,
      reserveUsePolicy: policy.reserveUsePolicy,
      reserveUseThreshold: policy.reserveUseThreshold
    };
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getFundPolicy(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: policy => {
        this.apply(policy);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.policy = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar la política de fondos.');
        this.cdr.markForCheck();
      }
    });
  }
}

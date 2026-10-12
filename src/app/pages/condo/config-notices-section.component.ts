import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { NoticeKind, NoticeRule, NoticeRules } from '../../api/building-config.models';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

const DESCRIPTIONS: Record<NoticeKind, string> = {
  BeforeDue: 'Avisa a cada propietario unos días antes de que venza su expensa.',
  OnDue: 'Avisa el día del vencimiento a quien todavía no pagó.',
  LateFeeApplied: 'Avisa cuando se le suma mora a su deuda.',
  PaymentReceived: 'Avisa cuando se registra un pago suyo.',
  PeriodPublished: 'Avisa cuando se publica la liquidación del período.'
};

// Avisos automáticos del edificio: qué avisos les llegan a los propietarios por pantalla y push, y con cuánta anticipación el aviso previo al
// vencimiento. Sin reglas guardadas rige el comportamiento por defecto (se muestra como «por defecto»).
@Component({
  standalone: true,
  selector: 'app-config-notices-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Message],
  template: `
    <h2>Avisos automáticos</h2>
    <p class="muted small">Qué avisos reciben los propietarios del edificio (en la aplicación y como notificación).</p>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando...</p>

    <ng-container *ngIf="data as d">
      <div class="rules">
        <article class="rule" *ngFor="let r of rows">
          <label class="check">
            <input type="checkbox" [(ngModel)]="r.isActive" [disabled]="!d.canEdit" />
            <strong>{{ r.label }}</strong>
            <span class="muted default" *ngIf="r.isDefault">por defecto</span>
          </label>
          <p class="muted small">{{ description(r) }}</p>
          <label class="field offset" *ngIf="r.kind === 'BeforeDue' && r.isActive">
            <span>Días de anticipación</span>
            <input type="number" min="1" max="30" step="1" [(ngModel)]="r.offsetDays" [disabled]="!d.canEdit" />
          </label>
        </article>
      </div>

      <div class="actions" *ngIf="d.canEdit">
        <button type="button" class="btn" [disabled]="saving" (click)="save()">{{ saving ? 'Guardando...' : 'Guardar avisos' }}</button>
      </div>
      <p class="muted small" *ngIf="!d.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden editar los avisos automáticos.</p>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .rules { display: grid; gap: 0.7rem; max-width: 46rem; margin-top: 0.8rem; }
    .rule { border: 1px solid var(--brand-border); border-radius: 12px; padding: 0.7rem 1rem; }
    .rule p { margin: 0.25rem 0 0 1.6rem; }
    .default { font-size: 0.78rem; font-weight: 400; }
    .offset { margin: 0.4rem 0 0 1.6rem; max-width: 12rem; }
  `]
})
export class ConfigNoticesSectionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';

  data: NoticeRules | null = null;
  rows: NoticeRule[] = [];
  loading = false;
  saving = false;
  error = '';

  description(r: NoticeRule): string { return DESCRIPTIONS[r.kind] ?? ''; }

  ngOnChanges(): void {
    this.load();
  }

  save(): void {
    const bad = this.rows.find(r => r.kind === 'BeforeDue' && r.isActive && (r.offsetDays === null || r.offsetDays < 1 || r.offsetDays > 30));
    if (bad) {
      this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail: 'Los días de anticipación del aviso previo al vencimiento deben estar entre 1 y 30.', life: 5000 });
      return;
    }

    this.saving = true;
    this.api.updateNoticeRules(this.buildingId, this.rows.map(r => ({ kind: r.kind, isActive: r.isActive, offsetDays: r.kind === 'BeforeDue' ? r.offsetDays : null })))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: data => {
          this.apply(data);
          this.saving = false;
          this.msg.add({ severity: 'success', summary: 'Avisos guardados', life: 3500 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.saving = false;
          this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudieron guardar los avisos.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  private apply(data: NoticeRules): void {
    this.data = data;
    this.rows = data.rules.map(r => ({ ...r }));
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getNoticeRules(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.apply(data);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.data = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudieron cargar los avisos.');
        this.cdr.markForCheck();
      }
    });
  }
}

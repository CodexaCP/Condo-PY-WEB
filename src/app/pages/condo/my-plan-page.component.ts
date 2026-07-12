import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingPlansApiService } from '../../api/building-plans-api.service';
import { BuildingPlanPaymentsApiService } from '../../api/building-plan-payments-api.service';
import { BuildingPlanPaymentCreateRequest, BuildingPlanStatus, BuildingPlanSummary } from '../../api/models';

const STATUS_LABEL: Record<BuildingPlanStatus, string> = {
  Active: 'Activo', ExpiringSoon: 'Por vencer', Expired: 'Vencido',
  Suspended: 'Suspendido', Archived: 'Archivado',
};
const STATUS_SEV: Record<BuildingPlanStatus, 'success' | 'warn' | 'danger' | 'secondary'> = {
  Active: 'success', ExpiringSoon: 'warn', Expired: 'danger',
  Suspended: 'danger', Archived: 'secondary',
};

@Component({
  standalone: true,
  selector: 'app-my-plan-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Mi plan</h1>
          <p>Estado del plan de suscripción activo para tu empresa.</p>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando plan...</p>

      <!-- Sin plan asignado -->
      <div class="empty-state" *ngIf="!loading && !plan && !loadError">
        <div class="empty-icon">📋</div>
        <p>No tenés ningún plan activo asignado.</p>
        <small>Contactá al administrador del sistema para que te asigne un plan.</small>
      </div>

      <!-- Error de carga -->
      <div class="empty-state" *ngIf="!loading && loadError">
        <div class="empty-icon">⚠️</div>
        <p>{{ loadError }}</p>
      </div>

      <!-- Plan card -->
      <div class="plan-card" *ngIf="plan">
        <div class="plan-header">
          <div>
            <h2 class="plan-name">{{ plan.planName }}</h2>
            <p class="plan-building">{{ plan.buildingName }}</p>
          </div>
          <p-tag [value]="statusLabel(plan.status)" [severity]="statusSev(plan.status)" styleClass="tag-lg"></p-tag>
        </div>

        <div class="plan-stats">
          <div class="stat" [class.stat-warn]="plan.daysUntilExpiry <= 5 && plan.daysUntilExpiry >= 0"
                           [class.stat-danger]="plan.daysUntilExpiry < 0">
            <span class="stat-value">{{ plan.daysUntilExpiry >= 0 ? plan.daysUntilExpiry : 0 }}</span>
            <span class="stat-label">días restantes</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ fmtDate(plan.startDate) }}</span>
            <span class="stat-label">inicio</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ fmtDate(plan.endDate) }}</span>
            <span class="stat-label">vencimiento</span>
          </div>
          <div class="stat" [class.stat-ok]="plan.isPaid" [class.stat-danger]="!plan.isPaid">
            <span class="stat-value">{{ plan.isPaid ? 'Sí' : 'No' }}</span>
            <span class="stat-label">pagado</span>
          </div>
        </div>

        <!-- Renovación programada -->
        <div class="renewal-banner" *ngIf="plan.hasRenewal">
          <span class="pi pi-refresh"></span>
          <span>Renovación programada. Está pendiente de aprobación por el administrador.</span>
        </div>

        <!-- Suspendido -->
        <div class="warn-banner" *ngIf="plan.status === 'Suspended'">
          <span class="pi pi-exclamation-triangle"></span>
          <span>Tu plan está <strong>suspendido</strong> por falta de pago. Enviá un comprobante para reactivarlo.</span>
        </div>

        <!-- Vencido / Por vencer -->
        <div class="warn-banner warn-banner-soft" *ngIf="plan.status === 'ExpiringSoon' || plan.status === 'Expired'">
          <span class="pi pi-clock"></span>
          <span *ngIf="plan.status === 'ExpiringSoon'">Tu plan vence en <strong>{{ plan.daysUntilExpiry }} día(s)</strong>. Enviá el comprobante cuanto antes.</span>
          <span *ngIf="plan.status === 'Expired'">Tu plan está vencido. Estás en el período de gracia. Enviá el comprobante para evitar la suspensión.</span>
        </div>

        <!-- Pagado y activo -->
        <div class="ok-banner" *ngIf="plan.isPaid && plan.status === 'Active'">
          <span class="pi pi-check-circle"></span>
          <span>Tu plan está al día.</span>
        </div>

        <!-- Acción principal -->
        <div class="plan-actions" *ngIf="plan.status !== 'Archived'">
          <p-button label="Enviar comprobante de pago" icon="pi pi-upload"
                    (onClick)="openPayForm()" [outlined]="plan.isPaid && plan.status === 'Active'">
          </p-button>
        </div>
      </div>
    </p-card>

    <!-- ══════════════════════════ PAY MODAL ══════════════════════════ -->
    <div class="ov-backdrop" *ngIf="payVisible" (click)="closePay()"></div>
    <div class="ov-panel" *ngIf="payVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Enviar comprobante de pago</strong>
        <button class="ov-close" (click)="closePay()">✕</button>
      </div>
      <p class="pay-hint">
        Una vez enviado, el administrador revisará el comprobante y aprobará o rechazará el pago.
        Solo podés tener un comprobante pendiente de revisión a la vez.
      </p>
      <form class="ficha-form" (ngSubmit)="submitPayment()">
        <label>
          <span>Monto declarado (Gs.) <span class="req">*</span></span>
          <input [(ngModel)]="payForm.declaredAmount" name="amount" type="number" min="1" step="1000" required />
        </label>
        <label>
          <span>Fecha del pago <span class="req">*</span></span>
          <input [(ngModel)]="payForm.paymentDate" name="payDate" type="date" required />
        </label>
        <label>
          <span>URL del comprobante</span>
          <input [(ngModel)]="payForm.comprobanteUrl" name="compUrl" type="url"
                 placeholder="https://..." maxlength="500" />
          <small>Enlace a la imagen o PDF del comprobante (Google Drive, Dropbox, etc.)</small>
        </label>
        <label>
          <span>Referencia / N° de transferencia</span>
          <input [(ngModel)]="payForm.reference" name="ref" maxlength="200"
                 placeholder="Número de transacción, cheque, etc." />
        </label>
        <div class="ficha-footer">
          <span></span>
          <p-button type="submit" [loading]="isSubmitting" label="Enviar comprobante"
                    icon="pi pi-send"></p-button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .plan-card {
      max-width: 680px; background: var(--surface-card, #fff);
      border: 1px solid rgba(19,133,182,0.12); border-radius: 20px;
      padding: 1.8rem; display: grid; gap: 1.4rem; margin-top: 0.5rem;
    }
    .plan-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .plan-name { margin: 0; font-size: 1.5rem; color: var(--brand-ink); }
    .plan-building { margin: 0.2rem 0 0; color: var(--brand-muted); font-size: 0.9rem; }
    :host ::ng-deep .tag-lg .p-tag { font-size: 0.85rem; padding: 0.3rem 0.8rem; }

    .plan-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .stat {
      background: var(--surface-ground, #f8fafc); border-radius: 14px;
      padding: 1rem; text-align: center; display: flex; flex-direction: column; gap: 0.3rem;
    }
    .stat-value { font-size: 1.35rem; font-weight: 700; color: var(--brand-ink); }
    .stat-label { font-size: 0.72rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-warn .stat-value { color: #b45309; }
    .stat-danger .stat-value { color: #dc2626; }
    .stat-ok .stat-value { color: #16a34a; }

    .renewal-banner, .warn-banner, .ok-banner {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1rem;
      border-radius: 12px; font-size: 0.9rem; line-height: 1.5;
    }
    .renewal-banner { background: rgba(59,130,246,0.08); color: #1d4ed8; }
    .warn-banner { background: rgba(220,38,38,0.07); color: #b91c1c; }
    .warn-banner-soft { background: rgba(234,179,8,0.1); color: #92400e; }
    .ok-banner { background: rgba(22,163,74,0.08); color: #15803d; }

    .plan-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }

    .empty-state {
      text-align: center; padding: 3rem 1rem; color: var(--brand-muted);
      display: grid; gap: 0.5rem;
    }
    .empty-icon { font-size: 3rem; }
    .empty-state p { margin: 0; font-size: 1rem; color: var(--brand-ink); }
    .empty-state small { font-size: 0.85rem; }

    /* OVERLAY */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px); animation: fadeIn 0.15s ease;
    }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(520px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28);
      padding: 1.6rem; animation: slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
                         to   { opacity: 1; transform: translate(-50%, -50%); } }
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size: 1.1rem; color: var(--brand-ink); }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }

    .pay-hint {
      font-size: 0.85rem; color: var(--brand-muted); margin: 0 0 1.2rem;
      background: rgba(19,133,182,0.05); border-radius: 10px; padding: 0.6rem 0.9rem; line-height: 1.6;
    }
    .ficha-form { display: grid; gap: 1rem; }
    .ficha-form label > span:first-child { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted);
                                           display: block; margin-bottom: 0.25rem; }
    .ficha-form small { font-size: 0.78rem; color: var(--brand-muted); margin-top: 0.2rem; display: block; }
    .ficha-form input {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25);
      border-radius: 10px; font: inherit; font-size: 0.95rem; color: var(--brand-ink);
      background: var(--surface-ground, #f8fafc); transition: border-color 0.15s;
    }
    .ficha-form input:focus { outline: none; border-color: var(--brand-blue); }
    .ficha-footer { display: flex; justify-content: flex-end; padding-top: 0.5rem; }
    .req { color: var(--red-400); }
  `]
})
export class MyPlanPageComponent implements OnInit {
  private readonly bpApi = inject(BuildingPlansApiService);
  private readonly payApi = inject(BuildingPlanPaymentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  plan: BuildingPlanSummary | null = null;
  loading = true;
  loadError = '';

  payVisible = false;
  payForm: Partial<BuildingPlanPaymentCreateRequest> = {};
  isSubmitting = false;

  ngOnInit(): void {
    this.bpApi.getMyPlan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: plans => {
        // Prioritize: active/expiring > expired > suspended > archived
        const priority: Record<BuildingPlanStatus, number> = { Active: 0, ExpiringSoon: 1, Expired: 2, Suspended: 3, Archived: 4 };
        this.plan = [...plans].sort((a, b) => priority[a.status] - priority[b.status])[0] ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        const status = err?.status;
        this.loadError = status === 404
          ? 'No tenés ningún plan activo asignado.'
          : status === 403
          ? 'No tenés acceso a esta sección.'
          : 'No se pudo cargar el plan.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openPayForm(): void {
    if (!this.plan) return;
    this.payForm = {
      buildingPlanId: this.plan.id,
      declaredAmount: 0,
      paymentDate: new Date().toISOString().substring(0, 10),
      comprobanteUrl: '',
      reference: '',
    };
    this.payVisible = true;
  }

  closePay(): void { this.payVisible = false; }

  submitPayment(): void {
    if (this.isSubmitting) return;
    const { buildingPlanId, declaredAmount, paymentDate, comprobanteUrl, reference } = this.payForm;
    if (!buildingPlanId || !declaredAmount || declaredAmount <= 0) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El monto debe ser mayor a cero.', life: 5000 });
      return;
    }
    if (!paymentDate) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La fecha de pago es obligatoria.', life: 5000 });
      return;
    }
    this.isSubmitting = true;
    const req: BuildingPlanPaymentCreateRequest = {
      buildingPlanId,
      declaredAmount,
      paymentDate,
      ...(comprobanteUrl?.trim() ? { comprobanteUrl: comprobanteUrl.trim() } : {}),
      ...(reference?.trim() ? { reference: reference.trim() } : {}),
    };
    this.payApi.submit(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.payVisible = false;
        this.msg.add({
          severity: 'success', summary: 'Comprobante enviado',
          detail: 'El administrador revisará tu comprobante y recibirás una notificación con el resultado.',
          life: 7000
        });
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo enviar el comprobante.'), life: 6000 });
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  statusLabel(s: BuildingPlanStatus): string { return STATUS_LABEL[s] ?? s; }
  statusSev(s: BuildingPlanStatus): 'success' | 'warn' | 'danger' | 'secondary' { return STATUS_SEV[s] ?? 'secondary'; }

  fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AuthService } from '../../auth/auth.service';
import { InvoicesApiService } from '../../api/invoices-api.service';
import { OwnerPaymentsApiService } from '../../api/owner-payments-api.service';
import { OwnerPayment } from '../../api/models';

const STATUS_LABELS: Record<string, string> = {
  Pending:     'Pendiente',
  UnderReview: 'En Revisión',
  Approved:    'Aprobado',
  Rejected:    'Rechazado'
};

const STATUS_SEVERITY: Record<string, 'warn' | 'info' | 'success' | 'danger' | 'secondary'> = {
  Pending:     'warn',
  UnderReview: 'info',
  Approved:    'success',
  Rejected:    'danger'
};

@Component({
  standalone: true,
  selector: 'app-owner-payment-detail-page',
  imports: [CommonModule, FormsModule, Button, Card, InputNumber, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <!-- Header -->
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Detalle de Pago</h1>
            <p class="monospace">{{ payment?.reference || 'Cargando...' }}</p>
          </div>
        </div>
        <p-button label="Volver" icon="pi pi-arrow-left" severity="secondary" (onClick)="goBack()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p-message *ngIf="actionError" severity="error" [text]="actionError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando pago...</p>

      <div *ngIf="payment && !loading">

        <!-- Estado -->
        <div class="status-row">
          <p-tag
            [value]="statusLabel(payment.status)"
            [severity]="statusSeverity(payment.status)"
            styleClass="status-tag">
          </p-tag>
          <span *ngIf="payment.resolvedAt" class="resolved-date">
            {{ payment.status === 'Approved' ? 'Aprobado' : 'Rechazado' }} el
            {{ payment.resolvedAt | date:'dd/MM/yyyy HH:mm' }}
          </span>
        </div>

        <!-- Datos del pago -->
        <div class="form-section">
          <h3>Datos del pago</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Propietario</label>
              <span>{{ payment.ownerFullName }}</span>
            </div>
            <div class="detail-item">
              <label>Referencia</label>
              <span class="monospace">{{ payment.reference }}</span>
            </div>
            <div class="detail-item">
              <label>Fecha del comprobante</label>
              <span>{{ payment.paymentDate | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-item">
              <label>Monto declarado</label>
              <span class="amount">{{ payment.declaredAmount | number:'1.0-2' }}</span>
            </div>
            <div class="detail-item" *ngIf="payment.reviewedAmount !== null">
              <label>Monto revisado</label>
              <span class="amount highlight">{{ payment.reviewedAmount | number:'1.0-2' }}</span>
            </div>
            <div class="detail-item">
              <label>Enviado el</label>
              <span>{{ payment.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <div class="detail-item" *ngIf="payment.reviewedByUserFullName">
              <label>Revisado por</label>
              <span>{{ payment.reviewedByUserFullName }}</span>
            </div>
          </div>
        </div>

        <!-- Facturación: una factura por unidad con todo lo aplicado (capital + mora) -->
        <div class="form-section action-section" *ngIf="payment.status === 'Approved' && canInvoice">
          <h3>Facturación</h3>
          <p class="action-hint">
            Prepara un borrador de factura por unidad con lo que cubrió este pago (expensas y mora).
            Luego lo emitís desde Facturación → Facturas.
          </p>
          <div class="action-buttons">
            <p-button
              label="Generar facturas"
              icon="pi pi-file-edit"
              severity="success"
              (onClick)="createInvoiceDrafts()"
              [loading]="creatingInvoices">
            </p-button>
          </div>
        </div>

        <!-- Saldo a favor del propietario -->
        <div class="form-section credit-section" *ngIf="ownerCredit !== null">
          <h3>Saldo a favor del propietario</h3>
          <div class="credit-box" [class.credit-positive]="ownerCredit > 0" [class.credit-zero]="ownerCredit === 0">
            <i class="pi" [class]="ownerCredit > 0 ? 'pi-check-circle' : 'pi-minus-circle'"></i>
            <div class="credit-text">
              <span class="credit-amount">{{ ownerCredit | number:'1.0-2' }} Gs.</span>
              <span class="credit-hint">{{ ownerCredit > 0 ? 'El excedente quedó como crédito a favor.' : 'Sin saldo a favor.' }}</span>
            </div>
            <p-button
              *ngIf="ownerCredit > 0"
              label="Aplicar saldo"
              icon="pi pi-bolt"
              severity="success"
              size="small"
              [loading]="applyingCredit"
              (onClick)="doApplyCredit()">
            </p-button>
          </div>
        </div>

        <!-- Comprobante -->
        <div class="form-section">
          <h3>Comprobante</h3>
          <a *ngIf="payment.comprobanteUrl" [href]="payment.comprobanteUrl" target="_blank" rel="noopener" class="comprobante-link">
            <i class="pi pi-external-link"></i>&nbsp; Ver comprobante
          </a>
          <span *ngIf="!payment.comprobanteUrl" class="no-comprobante">Sin comprobante adjunto.</span>
        </div>

        <!-- Unidades -->
        <div class="form-section">
          <h3>Unidades incluidas</h3>
          <div class="app-list" *ngIf="payment.units.length">
            <div class="app-row header grid-units">
              <span>Unidad</span>
              <span>Edificio</span>
              <span class="right">Monto asignado</span>
            </div>
            <div class="app-row grid-units" *ngFor="let u of payment.units">
              <span class="monospace">{{ u.unitCode }}</span>
              <span>{{ u.buildingName }}</span>
              <span class="right amount">{{ u.allocatedAmount | number:'1.0-2' }}</span>
            </div>
          </div>
          <p *ngIf="!payment.units.length" class="app-state">Sin unidades registradas.</p>
        </div>

        <!-- Acción: PENDIENTE → Introducir monto y marcar en revisión -->
        <div class="form-section action-section" *ngIf="payment.status === 'Pending'">
          <h3>Revisar pago</h3>
          <p class="action-hint">
            Introduce el monto que refleja el comprobante y marca el pago como en revisión.
          </p>
          <div class="action-row">
            <label class="field-label">Monto del comprobante <span class="required">*</span></label>
            <p-inputNumber
              [(ngModel)]="reviewedAmount"
              [min]="0.01"
              mode="decimal"
              [minFractionDigits]="2"
              [maxFractionDigits]="2"
              placeholder="0.00"
              styleClass="amount-input">
            </p-inputNumber>
            <p-button
              label="Marcar en revisión"
              icon="pi pi-search"
              severity="info"
              (onClick)="doReview()"
              [loading]="saving"
              [disabled]="!reviewedAmount || reviewedAmount <= 0">
            </p-button>
          </div>
        </div>

        <!-- Acción: EN REVISIÓN → Aprobar o Rechazar -->
        <div class="form-section action-section" *ngIf="payment.status === 'UnderReview'">
          <h3>Resolución</h3>
          <p class="action-hint">
            Monto revisado: <strong>{{ payment.reviewedAmount | number:'1.0-2' }}</strong>
          </p>
          <div class="action-buttons">
            <p-button
              label="Aprobar"
              icon="pi pi-check"
              severity="success"
              (onClick)="doApprove()"
              [loading]="saving">
            </p-button>
            <p-button
              label="Rechazar"
              icon="pi pi-times"
              severity="danger"
              [outlined]="!showRejectForm"
              (onClick)="toggleRejectForm()">
            </p-button>
          </div>

          <div class="reject-form" *ngIf="showRejectForm">
            <label class="field-label">Motivo de rechazo <span class="required">*</span></label>
            <textarea
              [(ngModel)]="rejectionReason"
              rows="4"
              maxlength="500"
              placeholder="Describe el motivo del rechazo (obligatorio, máx. 500 caracteres)..."
              class="reject-textarea">
            </textarea>
            <div class="reject-actions">
              <span class="char-count">{{ rejectionReason.length }}/500</span>
              <p-button
                label="Confirmar rechazo"
                icon="pi pi-times-circle"
                severity="danger"
                (onClick)="doReject()"
                [loading]="saving"
                [disabled]="!rejectionReason.trim()">
              </p-button>
            </div>
          </div>
        </div>

        <!-- Motivo de rechazo (solo lectura) -->
        <div class="form-section" *ngIf="payment.status === 'Rejected' && payment.rejectionReason">
          <h3>Motivo de rechazo</h3>
          <p class="rejection-text">{{ payment.rejectionReason }}</p>
        </div>

      </div>
    </p-card>
  `,
  styles: [`
    .status-row      { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .status-tag      { font-size: 0.95rem; }
    .resolved-date   { font-size: 0.85rem; color: var(--brand-muted); }

    .detail-grid     { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem 2rem; }
    .detail-item     { display: flex; flex-direction: column; gap: 0.2rem; }
    .detail-item label { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .detail-item span  { font-size: 0.95rem; }

    .monospace       { font-family: monospace; }
    .amount          { font-weight: 700; font-family: monospace; }
    .highlight       { color: var(--p-primary-color); }
    .right           { text-align: right; }

    .comprobante-link {
      display: inline-flex; align-items: center; gap: 0.4rem;
      color: var(--p-primary-color); font-weight: 600; font-size: 0.95rem;
      text-decoration: none; padding: 0.5rem 1rem; border: 1.5px solid var(--p-primary-color);
      border-radius: 6px; transition: all 0.15s;
    }
    .comprobante-link:hover { background: color-mix(in srgb, var(--p-primary-color) 8%, transparent); }

    .grid-units      { grid-template-columns: 0.8fr 1.5fr 1fr; }

    .action-section  { border-top: 2px solid var(--p-surface-200); padding-top: 1.2rem; }
    .action-hint     { color: var(--brand-muted); font-size: 0.9rem; margin-bottom: 1rem; }
    .field-label     { font-weight: 600; font-size: 0.88rem; margin-bottom: 0.4rem; display: block; }
    .required        { color: var(--p-red-500); }
    .action-row      { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
    .amount-input    { width: 14rem; }

    .action-buttons  { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }

    .reject-form     {
      margin-top: 1rem; padding: 1rem; border-radius: 8px;
      background: color-mix(in srgb, var(--p-red-500) 5%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-500) 25%, transparent);
    }
    .reject-textarea {
      width: 100%; box-sizing: border-box; padding: 0.6rem 0.8rem;
      border: 1px solid var(--p-surface-400); border-radius: 6px; resize: vertical;
      font-family: inherit; font-size: 0.9rem; margin-bottom: 0.75rem;
      background: var(--p-surface-0);
    }
    .reject-textarea:focus { outline: none; border-color: var(--p-primary-color); }
    .reject-actions  { display: flex; justify-content: space-between; align-items: center; }
    .char-count      { font-size: 0.8rem; color: var(--brand-muted); }

    .credit-box {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.75rem 1rem; border-radius: 8px; flex-wrap: wrap;
    }
    .credit-positive { background: color-mix(in srgb, var(--p-green-500) 10%, transparent); border-left: 3px solid var(--p-green-500); }
    .credit-positive .pi, .credit-positive .credit-amount { color: var(--p-green-700); }
    .credit-zero { background: var(--p-surface-100); border-left: 3px solid var(--p-surface-400); }
    .credit-zero .pi, .credit-zero .credit-amount { color: var(--brand-muted); }
    .credit-text   { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; }
    .credit-amount { font-family: monospace; font-size: 1.1rem; font-weight: 700; }
    .credit-hint   { font-size: 0.82rem; color: var(--brand-muted); }
    .no-comprobante { font-size: 0.88rem; color: var(--brand-muted); }

    .rejection-text  {
      padding: 0.75rem 1rem; border-radius: 6px;
      background: color-mix(in srgb, var(--p-red-500) 8%, transparent);
      border-left: 3px solid var(--p-red-500); font-size: 0.92rem;
    }

    @media (max-width: 600px) {
      .detail-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class OwnerPaymentDetailPageComponent implements OnInit {
  private readonly api        = inject(OwnerPaymentsApiService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly msgSvc     = inject(MessageService);
  private readonly invoicesApi = inject(InvoicesApiService);
  private readonly auth       = inject(AuthService);

  payment:        OwnerPayment | null = null;
  ownerCredit:    number | null = null;
  loading         = true;
  saving          = false;
  applyingCredit  = false;
  pageError       = '';
  actionError     = '';
  reviewedAmount: number | null = null;
  showRejectForm  = false;
  creatingInvoices = false;
  rejectionReason = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: p => {
          this.payment = p;
          this.loading = false;
          this.cdr.markForCheck();
          this.loadCredit(p.ownerId);
        },
        error: () => {
          this.pageError = 'No se pudo cargar el pago.';
          this.loading   = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadCredit(ownerId: string): void {
    this.api.getOwnerCredit(ownerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => { this.ownerCredit = dto.amount; this.cdr.markForCheck(); },
        error: ()  => {}
      });
  }

  doReview(): void {
    if (!this.payment || !this.reviewedAmount || this.reviewedAmount <= 0) return;
    this.saving      = true;
    this.actionError = '';
    this.api.review(this.payment.id, { reviewedAmount: this.reviewedAmount })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.payment = updated;
          this.saving  = false;
          this.msgSvc.add({ severity: 'success', summary: 'Pago en revisión', detail: 'Estado actualizado correctamente.' });
          this.cdr.markForCheck();
        },
        error: err => {
          this.actionError = extractApiErrorMessage(err, 'Error al actualizar el estado.');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  doApprove(): void {
    if (!this.payment) return;
    this.saving      = true;
    this.actionError = '';
    this.api.approve(this.payment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.payment = updated;
          this.saving  = false;
          this.msgSvc.add({ severity: 'success', summary: 'Pago aprobado', detail: 'La deuda ha sido liquidada automáticamente.' });
          this.cdr.markForCheck();
        },
        error: err => {
          this.actionError = extractApiErrorMessage(err, 'Error al aprobar el pago.');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  doReject(): void {
    if (!this.payment || !this.rejectionReason.trim()) return;
    this.saving      = true;
    this.actionError = '';
    this.api.reject(this.payment.id, { rejectionReason: this.rejectionReason.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.payment        = updated;
          this.showRejectForm = false;
          this.saving         = false;
          this.msgSvc.add({ severity: 'warn', summary: 'Pago rechazado', detail: 'El propietario será notificado.' });
          this.cdr.markForCheck();
        },
        error: err => {
          this.actionError = extractApiErrorMessage(err, 'Error al rechazar el pago.');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  doApplyCredit(): void {
    if (!this.payment) return;
    this.applyingCredit = true;
    this.actionError = '';
    this.api.applyCredit(this.payment.ownerId.toString())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.ownerCredit = result.remainingCredit;
          this.applyingCredit = false;
          this.msgSvc.add({
            severity: 'success',
            summary: 'Saldo aplicado',
            detail: `Se liquidaron ${result.chargesSettled} cargo(s) por ${result.settledAmount.toLocaleString('es-PY')} Gs. Saldo restante: ${result.remainingCredit.toLocaleString('es-PY')} Gs.`
          });
          this.cdr.markForCheck();
        },
        error: err => {
          this.actionError = extractApiErrorMessage(err, 'Error al aplicar el saldo.');
          this.applyingCredit = false;
          this.cdr.markForCheck();
        }
      });
  }

  toggleRejectForm(): void {
    this.showRejectForm = !this.showRejectForm;
    if (!this.showRejectForm) this.rejectionReason = '';
  }

  goBack(): void { this.router.navigate(['/owner-payments']); }

  // Quien puede facturar: SuperAdmin, CompanyAdmin y BuildingManager (el operador no).
  get canInvoice(): boolean {
    return this.auth.hasRole('SuperAdmin', 'CompanyAdmin', 'BuildingManager');
  }

  createInvoiceDrafts(): void {
    if (!this.payment) return;
    this.creatingInvoices = true;
    this.actionError = '';
    this.invoicesApi.createDraftsFromOwnerPayment(this.payment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: drafts => {
          this.creatingInvoices = false;
          this.msgSvc.add({
            severity: 'success',
            summary: 'Facturas preparadas',
            detail: drafts.length === 1 ? 'Se creó 1 borrador de factura.' : `Se crearon ${drafts.length} borradores de factura (uno por unidad).`
          });
          this.router.navigate(['/invoices']);
        },
        error: err => {
          this.creatingInvoices = false;
          this.actionError = extractApiErrorMessage(err, 'No se pudieron preparar las facturas.');
          this.cdr.markForCheck();
        }
      });
  }

  statusLabel(status: string): string { return STATUS_LABELS[status] ?? status; }
  statusSeverity(status: string): 'warn' | 'info' | 'success' | 'danger' | 'secondary' {
    return STATUS_SEVERITY[status] ?? 'secondary';
  }
}

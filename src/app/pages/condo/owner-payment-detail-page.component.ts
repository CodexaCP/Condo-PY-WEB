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
import { InvoiceSeriesApiService } from '../../api/invoice-series-api.service';
import { InvoicesApiService } from '../../api/invoices-api.service';
import { OwnerPaymentsApiService } from '../../api/owner-payments-api.service';
import { InvoiceLedgerRow, InvoiceSeries, OwnerPayment } from '../../api/models';

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
            Prepara un borrador de factura por comprobante (unidad y período) con lo que cubrió este pago (expensas y mora).
            Desde aquí las emitís y, si hace falta, las anulás. Para consultar todas las facturas, entrá a Facturación → Facturas.
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

          <div class="pay-invoices" *ngIf="paymentInvoices.length > 0">
            <div class="inv-card" *ngFor="let inv of paymentInvoices"
                 [class.inv-issued]="inv.status === 'Issued'"
                 [class.inv-voided]="inv.status === 'Voided'"
                 [class.inv-draft]="inv.status === 'Draft'">

              <div class="inv-top">
                <div class="inv-id">
                  <strong class="inv-number">{{ inv.numeroFormateado || 'Borrador sin numerar' }}</strong>
                  <span class="inv-sub">
                    <i class="pi pi-building"></i> Unidad {{ inv.unitCode }}
                    <i class="inv-sep"></i>
                    <i class="pi pi-calendar"></i> Período {{ inv.periodYear }}-{{ inv.periodMonth < 10 ? '0' : '' }}{{ inv.periodMonth }}
                  </span>
                </div>

                <span class="inv-status"><i class="inv-status-dot"></i>{{ invoiceStatusLabel(inv.status) }}</span>

                <div class="inv-amount">
                  <small>Monto</small>
                  <strong>{{ formatGs(inv.montoTotal) }}</strong>
                </div>

                <div class="inv-btns">
                  <a class="inv-btn" [href]="invoicePdfUrl(inv.id)" target="_blank">
                    <i class="pi pi-file-pdf"></i> PDF
                  </a>
                  <button type="button" class="inv-btn inv-btn-danger" *ngIf="inv.status === 'Issued'" (click)="askVoid(inv)">
                    <i class="pi pi-times"></i> Anular
                  </button>
                </div>
              </div>

              <div class="inv-panel" *ngIf="inv.status === 'Draft'">
                <p class="inv-note" *ngIf="seriesFor(inv).length === 0">
                  <i class="pi pi-info-circle"></i> No hay un timbrado activo y vigente para este edificio.
                </p>
                <div class="inv-emit" *ngIf="seriesFor(inv).length > 0">
                  <select [(ngModel)]="emitSeriesByInvoice[inv.id]" [name]="'series-' + inv.id">
                    <option value="" disabled selected>Seleccionar timbrado</option>
                    <option *ngFor="let sr of seriesFor(inv)" [value]="sr.id">{{ sr.establecimiento }}-{{ sr.puntoExpedicion }}-{{ sr.numeroTimbrado }} ({{ sr.numerosDisponibles }} disponibles)</option>
                  </select>
                  <p-button label="Emitir factura" icon="pi pi-send" size="small" (onClick)="emitInvoice(inv)"
                            [loading]="emittingId === inv.id" [disabled]="!emitSeriesByInvoice[inv.id]"></p-button>
                </div>
              </div>

              <div class="inv-panel inv-panel-danger" *ngIf="voidTargetId === inv.id">
                <label class="inv-void-label">Motivo de la anulación <em>*</em></label>
                <textarea [(ngModel)]="voidReason" [name]="'void-' + inv.id" rows="2" placeholder="Ej: error en los datos del cliente, se reemite con nuevo número"></textarea>
                <div class="inv-void-actions">
                  <p-button label="Cancelar" severity="secondary" [outlined]="true" size="small" (onClick)="askVoid(inv)"></p-button>
                  <p-button label="Confirmar anulación" icon="pi pi-times" severity="danger" size="small"
                            (onClick)="voidInvoice(inv)" [loading]="voidingId === inv.id"></p-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Saldo a favor del propietario -->
        <div class="form-section credit-section" *ngIf="showCredit && ownerCredit !== null">
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

    .pay-invoices { margin-top: 1.1rem; display: grid; gap: 0.75rem; }
    .inv-card { background: #fff; border: 1px solid rgba(20,54,61,0.12); border-left: 4px solid #f59e0b; border-radius: 14px; padding: 0.9rem 1.1rem; box-shadow: 0 1px 2px rgba(15,40,60,0.04); transition: box-shadow .15s; }
    .inv-card:hover { box-shadow: 0 6px 18px rgba(15,40,60,0.08); }
    .inv-card.inv-issued { border-left-color: #16a34a; }
    .inv-card.inv-voided { border-left-color: #dc2626; background: #fffafa; }
    .inv-top { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 1.1rem; }
    .inv-id { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .inv-number { font-size: 1.05rem; color: #14363d; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
    .inv-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; color: #637b88; font-size: 0.82rem; }
    .inv-sub .pi { font-size: 0.78rem; opacity: 0.8; }
    .inv-sep { width: 4px; height: 4px; border-radius: 50%; background: #b8c7cf; display: inline-block; margin: 0 0.25rem; }
    .inv-status { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.28rem 0.7rem; border-radius: 999px; font-size: 0.76rem; font-weight: 700; background: rgba(245,158,11,0.14); color: #92400e; white-space: nowrap; }
    .inv-status-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; }
    .inv-issued .inv-status { background: rgba(22,163,74,0.13); color: #166534; }
    .inv-voided .inv-status { background: #fee2e2; color: #991b1b; }
    .inv-amount { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15; }
    .inv-amount small { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #8a9ba5; }
    .inv-amount strong { font-size: 1.15rem; color: #14363d; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .inv-voided .inv-amount strong { text-decoration: line-through; color: #8a9ba5; }
    .inv-btns { display: flex; gap: 0.45rem; }
    .inv-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.42rem 0.8rem; border-radius: 10px; border: 1.5px solid rgba(20,54,61,0.16); background: #fff; color: #14363d; font-size: 0.82rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: background .12s, border-color .12s; }
    .inv-btn:hover { background: rgba(19,133,182,0.07); border-color: rgba(19,133,182,0.4); }
    .inv-btn .pi { font-size: 0.85rem; }
    .inv-btn-danger { color: #b91c1c; border-color: rgba(220,38,38,0.35); }
    .inv-btn-danger:hover { background: rgba(220,38,38,0.07); border-color: #dc2626; }
    .inv-panel { margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px dashed rgba(20,54,61,0.16); }
    .inv-emit { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .inv-emit select { flex: 1; min-width: 240px; padding: 0.5rem 0.7rem; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; background: #fff; font-size: 0.9rem; }
    .inv-note { margin: 0; display: flex; align-items: center; gap: 0.4rem; color: #92400e; font-size: 0.85rem; }
    .inv-panel-danger { display: grid; gap: 0.5rem; }
    .inv-void-label { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #991b1b; }
    .inv-void-label em { color: #dc2626; font-style: normal; }
    .inv-panel-danger textarea { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid rgba(220,38,38,0.4); border-radius: 10px; font: inherit; background: rgba(220,38,38,0.03); resize: vertical; }
    .inv-void-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    @media (max-width: 720px) {
      .inv-top { grid-template-columns: 1fr auto; }
      .inv-status { justify-self: start; }
      .inv-amount { align-items: flex-end; }
      .inv-btns { grid-column: 1 / -1; }
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
  private readonly seriesApi = inject(InvoiceSeriesApiService);
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
  paymentInvoices: InvoiceLedgerRow[] = [];
  allSeries: InvoiceSeries[] = [];
  emitSeriesByInvoice: Record<string, string> = {};
  emittingId = '';
  voidingId = '';
  voidReason = '';
  voidTargetId = '';
  // El saldo a favor está deshabilitado por ahora: cada pago cubre comprobantes completos, sin excedente.
  readonly showCredit = false;
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
          this.loadPaymentInvoices();
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

  // Facturas de este pago (borrador, emitidas, anuladas): desde aquí se emiten y anulan. La página
  // Facturas es solo de consulta.
  loadPaymentInvoices(): void {
    if (!this.payment || this.payment.status !== 'Approved' || !this.canInvoice) return;
    this.invoicesApi.getLedger({ ownerPaymentId: this.payment.id, pageSize: 200, sortBy: 'periodo', sortDir: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ledger => { this.paymentInvoices = ledger.items; this.cdr.markForCheck(); },
        error: () => {}
      });
    if (this.allSeries.length === 0) {
      this.seriesApi.getAll().pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: series => { this.allSeries = series; this.cdr.markForCheck(); }, error: () => {} });
    }
  }

  seriesFor(invoice: InvoiceLedgerRow): InvoiceSeries[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.allSeries.filter(x =>
      x.buildingId === invoice.buildingId && x.activo && x.numerosDisponibles > 0 &&
      x.vigenciaDesde <= today && x.vigenciaHasta >= today);
  }

  emitInvoice(invoice: InvoiceLedgerRow): void {
    const seriesId = this.emitSeriesByInvoice[invoice.id];
    if (!seriesId || this.emittingId) return;
    this.emittingId = invoice.id;
    this.invoicesApi.emit(invoice.id, seriesId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.emittingId = '';
        this.msgSvc.add({ severity: 'success', summary: 'Emitida', detail: `Factura ${updated.numeroFormateado} emitida.`, life: 5000 });
        this.loadPaymentInvoices();
      },
      error: err => {
        this.emittingId = '';
        this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo emitir la factura.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  askVoid(invoice: InvoiceLedgerRow): void {
    this.voidTargetId = this.voidTargetId === invoice.id ? '' : invoice.id;
    this.voidReason = '';
  }

  voidInvoice(invoice: InvoiceLedgerRow): void {
    if (this.voidingId) return;
    if (!this.voidReason.trim()) {
      this.msgSvc.add({ severity: 'error', summary: 'Error', detail: 'El motivo de anulación es obligatorio.', life: 5000 });
      return;
    }
    this.voidingId = invoice.id;
    this.invoicesApi.void(invoice.id, this.voidReason.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.voidingId = '';
        this.voidTargetId = '';
        this.voidReason = '';
        this.msgSvc.add({ severity: 'info', summary: 'Anulada', detail: 'Factura anulada. Se generó un borrador sucesor para reemitir.', life: 6000 });
        this.loadPaymentInvoices();
      },
      error: err => {
        this.voidingId = '';
        this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo anular la factura.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  invoiceStatusLabel(status: string): string {
    return status === 'Issued' ? 'Emitida' : status === 'Voided' ? 'Anulada' : 'Borrador';
  }

  invoicePdfUrl(id: string): string {
    return this.invoicesApi.getPdfUrl(id, this.auth.getToken() ?? '');
  }

  formatGs(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
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
          this.loadPaymentInvoices();
          this.cdr.markForCheck();
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

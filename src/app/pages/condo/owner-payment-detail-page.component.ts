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
import { CreditNotesApiService } from '../../api/credit-notes-api.service';
import { UploadsApiService } from '../../api/uploads-api.service';
import {
  AdjustableCharge,
  CreditNote,
  CreditNoteAttachment,
  CreditNoteAttachmentKind,
  InvoiceLedgerRow,
  InvoiceSeries,
  OwnerPayment,
  RegisterCreditNoteFiscalDataRequest
} from '../../api/models';

const CREDIT_NOTE_STATUS_LABELS: Record<string, string> = {
  Draft: 'Borrador',
  Approved: 'Aprobada',
  Rejected: 'Rechazada',
  Voided: 'Anulada'
};

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

              <!-- Notas de crédito: ajustes sobre esta factura emitida, sin modificarla -->
              <div class="inv-panel cn-section" *ngIf="inv.status === 'Issued' && canCreateCreditNotesRole">
                <div class="cn-header">
                  <strong>Notas de crédito</strong>
                  <p-button label="Nueva NC" icon="pi pi-plus" size="small" [outlined]="true"
                            (onClick)="toggleNewCreditNote(inv)"></p-button>
                </div>

                <div class="cn-list" *ngIf="(creditNotesByInvoice[inv.id]?.length ?? 0) > 0">
                  <div class="cn-card" *ngFor="let cn of creditNotesByInvoice[inv.id]"
                       [class.cn-approved]="cn.status === 'Approved'"
                       [class.cn-rejected]="cn.status === 'Rejected'"
                       [class.cn-voided]="cn.status === 'Voided'">
                    <div class="cn-top">
                      <span class="cn-status" [class]="'cn-status-' + cn.status.toLowerCase()">{{ creditNoteStatusLabel(cn.status) }}</span>
                      <strong class="cn-amount">-{{ formatGs(cn.amount) }}</strong>
                    </div>
                    <p class="cn-motivo">{{ cn.motivo }}</p>
                    <p class="cn-meta">Creada por {{ cn.createdByName }} el {{ cn.createdAtUtc | date:'dd/MM/yyyy' }}
                      · <a [href]="creditNotePdfUrl(cn.id)" target="_blank" rel="noopener"><i class="pi pi-file-pdf"></i> PDF</a></p>

                    <ul class="cn-lines">
                      <li *ngFor="let l of cn.lines">{{ l.chargeConcept }}: -{{ formatGs(l.amount) }}</li>
                    </ul>

                    <p class="cn-rejection" *ngIf="cn.status === 'Rejected' && cn.rejectionReason">Motivo de rechazo: {{ cn.rejectionReason }}</p>
                    <p class="cn-rejection" *ngIf="cn.status === 'Voided' && cn.voidReason">Motivo de anulación: {{ cn.voidReason }}</p>

                    <div class="cn-actions" *ngIf="cn.status === 'Draft' && canApproveCreditNotesRole">
                      <p-button label="Aprobar" icon="pi pi-check" size="small" severity="success"
                                (onClick)="askApproveCreditNote(cn)"></p-button>
                      <p-button label="Rechazar" icon="pi pi-times" size="small" severity="danger" [outlined]="true"
                                (onClick)="askRejectCreditNote(cn)"></p-button>
                    </div>
                    <div class="cn-reason-form" *ngIf="cnApproveTargetId === cn.id">
                      <p class="cn-note" *ngIf="creditNoteSeriesFor(cn.buildingId).length === 0">
                        No hay timbrado activo de notas de crédito para este edificio. Cargá uno en Facturación → Timbrados antes de aprobar.
                      </p>
                      <div class="cn-emit-row" *ngIf="creditNoteSeriesFor(cn.buildingId).length > 0">
                        <select [(ngModel)]="cnApproveSeriesByCn[cn.id]" [name]="'cn-approve-series-' + cn.id">
                          <option value="" disabled selected>Seleccionar timbrado</option>
                          <option *ngFor="let sr of creditNoteSeriesFor(cn.buildingId)" [value]="sr.id">{{ sr.establecimiento }}-{{ sr.puntoExpedicion }}-{{ sr.numeroTimbrado }} ({{ sr.numerosDisponibles }} disponibles)</option>
                        </select>
                        <p-button label="Confirmar aprobación" size="small" severity="success" (onClick)="approveCreditNote(cn)"
                                  [loading]="cnActionId === cn.id" [disabled]="!cnApproveSeriesByCn[cn.id]"></p-button>
                      </div>
                    </div>
                    <div class="cn-reason-form" *ngIf="cnRejectTargetId === cn.id">
                      <textarea [(ngModel)]="cnRejectReason" [name]="'cn-reject-' + cn.id" rows="2" placeholder="Motivo de rechazo (obligatorio)"></textarea>
                      <p-button label="Confirmar rechazo" size="small" severity="danger"
                                (onClick)="rejectCreditNote(cn)" [loading]="cnActionId === cn.id"></p-button>
                    </div>

                    <p class="cn-emit-issued" *ngIf="cn.numero">
                      <i class="pi pi-check-circle"></i> Numerada: {{ cn.fiscalNumero }} (timbrado {{ cn.fiscalTimbrado }})
                    </p>

                    <div class="cn-actions" *ngIf="cn.status === 'Approved' && canApproveCreditNotesRole">
                      <p-button label="Anular NC" icon="pi pi-times" size="small" severity="danger" [outlined]="true"
                                (onClick)="askVoidCreditNote(cn)"></p-button>
                    </div>
                    <div class="cn-reason-form" *ngIf="cnVoidTargetId === cn.id">
                      <textarea [(ngModel)]="cnVoidReason" [name]="'cn-void-' + cn.id" rows="2" placeholder="Motivo de anulación (obligatorio)"></textarea>
                      <p-button label="Confirmar anulación" size="small" severity="danger"
                                (onClick)="voidCreditNote(cn)" [loading]="cnActionId === cn.id"></p-button>
                    </div>

                    <div class="cn-fiscal">
                      <button type="button" class="cn-fiscal-toggle" (click)="toggleFiscalForm(cn)">
                        <i class="pi" [class.pi-chevron-down]="cnFiscalTargetId !== cn.id" [class.pi-chevron-up]="cnFiscalTargetId === cn.id"></i>
                        Datos complementarios{{ cn.fiscalNumero ? ' (' + cn.fiscalNumero + ')' : '' }}
                      </button>
                      <div class="cn-fiscal-form" *ngIf="cnFiscalTargetId === cn.id">
                        <div class="cn-fiscal-row">
                          <select [(ngModel)]="cnFiscalForm.documentType" [name]="'cn-doctype-' + cn.id">
                            <option [ngValue]="null">Tipo de documento</option>
                            <option value="Paper">Papel</option>
                            <option value="Electronic">Electrónica</option>
                          </select>
                          <input type="text" [(ngModel)]="cnFiscalForm.cdc" [name]="'cn-cdc-' + cn.id" placeholder="CDC" *ngIf="cnFiscalForm.documentType === 'Electronic'">
                        </div>
                        <div class="cn-fiscal-row">
                          <input type="text" [(ngModel)]="cnFiscalForm.estado" [name]="'cn-estado-' + cn.id" placeholder="Estado">
                        </div>
                        <textarea [(ngModel)]="cnFiscalForm.observaciones" [name]="'cn-obs-' + cn.id" rows="2" placeholder="Observaciones"></textarea>
                        <p-button label="Guardar datos fiscales" size="small" (onClick)="saveFiscalData(cn)" [loading]="cnFiscalSaving"></p-button>

                        <div class="cn-attachments">
                          <div class="cn-attachment" *ngFor="let att of cn.attachments">
                            <a [href]="att.url" target="_blank" rel="noopener"><i class="pi pi-paperclip"></i> {{ att.fileName }}</a>
                            <button type="button" (click)="deleteAttachment(cn, att)"><i class="pi pi-trash"></i></button>
                          </div>
                          <label class="cn-attach-input">
                            <i class="pi pi-upload"></i> Adjuntar archivo (PDF, imagen o XML)
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xml" (change)="uploadAttachment(cn, $event)">
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="cn-new-form" *ngIf="ncTargetInvoiceId === inv.id">
                  <p class="cn-note" *ngIf="ncAdjustableCharges.length === 0">No hay cargos ajustables en este comprobante.</p>
                  <div class="cn-charge-row" *ngFor="let ch of ncAdjustableCharges">
                    <span class="cn-charge-label">{{ ch.concept }} <small>(hasta {{ formatGs(ch.adjustable) }})</small></span>
                    <input type="number" min="0" [max]="ch.adjustable" [(ngModel)]="ncLineAmounts[ch.expenseChargeId]"
                           [name]="'cn-line-' + ch.expenseChargeId" placeholder="0">
                  </div>
                  <textarea [(ngModel)]="ncMotivo" name="cn-new-motivo" rows="2" placeholder="Motivo del ajuste (obligatorio)"></textarea>
                  <div class="cn-new-actions">
                    <p-button label="Cancelar" severity="secondary" [outlined]="true" size="small" (onClick)="toggleNewCreditNote(inv)"></p-button>
                    <p-button label="Crear nota de crédito" icon="pi pi-check" size="small"
                              (onClick)="createCreditNote(inv)" [loading]="ncCreating"></p-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Saldo a favor del propietario: se genera por notas de crédito y se descuenta solo en
             su próximo pago (nunca lo elige el propietario), por eso no hay botón "Aplicar". -->
        <div class="form-section credit-section" *ngIf="ownerCredit !== null">
          <h3>Saldo a favor del propietario</h3>
          <div class="credit-box" [class.credit-positive]="ownerCredit > 0" [class.credit-zero]="ownerCredit === 0">
            <i class="pi" [class]="ownerCredit > 0 ? 'pi-check-circle' : 'pi-minus-circle'"></i>
            <div class="credit-text">
              <span class="credit-amount">{{ ownerCredit | number:'1.0-2' }} Gs.</span>
              <span class="credit-hint">{{ ownerCredit > 0 ? 'Se descuenta automáticamente en el próximo pago que se apruebe.' : 'Sin saldo a favor.' }}</span>
            </div>
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

    .cn-section { display: grid; gap: 0.75rem; }
    .cn-header { display: flex; align-items: center; justify-content: space-between; }
    .cn-list { display: grid; gap: 0.75rem; }
    .cn-card { border: 1px solid rgba(20,54,61,0.12); border-left: 4px solid #6366f1; border-radius: 12px; padding: 0.8rem 1rem; background: #fff; display: grid; gap: 0.4rem; }
    .cn-card.cn-approved { border-left-color: #16a34a; }
    .cn-card.cn-rejected { border-left-color: #dc2626; background: #fffafa; }
    .cn-card.cn-voided { border-left-color: #8a9ba5; background: #fafafa; }
    .cn-top { display: flex; align-items: center; justify-content: space-between; }
    .cn-status { display: inline-flex; align-items: center; padding: 0.22rem 0.6rem; border-radius: 999px; font-size: 0.74rem; font-weight: 700; background: rgba(99,102,241,0.14); color: #4338ca; }
    .cn-status-approved { background: rgba(22,163,74,0.13); color: #166534; }
    .cn-status-rejected { background: #fee2e2; color: #991b1b; }
    .cn-status-voided { background: #eceff1; color: #607080; }
    .cn-amount { font-family: monospace; font-size: 1.05rem; color: #b91c1c; }
    .cn-motivo { margin: 0; font-size: 0.9rem; }
    .cn-meta { margin: 0; font-size: 0.78rem; color: var(--brand-muted); }
    .cn-lines { margin: 0; padding-left: 1.1rem; font-size: 0.85rem; color: #3a4a52; }
    .cn-rejection { margin: 0; font-size: 0.82rem; color: #991b1b; }
    .cn-actions { display: flex; gap: 0.5rem; }
    .cn-reason-form { display: grid; gap: 0.5rem; padding: 0.6rem; border-radius: 8px; background: color-mix(in srgb, var(--p-red-500) 5%, transparent); border: 1px solid color-mix(in srgb, var(--p-red-500) 25%, transparent); }
    .cn-reason-form textarea { width: 100%; box-sizing: border-box; padding: 0.5rem 0.7rem; border: 1px solid var(--p-surface-400); border-radius: 6px; resize: vertical; font: inherit; }

    .cn-fiscal { border-top: 1px dashed rgba(20,54,61,0.16); padding-top: 0.5rem; }
    .cn-fiscal-toggle { background: none; border: none; padding: 0; display: flex; align-items: center; gap: 0.4rem; color: var(--p-primary-color); font-weight: 600; font-size: 0.85rem; cursor: pointer; }
    .cn-fiscal-form { margin-top: 0.6rem; display: grid; gap: 0.5rem; }
    .cn-emit-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .cn-emit-row select { flex: 1; min-width: 220px; padding: 0.45rem 0.6rem; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 8px; font-size: 0.85rem; }
    .cn-emit-issued { margin: 0; font-size: 0.82rem; color: #166534; display: flex; align-items: center; gap: 0.4rem; }
    .cn-fiscal-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .cn-fiscal-row select, .cn-fiscal-row input, .cn-fiscal-form textarea { flex: 1; min-width: 140px; padding: 0.45rem 0.6rem; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 8px; font-size: 0.85rem; box-sizing: border-box; }
    .cn-fiscal-form textarea { width: 100%; resize: vertical; }
    .cn-attachments { display: grid; gap: 0.4rem; }
    .cn-attachment { display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.6rem; border: 1px solid rgba(20,54,61,0.12); border-radius: 8px; font-size: 0.82rem; }
    .cn-attachment a { color: #14363d; text-decoration: none; display: inline-flex; gap: 0.4rem; align-items: center; }
    .cn-attachment button { background: none; border: none; color: #b91c1c; cursor: pointer; }
    .cn-attach-input { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--p-primary-color); cursor: pointer; }
    .cn-attach-input input[type="file"] { display: none; }

    .cn-new-form { display: grid; gap: 0.5rem; padding: 0.75rem; border-radius: 10px; background: rgba(99,102,241,0.06); border: 1px dashed rgba(99,102,241,0.35); }
    .cn-note { margin: 0; font-size: 0.85rem; color: var(--brand-muted); }
    .cn-charge-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
    .cn-charge-label { font-size: 0.85rem; }
    .cn-charge-label small { color: var(--brand-muted); }
    .cn-charge-row input { width: 9rem; padding: 0.4rem 0.6rem; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 8px; }
    .cn-new-form textarea { width: 100%; box-sizing: border-box; padding: 0.5rem 0.7rem; border: 1px solid var(--p-surface-400); border-radius: 6px; resize: vertical; font: inherit; }
    .cn-new-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
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
  private readonly creditNotesApi = inject(CreditNotesApiService);
  private readonly uploadsApi = inject(UploadsApiService);

  payment:        OwnerPayment | null = null;
  ownerCredit:    number | null = null;
  loading         = true;
  saving          = false;
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
  rejectionReason = '';

  // Notas de crédito por factura, y estado de los formularios inline (nueva NC, rechazo, anulación, datos fiscales).
  creditNotesByInvoice: Record<string, CreditNote[]> = {};
  ncTargetInvoiceId = '';
  ncAdjustableCharges: AdjustableCharge[] = [];
  ncLineAmounts: Record<string, number> = {};
  ncMotivo = '';
  ncCreating = false;
  cnActionId = '';
  cnRejectTargetId = '';
  cnRejectReason = '';
  cnVoidTargetId = '';
  cnVoidReason = '';
  cnFiscalTargetId = '';
  cnFiscalSaving = false;
  cnFiscalForm: RegisterCreditNoteFiscalDataRequest = { documentType: null };
  cnApproveTargetId = '';
  cnApproveSeriesByCn: Record<string, string> = {};

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
        next: ledger => {
          this.paymentInvoices = ledger.items;
          for (const inv of ledger.items) {
            if (inv.status === 'Issued') this.loadCreditNotesForInvoice(inv.id);
          }
          this.cdr.markForCheck();
        },
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

  creditNotePdfUrl(id: string): string {
    return this.creditNotesApi.getPdfUrl(id, this.auth.getToken() ?? '');
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

  // ─── Notas de crédito ───────────────────────────────────────────────────

  get canCreateCreditNotesRole(): boolean {
    return this.auth.hasRole('SuperAdmin', 'CompanyAdmin', 'BuildingManager');
  }

  // Quien crea el borrador puede ser BuildingManager; aprobar/rechazar/anular (lo que mueve el
  // saldo) queda un escalón más arriba, igual que hoy publica/rechaza la liquidación de expensas.
  get canApproveCreditNotesRole(): boolean {
    return this.auth.hasRole('SuperAdmin', 'CompanyAdmin');
  }

  creditNoteStatusLabel(status: string): string { return CREDIT_NOTE_STATUS_LABELS[status] ?? status; }

  loadCreditNotesForInvoice(invoiceId: string): void {
    this.creditNotesApi.getAll({ invoiceId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => { this.creditNotesByInvoice[invoiceId] = list; this.cdr.markForCheck(); },
        error: () => {}
      });
  }

  toggleNewCreditNote(inv: InvoiceLedgerRow): void {
    if (this.ncTargetInvoiceId === inv.id) {
      this.ncTargetInvoiceId = '';
      return;
    }
    this.ncTargetInvoiceId = inv.id;
    this.ncMotivo = '';
    this.ncLineAmounts = {};
    this.ncAdjustableCharges = [];
    this.creditNotesApi.getAdjustableCharges(inv.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: charges => { this.ncAdjustableCharges = charges; this.cdr.markForCheck(); },
        error: err => {
          this.ncTargetInvoiceId = '';
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudieron cargar los cargos ajustables.'), life: 6000 });
          this.cdr.markForCheck();
        }
      });
  }

  createCreditNote(inv: InvoiceLedgerRow): void {
    const lines = this.ncAdjustableCharges
      .map(ch => ({ expenseChargeId: ch.expenseChargeId, amount: Number(this.ncLineAmounts[ch.expenseChargeId]) || 0 }))
      .filter(l => l.amount > 0);

    if (!this.ncMotivo.trim()) {
      this.msgSvc.add({ severity: 'error', summary: 'Error', detail: 'El motivo es obligatorio.', life: 5000 });
      return;
    }
    if (lines.length === 0) {
      this.msgSvc.add({ severity: 'error', summary: 'Error', detail: 'Ingresá al menos un importe a ajustar.', life: 5000 });
      return;
    }

    this.ncCreating = true;
    this.creditNotesApi.create({ invoiceId: inv.id, motivo: this.ncMotivo.trim(), lines })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.ncCreating = false;
          this.ncTargetInvoiceId = '';
          this.msgSvc.add({ severity: 'success', summary: 'Nota de crédito creada', detail: 'Queda en borrador hasta que se apruebe.' });
          this.loadCreditNotesForInvoice(inv.id);
          this.cdr.markForCheck();
        },
        error: err => {
          this.ncCreating = false;
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo crear la nota de crédito.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  askApproveCreditNote(cn: CreditNote): void {
    this.cnApproveTargetId = this.cnApproveTargetId === cn.id ? '' : cn.id;
  }

  approveCreditNote(cn: CreditNote): void {
    const seriesId = this.cnApproveSeriesByCn[cn.id];
    if (!seriesId) return;

    this.cnActionId = cn.id;
    this.creditNotesApi.approve(cn.id, seriesId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.cnActionId = '';
          this.cnApproveTargetId = '';
          this.msgSvc.add({ severity: 'success', summary: 'Nota de crédito aprobada', detail: `Numerada como ${updated.fiscalNumero}. El saldo del comprobante se actualizó.` });
          this.loadCreditNotesForInvoice(cn.invoiceId);
          this.cdr.markForCheck();
        },
        error: err => {
          this.cnActionId = '';
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo aprobar la nota de crédito.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  askRejectCreditNote(cn: CreditNote): void {
    this.cnRejectTargetId = this.cnRejectTargetId === cn.id ? '' : cn.id;
    this.cnRejectReason = '';
  }

  rejectCreditNote(cn: CreditNote): void {
    if (!this.cnRejectReason.trim()) {
      this.msgSvc.add({ severity: 'error', summary: 'Error', detail: 'El motivo de rechazo es obligatorio.', life: 5000 });
      return;
    }
    this.cnActionId = cn.id;
    this.creditNotesApi.reject(cn.id, this.cnRejectReason.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cnActionId = '';
          this.cnRejectTargetId = '';
          this.msgSvc.add({ severity: 'warn', summary: 'Nota de crédito rechazada' });
          this.loadCreditNotesForInvoice(cn.invoiceId);
          this.cdr.markForCheck();
        },
        error: err => {
          this.cnActionId = '';
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo rechazar la nota de crédito.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  askVoidCreditNote(cn: CreditNote): void {
    this.cnVoidTargetId = this.cnVoidTargetId === cn.id ? '' : cn.id;
    this.cnVoidReason = '';
  }

  voidCreditNote(cn: CreditNote): void {
    if (!this.cnVoidReason.trim()) {
      this.msgSvc.add({ severity: 'error', summary: 'Error', detail: 'El motivo de anulación es obligatorio.', life: 5000 });
      return;
    }
    this.cnActionId = cn.id;
    this.creditNotesApi.void(cn.id, this.cnVoidReason.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cnActionId = '';
          this.cnVoidTargetId = '';
          this.msgSvc.add({ severity: 'info', summary: 'Nota de crédito anulada' });
          this.loadCreditNotesForInvoice(cn.invoiceId);
          this.cdr.markForCheck();
        },
        error: err => {
          this.cnActionId = '';
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo anular la nota de crédito.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  toggleFiscalForm(cn: CreditNote): void {
    if (this.cnFiscalTargetId === cn.id) {
      this.cnFiscalTargetId = '';
      return;
    }
    this.cnFiscalTargetId = cn.id;
    this.cnFiscalForm = {
      documentType: cn.fiscalDocumentType,
      cdc: cn.fiscalCdc ?? '',
      estado: cn.fiscalEstado ?? '',
      observaciones: cn.fiscalObservaciones ?? ''
    };
  }

  creditNoteSeriesFor(buildingId: string): InvoiceSeries[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.allSeries.filter(x =>
      x.buildingId === buildingId && x.documentType === 'CreditNote' && x.activo && x.numerosDisponibles > 0 &&
      x.vigenciaDesde <= today && x.vigenciaHasta >= today);
  }

  saveFiscalData(cn: CreditNote): void {
    this.cnFiscalSaving = true;
    this.creditNotesApi.registerFiscalData(cn.id, this.cnFiscalForm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cnFiscalSaving = false;
          this.msgSvc.add({ severity: 'success', summary: 'Datos fiscales guardados' });
          this.loadCreditNotesForInvoice(cn.invoiceId);
          this.cdr.markForCheck();
        },
        error: err => {
          this.cnFiscalSaving = false;
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudieron guardar los datos fiscales.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  uploadAttachment(cn: CreditNote, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const kind = this.attachmentKindFor(file.name);
    this.uploadsApi.upload(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.creditNotesApi.addAttachment(cn.id, res.url, file.name, kind)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.msgSvc.add({ severity: 'success', summary: 'Adjunto agregado' });
                this.loadCreditNotesForInvoice(cn.invoiceId);
                this.cdr.markForCheck();
              },
              error: err => {
                this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo registrar el adjunto.'), life: 7000 });
                this.cdr.markForCheck();
              }
            });
        },
        error: err => {
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo subir el archivo.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  deleteAttachment(cn: CreditNote, att: CreditNoteAttachment): void {
    this.creditNotesApi.deleteAttachment(cn.id, att.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadCreditNotesForInvoice(cn.invoiceId);
          this.cdr.markForCheck();
        },
        error: err => {
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar el adjunto.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  private attachmentKindFor(fileName: string): CreditNoteAttachmentKind {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'Pdf';
    if (ext === 'xml') return 'Xml';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'Image';
    return 'Other';
  }
}

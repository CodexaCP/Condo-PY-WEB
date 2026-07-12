import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingPlanPaymentsApiService } from '../../api/building-plan-payments-api.service';
import { BuildingPlanPayment, BuildingPlanPaymentStatus } from '../../api/models';

const STATUS_LABEL: Record<BuildingPlanPaymentStatus, string> = {
  Pending: 'Pendiente', Approved: 'Aprobado', Rejected: 'Rechazado',
};
const STATUS_SEV: Record<BuildingPlanPaymentStatus, 'warn' | 'success' | 'danger'> = {
  Pending: 'warn', Approved: 'success', Rejected: 'danger',
};

@Component({
  standalone: true,
  selector: 'app-building-plan-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Pagos de planes</h1>
            <p>Comprobantes de pago enviados por las empresas para renovación de planes.</p>
          </div>
        </div>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>

      <!-- Filtros -->
      <div class="filter-bar">
        <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()">
          <option value="">Todos los estados</option>
          <option value="Pending">Pendiente</option>
          <option value="Approved">Aprobado</option>
          <option value="Rejected">Rechazado</option>
        </select>
        <input [(ngModel)]="filterText" (ngModelChange)="applyFilters()"
               placeholder="Buscar empresa o edificio..." class="filter-input" />
      </div>

      <p class="app-state" *ngIf="loading">Cargando pagos...</p>
      <p class="app-state" *ngIf="!loading && !filtered.length && !pageError">No hay comprobantes para mostrar.</p>

      <div class="app-list" *ngIf="filtered.length">
        <div class="app-row header pay-grid">
          <span>Empresa / Edificio</span>
          <span>Plan</span>
          <span>Monto</span>
          <span>Fecha pago</span>
          <span>Estado</span>
          <span>Enviado por</span>
        </div>
        <div class="app-row pay-grid" *ngFor="let item of filtered">
          <div class="name-cell">
            <button class="row-link" (click)="openDetail(item)">{{ item.companyName }}</button>
            <span class="sub-text">{{ item.buildingName }}</span>
          </div>
          <span>{{ item.planName }}</span>
          <span class="amount">{{ fmtCurrency(item.declaredAmount) }}</span>
          <span>{{ fmtDate(item.paymentDate) }}</span>
          <p-tag [value]="statusLabel(item.status)" [severity]="statusSev(item.status)"></p-tag>
          <span class="text-muted">{{ item.submittedByFullName }}</span>
        </div>
      </div>
    </p-card>

    <!-- ══════════════════════════ DETAIL PANEL ══════════════════════════ -->
    <div class="ov-backdrop" *ngIf="detailVisible" (click)="closeDetail()"></div>
    <div class="ov-panel" *ngIf="detailVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <div>
          <strong>Comprobante de pago</strong>
          <p-tag *ngIf="detail" [value]="statusLabel(detail.status)"
                 [severity]="statusSev(detail.status)" styleClass="ml-2"></p-tag>
        </div>
        <button class="ov-close" (click)="closeDetail()">✕</button>
      </div>

      <div class="detail-grid" *ngIf="detail">
        <div class="detail-row"><span class="dl">Empresa</span><span class="dv">{{ detail.companyName }}</span></div>
        <div class="detail-row"><span class="dl">Edificio</span><span class="dv">{{ detail.buildingName }}</span></div>
        <div class="detail-row"><span class="dl">Plan</span><span class="dv">{{ detail.planName }}</span></div>
        <div class="detail-row"><span class="dl">Monto declarado</span><span class="dv amount">{{ fmtCurrency(detail.declaredAmount) }}</span></div>
        <div class="detail-row"><span class="dl">Fecha de pago</span><span class="dv">{{ fmtDate(detail.paymentDate) }}</span></div>
        <div class="detail-row" *ngIf="detail.reference">
          <span class="dl">Referencia</span><span class="dv">{{ detail.reference }}</span>
        </div>
        <div class="detail-row" *ngIf="detail.comprobanteUrl">
          <span class="dl">Comprobante</span>
          <span class="dv"><a [href]="detail.comprobanteUrl" target="_blank" class="link">Ver archivo</a></span>
        </div>
        <div class="detail-row"><span class="dl">Enviado por</span><span class="dv">{{ detail.submittedByFullName }}</span></div>
        <div class="detail-row"><span class="dl">Enviado el</span><span class="dv">{{ fmtDate(detail.createdAtUtc) }}</span></div>
        <div class="detail-row" *ngIf="detail.reviewedByFullName">
          <span class="dl">Revisado por</span><span class="dv">{{ detail.reviewedByFullName }}</span>
        </div>
        <div class="detail-row" *ngIf="detail.reviewedAt">
          <span class="dl">Revisado el</span><span class="dv">{{ fmtDate(detail.reviewedAt!) }}</span>
        </div>
        <div class="detail-row" *ngIf="detail.rejectionReason">
          <span class="dl">Motivo rechazo</span>
          <span class="dv reject-reason">{{ detail.rejectionReason }}</span>
        </div>
      </div>

      <!-- Acciones para Pendiente -->
      <div class="actions-section" *ngIf="detail?.status === 'Pending' && !rejectMode">
        <p-button label="Aprobar pago" icon="pi pi-check" severity="success"
                  [loading]="isApproving" (onClick)="approve()"></p-button>
        <p-button label="Rechazar" icon="pi pi-times" severity="danger" [outlined]="true"
                  (onClick)="rejectMode = true"></p-button>
      </div>

      <!-- Form de rechazo -->
      <div class="reject-form" *ngIf="rejectMode">
        <label class="reject-label">
          <span>Motivo de rechazo <span class="req">*</span></span>
          <textarea [(ngModel)]="rejectionReason" name="reason" rows="3"
                    placeholder="Explica el motivo del rechazo al operador..."></textarea>
        </label>
        <div class="reject-footer">
          <p-button label="Cancelar" severity="secondary" [outlined]="true"
                    (onClick)="rejectMode = false; rejectionReason = ''"></p-button>
          <p-button label="Confirmar rechazo" severity="danger" icon="pi pi-times"
                    [loading]="isRejecting" (onClick)="reject()"></p-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pay-grid { grid-template-columns: 2fr 1.2fr 1fr 1fr 1fr 1.2fr; }
    .name-cell { display: flex; flex-direction: column; gap: 0.1rem; }
    .sub-text { font-size: 0.78rem; color: var(--brand-muted); }
    .row-link {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left; text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }
    .text-muted { color: var(--brand-muted); font-size: 0.88rem; }
    .amount { font-weight: 600; }

    .filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .filter-bar select, .filter-input {
      padding: 0.4rem 0.7rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.9rem; background: var(--surface-ground, #f8fafc);
    }
    .filter-input { flex: 1; min-width: 180px; }

    /* OVERLAY */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px); animation: fadeIn 0.15s ease;
    }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(580px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28);
      padding: 1.6rem; animation: slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
                         to   { opacity: 1; transform: translate(-50%, -50%); } }
    .ov-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 1.2rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header > div { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .ov-header strong { font-size: 1.15rem; color: var(--brand-ink); }
    .ml-2 { margin-left: 0.5rem; }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s; flex-shrink: 0;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }

    .detail-grid { display: grid; gap: 0.4rem; margin-bottom: 1.4rem; }
    .detail-row { display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem;
                  padding: 0.35rem 0; border-bottom: 1px solid rgba(19,133,182,0.06); }
    .dl { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .dv { font-size: 0.9rem; color: var(--brand-ink); }
    .reject-reason { color: #dc2626; font-style: italic; }
    .link { color: var(--brand-blue); text-decoration: underline; }

    .actions-section {
      display: flex; gap: 0.75rem; flex-wrap: wrap;
      border-top: 1px solid rgba(19,133,182,0.1); padding-top: 1.2rem;
    }
    .reject-form {
      border-top: 1px solid rgba(19,133,182,0.1); padding-top: 1.2rem;
      display: grid; gap: 1rem;
    }
    .reject-label > span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted);
                           display: block; margin-bottom: 0.4rem; }
    .reject-label textarea {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(220,38,38,0.4);
      border-radius: 10px; font: inherit; font-size: 0.95rem; resize: vertical;
      background: rgba(220,38,38,0.03);
    }
    .reject-label textarea:focus { outline: none; border-color: #dc2626; }
    .reject-footer { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .req { color: var(--red-400); }
  `]
})
export class BuildingPlanPaymentsPageComponent implements OnInit {
  private readonly api = inject(BuildingPlanPaymentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: BuildingPlanPayment[] = [];
  filtered: BuildingPlanPayment[] = [];
  loading = true;
  pageError = '';

  filterStatus = '';
  filterText = '';

  detailVisible = false;
  detail: BuildingPlanPayment | null = null;
  rejectMode = false;
  rejectionReason = '';
  isApproving = false;
  isRejecting = false;

  ngOnInit(): void {
    this.api.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items = items.sort((a, b) => {
          const order: Record<BuildingPlanPaymentStatus, number> = { Pending: 0, Approved: 1, Rejected: 2 };
          return order[a.status] - order[b.status] || new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime();
        });
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageError = 'No se pudieron cargar los pagos.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    const text = this.filterText.toLowerCase();
    this.filtered = this.items.filter(x =>
      (!this.filterStatus || x.status === this.filterStatus) &&
      (!text || x.companyName.toLowerCase().includes(text) || x.buildingName.toLowerCase().includes(text))
    );
  }

  openDetail(item: BuildingPlanPayment): void {
    this.detail = item;
    this.rejectMode = false;
    this.rejectionReason = '';
    this.detailVisible = true;
  }

  closeDetail(): void {
    this.detailVisible = false;
    this.detail = null;
    this.rejectMode = false;
  }

  approve(): void {
    if (this.isApproving || !this.detail) return;
    this.isApproving = true;
    this.api.approve(this.detail.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.updateItem(updated);
        this.isApproving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Pago aprobado. El plan fue renovado.', life: 5000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo aprobar el pago.'), life: 5000 });
        this.isApproving = false;
        this.cdr.markForCheck();
      }
    });
  }

  reject(): void {
    if (this.isRejecting || !this.detail) return;
    if (!this.rejectionReason.trim()) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El motivo de rechazo es obligatorio.', life: 5000 });
      return;
    }
    this.isRejecting = true;
    this.api.reject(this.detail.id, { rejectionReason: this.rejectionReason.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: updated => {
          this.updateItem(updated);
          this.rejectMode = false;
          this.isRejecting = false;
          this.msg.add({ severity: 'info', summary: 'Rechazado', detail: 'Comprobante rechazado. La empresa será notificada.', life: 5000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo rechazar el pago.'), life: 5000 });
          this.isRejecting = false;
          this.cdr.markForCheck();
        }
      });
  }

  statusLabel(s: BuildingPlanPaymentStatus): string { return STATUS_LABEL[s] ?? s; }
  statusSev(s: BuildingPlanPaymentStatus): 'warn' | 'success' | 'danger' { return STATUS_SEV[s] ?? 'warn'; }

  fmtDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  fmtCurrency(v: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 }).format(v);
  }

  private updateItem(updated: BuildingPlanPayment): void {
    this.items = this.items.map(x => x.id === updated.id ? updated : x);
    this.detail = updated;
    this.applyFilters();
  }
}

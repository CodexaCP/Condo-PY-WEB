import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { MarketplaceApiService } from '../../api/marketplace-api.service';
import { MarketplaceOperationHistory } from '../../api/models';
import { AuthService } from '../../auth/auth.service';

const STATUS_LABELS: Record<string, string> = {
  PendingPayment: 'Esperando pago', InReview: 'En revisión', Confirmed: 'Confirmada', Completed: 'Finalizada',
  Cancelled: 'Cancelada', Expired: 'Vencida', Rejected: 'Rechazada'
};

const CREDIT_LABELS: Record<string, string> = {
  None: 'No corresponde', Pending: 'Pendiente', Held: 'Retenida por un reclamo', Credited: 'Acreditada', Reversed: 'Revertida'
};

// Historial económico de una operación del Marketplace (publicación → reserva → importes → pago → acreditación), tal como quedó
// registrado, con el comprobante interno en PDF. Lo ve solo el personal del edificio. Se abre indicando la reserva.
@Component({
  standalone: true,
  selector: 'app-marketplace-history-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Button, Message],
  template: `
    <ng-container *ngIf="reservationId">
      <div class="hd-backdrop" (click)="closed.emit()"></div>
      <div class="hd-panel" (click)="$event.stopPropagation()">
        <div class="hd-header">
          <strong>Historial de la operación{{ history ? ' · ' + history.reference : '' }}</strong>
          <button class="hd-close" (click)="closed.emit()">✕</button>
        </div>

        <p-message *ngIf="error" severity="error" [text]="error"></p-message>
        <p class="hd-state" *ngIf="loading">Cargando...</p>

        <ng-container *ngIf="history && !loading">
          <div class="hd-sub">{{ history.title }} · Unidad {{ history.unitCode }} · {{ statusLabel(history.status) }}</div>
          <div class="hd-sub">Propietario: {{ history.ownerName }} · Comprador: {{ history.buyerName }}</div>
          <div class="hd-sub">{{ range(history.startsAtUtc, history.endsAtUtc) }} ({{ history.hours }} h)</div>

          <div class="hd-amounts">
            <div><small>Precio por hora</small><strong>{{ gs(history.hourlyPrice) }}</strong></div>
            <div><small>Precio del espacio</small><strong>{{ gs(history.baseAmount) }}</strong></div>
            <div><small>Comisión ({{ history.commissionPercent }} %)</small><strong>{{ gs(history.commissionAmount) }}</strong></div>
            <div><small>Total pagado</small><strong>{{ gs(history.totalAmount) }}</strong></div>
            <div><small>Ganancia del propietario</small><strong>{{ gs(history.ownerNetAmount) }}</strong></div>
            <div><small>Acreditación</small><strong>{{ creditLabel(history.creditStatus) }}</strong></div>
          </div>

          <p class="hd-label">Línea de tiempo</p>
          <p class="hd-state" *ngIf="!history.items.length">Todavía no hay movimientos registrados.</p>
          <ol class="hd-timeline">
            <li *ngFor="let item of history.items">
              <div class="hd-when">{{ dateTime(item.timestampUtc) }}</div>
              <div class="hd-what">
                <strong>{{ item.title }}</strong>
                <span class="hd-amount" *ngIf="item.amount !== null">{{ gs(item.amount) }}</span>
                <small *ngIf="item.detail">{{ item.detail }}</small>
                <small class="hd-actor">{{ item.actorName ?? 'Sistema' }}</small>
              </div>
            </li>
          </ol>

          <div class="hd-footer">
            <p-button label="Comprobante interno (PDF)" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"
                      [disabled]="!hasPayment" (onClick)="openReceipt()"></p-button>
            <p-button label="Cerrar" (onClick)="closed.emit()"></p-button>
          </div>
          <small class="hd-note" *ngIf="!hasPayment">El comprobante se genera cuando se confirma el pago de la reserva.</small>
        </ng-container>
      </div>
    </ng-container>
  `,
  styles: [`
    .hd-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1100; backdrop-filter: blur(2px); }
    .hd-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(640px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1101; box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .hd-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .hd-header strong { font-size: 1.15rem; color: var(--brand-ink); }
    .hd-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; }
    .hd-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .hd-sub { color: var(--brand-muted); font-size: 0.88rem; margin-bottom: 0.2rem; }
    .hd-state { color: var(--brand-muted); }
    .hd-amounts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.5rem; margin: 0.9rem 0; }
    .hd-amounts > div { background: var(--surface-ground, #f8fafc); border-radius: 12px; padding: 0.55rem 0.75rem; display: flex; flex-direction: column; }
    .hd-amounts small { color: var(--brand-muted); font-size: 0.74rem; }
    .hd-amounts strong { color: var(--brand-ink); }
    .hd-label { margin: 1rem 0 0.4rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--brand-muted); }
    .hd-timeline { list-style: none; margin: 0; padding: 0; border-left: 2px solid rgba(19,133,182,0.25); }
    .hd-timeline li { position: relative; padding: 0 0 0.9rem 1rem; display: grid; grid-template-columns: 8.5rem 1fr; gap: 0.6rem; }
    .hd-timeline li::before { content: ''; position: absolute; left: -6px; top: 0.3rem; width: 10px; height: 10px; border-radius: 50%; background: #1385b6; }
    .hd-when { color: var(--brand-muted); font-size: 0.8rem; }
    .hd-what { display: flex; flex-direction: column; gap: 0.1rem; color: var(--brand-ink); }
    .hd-what small { color: var(--brand-muted); line-height: 1.4; }
    .hd-actor { font-style: italic; }
    .hd-amount { font-weight: 700; color: #1385b6; }
    .hd-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
    .hd-note { display: block; text-align: right; color: var(--brand-muted); margin-top: 0.4rem; }
    @media (max-width: 600px) { .hd-timeline li { grid-template-columns: 1fr; gap: 0.1rem; } }
  `]
})
export class MarketplaceHistoryDialogComponent implements OnChanges {
  private readonly api = inject(MarketplaceApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() reservationId: string | null = null;
  @Output() closed = new EventEmitter<void>();

  history: MarketplaceOperationHistory | null = null;
  loading = false;
  error = '';

  // El comprobante existe una vez que el pago se confirmó (la reserva pasó por «Confirmada»).
  get hasPayment(): boolean {
    return !!this.history?.items.some(i => i.action === 'payment.approved');
  }

  ngOnChanges(): void {
    this.history = null;
    this.error = '';
    if (!this.reservationId) return;

    this.loading = true;
    this.api.getHistory(this.reservationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: history => { this.history = history; this.loading = false; this.cdr.markForCheck(); },
      error: err => {
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el historial de la operación.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openReceipt(): void {
    if (!this.history) return;
    window.open(this.api.receiptPdfUrl(this.history.reservationId, this.auth.getToken() ?? ''), '_blank', 'noopener');
  }

  statusLabel(status: string): string { return STATUS_LABELS[status] ?? status; }
  creditLabel(status: string): string { return CREDIT_LABELS[status] ?? status; }

  gs(value: number): string {
    return 'Gs. ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  dateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  range(startIso: string, endIso: string): string {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const day = (d: Date) => d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = (d: Date) => d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });
    return s.toDateString() === e.toDateString()
      ? `${day(s)} · ${time(s)}–${time(e)}`
      : `${day(s)} ${time(s)} → ${day(e)} ${time(e)}`;
  }
}

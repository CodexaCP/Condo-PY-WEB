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
import { isPdfUrl, resolveUploadUrl } from '../../api/file-url.util';
import { MarketplaceApiService } from '../../api/marketplace-api.service';
import { MarketplaceReviewItem, MarketplaceStaffBuilding } from '../../api/models';

type Dialog = 'approve' | 'reject' | null;

// Pagos de reservas del Marketplace por revisar (roles que aprueban pagos): se ve el comprobante y se confirma o rechaza.
// Confirmar exige que el monto del comprobante coincida exacto con el total esperado; rechazar pide motivo y cierra la reserva.
@Component({
  standalone: true,
  selector: 'app-marketplace-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Pagos del Marketplace</h1>
            <p>Reservas de espacios entre vecinos esperando que se confirme el pago por transferencia.</p>
          </div>
        </div>
      </div>

      <div class="filters" *ngIf="buildings.length > 1">
        <select [ngModel]="buildingId" (ngModelChange)="onBuildingChange($event)">
          <option *ngFor="let b of buildings" [value]="b.buildingId">{{ b.buildingName }}</option>
        </select>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando pagos...</p>
      <p class="app-state" *ngIf="!loading && !pageError && !buildings.length">El Marketplace no está disponible en ningún edificio de tu alcance.</p>
      <p class="app-state" *ngIf="!loading && !pageError && buildings.length && !items.length">No hay pagos esperando revisión.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header mk-grid">
          <span>Reserva</span>
          <span>Comprador</span>
          <span>Horario</span>
          <span>Total</span>
          <span></span>
        </div>
        <div class="app-row mk-grid" *ngFor="let item of items; trackBy: trackById">
          <div class="name-cell">
            <strong>{{ item.title }}</strong>
            <small>{{ item.reference }} · Unidad {{ item.unitCode }}</small>
          </div>
          <div class="name-cell">
            <span>{{ item.buyerName }}</span>
            <small *ngIf="item.buyerUnits">Unidad {{ item.buyerUnits }}</small>
            <p-tag *ngIf="item.buyerUnitOverdue" value="Unidad con pagos atrasados" severity="warn" styleClass="tag-sm"></p-tag>
          </div>
          <span>{{ range(item) }}</span>
          <strong>{{ gs(item.expectedAmount) }}</strong>
          <div class="app-actions">
            <p-button type="button" label="Revisar" icon="pi pi-search" size="small" (onClick)="open(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>

    <!-- Detalle del pago -->
    <div class="ov-backdrop" *ngIf="selected" (click)="close()"></div>
    <div class="ov-panel" *ngIf="selected" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ selected.title }} · {{ selected.reference }}</strong>
        <button class="ov-close" (click)="close()">✕</button>
      </div>

      <p-message *ngIf="selected.buyerUnitOverdue" severity="warn"
                 text="La unidad del comprador tiene pagos atrasados. Tenelo en cuenta al decidir."></p-message>
      <p-message *ngIf="selected.reservationEnded" severity="info"
                 text="La reserva ya terminó: ya no se puede confirmar, solo rechazar."></p-message>

      <div class="kv"><span>Comprador</span><strong>{{ selected.buyerName }}<ng-container *ngIf="selected.buyerUnits"> · Unidad {{ selected.buyerUnits }}</ng-container></strong></div>
      <div class="kv"><span>Publicó</span><strong>{{ selected.ownerName }}</strong></div>
      <div class="kv"><span>Horario</span><strong>{{ range(selected) }} ({{ selected.hours }} h)</strong></div>
      <div class="kv"><span>Precio del espacio</span><strong>{{ gs(selected.baseAmount) }}</strong></div>
      <div class="kv"><span>Comisión por gestión</span><strong>{{ gs(selected.commissionAmount) }}</strong></div>
      <div class="kv total"><span>Total que debe figurar en el comprobante</span><strong>{{ gs(selected.expectedAmount) }}</strong></div>

      <p class="label">Comprobante</p>
      <img *ngIf="!isPdf(selected.comprobanteUrl)" class="comprobante" [src]="url(selected.comprobanteUrl)" alt="Comprobante de pago" />
      <a *ngIf="isPdf(selected.comprobanteUrl)" [href]="url(selected.comprobanteUrl)" target="_blank" rel="noopener">Abrir comprobante (PDF)</a>

      <div class="confirm-footer">
        <p-button label="Rechazar" severity="danger" [outlined]="true" icon="pi pi-times" (onClick)="dialog = 'reject'; reason = ''; cdr.markForCheck()"></p-button>
        <p-button label="Confirmar pago" icon="pi pi-check" [disabled]="selected.reservationEnded" (onClick)="dialog = 'approve'; cdr.markForCheck()"></p-button>
      </div>
    </div>

    <!-- Confirmar -->
    <div class="ov-panel small" *ngIf="selected && dialog === 'approve'" (click)="$event.stopPropagation()">
      <div class="ov-header"><strong>Confirmar pago</strong></div>
      <p class="confirm-text">
        Confirmá que el comprobante muestra <strong>exactamente {{ gs(selected.expectedAmount) }}</strong>.
        Se confirma la reserva y se avisa a {{ selected.buyerName }} y al propietario.
      </p>
      <div class="confirm-footer">
        <p-button label="Volver" severity="secondary" [outlined]="true" [disabled]="busy" (onClick)="dialog = null; cdr.markForCheck()"></p-button>
        <p-button label="Sí, confirmar" icon="pi pi-check" [loading]="busy" (onClick)="approve()"></p-button>
      </div>
    </div>

    <!-- Rechazar -->
    <div class="ov-panel small" *ngIf="selected && dialog === 'reject'" (click)="$event.stopPropagation()">
      <div class="ov-header"><strong>Rechazar pago</strong></div>
      <p class="confirm-text">Se cierra la reserva y el horario queda libre. El motivo se le envía al comprador.</p>
      <textarea class="reason" rows="3" maxlength="500" placeholder="Motivo (obligatorio)" [(ngModel)]="reason"></textarea>
      <div class="confirm-footer">
        <p-button label="Volver" severity="secondary" [outlined]="true" [disabled]="busy" (onClick)="dialog = null; cdr.markForCheck()"></p-button>
        <p-button label="Rechazar" severity="danger" icon="pi pi-times" [loading]="busy" [disabled]="!reason.trim()" (onClick)="reject()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .filters select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .mk-grid { grid-template-columns: 1.6fr 1.6fr 1.6fr 1fr 1fr; }
    .name-cell { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
    .name-cell small { color: var(--brand-muted); }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; }
    @media (max-width: 900px) { .mk-grid { grid-template-columns: 1fr; } .app-row.header { display: none; } .app-actions { justify-content: flex-start; } }

    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(560px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-panel.small { width: min(440px, calc(100vw - 2rem)); z-index: 1002; }
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size: 1.15rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .kv { display: flex; justify-content: space-between; gap: 1rem; padding: 0.35rem 0; color: var(--brand-ink); }
    .kv span { color: var(--brand-muted); }
    .kv.total { margin-top: 0.3rem; padding-top: 0.6rem; border-top: 1px solid rgba(19,133,182,0.12); font-size: 1.05rem; }
    .kv.total span { color: var(--brand-ink); font-weight: 700; }
    .label { margin: 1rem 0 0.4rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--brand-muted); }
    .comprobante { width: 100%; max-height: 360px; object-fit: contain; border-radius: 12px; background: var(--surface-ground, #f8fafc); }
    .confirm-text { margin: 0 0 1rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.2rem; }
    .reason {
      width: 100%; padding: 0.6rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; resize: vertical; box-sizing: border-box;
    }
  `]
})
export class MarketplacePaymentsPageComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  readonly cdr = inject(ChangeDetectorRef);

  buildings: MarketplaceStaffBuilding[] = [];
  buildingId = '';
  items: MarketplaceReviewItem[] = [];
  loading = true;
  pageError = '';

  selected: MarketplaceReviewItem | null = null;
  dialog: Dialog = null;
  reason = '';
  busy = false;

  ngOnInit(): void {
    // Solo los edificios con el Marketplace disponible donde el rol revisa pagos: no se ofrece uno que respondería 403.
    this.api.getStaffBuildings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.buildings = list.filter(b => b.canReviewPayments);
        this.buildingId = this.buildings[0]?.buildingId ?? '';
        if (this.buildingId) {
          this.load();
        } else {
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: err => this.fail(err, 'No se pudieron cargar los edificios.')
    });
  }

  onBuildingChange(id: string): void {
    this.buildingId = id;
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.pageError = '';
    this.items = [];
    this.api.getPendingPayments(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items = items;
        this.loading = false;
        this.cdr.markForCheck();
      },
      // Si el Marketplace no está habilitado en el edificio, el mensaje de la API lo explica.
      error: err => this.fail(err, 'No se pudieron cargar los pagos del Marketplace.')
    });
  }

  private fail(err: unknown, fallback: string): void {
    this.pageError = extractApiErrorMessage(err, fallback);
    this.loading = false;
    this.cdr.markForCheck();
  }

  trackById(_: number, item: MarketplaceReviewItem): string { return item.paymentId; }

  gs(value: number): string {
    return 'Gs. ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  range(item: MarketplaceReviewItem): string {
    const s = new Date(item.startsAtUtc);
    const e = new Date(item.endsAtUtc);
    const day = (d: Date) => d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = (d: Date) => d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });
    return s.toDateString() === e.toDateString()
      ? `${day(s)} · ${time(s)}–${time(e)}`
      : `${day(s)} ${time(s)} → ${day(e)} ${time(e)}`;
  }

  url(path: string): string { return resolveUploadUrl(path); }
  isPdf(path: string): boolean { return isPdfUrl(path); }

  open(item: MarketplaceReviewItem): void { this.selected = item; this.dialog = null; this.cdr.markForCheck(); }
  close(): void { if (!this.busy) { this.selected = null; this.dialog = null; this.cdr.markForCheck(); } }

  approve(): void {
    const item = this.selected;
    if (!item || this.busy) return;
    this.run(item, this.api.approvePayment(item.paymentId, item.expectedAmount), 'Pago confirmado', 'No se pudo confirmar el pago.');
  }

  reject(): void {
    const item = this.selected;
    if (!item || this.busy || !this.reason.trim()) return;
    this.run(item, this.api.rejectPayment(item.paymentId, this.reason.trim()), 'Pago rechazado', 'No se pudo rechazar el pago.');
  }

  private run(item: MarketplaceReviewItem, call: ReturnType<MarketplaceApiService['approvePayment']>, okText: string, errText: string): void {
    this.busy = true;
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy = false;
        this.items = this.items.filter(x => x.paymentId !== item.paymentId);
        this.selected = null;
        this.dialog = null;
        this.msg.add({ severity: 'success', summary: okText, life: 4000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.busy = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, errText), life: 6000 });
        // Por ejemplo "este pago ya fue revisado": se recarga para mostrar el estado real.
        this.selected = null;
        this.dialog = null;
        this.load();
      }
    });
  }
}

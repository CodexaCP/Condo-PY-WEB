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
import { MarketplaceApiService } from '../../api/marketplace-api.service';
import {
  MarketplaceClaim,
  MarketplaceClaimOutcome,
  MarketplaceOwnerDebt,
  MarketplaceRefund,
  MarketplaceStaffBuilding
} from '../../api/models';

type Tab = 'refunds' | 'claims' | 'debts';

const ORIGIN_LABELS: Record<string, string> = {
  BuyerCancellation: 'Canceló el comprador (se devuelve el precio; la comisión no)',
  OwnerCancellation: 'Canceló el propietario (se devuelve todo)',
  ClaimResolution: 'Reclamo resuelto a favor del comprador (se devuelve todo)'
};

// Seguimiento del personal del Marketplace: reembolsos que hay que devolver a los compradores (fuera del sistema; acá se marcan
// "devueltos"), reclamos ("Reportar un problema") que el Encargado resuelve y deudas por gestión de los propietarios.
@Component({
  standalone: true,
  selector: 'app-marketplace-followup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Reembolsos y reclamos del Marketplace</h1>
            <p>Devolvé el dinero a los compradores (hasta en 72 horas) y resolvé los problemas que reporten los vecinos.</p>
          </div>
        </div>
      </div>

      <div class="filters">
        <select *ngIf="buildings.length > 1" [ngModel]="buildingId" (ngModelChange)="onBuildingChange($event)">
          <option *ngFor="let b of buildings" [value]="b.buildingId">{{ b.buildingName }}</option>
        </select>
        <div class="tabs" *ngIf="buildings.length">
          <button type="button" [class.on]="tab === 'refunds'" (click)="setTab('refunds')">
            Reembolsos <span class="count" *ngIf="pendingRefunds">{{ pendingRefunds }}</span>
          </button>
          <button type="button" [class.on]="tab === 'claims'" (click)="setTab('claims')">
            Reclamos <span class="count" *ngIf="openClaims">{{ openClaims }}</span>
          </button>
          <button type="button" [class.on]="tab === 'debts'" (click)="setTab('debts')">
            Deudas por gestión <span class="count" *ngIf="debts.length">{{ debts.length }}</span>
          </button>
        </div>
        <label class="history" *ngIf="buildings.length && tab !== 'debts'">
          <input type="checkbox" [(ngModel)]="history" (ngModelChange)="load()" />
          {{ tab === 'refunds' ? 'Ver también los devueltos' : 'Ver también los resueltos' }}
        </label>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando...</p>
      <p class="app-state" *ngIf="!loading && !pageError && !buildings.length">El Marketplace no está disponible en ningún edificio de tu alcance.</p>

      <!-- ── Reembolsos ── -->
      <ng-container *ngIf="!loading && buildings.length && tab === 'refunds'">
        <p class="app-state" *ngIf="!refunds.length">No hay reembolsos {{ history ? '' : 'pendientes' }}.</p>
        <div class="app-list" *ngIf="refunds.length">
          <div class="app-row header mk-grid">
            <span>Reserva</span><span>Comprador</span><span>Motivo</span><span>Monto</span><span>Plazo</span><span></span>
          </div>
          <div class="app-row mk-grid" *ngFor="let r of refunds; trackBy: trackById">
            <div class="name-cell"><strong>{{ r.title }}</strong><small>{{ r.reference }} · Unidad {{ r.unitCode }}</small></div>
            <span>{{ r.buyerName }}</span>
            <div class="name-cell"><span>{{ originLabel(r.origin) }}</span><small *ngIf="r.reason">{{ r.reason }}</small></div>
            <strong>{{ gs(r.amount) }}</strong>
            <div class="name-cell">
              <p-tag *ngIf="r.status === 'Pending' && r.overdue" value="Vencido" severity="danger" styleClass="tag-sm"></p-tag>
              <small *ngIf="r.status === 'Pending'">Hasta el {{ dateTime(r.dueAtUtc) }}</small>
              <p-tag *ngIf="r.status === 'Returned'" value="Devuelto" severity="success" styleClass="tag-sm"></p-tag>
              <small *ngIf="r.status === 'Returned'">{{ dateTime(r.returnedAtUtc!) }}<ng-container *ngIf="r.returnedByName"> · {{ r.returnedByName }}</ng-container></small>
            </div>
            <div class="app-actions">
              <p-button *ngIf="r.status === 'Pending'" type="button" label="Marcar devuelto" icon="pi pi-check" size="small"
                        (onClick)="askReturn(r)"></p-button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ── Reclamos ── -->
      <ng-container *ngIf="!loading && buildings.length && tab === 'claims'">
        <p class="app-state" *ngIf="!claims.length">No hay reclamos {{ history ? '' : 'abiertos' }}.</p>
        <div class="app-list" *ngIf="claims.length">
          <div class="app-row header cl-grid">
            <span>Reserva</span><span>Reportó</span><span>Problema</span><span>Total</span><span></span>
          </div>
          <div class="app-row cl-grid" *ngFor="let c of claims; trackBy: trackById">
            <div class="name-cell"><strong>{{ c.title }}</strong><small>{{ c.reference }} · {{ range(c) }}</small></div>
            <div class="name-cell"><span>{{ c.openedByName }}</span><small>{{ c.openedBy === 'Buyer' ? 'Comprador' : 'Propietario' }} · {{ dateTime(c.createdAtUtc) }}</small></div>
            <span>{{ c.reason }}</span>
            <strong>{{ gs(c.totalAmount) }}</strong>
            <div class="app-actions">
              <p-button *ngIf="c.status === 'Open'" type="button" label="Resolver" icon="pi pi-pencil" size="small" (onClick)="openClaim(c)"></p-button>
              <p-tag *ngIf="c.status === 'Resolved'" [value]="c.resolution === 'InFavorOfBuyer' ? 'A favor del comprador' : 'A favor del propietario'"
                     severity="secondary" styleClass="tag-sm"></p-tag>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ── Deudas por gestión ── -->
      <ng-container *ngIf="!loading && buildings.length && tab === 'debts'">
        <p class="note">Es la comisión que el propietario asumió al cancelar y su saldo a favor no alcanzó a cubrir. Se descuenta sola de su próxima acreditación del Marketplace en este edificio; no se suma a las expensas.</p>
        <p class="app-state" *ngIf="!debts.length">No hay deudas por gestión pendientes.</p>
        <div class="app-list" *ngIf="debts.length">
          <div class="app-row header db-grid">
            <span>Propietario</span><span>Reserva</span><span>Motivo</span><span>Debe</span>
          </div>
          <div class="app-row db-grid" *ngFor="let d of debts; trackBy: trackById">
            <strong>{{ d.ownerName }}</strong>
            <span>{{ d.reference }}</span>
            <span>{{ d.reason }}</span>
            <div class="name-cell"><strong>{{ gs(d.remaining) }}</strong><small *ngIf="d.paidAmount > 0">de {{ gs(d.amount) }}</small></div>
          </div>
        </div>
      </ng-container>
    </p-card>

    <!-- Confirmar devolución -->
    <div class="ov-backdrop" *ngIf="returning" (click)="closeReturn()"></div>
    <div class="ov-panel small" *ngIf="returning" (click)="$event.stopPropagation()">
      <div class="ov-header"><strong>Marcar como devuelto</strong></div>
      <p class="confirm-text">
        Confirmá que ya le devolviste <strong>{{ gs(returning.amount) }}</strong> a <strong>{{ returning.buyerName }}</strong> por la
        reserva {{ returning.reference }}. Queda registrado quién y cuándo, y se asienta la salida en la cuenta del Marketplace.
      </p>
      <div class="confirm-footer">
        <p-button label="Volver" severity="secondary" [outlined]="true" [disabled]="busy" (onClick)="closeReturn()"></p-button>
        <p-button label="Sí, ya lo devolví" icon="pi pi-check" [loading]="busy" (onClick)="confirmReturn()"></p-button>
      </div>
    </div>

    <!-- Resolver reclamo -->
    <div class="ov-backdrop" *ngIf="resolving" (click)="closeClaim()"></div>
    <div class="ov-panel" *ngIf="resolving" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ resolving.title }} · {{ resolving.reference }}</strong>
        <button class="ov-close" (click)="closeClaim()">✕</button>
      </div>
      <div class="kv"><span>Horario</span><strong>{{ range(resolving) }}</strong></div>
      <div class="kv"><span>Propietario</span><strong>{{ resolving.ownerName }}</strong></div>
      <div class="kv"><span>Comprador</span><strong>{{ resolving.buyerName }}<ng-container *ngIf="resolving.buyerUnits"> · Unidad {{ resolving.buyerUnits }}</ng-container></strong></div>
      <div class="kv"><span>Precio del espacio</span><strong>{{ gs(resolving.baseAmount) }}</strong></div>
      <div class="kv"><span>Comisión por gestión</span><strong>{{ gs(resolving.commissionAmount) }}</strong></div>
      <div class="kv total"><span>Pagó el comprador</span><strong>{{ gs(resolving.totalAmount) }}</strong></div>

      <p class="label">Lo que reportó {{ resolving.openedBy === 'Buyer' ? 'el comprador' : 'el propietario' }}</p>
      <p class="quote">{{ resolving.reason }}</p>
      <p class="label">Aviso de inicio</p>
      <p class="quote" *ngIf="!resolving.buyerStartResponse">El comprador no respondió (se asume que usó el espacio).</p>
      <p class="quote" *ngIf="resolving.buyerStartResponse === 'Attending'">El comprador respondió que iba a usarlo.</p>
      <p class="quote" *ngIf="resolving.buyerStartResponse === 'NotUsing'">El comprador respondió que no lo iba a usar: «{{ resolving.buyerStartResponseReason }}».</p>

      <p class="label">Cómo se resuelve</p>
      <label class="choice" [class.on]="outcome === 'InFavorOfOwner'">
        <input type="radio" name="outcome" value="InFavorOfOwner" [(ngModel)]="outcome" />
        <span><strong>A favor del propietario</strong><small>No se devuelve nada. Su ganancia ({{ gs(resolving.baseAmount) }}) se acredita a su saldo a favor normalmente.</small></span>
      </label>
      <label class="choice" [class.on]="outcome === 'InFavorOfBuyer'">
        <input type="radio" name="outcome" value="InFavorOfBuyer" [(ngModel)]="outcome" />
        <span><strong>A favor del comprador</strong><small>Se le devuelve todo ({{ gs(resolving.totalAmount) }}). El propietario no cobra y asume la comisión ({{ gs(resolving.commissionAmount) }}): se le descuenta de su saldo a favor o queda como deuda por gestión.</small></span>
      </label>

      <textarea class="reason" rows="3" maxlength="500" placeholder="Explicación para las dos partes (obligatoria)" [(ngModel)]="note"></textarea>
      <div class="confirm-footer">
        <p-button label="Volver" severity="secondary" [outlined]="true" [disabled]="busy" (onClick)="closeClaim()"></p-button>
        <p-button label="Resolver reclamo" icon="pi pi-check" [loading]="busy" [disabled]="!outcome || !note.trim()" (onClick)="confirmClaim()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
    .filters select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .tabs button {
      border: 1px solid rgba(19,133,182,0.25); background: #fff; color: var(--brand-ink); border-radius: 999px;
      padding: 0.45rem 0.95rem; font: inherit; font-weight: 600; cursor: pointer;
    }
    .tabs button.on { background: #1385b6; border-color: #1385b6; color: #fff; }
    .count { display: inline-block; min-width: 1.3rem; padding: 0 0.35rem; margin-left: 0.25rem; border-radius: 999px; background: #d92d20; color: #fff; font-size: 0.75rem; text-align: center; }
    .history { display: flex; align-items: center; gap: 0.4rem; color: var(--brand-muted); font-size: 0.85rem; }
    .note { color: var(--brand-muted); line-height: 1.5; margin: 0 0 1rem; }
    .mk-grid { grid-template-columns: 1.5fr 1.1fr 2fr 1fr 1.3fr 1.1fr; }
    .cl-grid { grid-template-columns: 1.6fr 1.3fr 2.4fr 1fr 1.2fr; }
    .db-grid { grid-template-columns: 1.4fr 1fr 2.4fr 1fr; }
    .name-cell { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
    .name-cell small { color: var(--brand-muted); }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; }
    @media (max-width: 900px) {
      .mk-grid, .cl-grid, .db-grid { grid-template-columns: 1fr; } .app-row.header { display: none; } .app-actions { justify-content: flex-start; }
    }

    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(580px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-panel.small { width: min(440px, calc(100vw - 2rem)); }
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
    .quote { margin: 0; padding: 0.6rem 0.8rem; background: var(--surface-ground, #f8fafc); border-radius: 10px; color: var(--brand-ink); line-height: 1.5; }
    .choice {
      display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.7rem 0.85rem; margin-bottom: 0.5rem;
      border: 1px solid rgba(19,133,182,0.2); border-radius: 12px; cursor: pointer;
    }
    .choice.on { border-color: #1385b6; background: rgba(19,133,182,0.06); }
    .choice span { display: flex; flex-direction: column; gap: 0.2rem; color: var(--brand-ink); }
    .choice small { color: var(--brand-muted); line-height: 1.45; }
    .confirm-text { margin: 0 0 1rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.2rem; }
    .reason {
      width: 100%; margin-top: 0.6rem; padding: 0.6rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; resize: vertical; box-sizing: border-box;
    }
  `]
})
export class MarketplaceFollowupPageComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  buildings: MarketplaceStaffBuilding[] = [];
  buildingId = '';
  tab: Tab = 'refunds';
  history = false;
  loading = true;
  pageError = '';
  busy = false;

  refunds: MarketplaceRefund[] = [];
  claims: MarketplaceClaim[] = [];
  debts: MarketplaceOwnerDebt[] = [];
  pendingRefunds = 0;
  openClaims = 0;

  returning: MarketplaceRefund | null = null;
  resolving: MarketplaceClaim | null = null;
  outcome: MarketplaceClaimOutcome | '' = '';
  note = '';

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

  setTab(tab: Tab): void {
    this.tab = tab;
    this.history = false;
    this.load();
  }

  load(): void {
    if (!this.buildingId) return;
    this.loading = true;
    this.pageError = '';
    const id = this.buildingId;

    // Los contadores de las solapas salen de lo pendiente (siempre se piden); si la solapa activa no pide historial, esa misma
    // respuesta es la lista que se muestra. Con historial se pide aparte la lista completa.
    this.api.getRefunds(id, false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.pendingRefunds = list.length;
        if (this.tab === 'refunds' && !this.history) { this.refunds = list; this.done(); }
        this.cdr.markForCheck();
      },
      error: err => { if (this.tab === 'refunds' && !this.history) this.fail(err, 'No se pudieron cargar los reembolsos.'); }
    });
    this.api.getClaims(id, false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.openClaims = list.length;
        if (this.tab === 'claims' && !this.history) { this.claims = list; this.done(); }
        this.cdr.markForCheck();
      },
      error: err => { if (this.tab === 'claims' && !this.history) this.fail(err, 'No se pudieron cargar los reclamos.'); }
    });
    this.api.getOwnerDebts(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => { this.debts = list; if (this.tab === 'debts') this.done(); this.cdr.markForCheck(); },
      error: err => { if (this.tab === 'debts') this.fail(err, 'No se pudieron cargar las deudas por gestión.'); }
    });

    if (this.history && this.tab === 'refunds') {
      this.api.getRefunds(id, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: list => { this.refunds = list; this.done(); },
        error: err => this.fail(err, 'No se pudieron cargar los reembolsos.')
      });
    } else if (this.history && this.tab === 'claims') {
      this.api.getClaims(id, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: list => { this.claims = list; this.done(); },
        error: err => this.fail(err, 'No se pudieron cargar los reclamos.')
      });
    }
  }

  private done(): void {
    this.loading = false;
    this.cdr.markForCheck();
  }

  private fail(err: unknown, fallback: string): void {
    this.pageError = extractApiErrorMessage(err, fallback);
    this.loading = false;
    this.cdr.markForCheck();
  }

  // ── Reembolsos ───────────────────────────────────────────────────────────

  askReturn(refund: MarketplaceRefund): void { this.returning = refund; this.cdr.markForCheck(); }
  closeReturn(): void { if (!this.busy) { this.returning = null; this.cdr.markForCheck(); } }

  confirmReturn(): void {
    const refund = this.returning;
    if (!refund || this.busy) return;
    this.busy = true;
    this.api.markRefundReturned(refund.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.finish('Reembolso marcado como devuelto'),
      error: err => this.failAction(err, 'No se pudo marcar el reembolso.')
    });
  }

  // ── Reclamos ─────────────────────────────────────────────────────────────

  openClaim(claim: MarketplaceClaim): void { this.resolving = claim; this.outcome = ''; this.note = ''; this.cdr.markForCheck(); }
  closeClaim(): void { if (!this.busy) { this.resolving = null; this.cdr.markForCheck(); } }

  confirmClaim(): void {
    const claim = this.resolving;
    if (!claim || !this.outcome || !this.note.trim() || this.busy) return;
    this.busy = true;
    this.api.resolveClaim(claim.id, this.outcome, this.note.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.finish('Reclamo resuelto'),
      error: err => this.failAction(err, 'No se pudo resolver el reclamo.')
    });
  }

  private finish(okText: string): void {
    this.busy = false;
    this.returning = null;
    this.resolving = null;
    this.msg.add({ severity: 'success', summary: okText, life: 4000 });
    this.load();
  }

  private failAction(err: unknown, fallback: string): void {
    this.busy = false;
    this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, fallback), life: 6000 });
    // Por ejemplo "este reclamo ya fue resuelto": se recarga para mostrar el estado real.
    this.returning = null;
    this.resolving = null;
    this.load();
  }

  // ── Formato ──────────────────────────────────────────────────────────────

  trackById(_: number, item: { id: string }): string { return item.id; }
  originLabel(origin: string): string { return ORIGIN_LABELS[origin] ?? origin; }

  gs(value: number): string {
    return 'Gs. ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  dateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  range(item: { startsAtUtc: string; endsAtUtc: string }): string {
    const s = new Date(item.startsAtUtc);
    const e = new Date(item.endsAtUtc);
    const day = (d: Date) => d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = (d: Date) => d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });
    return s.toDateString() === e.toDateString()
      ? `${day(s)} · ${time(s)}–${time(e)}`
      : `${day(s)} ${time(s)} → ${day(e)} ${time(e)}`;
  }
}

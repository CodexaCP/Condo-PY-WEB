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
import { MarketplaceHistoryDialogComponent } from './marketplace-history-dialog.component';
import { MarketplaceApiService } from '../../api/marketplace-api.service';
import { MarketplaceAccountRow, MarketplaceStaffBuilding, MarketplaceStatement } from '../../api/models';

type Dialog = 'adjust' | 'reverse' | null;

const KIND_LABELS: Record<string, string> = {
  PaymentIn: 'Ingreso por reserva',
  OwnerCredit: 'Acreditado al propietario',
  RefundOut: 'Devolución al comprador',
  Adjustment: 'Ajuste manual',
  CancellationFee: 'Comisión por cancelación del propietario'
};

const KIND_SEVERITY: Record<string, 'success' | 'info' | 'warn' | 'secondary'> = {
  PaymentIn: 'success',
  OwnerCredit: 'info',
  RefundOut: 'warn',
  Adjustment: 'secondary',
  CancellationFee: 'success'
};

// Cuenta aparte del marketplace de un edificio: extracto por período con exportación a Excel. No es una cuenta bancaria ni toca la
// contabilidad del edificio. Lo ven SuperAdmin, Administrador de empresa y Encargado; solo el SuperAdmin carga ajustes y revierte
// acreditaciones. La ganancia de la gestión (saldo menos lo pendiente de acreditar) se reparte fuera del sistema.
@Component({
  standalone: true,
  selector: 'app-marketplace-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag, MarketplaceHistoryDialogComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Cuenta del Marketplace</h1>
            <p>Lo cobrado por reservas, lo acreditado a los propietarios y lo que queda para la gestión. Es una cuenta contable aparte: no toca la contabilidad del edificio.</p>
          </div>
        </div>
      </div>

      <div class="filters">
        <select *ngIf="buildings.length" [ngModel]="buildingId" (ngModelChange)="onBuildingChange($event)">
          <option *ngFor="let b of buildings" [value]="b.buildingId">{{ b.buildingName }}</option>
        </select>
        <label class="date-field">Desde <input type="date" [(ngModel)]="from" (change)="load()" /></label>
        <label class="date-field">Hasta <input type="date" [(ngModel)]="to" (change)="load()" /></label>
        <span class="spacer"></span>
        <p-button type="button" label="Exportar a Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true"
                  [disabled]="!statement || exporting" [loading]="exporting" (onClick)="exportExcel()"></p-button>
        <p-button *ngIf="statement?.canEdit" type="button" label="Agregar ajuste" icon="pi pi-plus"
                  (onClick)="openAdjust()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando extracto...</p>
      <p class="app-state" *ngIf="!loading && !pageError && !buildings.length">El Marketplace no está disponible en ningún edificio de tu alcance.</p>

      <ng-container *ngIf="statement && !loading">
        <!-- Lo que queda para la gestión (hoy) -->
        <div class="gain-box">
          <div>
            <small>Saldo actual</small>
            <strong>{{ gs(statement.summary.currentBalance) }}</strong>
          </div>
          <div>
            <small>Pendiente de acreditar a propietarios</small>
            <strong>{{ gs(statement.summary.pendingToCredit) }}</strong>
          </div>
          <div *ngIf="statement.summary.pendingRefunds > 0">
            <small>Reembolsos pendientes de devolver</small>
            <strong>{{ gs(statement.summary.pendingRefunds) }}</strong>
          </div>
          <div *ngIf="statement.summary.ownerDebtsPending > 0">
            <small>Deudas por gestión por descontar</small>
            <strong>{{ gs(statement.summary.ownerDebtsPending) }}</strong>
          </div>
          <div class="gain">
            <small>Ganancia de la gestión (a repartir)</small>
            <strong>{{ gs(statement.summary.managementGain) }}</strong>
          </div>
        </div>

        <!-- Resumen del período -->
        <div class="summary">
          <div><small>Saldo inicial</small><strong>{{ gs(statement.summary.openingBalance) }}</strong></div>
          <div><small>Ingresos por reservas</small><strong>{{ gs(statement.summary.totalIn) }}</strong></div>
          <div><small>Acreditado a propietarios</small><strong>{{ gs(statement.summary.totalCredited) }}</strong></div>
          <div><small>Devuelto a compradores</small><strong>{{ gs(statement.summary.totalRefunds) }}</strong></div>
          <div><small>Ajustes manuales</small><strong>{{ gs(statement.summary.totalAdjustments) }}</strong></div>
          <div><small>Comisiones por cancelación</small><strong>{{ gs(statement.summary.totalCancellationFees) }}</strong></div>
          <div><small>Saldo final del período</small><strong>{{ gs(statement.summary.closingBalance) }}</strong></div>
        </div>

        <p class="app-state" *ngIf="!statement.rows.length">No hay movimientos en este período.</p>

        <div class="app-list" *ngIf="statement.rows.length">
          <div class="app-row header acc-grid">
            <span>Fecha</span>
            <span>Tipo</span>
            <span>Concepto</span>
            <span>Reserva</span>
            <span class="num">Importe</span>
            <span></span>
          </div>
          <div class="app-row acc-grid" *ngFor="let row of statement.rows; trackBy: trackById">
            <span>{{ dateTime(row.occurredAtUtc) }}</span>
            <p-tag [value]="kindLabel(row.kind)" [severity]="kindSeverity(row.kind)"></p-tag>
            <div class="name-cell">
              <span>{{ row.concept }}</span>
              <small>{{ row.createdByName ?? 'Automático' }}</small>
            </div>
            <span>{{ row.reference ?? '—' }}</span>
            <strong class="num" [class.neg]="row.amount < 0">{{ gs(row.amount) }}</strong>
            <div class="app-actions">
              <p-button *ngIf="row.reservationId" type="button" label="Historial" icon="pi pi-history" size="small" severity="secondary"
                        [outlined]="true" (onClick)="historyId = row.reservationId; cdr.markForCheck()"></p-button>
              <p-button *ngIf="row.canReverse" type="button" label="Revertir" icon="pi pi-undo" size="small" severity="danger"
                        [outlined]="true" (onClick)="openReverse(row)"></p-button>
            </div>
          </div>
        </div>
      </ng-container>
    </p-card>

    <app-marketplace-history-dialog [reservationId]="historyId" (closed)="historyId = null; cdr.markForCheck()"></app-marketplace-history-dialog>

    <div class="ov-backdrop" *ngIf="dialog" (click)="closeDialog()"></div>

    <!-- Ajuste manual -->
    <div class="ov-panel" *ngIf="dialog === 'adjust'" (click)="$event.stopPropagation()">
      <div class="ov-header"><strong>Agregar ajuste</strong><button class="ov-close" (click)="closeDialog()">✕</button></div>
      <p class="confirm-text">Movimiento manual de la cuenta, con signo: positivo suma, negativo resta. Queda registrado con tu nombre.</p>
      <label class="field"><span>Importe (Gs., con signo)</span>
        <input type="number" step="1" [(ngModel)]="adjustAmount" placeholder="Ej: 5000 o -2000" /></label>
      <label class="field"><span>Concepto</span>
        <input type="text" maxlength="300" [(ngModel)]="adjustConcept" placeholder="Qué es este movimiento" /></label>
      <p class="form-error" *ngIf="dialogError">{{ dialogError }}</p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" [disabled]="busy" (onClick)="closeDialog()"></p-button>
        <p-button label="Guardar" icon="pi pi-check" [loading]="busy" (onClick)="saveAdjust()"></p-button>
      </div>
    </div>

    <!-- Revertir acreditación -->
    <div class="ov-panel" *ngIf="dialog === 'reverse' && reverseTarget" (click)="$event.stopPropagation()">
      <div class="ov-header"><strong>Revertir acreditación</strong><button class="ov-close" (click)="closeDialog()">✕</button></div>
      <p class="confirm-text">
        Se quita {{ gs(-reverseTarget.amount) }} del saldo a favor del propietario ({{ reverseTarget.reference }}) y vuelve a la cuenta.
        Solo se puede mientras ese saldo no se haya usado en expensas.
      </p>
      <label class="field"><span>Motivo (obligatorio)</span>
        <textarea rows="3" maxlength="500" [(ngModel)]="reverseReason"></textarea></label>
      <p class="form-error" *ngIf="dialogError">{{ dialogError }}</p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" [disabled]="busy" (onClick)="closeDialog()"></p-button>
        <p-button label="Revertir" severity="danger" icon="pi pi-undo" [loading]="busy" [disabled]="!reverseReason.trim()" (onClick)="doReverse()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .filters { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: end; margin-bottom: 1rem; }
    .filters select, .filters input {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .date-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.78rem; color: var(--brand-muted); }
    .spacer { flex: 1; }
    .gain-box {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;
    }
    .gain-box > div { background: var(--surface-ground, #f8fafc); border-radius: 14px; padding: 0.9rem 1rem; display: flex; flex-direction: column; gap: 0.2rem; }
    .gain-box small, .summary small { color: var(--brand-muted); font-size: 0.78rem; }
    .gain-box strong { font-size: 1.25rem; color: var(--brand-ink); }
    .gain-box .gain { background: linear-gradient(135deg, #1385b6, #1ab7af); }
    .gain-box .gain small, .gain-box .gain strong { color: #fff; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.6rem; margin-bottom: 1.2rem; }
    .summary > div { border: 1px solid rgba(19,133,182,0.15); border-radius: 12px; padding: 0.6rem 0.8rem; display: flex; flex-direction: column; gap: 0.15rem; }
    .summary strong { color: var(--brand-ink); }
    .acc-grid { grid-template-columns: 1.1fr 1.3fr 3fr 1fr 1fr 1fr; }
    .name-cell { display: flex; flex-direction: column; gap: 0.15rem; }
    .name-cell small { color: var(--brand-muted); }
    .num { text-align: right; }
    .neg { color: #b42318; }
    @media (max-width: 900px) { .acc-grid { grid-template-columns: 1fr; } .app-row.header { display: none; } .num { text-align: left; } }

    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(480px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .ov-header strong { font-size: 1.15rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .confirm-text { margin: 0 0 1rem; color: var(--brand-ink); line-height: 1.6; }
    .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.8rem; color: var(--brand-ink); font-weight: 600; font-size: 0.9rem; }
    .field input, .field textarea {
      padding: 0.55rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px; font: inherit; font-weight: 400;
      box-sizing: border-box; width: 100%;
    }
    .form-error { color: #b42318; font-size: 0.9rem; margin: 0.3rem 0; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class MarketplaceAccountPageComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  readonly cdr = inject(ChangeDetectorRef);

  buildings: MarketplaceStaffBuilding[] = [];
  buildingId = '';
  from = '';
  to = '';

  statement: MarketplaceStatement | null = null;
  // Operación cuyo historial está abierto.
  historyId: string | null = null;
  loading = true;
  pageError = '';
  exporting = false;

  dialog: Dialog = null;
  dialogError = '';
  busy = false;
  adjustAmount: number | null = null;
  adjustConcept = '';
  reverseTarget: MarketplaceAccountRow | null = null;
  reverseReason = '';

  ngOnInit(): void {
    // Por defecto, el mes en curso (hora local).
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.to = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    this.from = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;

    // Solo los edificios con el Marketplace disponible donde el rol ve la cuenta: no se ofrece uno que respondería 403.
    this.api.getStaffBuildings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.buildings = list.filter(b => b.canViewAccount);
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

  load(): void {
    if (!this.buildingId) return;
    this.loading = true;
    this.pageError = '';
    this.api.getStatement(this.buildingId, this.from || undefined, this.to || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: statement => {
          this.statement = statement;
          this.loading = false;
          this.cdr.markForCheck();
        },
        // Si el Marketplace no está habilitado en el edificio o el rol no tiene acceso, el mensaje de la API lo explica.
        error: err => { this.statement = null; this.fail(err, 'No se pudo cargar el extracto.'); }
      });
  }

  private fail(err: unknown, fallback: string): void {
    this.pageError = extractApiErrorMessage(err, fallback);
    this.loading = false;
    this.cdr.markForCheck();
  }

  trackById(_: number, row: MarketplaceAccountRow): string { return row.id; }
  kindLabel(kind: string): string { return KIND_LABELS[kind] ?? kind; }
  kindSeverity(kind: string): 'success' | 'info' | 'warn' | 'secondary' { return KIND_SEVERITY[kind] ?? 'secondary'; }

  gs(value: number): string {
    const n = Math.round(value);
    return (n < 0 ? '-' : '') + 'Gs. ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.abs(n));
  }

  dateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ── Excel ────────────────────────────────────────────────────────────────

  exportExcel(): void {
    if (!this.statement || this.exporting) return;
    this.exporting = true;
    const fileName = `marketplace-cuenta-${this.from.replace(/-/g, '')}-${this.to.replace(/-/g, '')}.xlsx`;
    this.api.exportStatement(this.buildingId, this.from || undefined, this.to || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
          this.exporting = false;
          this.msg.add({ severity: 'success', summary: 'Excel generado', detail: fileName, life: 4000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.exporting = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo generar el Excel.'), life: 6000 });
          this.cdr.markForCheck();
        }
      });
  }

  // ── Diálogos (solo SuperAdmin) ───────────────────────────────────────────

  openAdjust(): void {
    this.adjustAmount = null;
    this.adjustConcept = '';
    this.dialogError = '';
    this.dialog = 'adjust';
    this.cdr.markForCheck();
  }

  openReverse(row: MarketplaceAccountRow): void {
    this.reverseTarget = row;
    this.reverseReason = '';
    this.dialogError = '';
    this.dialog = 'reverse';
    this.cdr.markForCheck();
  }

  closeDialog(): void {
    if (this.busy) return;
    this.dialog = null;
    this.reverseTarget = null;
    this.cdr.markForCheck();
  }

  saveAdjust(): void {
    if (this.busy) return;
    const amount = Number(this.adjustAmount);
    if (!this.adjustAmount || !Number.isFinite(amount) || amount === 0 || !Number.isInteger(amount)) {
      this.dialogError = 'Poné un importe entero, distinto de cero.';
      return;
    }
    if (!this.adjustConcept.trim()) {
      this.dialogError = 'Indicá el concepto.';
      return;
    }

    this.dialogError = '';
    this.busy = true;
    this.api.addAdjustment({ buildingId: this.buildingId, amount, concept: this.adjustConcept.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.busy = false;
          this.dialog = null;
          this.msg.add({ severity: 'success', summary: 'Ajuste guardado', life: 4000 });
          this.load();
        },
        error: err => {
          this.busy = false;
          this.dialogError = extractApiErrorMessage(err, 'No se pudo guardar el ajuste.');
          this.cdr.markForCheck();
        }
      });
  }

  doReverse(): void {
    const row = this.reverseTarget;
    if (!row?.reservationId || this.busy || !this.reverseReason.trim()) return;
    this.busy = true;
    this.api.reverseCredit(row.reservationId, this.reverseReason.trim())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.busy = false;
          this.dialog = null;
          this.reverseTarget = null;
          this.msg.add({ severity: 'success', summary: 'Acreditación revertida', life: 4000 });
          this.load();
        },
        error: err => {
          this.busy = false;
          this.dialogError = extractApiErrorMessage(err, 'No se pudo revertir la acreditación.');
          this.cdr.markForCheck();
        }
      });
  }
}

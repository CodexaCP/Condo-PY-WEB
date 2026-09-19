import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { InvoiceSeriesApiService } from '../../api/invoice-series-api.service';
import { InvoicesApiService } from '../../api/invoices-api.service';
import { PaymentsApiService } from '../../api/payments-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import { Building, Invoice, InvoiceSeries, InvoiceStatus, Payment, Unit } from '../../api/models';

const STATUS_LABEL: Record<InvoiceStatus, string> = { Draft: 'Borrador', Issued: 'Emitida', Voided: 'Anulada' };
const STATUS_SEV: Record<InvoiceStatus, 'warn' | 'success' | 'danger'> = { Draft: 'warn', Issued: 'success', Voided: 'danger' };

@Component({
  standalone: true,
  selector: 'app-invoices-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Facturas</h1>
            <p>Borrador, emisión y anulación de facturas a partir de pagos ya registrados.</p>
          </div>
        </div>

        <p-button
          *ngIf="canManage"
          [label]="showForm ? 'Cerrar formulario' : 'Nueva factura (borrador)'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <span class="pi pi-filter filters-icon"></span>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filters.buildingId" name="filterBuildingId" (ngModelChange)="onBuildingFilterChange()">
            <option value="">Todos</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Unidad</span>
          <select [(ngModel)]="filters.unitId" name="filterUnitId" (ngModelChange)="applyFilters()">
            <option value="">Todas</option>
            <option *ngFor="let u of filteredUnitsForSelector" [value]="u.id">{{ u.code }} · {{ u.buildingName }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Estado</span>
          <select [(ngModel)]="filters.status" name="filterStatus" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option value="Draft">Borrador</option>
            <option value="Issued">Emitida</option>
            <option value="Voided">Anulada</option>
          </select>
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" size="small" (onClick)="resetFilters()"></p-button>
      </div>

      <!-- Draft creation form -->
      <form class="panel-box form-panel" *ngIf="showForm" (ngSubmit)="submitDraft()">
        <div class="panel-box-title">
          <span class="pi pi-file-plus"></span>
          Nuevo borrador de factura
        </div>

        <div class="draft-form">
          <div class="field-block">
            <span>Edificio</span>
            <select [(ngModel)]="draftForm.buildingId" name="draftBuildingId" (ngModelChange)="onDraftBuildingChange()">
              <option value="">— Todos —</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="field-block wide2">
            <span>Pago a facturar <em>*</em></span>
            <select [(ngModel)]="draftForm.paymentId" name="paymentId" required>
              <option value="" disabled>— Seleccionar —</option>
              <option *ngFor="let p of paymentsForSelector" [value]="p.id">
                {{ p.unitCode }} · {{ p.buildingName }} · {{ p.paymentDate }} · {{ formatCurrency(p.amount) }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-footer">
          <div class="form-actions">
            <p-button type="submit" [disabled]="!draftForm.paymentId" [loading]="isSaving" icon="pi pi-file-plus" label="Crear borrador"></p-button>
          </div>
        </div>
      </form>

      <p class="app-state" *ngIf="loading">Cargando facturas...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay facturas cargadas.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header invoices-grid">
          <span>N° / Estado</span>
          <span>Edificio · Unidad</span>
          <span>Monto</span>
          <span>Fecha</span>
          <span class="actions-head">Acciones</span>
        </div>

        <div class="app-row invoices-grid" *ngFor="let item of items">
          <span>
            <strong>{{ item.numeroFormateado || 'Sin numerar' }}</strong>
            <p-tag [value]="statusLabel(item.status)" [severity]="statusSev(item.status)" styleClass="ml-2"></p-tag>
          </span>
          <span>{{ item.buildingName }} · {{ item.unitCode }}</span>
          <span>{{ formatCurrency(item.montoTotal) }}</span>
          <span>{{ fmtDate(item.fechaEmisionUtc || item.createdAtUtc) }}</span>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-eye" severity="secondary" [rounded]="true" [text]="true" pTooltip="Ver detalle" (onClick)="openDetail(item)"></p-button>
            <a [href]="getPdfUrl(item.id)" target="_blank" style="display:contents">
              <p-button type="button" icon="pi pi-file-pdf" severity="secondary" [rounded]="true" [text]="true" pTooltip="Descargar PDF"></p-button>
            </a>
          </div>
        </div>
      </div>
    </p-card>

    <!-- ══════════════════════════ DETAIL PANEL ══════════════════════════ -->
    <div class="ov-backdrop" *ngIf="detailVisible" (click)="closeDetail()"></div>
    <div class="ov-panel" *ngIf="detailVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <div>
          <strong>{{ detail?.numeroFormateado || 'Factura en borrador' }}</strong>
          <p-tag *ngIf="detail" [value]="statusLabel(detail.status)" [severity]="statusSev(detail.status)" styleClass="ml-2"></p-tag>
        </div>
        <button class="ov-close" (click)="closeDetail()">✕</button>
      </div>

      <div class="detail-grid" *ngIf="detail">
        <div class="detail-row"><span class="dl">Edificio</span><span class="dv">{{ detail.buildingName }}</span></div>
        <div class="detail-row"><span class="dl">Unidad</span><span class="dv">{{ detail.unitCode }}</span></div>
        <div class="detail-row" *ngIf="detail.seriesRazonSocial"><span class="dl">Emisor</span><span class="dv">{{ detail.seriesRazonSocial }} (RUC {{ detail.seriesRuc }})</span></div>
        <div class="detail-row" *ngIf="detail.seriesNumeroTimbrado"><span class="dl">Timbrado</span><span class="dv">{{ detail.seriesNumeroTimbrado }}</span></div>
        <div class="detail-row" *ngIf="detail.fechaEmisionUtc"><span class="dl">Fecha de emisión</span><span class="dv">{{ fmtDate(detail.fechaEmisionUtc) }}</span></div>
        <div class="detail-row" *ngIf="detail.motivoAnulacion"><span class="dl">Motivo anulación</span><span class="dv reject-reason">{{ detail.motivoAnulacion }}</span></div>

        <div class="detail-lines" *ngIf="detail.detalle.length">
          <span class="dl">Detalle</span>
          <div class="line-row" *ngFor="let line of detail.detalle">
            <span>{{ line.concepto }}</span>
            <strong>{{ formatCurrency(line.monto) }}</strong>
          </div>
        </div>
        <div class="detail-row total-row"><span class="dl">Total</span><span class="dv amount">{{ formatCurrency(detail.montoTotal) }}</span></div>
      </div>

      <div class="detail-actions">
        <a [href]="getPdfUrl(detail!.id)" target="_blank" style="display:contents">
          <p-button type="button" label="Descargar PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true"></p-button>
        </a>
      </div>

      <!-- Emitir (solo Draft) -->
      <div class="actions-section" *ngIf="detail?.status === 'Draft' && canManage && !voidMode">
        <div class="panel-box-title"><span class="pi pi-send"></span> Emitir factura</div>
        <p class="app-state" *ngIf="!seriesForBuilding.length">No hay timbrados activos para este edificio. Cargá uno primero en Timbrados.</p>
        <div class="emit-row" *ngIf="seriesForBuilding.length">
          <select [(ngModel)]="emitSeriesId" name="emitSeriesId" [ngModelOptions]="{standalone: true}">
            <option value="" disabled>— Seleccionar timbrado —</option>
            <option *ngFor="let s of seriesForBuilding" [value]="s.id">
              {{ s.establecimiento }}-{{ s.puntoExpedicion }}-{{ s.numeroTimbrado }} ({{ s.numerosDisponibles }} disponibles)
            </option>
          </select>
          <p-button label="Confirmar emisión" icon="pi pi-send" [loading]="isEmitting" [disabled]="!emitSeriesId" (onClick)="emit()"></p-button>
        </div>
      </div>

      <!-- Anular (solo Issued) -->
      <div class="actions-section" *ngIf="detail?.status === 'Issued' && canManage && !voidMode">
        <p-button label="Anular factura" icon="pi pi-times" severity="danger" [outlined]="true" (onClick)="voidMode = true"></p-button>
      </div>
      <div class="reject-form" *ngIf="voidMode">
        <label class="reject-label">
          <span>Motivo de anulación <span class="req">*</span></span>
          <textarea [(ngModel)]="voidReason" name="voidReason" rows="3" placeholder="Ej: se trabó la hoja al imprimir, se reemite con nuevo número..."></textarea>
        </label>
        <div class="reject-footer">
          <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="voidMode = false; voidReason = ''"></p-button>
          <p-button label="Confirmar anulación" severity="danger" icon="pi pi-times" [loading]="isVoiding" (onClick)="voidInvoice()"></p-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filters-bar {
      display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;
      padding: 0.75rem 1rem; background: rgba(20,54,61,0.04);
      border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.25rem;
    }
    .filters-icon { color: var(--brand-muted); font-size: 1rem; margin-bottom: 0.35rem; }
    .panel-box { border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
    .form-panel { border: 1.5px solid rgba(19,133,182,0.25); background: rgba(235,247,255,0.45); }
    .panel-box-title { font-weight: 700; font-size: 0.95rem; color: var(--brand-ink); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .panel-box-title .pi { color: var(--brand-blue); }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-block span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block em { color: #e53e3e; font-style: normal; }
    .field-block select, .field-block input {
      border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px;
      padding: 0.5rem 0.75rem; font-size: 0.92rem; color: var(--brand-ink);
      background: #fff; outline: none; width: 100%;
    }
    .draft-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .wide2 { grid-column: span 2; }
    .form-footer { display: flex; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid rgba(20,54,61,0.1); }
    .invoices-grid { grid-template-columns: 1.3fr 1.5fr 0.9fr 0.9fr 0.7fr; }
    .actions-head { text-align: right; }
    .ml-2 { margin-left: 0.4rem; }

    /* OVERLAY */
    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(600px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .ov-header > div { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .ov-header strong { font-size: 1.15rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }

    .detail-grid { display: grid; gap: 0.4rem; margin-bottom: 1rem; }
    .detail-row { display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem; padding: 0.35rem 0; border-bottom: 1px solid rgba(19,133,182,0.06); }
    .dl { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .dv { font-size: 0.9rem; color: var(--brand-ink); }
    .amount { font-weight: 700; }
    .reject-reason { color: #dc2626; font-style: italic; }
    .total-row .dv { font-weight: 700; }
    .detail-lines { margin: 0.5rem 0; padding: 0.5rem 0; border-top: 1px dashed rgba(19,133,182,0.15); border-bottom: 1px dashed rgba(19,133,182,0.15); }
    .line-row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.9rem; color: var(--brand-ink); }

    .detail-actions { display: flex; justify-content: flex-end; margin-bottom: 1rem; }

    .actions-section { display: flex; flex-direction: column; gap: 0.75rem; border-top: 1px solid rgba(19,133,182,0.1); padding-top: 1.2rem; }
    .emit-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .emit-row select { flex: 1; min-width: 220px; padding: 0.5rem 0.75rem; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; }

    .reject-form { border-top: 1px solid rgba(19,133,182,0.1); padding-top: 1.2rem; display: grid; gap: 1rem; }
    .reject-label > span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); display: block; margin-bottom: 0.4rem; }
    .reject-label textarea {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(220,38,38,0.4);
      border-radius: 10px; font: inherit; font-size: 0.95rem; resize: vertical; background: rgba(220,38,38,0.03);
    }
    .reject-footer { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .req { color: #dc2626; }

    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .draft-form { grid-template-columns: 1fr; }
      .wide2 { grid-column: span 1; }
    }
  `]
})
export class InvoicesPageComponent implements OnInit {
  private readonly invoicesApi = inject(InvoicesApiService);
  private readonly seriesApi = inject(InvoiceSeriesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get canManage(): boolean { return this.auth.hasRole('CompanyAdmin', 'BuildingManager'); }

  items: Invoice[] = [];
  private allItems: Invoice[] = [];
  buildings: Building[] = [];
  units: Unit[] = [];
  allSeries: InvoiceSeries[] = [];
  payments: Payment[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  filters = { buildingId: '', unitId: '', status: '' as InvoiceStatus | '' };
  draftForm = { buildingId: '', paymentId: '' };

  detailVisible = false;
  detail: Invoice | null = null;
  emitSeriesId = '';
  isEmitting = false;
  voidMode = false;
  voidReason = '';
  isVoiding = false;

  get filteredUnitsForSelector(): Unit[] {
    return this.filters.buildingId ? this.units.filter((u) => u.buildingId === this.filters.buildingId) : this.units;
  }

  get paymentsForSelector(): Payment[] {
    return this.draftForm.buildingId ? this.payments.filter((p) => p.buildingId === this.draftForm.buildingId) : this.payments;
  }

  get seriesForBuilding(): InvoiceSeries[] {
    if (!this.detail) return [];
    const today = new Date().toISOString().slice(0, 10);
    return this.allSeries.filter((s) =>
      s.buildingId === this.detail!.buildingId && s.activo && s.numerosDisponibles > 0 &&
      s.vigenciaDesde <= today && s.vigenciaHasta >= today);
  }

  ngOnInit(): void {
    this.loadData();
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.draftForm = { buildingId: '', paymentId: '' };
  }

  onDraftBuildingChange(): void {
    this.draftForm.paymentId = '';
  }

  onBuildingFilterChange(): void {
    if (!this.filteredUnitsForSelector.some((u) => u.id === this.filters.unitId)) this.filters.unitId = '';
    this.applyFilters();
  }

  applyFilters(): void {
    this.items = this.allItems.filter((item) =>
      (!this.filters.buildingId || item.buildingId === this.filters.buildingId) &&
      (!this.filters.unitId || item.unitId === this.filters.unitId) &&
      (!this.filters.status || item.status === this.filters.status)
    );
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.filters = { buildingId: '', unitId: '', status: '' };
    this.applyFilters();
  }

  submitDraft(): void {
    if (!this.draftForm.paymentId) return;
    this.isSaving = true;
    this.invoicesApi.createDraft(this.draftForm.paymentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (invoice) => {
        this.allItems = [invoice, ...this.allItems];
        this.applyFilters();
        this.draftForm = { buildingId: '', paymentId: '' };
        this.showForm = false;
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Borrador de factura creado.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        const status = (error as any)?.status;
        const fallback = status === 409 ? 'Este pago ya tiene una factura vigente.' : 'No se pudo crear el borrador.';
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, fallback), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  openDetail(item: Invoice): void {
    this.detail = item;
    this.detailVisible = true;
    this.emitSeriesId = '';
    this.voidMode = false;
    this.voidReason = '';
  }

  closeDetail(): void {
    this.detailVisible = false;
    this.detail = null;
    this.voidMode = false;
  }

  emit(): void {
    if (!this.detail || !this.emitSeriesId || this.isEmitting) return;
    this.isEmitting = true;
    this.invoicesApi.emit(this.detail.id, this.emitSeriesId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.updateItem(updated);
        this.isEmitting = false;
        this.msg.add({ severity: 'success', summary: 'Emitida', detail: `Factura ${updated.numeroFormateado} emitida.`, life: 5000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo emitir la factura.'), life: 5000 });
        this.isEmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  voidInvoice(): void {
    if (!this.detail || this.isVoiding) return;
    if (!this.voidReason.trim()) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El motivo de anulación es obligatorio.', life: 5000 });
      return;
    }
    this.isVoiding = true;
    this.invoicesApi.void(this.detail.id, this.voidReason.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.updateItem(updated);
        this.voidMode = false;
        this.isVoiding = false;
        this.msg.add({ severity: 'info', summary: 'Anulada', detail: 'Factura anulada. Se generó un borrador sucesor para reemitir.', life: 6000 });
        this.loadData();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo anular la factura.'), life: 5000 });
        this.isVoiding = false;
        this.cdr.markForCheck();
      }
    });
  }

  getPdfUrl(id: string): string {
    return this.invoicesApi.getPdfUrl(id, this.auth.getToken() ?? '');
  }

  statusLabel(s: InvoiceStatus): string { return STATUS_LABEL[s] ?? s; }
  statusSev(s: InvoiceStatus): 'warn' | 'success' | 'danger' { return STATUS_SEV[s] ?? 'warn'; }

  fmtDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private updateItem(updated: Invoice): void {
    this.allItems = this.allItems.map((x) => x.id === updated.id ? updated : x);
    this.detail = updated;
    this.applyFilters();
  }

  private loadData(): void {
    forkJoin({
      invoices: this.invoicesApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      units: this.unitsApi.getAll(),
      series: this.seriesApi.getAll(),
      payments: this.paymentsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ invoices, buildings, units, series, payments }) => {
        this.allItems = invoices;
        this.buildings = buildings;
        this.units = units;
        this.allSeries = series;
        this.payments = payments.filter((p) => !p.isReversed);
        this.loading = false;
        this.applyFilters();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar las facturas.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}

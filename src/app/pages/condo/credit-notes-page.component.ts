import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AuthService } from '../../auth/auth.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CreditNotesApiService } from '../../api/credit-notes-api.service';
import { Building, CreditNote, CreditNoteStatus } from '../../api/models';

const STATUS_LABEL: Record<CreditNoteStatus, string> = {
  Draft: 'Borrador', Approved: 'Aprobada', Rejected: 'Rechazada', Voided: 'Anulada'
};
const STATUS_SEV: Record<CreditNoteStatus, 'warn' | 'success' | 'danger' | 'secondary'> = {
  Draft: 'warn', Approved: 'success', Rejected: 'danger', Voided: 'secondary'
};

@Component({
  standalone: true,
  selector: 'app-credit-notes-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Notas de Crédito</h1>
            <p>Consulta: ajustes internos sobre facturas emitidas, su estado y el documento fiscal oficial asociado.</p>
          </div>
        </div>
      </div>

      <!-- Resumen -->
      <div class="kpi-grid" *ngIf="!loading">
        <div class="kpi">
          <span class="kpi-label">Total</span>
          <span class="kpi-value">{{ items.length }}</span>
        </div>
        <div class="kpi kpi-warn">
          <span class="kpi-label">Borrador</span>
          <span class="kpi-value">{{ countByStatus('Draft') }}</span>
        </div>
        <div class="kpi kpi-success">
          <span class="kpi-label">Aprobadas</span>
          <span class="kpi-value">{{ countByStatus('Approved') }}</span>
          <span class="kpi-sub">-{{ formatGs(amountByStatus('Approved')) }}</span>
        </div>
        <div class="kpi kpi-danger">
          <span class="kpi-label">Rechazadas</span>
          <span class="kpi-value">{{ countByStatus('Rejected') }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Anuladas</span>
          <span class="kpi-value">{{ countByStatus('Voided') }}</span>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filters-bar">
        <span class="pi pi-filter filters-icon"></span>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filterBuildingId" name="filterBuildingId" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Estado</span>
          <select [(ngModel)]="filterStatus" name="filterStatus" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option value="Draft">Borrador</option>
            <option value="Approved">Aprobada</option>
            <option value="Rejected">Rechazada</option>
            <option value="Voided">Anulada</option>
          </select>
        </div>
        <div class="field-block wide">
          <span>Buscar</span>
          <input type="text" [(ngModel)]="filterSearch" name="filterSearch" (ngModelChange)="applyFilters()"
                 placeholder="Motivo, factura, unidad o edificio...">
        </div>
        <p-button label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" size="small" (onClick)="resetFilters()"></p-button>
      </div>

      <p class="app-state" *ngIf="loading">Cargando notas de crédito...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay notas de crédito registradas.</p>
      <p class="app-state" *ngIf="!loading && items.length && !filteredItems.length">Ningún resultado con estos filtros.</p>

      <div class="app-list" *ngIf="filteredItems.length">
        <div class="app-row header cn-grid">
          <span>Motivo</span>
          <span>Factura</span>
          <span>Edificio · Unidad</span>
          <span class="right">Importe</span>
          <span>Estado</span>
          <span>Creada</span>
          <span class="actions-head">Detalle</span>
        </div>

        <div class="app-row cn-grid" *ngFor="let cn of filteredItems">
          <span class="motivo-cell" [title]="cn.motivo">{{ cn.motivo }}</span>
          <span class="monospace">{{ cn.invoiceNumeroFormateado || 'Borrador' }}</span>
          <span>
            {{ cn.buildingName }}
            <small class="sub-text">Unidad {{ cn.unitCode }}</small>
          </span>
          <span class="right amount">-{{ formatGs(cn.amount) }}</span>
          <p-tag [value]="statusLabel(cn.status)" [severity]="statusSeverity(cn.status)"></p-tag>
          <span>
            {{ cn.createdAtUtc | date:'dd/MM/yyyy' }}
            <small class="sub-text">{{ cn.createdByName }}</small>
          </span>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-eye" severity="secondary" [rounded]="true" [text]="true"
                      (onClick)="openDetail(cn)"></p-button>
          </div>
        </div>
      </div>
    </p-card>

    <!-- Detalle (solo lectura) -->
    <div class="drawer-backdrop" *ngIf="detail" (click)="closeDetail()"></div>
    <div class="drawer" *ngIf="detail">
      <div class="drawer-head">
        <h2>Nota de crédito</h2>
        <button type="button" class="drawer-close" (click)="closeDetail()"><i class="pi pi-times"></i></button>
      </div>

      <div class="drawer-body" *ngIf="!detailLoading">
        <div class="drawer-top">
          <p-tag [value]="statusLabel(detail!.status)" [severity]="statusSeverity(detail!.status)"></p-tag>
          <strong class="drawer-amount">-{{ formatGs(detail!.amount) }}</strong>
        </div>

        <a class="drawer-attachment" [href]="pdfUrl(detail!.id)" target="_blank" rel="noopener">
          <i class="pi pi-file-pdf"></i> Descargar PDF de la nota de crédito
        </a>

        <p class="drawer-motivo">{{ detail!.motivo }}</p>

        <div class="drawer-section">
          <h4>Comprobante original</h4>
          <p>Factura {{ detail!.invoiceNumeroFormateado || 'Borrador' }} · {{ detail!.buildingName }} · Unidad {{ detail!.unitCode }}</p>
          <p class="sub-text">Monto de la factura: {{ formatGs(detail!.invoiceMontoTotal) }}</p>
        </div>

        <div class="drawer-section">
          <h4>Líneas ajustadas</h4>
          <div class="drawer-lines">
            <div class="drawer-line" *ngFor="let l of detail!.lines">
              <span>{{ l.chargeConcept }}</span>
              <span class="amount">-{{ formatGs(l.amount) }}</span>
            </div>
          </div>
        </div>

        <div class="drawer-section" *ngIf="detail!.status === 'Rejected' && detail!.rejectionReason">
          <h4>Motivo de rechazo</h4>
          <p>{{ detail!.rejectionReason }} <span class="sub-text">— {{ detail!.rejectedByName }}, {{ detail!.rejectedAtUtc | date:'dd/MM/yyyy' }}</span></p>
        </div>

        <div class="drawer-section" *ngIf="detail!.status === 'Voided' && detail!.voidReason">
          <h4>Motivo de anulación</h4>
          <p>{{ detail!.voidReason }} <span class="sub-text">— {{ detail!.voidedByName }}, {{ detail!.voidedAtUtc | date:'dd/MM/yyyy' }}</span></p>
        </div>

        <div class="drawer-section" *ngIf="detail!.status === 'Approved' || detail!.status === 'Voided'">
          <h4>Aprobación</h4>
          <p>{{ detail!.approvedByName }}, {{ detail!.approvedAtUtc | date:'dd/MM/yyyy HH:mm' }}</p>
        </div>

        <div class="drawer-section">
          <h4>Documento fiscal oficial</h4>
          <p *ngIf="!detail!.fiscalNumero && !detail!.numero" class="sub-text">Sin datos fiscales registrados todavía.</p>
          <div *ngIf="detail!.fiscalNumero || detail!.numero">
            <p><strong>{{ detail!.fiscalNumero }}</strong> <span *ngIf="detail!.numero" class="sub-text">(numerada automáticamente)</span></p>
            <p class="sub-text" *ngIf="detail!.fiscalTimbrado">Timbrado {{ detail!.fiscalTimbrado }}</p>
            <p class="sub-text" *ngIf="detail!.fiscalCdc">CDC {{ detail!.fiscalCdc }}</p>
            <p class="sub-text" *ngIf="detail!.fiscalFechaEmisionUtc">Emitida el {{ detail!.fiscalFechaEmisionUtc | date:'dd/MM/yyyy' }}</p>
            <p class="sub-text" *ngIf="detail!.fiscalEstado">Estado: {{ detail!.fiscalEstado }}</p>
            <p class="sub-text" *ngIf="detail!.fiscalObservaciones">{{ detail!.fiscalObservaciones }}</p>
          </div>
        </div>

        <div class="drawer-section" *ngIf="detail!.attachments.length">
          <h4>Adjuntos</h4>
          <div class="drawer-attachments">
            <a *ngFor="let att of detail!.attachments" [href]="att.url" target="_blank" rel="noopener" class="drawer-attachment">
              <i class="pi pi-paperclip"></i> {{ att.fileName }}
            </a>
          </div>
        </div>
      </div>

      <p class="app-state" *ngIf="detailLoading">Cargando detalle...</p>
    </div>
  `,
  styles: [`
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.9rem; margin-bottom: 1.25rem; }
    .kpi { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.8rem 1rem; border-radius: 12px; background: rgba(20,54,61,0.04); border: 1px solid rgba(20,54,61,0.1); }
    .kpi-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--brand-muted); }
    .kpi-value { font-size: 1.3rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi-sub { font-size: 0.78rem; color: var(--brand-muted); font-family: monospace; }
    .kpi-warn .kpi-value { color: #92400e; }
    .kpi-success .kpi-value { color: #166534; }
    .kpi-danger .kpi-value { color: #991b1b; }

    .filters-bar {
      display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;
      padding: 0.75rem 1rem; background: rgba(20,54,61,0.04);
      border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.25rem;
    }
    .filters-icon { color: var(--brand-muted); font-size: 1rem; margin-bottom: 0.35rem; }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-block.wide { flex: 1; min-width: 200px; }
    .field-block span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block select, .field-block input {
      border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px;
      padding: 0.5rem 0.75rem; font-size: 0.92rem; color: var(--brand-ink);
      background: #fff; outline: none; width: 100%; box-sizing: border-box;
    }

    .cn-grid { grid-template-columns: 1.6fr 1fr 1.4fr 1fr 0.9fr 1fr 0.5fr; }
    .actions-head { text-align: right; }
    .motivo-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub-text { display: block; font-size: 0.78rem; color: var(--brand-muted); }
    .monospace { font-family: monospace; }
    .amount { font-family: monospace; font-weight: 700; color: #b91c1c; }
    .right { text-align: right; }

    .drawer-backdrop { position: fixed; inset: 0; background: rgba(15,40,60,0.35); z-index: 1000; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: min(480px, 100vw);
      background: #fff; z-index: 1001; overflow-y: auto; box-shadow: -8px 0 24px rgba(15,40,60,0.18);
      padding: 1.25rem 1.5rem;
    }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .drawer-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--brand-muted); }
    .drawer-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    .drawer-amount { font-family: monospace; font-size: 1.2rem; color: #b91c1c; }
    .drawer-motivo { font-size: 0.92rem; margin-bottom: 1rem; }
    .drawer-section { margin-bottom: 1.1rem; padding-bottom: 1.1rem; border-bottom: 1px dashed rgba(20,54,61,0.14); }
    .drawer-section h4 { margin: 0 0 0.4rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--brand-muted); }
    .drawer-section p { margin: 0.2rem 0; font-size: 0.9rem; }
    .drawer-lines { display: grid; gap: 0.3rem; }
    .drawer-line { display: flex; justify-content: space-between; font-size: 0.88rem; }
    .drawer-attachments { display: grid; gap: 0.4rem; }
    .drawer-attachment { display: inline-flex; gap: 0.4rem; align-items: center; color: var(--p-primary-color); text-decoration: none; font-size: 0.88rem; }

    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .cn-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CreditNotesPageComponent implements OnInit {
  private readonly creditNotesApi = inject(CreditNotesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);
  private readonly auth = inject(AuthService);

  items: CreditNote[] = [];
  filteredItems: CreditNote[] = [];
  buildings: Building[] = [];
  loading = true;

  filterBuildingId = '';
  filterStatus: CreditNoteStatus | '' = '';
  filterSearch = '';

  detail: CreditNote | null = null;
  detailLoading = false;

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    forkJoin({
      items: this.creditNotesApi.getAll(),
      buildings: this.buildingsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items, buildings }) => {
        this.items = items;
        this.buildings = buildings;
        this.loading = false;
        this.applyFilters();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar las notas de crédito.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    const search = this.filterSearch.trim().toLowerCase();
    this.filteredItems = this.items.filter(x =>
      (!this.filterBuildingId || x.buildingId === this.filterBuildingId) &&
      (!this.filterStatus || x.status === this.filterStatus) &&
      (!search ||
        x.motivo.toLowerCase().includes(search) ||
        (x.invoiceNumeroFormateado ?? '').toLowerCase().includes(search) ||
        x.unitCode.toLowerCase().includes(search) ||
        x.buildingName.toLowerCase().includes(search)));
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.filterBuildingId = '';
    this.filterStatus = '';
    this.filterSearch = '';
    this.applyFilters();
  }

  countByStatus(status: CreditNoteStatus): number {
    return this.items.filter(x => x.status === status).length;
  }

  amountByStatus(status: CreditNoteStatus): number {
    return this.items.filter(x => x.status === status).reduce((sum, x) => sum + x.amount, 0);
  }

  openDetail(cn: CreditNote): void {
    this.detail = cn;
    this.detailLoading = true;
    this.creditNotesApi.getById(cn.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: full => { this.detail = full; this.detailLoading = false; this.cdr.markForCheck(); },
      error: err => {
        this.detailLoading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo cargar el detalle.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  closeDetail(): void {
    this.detail = null;
  }

  statusLabel(status: CreditNoteStatus): string { return STATUS_LABEL[status]; }
  pdfUrl(id: string): string { return this.creditNotesApi.getPdfUrl(id, this.auth.getToken() ?? ''); }
  statusSeverity(status: CreditNoteStatus): 'warn' | 'success' | 'danger' | 'secondary' { return STATUS_SEV[status]; }

  formatGs(value: number): string {
    return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }
}

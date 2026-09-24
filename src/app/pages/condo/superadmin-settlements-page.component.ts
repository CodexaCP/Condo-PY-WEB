import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { CompaniesApiService } from '../../api/companies-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { Building, Company, ExpensePeriod, ExpenseSettlementSummary } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-superadmin-settlements-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, Message],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Liquidaciones — todas las empresas</h1>
          <p>Ubicá cualquier período por empresa y edificio. Desde acá podés deshacer una publicación hecha por error.</p>
        </div>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>

      <div class="filters-bar">
        <div class="field-block">
          <span>Empresa</span>
          <select [(ngModel)]="companyId" (ngModelChange)="onCompanyChange()">
            <option value="">— Seleccionar —</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="buildingId" (ngModelChange)="onBuildingChange()" [disabled]="!companyId">
            <option value="">— Seleccionar —</option>
            <option *ngFor="let b of filteredBuildings" [value]="b.id">{{ b.name }} ({{ b.code }})</option>
          </select>
        </div>
        <div class="field-block">
          <span>Período</span>
          <select [(ngModel)]="periodId" (ngModelChange)="onPeriodChange()" [disabled]="!buildingId">
            <option value="">— Seleccionar —</option>
            <option *ngFor="let p of filteredPeriods" [value]="p.id">{{ p.name }}</option>
          </select>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>

      <div class="detail-block" *ngIf="!loading && selectedPeriod">
        <div class="detail-header">
          <div>
            <h2>{{ selectedPeriod.name }}</h2>
            <p class="detail-sub">{{ selectedBuildingName }}</p>
          </div>
          <p-tag [value]="statusLabel(selectedPeriod.status)" [severity]="statusSeverity(selectedPeriod.status)"></p-tag>
        </div>

        <p class="app-state" *ngIf="loadingSettlement">Cargando liquidación...</p>

        <div class="settlement-info" *ngIf="!loadingSettlement && settlement">
          <div class="detail-row" *ngIf="settlement.publishedAtUtc">
            <span class="detail-lbl">Publicado</span>
            <span class="detail-val">{{ settlement.publishedByUserName }} · {{ settlement.publishedAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-lbl">Monto neto</span>
            <span class="detail-val">{{ settlement.netCommonAmount | number:'1.0-0' }} Gs.</span>
          </div>
        </div>

        <ng-container *ngIf="!loadingSettlement && selectedPeriod.status === 'Published'">
          <p-button *ngIf="!showUnpublishForm" label="Deshacer publicación" icon="pi pi-history" severity="danger" [outlined]="true"
                    (onClick)="showUnpublishForm = true"></p-button>

          <div class="reject-form" *ngIf="showUnpublishForm">
            <label class="field-label">Motivo <span class="required">*</span></label>
            <textarea [(ngModel)]="unpublishReason" rows="4" maxlength="500"
                      placeholder="Por qué se deshace esta publicación (obligatorio, máx. 500 caracteres)..."
                      class="reject-textarea"></textarea>
            <div class="reject-actions">
              <span class="char-count">{{ unpublishReason.length }}/500</span>
              <div style="display:flex; gap:0.5rem;">
                <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="showUnpublishForm = false; unpublishReason = ''"></p-button>
                <p-button label="Confirmar" icon="pi pi-history" severity="danger"
                          [loading]="unpublishing" [disabled]="!unpublishReason.trim()"
                          (onClick)="confirmUnpublish()"></p-button>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </p-card>
  `,
  styles: [`
    .filters-bar { display:flex; align-items:flex-end; gap:1rem; flex-wrap:wrap; margin:1.25rem 0; }
    .field-block { display:flex; flex-direction:column; gap:0.35rem; min-width:220px; }
    .field-block span { font-size:0.82rem; font-weight:600; color:var(--brand-muted); }
    .field-block select {
      padding:0.55rem 0.75rem; border:1px solid rgba(19,133,182,0.25); border-radius:10px;
      font:inherit; font-size:0.9rem; background:#fff;
    }
    .field-block select:disabled { background:#f4f7f8; color:var(--brand-muted); }

    .detail-block { margin-top:1.5rem; padding-top:1.25rem; border-top:1px solid rgba(19,133,182,0.1); }
    .detail-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
    .detail-header h2 { margin:0; font-size:1.1rem; }
    .detail-sub { margin:0.15rem 0 0; font-size:0.85rem; color:var(--brand-muted); }

    .settlement-info { margin-bottom:1.25rem; }
    .detail-row {
      display:flex; justify-content:space-between; padding:0.5rem 0;
      border-bottom:1px solid rgba(19,133,182,0.08); font-size:0.9rem;
    }
    .detail-lbl { color:var(--brand-muted); }
    .detail-val { font-weight:600; }

    .reject-form {
      margin-top: 1rem; padding: 1rem; border-radius: 8px;
      background: rgba(220,38,38,0.05);
      border: 1px solid rgba(220,38,38,0.25);
    }
    .reject-textarea {
      width: 100%; box-sizing: border-box; padding: 0.6rem 0.8rem;
      border: 1px solid #cbd5d1; border-radius: 6px; resize: vertical;
      font-family: inherit; font-size: 0.9rem; margin-bottom: 0.75rem;
      background: white;
    }
    .reject-textarea:focus { outline: none; border-color: #1385b6; }
    .reject-actions { display: flex; justify-content: space-between; align-items: center; }
    .char-count { font-size: 0.8rem; color: #6b878d; }
    .field-label { display: block; font-size: 0.85rem; font-weight: 600; color: #14363d; margin-bottom: 0.4rem; }
    .field-label .required { color: #dc2626; }
  `]
})
export class SuperadminSettlementsPageComponent implements OnInit {
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi   = inject(ExpensePeriodsApiService);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly cdr          = inject(ChangeDetectorRef);
  private readonly msg          = inject(MessageService);

  companies: Company[] = [];
  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];

  companyId = '';
  buildingId = '';
  periodId = '';

  loading = true;
  loadingSettlement = false;
  pageError = '';

  settlement: ExpenseSettlementSummary | null = null;
  showUnpublishForm = false;
  unpublishReason = '';
  unpublishing = false;

  get filteredBuildings(): Building[] {
    return this.buildings.filter(b => b.companyId === this.companyId).sort((a, b) => a.name.localeCompare(b.name));
  }

  get filteredPeriods(): ExpensePeriod[] {
    return this.periods
      .filter(p => p.buildingId === this.buildingId)
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }

  get selectedPeriod(): ExpensePeriod | null {
    return this.periods.find(p => p.id === this.periodId) ?? null;
  }

  get selectedBuildingName(): string {
    return this.buildings.find(b => b.id === this.buildingId)?.name ?? '';
  }

  ngOnInit(): void {
    forkJoin({
      companies: this.companiesApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      periods: this.periodsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ companies, buildings, periods }) => {
        this.companies = companies.sort((a, b) => a.name.localeCompare(b.name));
        this.buildings = buildings;
        this.periods = periods;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageError = 'No se pudieron cargar los datos.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onCompanyChange(): void {
    this.buildingId = '';
    this.periodId = '';
    this.settlement = null;
    this.showUnpublishForm = false;
  }

  onBuildingChange(): void {
    this.periodId = '';
    this.settlement = null;
    this.showUnpublishForm = false;
  }

  onPeriodChange(): void {
    this.showUnpublishForm = false;
    this.unpublishReason = '';
    if (!this.periodId) { this.settlement = null; return; }

    this.loadingSettlement = true;
    this.periodsApi.getSettlement(this.periodId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => { this.settlement = s; this.loadingSettlement = false; this.cdr.markForCheck(); },
      error: () => { this.settlement = null; this.loadingSettlement = false; this.cdr.markForCheck(); }
    });
  }

  confirmUnpublish(): void {
    if (!this.periodId || !this.unpublishReason.trim()) return;

    this.unpublishing = true;
    this.periodsApi.unpublishSettlement(this.periodId, { rejectionReason: this.unpublishReason.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: s => {
          this.settlement = s;
          this.unpublishing = false;
          this.showUnpublishForm = false;
          this.unpublishReason = '';
          const idx = this.periods.findIndex(p => p.id === this.periodId);
          if (idx >= 0) this.periods[idx] = { ...this.periods[idx], status: 'Draft' };
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Publicación deshecha. El período volvió a preparación.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.unpublishing = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo deshacer la publicación.'), life: 6000 });
          this.cdr.markForCheck();
        }
      });
  }

  statusLabel(status: string): string {
    return status === 'Draft' ? 'Borrador' : status === 'Closed' ? 'Cerrado' : 'Publicado';
  }

  statusSeverity(status: string): 'success' | 'warn' | 'info' {
    return status === 'Published' ? 'success' : status === 'Closed' ? 'info' : 'warn';
  }
}

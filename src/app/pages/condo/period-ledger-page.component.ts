import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { Building, ExpensePeriod, ExpensePeriodReconciliation } from '../../api/models';
import { BuildingExpensesPageComponent } from './building-expenses-page.component';
import { PeriodCreditNotesSectionComponent } from './period-credit-notes-section.component';
import { BuildingIncomesPageComponent } from './building-incomes-page.component';
import { PeriodChargesSectionComponent } from './period-charges-section.component';

type LedgerTab = 'expenses' | 'incomes' | 'charges';

const STATUS_LABELS: Record<string, string> = { Draft: 'Borrador', Closed: 'Cerrado (en revisión)', Published: 'Publicado' };

// Gastos y cargos: una sola pantalla por edificio y periodo. El gasto es la causa y el cargo la consecuencia:
// Gastos e Ingresos se cargan en borrador, Cargos es lo que se cobra a cada unidad (vista previa en borrador, cargos
// reales una vez aprobada la liquidacion) y la conciliacion muestra que ambos lados cierran.
@Component({
  standalone: true,
  selector: 'app-period-ledger-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, BuildingExpensesPageComponent, BuildingIncomesPageComponent, PeriodChargesSectionComponent, PeriodCreditNotesSectionComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Gastos y cargos</h1>
            <p>Lo que gasta el edificio, lo que ingresa y lo que se cobra a cada unidad, en un solo lugar por periodo.</p>
          </div>
        </div>
        <p-button label="Liquidación del periodo" icon="pi pi-calculator" severity="secondary" [outlined]="true" (onClick)="goToPeriods()"></p-button>
      </div>

      <!-- Edificio y periodo -->
      <div class="selectors">
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="buildingId" name="ledgerBuilding" (ngModelChange)="onBuildingChange()">
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Periodo</span>
          <select [(ngModel)]="periodId" name="ledgerPeriod" (ngModelChange)="onPeriodChange()">
            <option value="" disabled>— Seleccionar —</option>
            <option *ngFor="let p of buildingPeriods" [value]="p.id">{{ p.name }}</option>
          </select>
        </div>
        <p-tag *ngIf="period" [value]="statusLabel(period.status)" [severity]="period.status === 'Published' ? 'success' : period.status === 'Closed' ? 'info' : 'warn'"></p-tag>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>
      <p class="app-state" *ngIf="!loading && !buildings.length">No hay edificios disponibles.</p>
      <p class="app-state" *ngIf="!loading && buildings.length && !buildingPeriods.length">Este edificio todavía no tiene periodos. Creá uno desde Periodos.</p>

      <!-- Conciliacion: gastos + aportes - ingresos = cargos -->
      <div class="recon" *ngIf="period && recon">
        <div class="recon-head">
          <strong>Conciliación del periodo</strong>
          <p-tag *ngIf="recon.state === 'Preview'" value="Vista previa" severity="info"></p-tag>
          <p-tag *ngIf="recon.state === 'Reconciled'" value="Conciliado" severity="success"></p-tag>
          <p-tag *ngIf="recon.state === 'Difference'" value="Con diferencia" severity="danger"></p-tag>
          <p-tag *ngIf="recon.state === 'Error'" value="No se puede calcular" severity="danger"></p-tag>
          <p-button type="button" icon="pi pi-refresh" severity="secondary" [text]="true" [rounded]="true" size="small" [loading]="reconLoading" (onClick)="loadRecon()" title="Actualizar"></p-button>
        </div>
        <p class="recon-msg" *ngIf="recon.message">{{ recon.message }}</p>

        <div class="recon-grid" *ngIf="recon.state !== 'Error'">
          <div class="recon-row"><span>Gastos del periodo <small>(sin los pagados por el fondo de reserva)</small></span><strong>{{ money(recon.totalExpenses) }}</strong></div>
          <div class="recon-row minus" *ngIf="recon.nonDistributedExpenses"><span>(−) No distribuidos <small>no se cobran a las unidades</small></span><strong>{{ money(recon.nonDistributedExpenses) }}</strong></div>
          <div class="recon-row minus" *ngIf="recon.incomesCredited"><span>(−) Ingresos acreditados a los propietarios</span><strong>{{ money(recon.incomesCredited) }}</strong></div>
          <div class="recon-row plus" *ngIf="recon.reserveContribution"><span>(+) Aporte al fondo de reserva</span><strong>{{ money(recon.reserveContribution) }}</strong></div>
          <div class="recon-row plus" *ngIf="recon.extraordinaryContribution"><span>(+) Aporte extraordinario</span><strong>{{ money(recon.extraordinaryContribution) }}</strong></div>
          <div class="recon-row total"><span>Cargos esperados</span><strong>{{ money(recon.expectedCharges) }}</strong></div>
          <div class="recon-row" *ngIf="recon.state !== 'Preview'"><span>Cargos emitidos por la liquidación</span><strong>{{ money(recon.issuedCharges) }}</strong></div>
          <div class="recon-row bad" *ngIf="recon.state === 'Difference'"><span>Diferencia</span><strong>{{ money(recon.difference) }}</strong></div>
        </div>

        <div class="collect" *ngIf="recon.totalCharged !== 0">
          <div class="collect-bar"><div class="collect-fill" [style.width.%]="collectedPercent"></div></div>
          <div class="collect-nums">
            <span>Cargado <strong>{{ money(recon.totalCharged) }}</strong></span>
            <span>Cobrado <strong>{{ money(recon.collected) }}</strong></span>
            <span>Pendiente <strong>{{ money(recon.pending) }}</strong></span>
            <span *ngIf="recon.lateFeeAmount">incluye mora <strong>{{ money(recon.lateFeeAmount) }}</strong></span>
          </div>
        </div>
      </div>

      <!-- Secciones -->
      <div class="tabs" *ngIf="period">
        <button type="button" class="tab" [class.active]="tab === 'expenses'" (click)="setTab('expenses')"><i class="pi pi-arrow-circle-down"></i> Gastos</button>
        <button type="button" class="tab" [class.active]="tab === 'incomes'" (click)="setTab('incomes')"><i class="pi pi-arrow-circle-up"></i> Ingresos</button>
        <button type="button" class="tab" [class.active]="tab === 'charges'" (click)="setTab('charges')">
          <i class="pi pi-tags"></i> Cargos por unidad
          <span class="tab-badge" *ngIf="recon && recon.manualChargeCount">{{ recon.manualChargeCount }} legacy</span>
        </button>
      </div>
      <p class="hint" *ngIf="period && tab !== 'charges' && period.status !== 'Draft'">
        Este periodo ya no está en borrador: los gastos e ingresos no se pueden modificar. Si hay que corregir algo, se hace con una nota de crédito.
      </p>
    </p-card>

    <app-building-expenses-page *ngIf="period && tab === 'expenses'" [embedded]="true" [scopeBuildingId]="buildingId" [scopePeriodId]="periodId"></app-building-expenses-page>
    <app-period-credit-notes-section *ngIf="period && tab === 'expenses' && buildingId" [buildingId]="buildingId" [periodId]="periodId"></app-period-credit-notes-section>
    <app-building-incomes-page *ngIf="period && tab === 'incomes'" [embedded]="true" [scopeBuildingId]="buildingId" [scopePeriodId]="periodId"></app-building-incomes-page>
    <p-card styleClass="app-page-card" *ngIf="period && tab === 'charges'">
      <app-period-charges-section [periodId]="periodId" [periodStatus]="period.status" (changed)="loadRecon()"></app-period-charges-section>
    </p-card>
  `,
  styles: [`
    .selectors { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.2rem; }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; min-width: 220px; }
    .field-block > span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block select { border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; padding: 0.5rem 0.75rem; font-size: 0.92rem; background: #fff; color: var(--brand-ink); }

    .recon { border: 1.5px solid rgba(20,54,61,0.12); border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.2rem; background: rgba(20,54,61,0.025); }
    .recon-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
    .recon-msg { margin: 0 0 0.6rem; font-size: 0.85rem; color: var(--brand-muted); }
    .recon-grid { display: grid; gap: 0.15rem; max-width: 640px; }
    .recon-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.3rem 0; font-size: 0.92rem; }
    .recon-row small { color: var(--brand-muted); margin-left: 0.3rem; }
    .recon-row strong { font-family: monospace; }
    .recon-row.total { border-top: 1.5px solid rgba(20,54,61,0.2); margin-top: 0.2rem; padding-top: 0.5rem; font-weight: 700; }
    .recon-row.bad { color: #b91c1c; }
    .collect { margin-top: 0.9rem; max-width: 640px; }
    .collect-bar { height: 8px; border-radius: 6px; background: rgba(20,54,61,0.1); overflow: hidden; }
    .collect-fill { height: 100%; background: #16a34a; }
    .collect-nums { display: flex; gap: 1.2rem; flex-wrap: wrap; margin-top: 0.4rem; font-size: 0.85rem; color: var(--brand-muted); }
    .collect-nums strong { color: var(--brand-ink); font-family: monospace; }

    .tabs { display: flex; gap: 0.5rem; border-bottom: 2px solid rgba(20,54,61,0.1); flex-wrap: wrap; }
    .tab { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.1rem; background: transparent; border: none; border-bottom: 3px solid transparent; margin-bottom: -2px; cursor: pointer; font-size: 0.95rem; font-weight: 700; color: var(--brand-muted); }
    .tab.active { color: var(--p-primary-color); border-bottom-color: var(--p-primary-color); }
    .tab-badge { font-size: 0.72rem; font-weight: 700; color: #c2410c; background: rgba(234,88,12,0.12); border-radius: 10px; padding: 0.05rem 0.5rem; }
    .hint { margin: 0.8rem 0 0; font-size: 0.85rem; color: var(--brand-muted); }
    :host ::ng-deep app-building-expenses-page .p-card, :host ::ng-deep app-building-incomes-page .p-card { margin-top: 1rem; }
  `]
})
export class PeriodLedgerPageComponent implements OnInit {
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildings: Building[] = [];
  periods: ExpensePeriod[] = [];
  buildingId = '';
  periodId = '';
  tab: LedgerTab = 'expenses';
  loading = true;
  recon: ExpensePeriodReconciliation | null = null;
  reconLoading = false;

  get buildingPeriods(): ExpensePeriod[] {
    return this.periods
      .filter(p => p.buildingId === this.buildingId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  get period(): ExpensePeriod | null {
    return this.periods.find(p => p.id === this.periodId) ?? null;
  }

  get collectedPercent(): number {
    return this.recon && this.recon.totalCharged > 0 ? Math.min(100, Math.max(0, (this.recon.collected / this.recon.totalCharged) * 100)) : 0;
  }

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const tab = q.get('tab');
    if (tab === 'incomes' || tab === 'charges' || tab === 'expenses') this.tab = tab;

    forkJoin({ buildings: this.buildingsApi.getAll(), periods: this.periodsApi.getAll() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ buildings, periods }) => {
          this.buildings = [...buildings].sort((a, b) => a.name.localeCompare(b.name, 'es'));
          this.periods = periods;

          const wantedPeriod = periods.find(p => p.id === q.get('periodId'));
          const wantedBuilding = q.get('buildingId') ?? wantedPeriod?.buildingId ?? '';
          this.buildingId = this.buildings.some(b => b.id === wantedBuilding) ? wantedBuilding : (this.buildings[0]?.id ?? '');
          this.periodId = wantedPeriod && wantedPeriod.buildingId === this.buildingId ? wantedPeriod.id : this.defaultPeriodId();
          this.loading = false;
          this.loadRecon();
          this.cdr.markForCheck();
        },
        error: () => { this.loading = false; this.cdr.markForCheck(); }
      });
  }

  onBuildingChange(): void {
    this.periodId = this.defaultPeriodId();
    this.syncUrl();
    this.loadRecon();
  }

  onPeriodChange(): void {
    this.syncUrl();
    this.loadRecon();
  }

  setTab(tab: LedgerTab): void {
    this.tab = tab;
    this.syncUrl();
    // Al cambiar de seccion se vuelve a conciliar: lo que se cargo en la anterior pudo mover los totales.
    this.loadRecon();
  }

  loadRecon(): void {
    if (!this.periodId) { this.recon = null; return; }
    this.reconLoading = true;
    this.periodsApi.getReconciliation(this.periodId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: recon => { this.recon = recon; this.reconLoading = false; this.cdr.markForCheck(); },
      error: () => { this.recon = null; this.reconLoading = false; this.cdr.markForCheck(); }
    });
  }

  goToPeriods(): void { this.router.navigate(['/expense-periods']); }

  statusLabel(status: string): string { return STATUS_LABELS[status] ?? status; }

  money(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  // El periodo abierto de trabajo: el borrador mas reciente; si no hay, el ultimo del edificio.
  private defaultPeriodId(): string {
    const list = this.buildingPeriods;
    return (list.find(p => p.status === 'Draft') ?? list[0])?.id ?? '';
  }

  private syncUrl(): void {
    this.router.navigate([], {
      queryParams: { buildingId: this.buildingId || null, periodId: this.periodId || null, tab: this.tab === 'expenses' ? null : this.tab },
      replaceUrl: true
    });
  }
}

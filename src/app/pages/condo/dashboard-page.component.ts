import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Card } from 'primeng/card';
import { DashboardApiService } from '../../api/dashboard-api.service';
import { DashboardSummary } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule, Card],
  template: `
    <section class="page-head">
      <div>
        <h1>Resumen general</h1>
        <p>Estado operativo y financiero real del condominio</p>
      </div>
    </section>

    <p class="app-state" *ngIf="loading">Cargando resumen operativo y financiero...</p>

    <ng-container *ngIf="summary">
      <section class="stats-grid">
        <p-card styleClass="stat-card" *ngFor="let card of statCards">
          <div class="stat-card-inner">
            <div class="stat-icon" [style.background]="card.badge">{{ card.icon }}</div>
            <div>
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <small>{{ card.note }}</small>
            </div>
          </div>
        </p-card>
      </section>

      <section class="content-grid">
        <p-card styleClass="panel wide">
          <div class="panel-head">
            <strong>Cobertura operativa</strong>
            <span>Base operativa</span>
          </div>
          <div class="metric-grid">
            <div class="metric-card">
              <span>Ocupacion de unidades</span>
              <strong>{{ occupancyPercentage }}%</strong>
              <small>{{ summary.occupiedUnits }} de {{ summary.totalUnits }} unidades con residente asignado</small>
            </div>
            <div class="metric-card">
              <span>Residentes activos</span>
              <strong>{{ activeResidentsPercentage }}%</strong>
              <small>{{ summary.activeResidents }} de {{ summary.totalResidents }} residentes activos</small>
            </div>
            <div class="metric-card">
              <span>Edificios activos</span>
              <strong>{{ activeBuildingsPercentage }}%</strong>
              <small>{{ summary.activeBuildings }} de {{ summary.totalBuildings }} edificios operativos</small>
            </div>
          </div>
        </p-card>

        <p-card styleClass="panel wide">
          <div class="panel-head">
            <strong>Resumen financiero</strong>
            <span>Modulo 2</span>
          </div>
          <div class="metric-grid">
            <div class="metric-card">
              <span>Total emitido</span>
              <strong>{{ formatCurrency(summary.totalChargedAmount) }}</strong>
              <small>{{ summary.totalExpensePeriods }} periodos cargados</small>
            </div>
            <div class="metric-card">
              <span>Total cobrado</span>
              <strong>{{ formatCurrency(summary.totalCollectedAmount) }}</strong>
              <small>{{ summary.collectionRatePercentage }}% de recuperacion</small>
            </div>
            <div class="metric-card">
              <span>Saldo pendiente</span>
              <strong>{{ formatCurrency(summary.pendingBalanceAmount) }}</strong>
              <small>{{ summary.unitsWithOutstandingBalance }} unidades con deuda</small>
            </div>
          </div>
        </p-card>

        <p-card styleClass="panel">
          <div class="panel-head">
            <strong>Alertas clave</strong>
          </div>
          <div class="alert-list">
            <div class="alert-item" *ngFor="let alert of alerts">
              <div class="alert-badge" [class.warn]="alert.variant === 'warn'" [class.good]="alert.variant === 'good'">
                {{ alert.icon }}
              </div>
              <div>
                <strong>{{ alert.title }}</strong>
                <span>{{ alert.detail }}</span>
              </div>
            </div>
          </div>
        </p-card>

        <p-card styleClass="panel">
          <div class="panel-head">
            <strong>Flujo operativo</strong>
          </div>
          <div class="flow-list">
            <div class="flow-item" *ngFor="let item of systemFlow; let index = index">
              <div class="flow-step">{{ index + 1 }}</div>
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.detail }}</span>
              </div>
            </div>
          </div>
        </p-card>

        <p-card styleClass="panel wide">
          <div class="panel-head">
            <strong>Resumen del sistema</strong>
          </div>
          <div class="summary-grid">
            <div class="summary-item">
              <span>Unidades activas</span>
              <strong>{{ summary.activeUnits }}</strong>
            </div>
            <div class="summary-item">
              <span>Asignaciones activas</span>
              <strong>{{ summary.activeAssignments }}</strong>
            </div>
            <div class="summary-item">
              <span>Sin residente principal</span>
              <strong>{{ summary.unitsWithoutPrimaryResident }}</strong>
            </div>
            <div class="summary-item">
              <span>Sin ocupacion</span>
              <strong>{{ vacantUnits }}</strong>
            </div>
            <div class="summary-item">
              <span>Periodos en borrador</span>
              <strong>{{ summary.draftExpensePeriods }}</strong>
            </div>
            <div class="summary-item">
              <span>Mora vencida</span>
              <strong>{{ formatCurrency(summary.overdueBalanceAmount) }}</strong>
            </div>
            <div class="summary-item">
              <span>Unidades con saldo</span>
              <strong>{{ summary.unitsWithOutstandingBalance }}</strong>
            </div>
            <div class="summary-item">
              <span>Cobranza</span>
              <strong>{{ summary.collectionRatePercentage }}%</strong>
            </div>
          </div>
        </p-card>
      </section>
    </ng-container>
  `,
  styles: [`
    .page-head h1 { margin: 0; font-size: 3rem; color: var(--brand-ink); letter-spacing: -0.04em; }
    .page-head p { margin: 0.4rem 0 0; color: var(--brand-muted); font-size: 1.05rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-top: 1.4rem; }
    .stat-card-inner { display: flex; align-items: center; gap: 1rem; }
    .stat-icon { width: 64px; height: 64px; border-radius: 999px; display: grid; place-items: center; color: white; font-size: 1.2rem; font-weight: 800; }
    .stat-card span, .panel-head span, .alert-item span, .flow-item span { display: block; color: var(--brand-muted); }
    .stat-card strong { display: block; font-size: 2rem; color: var(--brand-ink); margin: 0.2rem 0; }
    .stat-card small { color: var(--brand-blue); font-weight: 700; }
    .content-grid { display: grid; grid-template-columns: 1.45fr 0.95fr 0.95fr; gap: 1rem; margin-top: 1rem; }
    .wide { grid-column: span 2; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; color: var(--brand-ink); }
    .panel-head strong { font-size: 1.3rem; }
    .metric-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:1rem; }
    .metric-card, .summary-item { background:var(--brand-gradient-soft); border-radius:20px; padding:1rem; display:grid; gap:0.35rem; border:1px solid rgba(19, 133, 182, 0.08); }
    .metric-card span, .summary-item span { color:var(--brand-muted); }
    .metric-card strong, .summary-item strong { color:var(--brand-ink); font-size:1.8rem; }
    .metric-card small { color:var(--brand-blue); font-weight:700; }
    .alert-list, .flow-list { display:grid; gap:0.9rem; }
    .alert-item, .flow-item { display:grid; grid-template-columns:auto 1fr; gap:0.8rem; align-items:start; border-top:1px solid rgba(19, 133, 182, 0.08); padding-top:0.9rem; }
    .alert-item:first-child, .flow-item:first-child { border-top:0; padding-top:0; }
    .alert-badge, .flow-step { width:46px; height:46px; border-radius:16px; display:grid; place-items:center; font-weight:800; }
    .alert-badge { background:var(--brand-gradient-soft); color:var(--brand-blue); }
    .alert-badge.warn { background:rgba(201, 77, 63, 0.12); color:#b64233; }
    .alert-badge.good { background:rgba(106, 198, 74, 0.14); color:#3d7d2d; }
    .flow-step { background:var(--brand-gradient-soft); color:var(--brand-ink); }
    .summary-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:1rem; }
    :host ::ng-deep .stat-card.p-card,
    :host ::ng-deep .panel.p-card { background: rgba(255, 255, 255, 0.88); border: 1px solid rgba(19, 133, 182, 0.08); border-radius: 24px; box-shadow: 0 14px 40px rgba(17, 54, 74, 0.1); }
    @media (max-width: 1240px) {
      .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .content-grid { grid-template-columns: 1fr; }
      .wide { grid-column: span 1; }
      .metric-grid, .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .stats-grid, .metric-grid, .summary-grid { grid-template-columns: 1fr; }
      .page-head h1 { font-size: 2.4rem; }
    }
  `]
})
export class DashboardPageComponent implements OnInit {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  summary: DashboardSummary | null = null;
  loading = true;

  readonly systemFlow = [
    { title: 'Alta de edificio', detail: 'Se registra el edificio o condominio administrado.' },
    { title: 'Alta de unidades', detail: 'Cada unidad queda vinculada a un edificio.' },
    { title: 'Alta de residentes', detail: 'Se registran propietarios e inquilinos del sistema.' },
    { title: 'Asignacion unidad residente', detail: 'Se define quien ocupa o representa cada unidad.' }
  ];

  ngOnInit(): void {
    this.dashboardApi
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el resumen del dashboard.', life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  get statCards() {
    if (!this.summary) {
      return [];
    }

    return [
      {
        icon: 'E',
        label: 'Edificios',
        value: this.summary.totalBuildings.toString(),
        note: `${this.summary.activeBuildings} activos`,
        badge: 'var(--brand-gradient)'
      },
      {
        icon: 'U',
        label: 'Unidades',
        value: this.summary.totalUnits.toString(),
        note: `${this.summary.activeUnits} activas`,
        badge: 'var(--brand-gradient)'
      },
      {
        icon: 'R',
        label: 'Residentes',
        value: this.summary.totalResidents.toString(),
        note: `${this.summary.activeResidents} activos`,
        badge: 'var(--brand-gradient)'
      },
      {
        icon: 'A',
        label: 'Asignaciones activas',
        value: this.summary.activeAssignments.toString(),
        note: `${this.summary.occupiedUnits} unidades ocupadas`,
        badge: 'var(--brand-gradient)'
      },
      {
        icon: '$',
        label: 'Saldo pendiente',
        value: this.formatCurrency(this.summary.pendingBalanceAmount),
        note: `${this.summary.unitsWithOutstandingBalance} unidades con deuda`,
        badge: 'var(--brand-gradient)'
      },
      {
        icon: '%',
        label: 'Cobranza',
        value: `${this.summary.collectionRatePercentage}%`,
        note: `${this.formatCurrency(this.summary.totalCollectedAmount)} cobrados`,
        badge: 'var(--brand-gradient)'
      }
    ];
  }

  get alerts() {
    if (!this.summary) {
      return [];
    }

    return [
      {
        icon: this.summary.unitsWithoutPrimaryResident > 0 ? '!' : 'OK',
        title: 'Unidades sin residente principal',
        detail: `${this.summary.unitsWithoutPrimaryResident} pendientes de normalizacion`,
        variant: this.summary.unitsWithoutPrimaryResident > 0 ? 'warn' : 'good'
      },
      {
        icon: this.vacantUnits > 0 ? 'V' : 'OK',
        title: 'Unidades sin ocupacion',
        detail: `${this.vacantUnits} unidades sin asignacion activa`,
        variant: this.vacantUnits > 0 ? 'warn' : 'good'
      },
      {
        icon: 'A',
        title: 'Cobertura administrativa',
        detail: `${this.summary.activeAssignments} vinculos activos sostienen la operacion actual`,
        variant: 'good'
      },
      {
        icon: this.summary.overdueBalanceAmount > 0 ? '$' : 'OK',
        title: 'Mora vencida',
        detail: `${this.formatCurrency(this.summary.overdueBalanceAmount)} fuera de vencimiento`,
        variant: this.summary.overdueBalanceAmount > 0 ? 'warn' : 'good'
      },
      {
        icon: this.summary.draftExpensePeriods > 0 ? 'P' : 'OK',
        title: 'Periodos pendientes de cierre',
        detail: `${this.summary.draftExpensePeriods} periodos siguen en borrador`,
        variant: this.summary.draftExpensePeriods > 0 ? 'warn' : 'good'
      }
    ];
  }

  get occupancyPercentage(): number {
    return this.percentage(this.summary?.occupiedUnits ?? 0, this.summary?.totalUnits ?? 0);
  }

  get activeResidentsPercentage(): number {
    return this.percentage(this.summary?.activeResidents ?? 0, this.summary?.totalResidents ?? 0);
  }

  get activeBuildingsPercentage(): number {
    return this.percentage(this.summary?.activeBuildings ?? 0, this.summary?.totalBuildings ?? 0);
  }

  get vacantUnits(): number {
    if (!this.summary) {
      return 0;
    }

    return Math.max(this.summary.totalUnits - this.summary.occupiedUnits, 0);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }

  private percentage(value: number, total: number): number {
    if (!total) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { PlatformActivityApiService } from '../../api/platform-activity-api.service';
import { UsersApiService } from '../../api/users-api.service';
import { Building, Company, Condominium, ManagedUser, PlatformActivity, PlatformActivityItem } from '../../api/models';

interface CompanyCard {
  company: Company;
  admins: ManagedUser[];
  operators: ManagedUser[];
  condominiums: Condominium[];
  buildings: Building[];
}

interface ChartPoint { x: number; y: number; count: number; label: string; }

// Medidas del grafico de actividad (viewBox del SVG).
const CHART = { width: 600, height: 210, left: 30, right: 14, top: 14, bottom: 30 };

@Component({
  standalone: true,
  selector: 'app-superadmin-dashboard-page',
  imports: [CommonModule, RouterLink],
  styleUrl: './superadmin-dashboard-page.component.css',
  template: `
    <!-- ENCABEZADO -->
    <section class="hero">
      <div class="hero-text">
        <div class="hero-badge">Centro de mando</div>
        <h1>Vista de plataforma</h1>
        <p>Resumen general del sistema, empresas, edificios y estado del ecosistema.</p>
      </div>
      <div class="hero-right">
        <i class="pi pi-calendar"></i>
        <span>{{ today }}</span>
      </div>
    </section>

    <!-- INDICADORES -->
    <section class="kpi-row" *ngIf="!loading">
      <a class="kpi-card" routerLink="/companies">
        <div class="kpi-icon" style="background: linear-gradient(135deg,#1385b6,#1ab7af)"><i class="pi pi-building"></i></div>
        <div class="kpi-body">
          <span>Empresas totales</span>
          <strong>{{ companies.length }}</strong>
          <small>{{ activeCompanies }} activas · {{ inactiveCompanies }} inactivas</small>
        </div>
        <i class="pi pi-angle-right kpi-go"></i>
        <div class="kpi-bar-wrap"><div class="kpi-bar" [style.width.%]="activeRatio"></div></div>
      </a>

      <a class="kpi-card" routerLink="/users" [queryParams]="{ role: 'CompanyAdmin' }">
        <div class="kpi-icon" style="background: linear-gradient(135deg,#1ab7af,#6ac64a)"><i class="pi pi-user"></i></div>
        <div class="kpi-body">
          <span>Administradores generales</span>
          <strong>{{ totalAdmins }}</strong>
          <small>{{ companiesWithAdmin }} emp. res. cubiertas</small>
        </div>
        <i class="pi pi-angle-right kpi-go"></i>
        <div class="kpi-bar-wrap"><div class="kpi-bar accent" [style.width.%]="coverageRatio"></div></div>
      </a>

      <a class="kpi-card" [class.kpi-alert]="uncoveredCompanies > 0" routerLink="/users" [queryParams]="{ role: 'CompanyAdmin' }">
        <div class="kpi-icon" [style.background]="uncoveredCompanies > 0 ? 'linear-gradient(135deg,#c94d3f,#e07020)' : 'linear-gradient(135deg,#3d9d2d,#6ac64a)'">
          <i class="pi" [ngClass]="uncoveredCompanies > 0 ? 'pi-exclamation-triangle' : 'pi-shield'"></i>
        </div>
        <div class="kpi-body">
          <span>Sin cobertura</span>
          <strong>{{ uncoveredCompanies }}</strong>
          <small>{{ uncoveredCompanies > 0 ? 'empresas sin admin asignado' : 'Todas tienen admin asignado' }}</small>
        </div>
        <i class="pi pi-angle-right kpi-go"></i>
        <div class="kpi-bar-wrap"><div class="kpi-bar warn" [style.width.%]="uncoveredCompanies > 0 ? (uncoveredCompanies / companies.length * 100) : 0"></div></div>
      </a>

      <a class="kpi-card" routerLink="/condominiums">
        <div class="kpi-icon" style="background: linear-gradient(135deg,#7c3aed,#1ab7af)"><i class="pi pi-building-columns"></i></div>
        <div class="kpi-body">
          <span>Condominios</span>
          <strong>{{ condominiums.length }}</strong>
          <small>{{ condominiumsWithCompany }} asignados a empresa</small>
        </div>
        <i class="pi pi-angle-right kpi-go"></i>
        <div class="kpi-bar-wrap"><div class="kpi-bar purple" [style.width.%]="condominiumCoverageRatio"></div></div>
      </a>
    </section>

    <div class="loading-state" *ngIf="loading">
      <div class="spinner"></div>
      <span>Cargando plataforma...</span>
    </div>

    <!-- CUERPO: columna principal + columna lateral -->
    <section class="main-grid" *ngIf="!loading">
      <div class="main-col">

        <!-- EMPRESAS Y ADMINISTRADORES -->
        <div class="panel">
          <div class="panel-head">
            <div>
              <strong>Empresas y administradores</strong>
              <span>Estado actual de las empresas y sus administradores</span>
            </div>
            <a routerLink="/companies" class="panel-action"><i class="pi pi-plus"></i> Nueva empresa</a>
          </div>

          <div class="company-grid">
            <div class="company-card" *ngFor="let item of companyCards" [class.inactive]="!item.company.isActive">
              <div class="company-header">
                <div class="company-avatar">{{ item.company.name[0].toUpperCase() }}</div>
                <div class="company-info">
                  <strong>{{ item.company.name }}</strong>
                  <code>{{ item.company.slug }}</code>
                </div>
                <div class="status-pill" [class.active]="item.company.isActive">
                  {{ item.company.isActive ? 'Activa' : 'Inactiva' }}
                </div>
              </div>

              <div class="company-stats">
                <div class="cstat"><span>Condominios</span><strong>{{ item.condominiums.length }}</strong></div>
                <div class="cstat"><span>Edificios</span><strong>{{ item.buildings.length }}</strong></div>
                <div class="cstat"><span>Admin.</span><strong>{{ item.admins.length }}</strong></div>
              </div>

              <div class="admin-chips" *ngIf="item.admins.length > 0">
                <div class="chip" *ngFor="let admin of item.admins">
                  <div class="chip-avatar"><i class="pi pi-user"></i></div>
                  <span>{{ admin.fullName }}</span>
                  <div class="chip-dot" [class.active]="admin.isActive"></div>
                </div>
              </div>

              <div class="no-admin-warn" *ngIf="item.admins.length === 0">
                <span><i class="pi pi-exclamation-triangle"></i> Sin administrador asignado</span>
                <a routerLink="/users" class="assign-link">Asignar →</a>
              </div>
            </div>
            <div class="cov-empty" *ngIf="companyCards.length === 0">No hay empresas registradas.</div>
          </div>
        </div>

        <!-- ACTIVIDAD + COBERTURA -->
        <div class="split">
          <div class="panel">
            <div class="panel-head">
              <div>
                <strong>Actividad del sistema</strong>
                <span>Últimos 7 días</span>
              </div>
              <div class="legend-chip"><span class="legend-dot green"></span> Altas y cambios</div>
            </div>

            <svg *ngIf="chartPoints.length" class="chart" [attr.viewBox]="'0 0 ' + chart.width + ' ' + chart.height" preserveAspectRatio="none" role="img"
                 aria-label="Altas y cambios de la plataforma en los últimos 7 días">
              <defs>
                <linearGradient id="actArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#1ab7af" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="#1ab7af" stop-opacity="0.02"/>
                </linearGradient>
              </defs>
              <g *ngFor="let tick of chartTicks">
                <line [attr.x1]="chart.left" [attr.x2]="chart.width - chart.right" [attr.y1]="tick.y" [attr.y2]="tick.y" class="grid-line"/>
                <text [attr.x]="chart.left - 8" [attr.y]="tick.y + 4" text-anchor="end" class="axis-text">{{ tick.value }}</text>
              </g>
              <path [attr.d]="areaPath" fill="url(#actArea)"/>
              <path [attr.d]="linePath" class="chart-line"/>
              <circle *ngFor="let p of chartPoints" [attr.cx]="p.x" [attr.cy]="p.y" r="3.6" class="chart-dot"><title>{{ p.label }}: {{ p.count }}</title></circle>
              <text *ngFor="let p of chartPoints" [attr.x]="p.x" [attr.y]="chart.height - 8" text-anchor="middle" class="axis-text">{{ p.label }}</text>
            </svg>
            <div class="cov-empty" *ngIf="!chartPoints.length">Sin datos de actividad todavía.</div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <strong>Cobertura admin</strong>
                <span>Por empresa</span>
              </div>
            </div>
            <div class="coverage-list">
              <div class="cov-row" *ngFor="let item of companyCards">
                <div class="cov-name">{{ item.company.name }}</div>
                <div class="cov-bar-wrap">
                  <div class="cov-bar" [style.width.%]="item.admins.length > 0 ? 100 : 0" [class.covered]="item.admins.length > 0" [class.empty]="item.admins.length === 0"></div>
                </div>
                <div class="cov-val" [class.no-cover]="item.admins.length === 0">
                  {{ item.admins.length > 0 ? item.admins.length + ' admin' + (item.admins.length > 1 ? 's' : '') : 'Sin admin' }}
                </div>
              </div>
              <div class="cov-empty" *ngIf="companyCards.length === 0">No hay empresas registradas.</div>
            </div>
          </div>
        </div>

        <!-- ÚLTIMOS MOVIMIENTOS -->
        <div class="panel">
          <div class="panel-head">
            <div>
              <strong>Últimos movimientos</strong>
              <span>Registro de acciones recientes en el sistema</span>
            </div>
            <a routerLink="/auditoria" class="panel-link">Ver todos <i class="pi pi-arrow-right"></i></a>
          </div>

          <div class="movements" *ngIf="movements.length">
            <div class="mv-row mv-head">
              <span>Fecha y hora</span><span>Acción</span><span>Detalle</span>
            </div>
            <div class="mv-row" *ngFor="let m of movements">
              <span class="mv-date"><i class="mv-dot" [ngClass]="dotClass(m.kind)"></i>{{ m.atUtc | date:'dd/MM/yyyy HH:mm' }}</span>
              <span class="mv-action">{{ m.title }}</span>
              <span class="mv-detail">{{ m.detail }}</span>
            </div>
          </div>
          <div class="cov-empty" *ngIf="!movements.length">Todavía no hay movimientos para mostrar.</div>
        </div>
      </div>

      <!-- LADO DERECHO -->
      <div class="side-col">

        <div class="panel">
          <div class="panel-head">
            <div>
              <strong>Distribución de estados</strong>
              <span>Estado del portafolio</span>
            </div>
          </div>
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200" class="donut-svg">
              <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(19,133,182,0.08)" stroke-width="24"/>
              <circle cx="100" cy="100" r="72" fill="none" stroke="url(#g1)" stroke-width="24"
                [attr.stroke-dasharray]="activeArc + ' ' + totalArc" [attr.stroke-dashoffset]="dashOffset"
                stroke-linecap="round" transform="rotate(-90 100 100)"/>
              <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(180,60,50,0.35)" stroke-width="24"
                [attr.stroke-dasharray]="inactiveArc + ' ' + totalArc" [attr.stroke-dashoffset]="inactiveOffset"
                stroke-linecap="round" transform="rotate(-90 100 100)"/>
              <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#1ab7af"/>
                  <stop offset="100%" stop-color="#6ac64a"/>
                </linearGradient>
              </defs>
              <text x="100" y="95" text-anchor="middle" class="donut-center-val">{{ activeCompanies }}</text>
              <text x="100" y="115" text-anchor="middle" class="donut-center-lbl">activas</text>
            </svg>
            <div class="donut-legend">
              <div class="legend-item"><div class="legend-dot green"></div><span>Activas</span><strong>{{ activeCompanies }}</strong></div>
              <div class="legend-item"><div class="legend-dot red"></div><span>Inactivas</span><strong>{{ inactiveCompanies }}</strong></div>
              <div class="legend-item"><div class="legend-dot blue"></div><span>Condominios</span><strong>{{ condominiums.length }}</strong></div>
              <div class="legend-item"><div class="legend-dot orange"></div><span>Sin admin</span><strong>{{ uncoveredCompanies }}</strong></div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><div><strong>Acciones rápidas</strong></div></div>
          <div class="action-list">
            <a routerLink="/companies" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#1385b6,#1ab7af)"><i class="pi pi-building"></i></div>
              <div><strong>Nueva empresa</strong><span>Registrar empresa administradora</span></div>
              <i class="pi pi-angle-right action-arrow"></i>
            </a>
            <a routerLink="/users" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#1ab7af,#6ac64a)"><i class="pi pi-user-plus"></i></div>
              <div><strong>Nuevo admin general</strong><span>Crear y asignar administrador</span></div>
              <i class="pi pi-angle-right action-arrow"></i>
            </a>
            <a routerLink="/condominiums" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#7c3aed,#1ab7af)"><i class="pi pi-building-columns"></i></div>
              <div><strong>Nuevo condominio</strong><span>Asignar condominio a empresa</span></div>
              <i class="pi pi-angle-right action-arrow"></i>
            </a>
            <a routerLink="/buildings" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#1385b6,#6ac64a)"><i class="pi pi-home"></i></div>
              <div><strong>Nuevo edificio</strong><span>Registrar edificio con condominio opcional</span></div>
              <i class="pi pi-angle-right action-arrow"></i>
            </a>
          </div>
        </div>

        <div class="promo">
          <svg class="promo-art" viewBox="0 0 120 110" aria-hidden="true">
            <rect x="8" y="22" width="40" height="78" rx="3" fill="#1385b6" opacity="0.85"/>
            <rect x="52" y="34" width="32" height="66" rx="3" fill="#1ab7af" opacity="0.9"/>
            <rect x="14" y="30" width="8" height="10" rx="1.5" fill="#fff" opacity="0.8"/><rect x="26" y="30" width="8" height="10" rx="1.5" fill="#fff" opacity="0.8"/>
            <rect x="14" y="46" width="8" height="10" rx="1.5" fill="#fff" opacity="0.8"/><rect x="26" y="46" width="8" height="10" rx="1.5" fill="#fff" opacity="0.8"/>
            <rect x="14" y="62" width="8" height="10" rx="1.5" fill="#fff" opacity="0.8"/><rect x="26" y="62" width="8" height="10" rx="1.5" fill="#fff" opacity="0.8"/>
            <rect x="58" y="42" width="7" height="9" rx="1.5" fill="#fff" opacity="0.8"/><rect x="70" y="42" width="7" height="9" rx="1.5" fill="#fff" opacity="0.8"/>
            <rect x="58" y="58" width="7" height="9" rx="1.5" fill="#fff" opacity="0.8"/><rect x="70" y="58" width="7" height="9" rx="1.5" fill="#fff" opacity="0.8"/>
            <circle cx="92" cy="78" r="17" fill="#6ac64a"/>
            <circle cx="92" cy="78" r="6.5" fill="#fff"/>
          </svg>
          <div class="promo-text">
            <strong>Tu plataforma, más eficiente</strong>
            <span>Configura y administra todo tu ecosistema de condominios desde un solo lugar.</span>
            <a routerLink="/condominiums" class="promo-btn">Ir a la configuración <i class="pi pi-arrow-right"></i></a>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class SuperadminDashboardPageComponent implements OnInit {
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly condominiumsApi = inject(CondominiumsApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly activityApi = inject(PlatformActivityApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  companies: Company[] = [];
  condominiums: Condominium[] = [];
  buildings: Building[] = [];
  users: ManagedUser[] = [];
  activity: PlatformActivity | null = null;
  movements: PlatformActivityItem[] = [];
  chartPoints: ChartPoint[] = [];
  chartTicks: { value: number; y: number }[] = [];
  linePath = '';
  areaPath = '';
  loading = true;

  readonly chart = CHART;

  readonly today = new Date().toLocaleDateString('es-PY', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  ngOnInit(): void {
    forkJoin({
      companies: this.companiesApi.getAll(),
      condominiums: this.condominiumsApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      users: this.usersApi.getAll(),
      // Si el servidor todavía no tiene este endpoint, el panel igual carga y esas dos tarjetas quedan vacías.
      activity: this.activityApi.get(7, 8).pipe(catchError(() => of(null)))
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ companies, condominiums, buildings, users, activity }) => {
          this.companies = companies.sort((a, b) => a.name.localeCompare(b.name));
          this.condominiums = condominiums;
          this.buildings = buildings;
          this.users = users;
          this.activity = activity;
          this.buildActivity();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => { this.loading = false; this.cdr.markForCheck(); }
      });
  }

  get activeCompanies(): number {
    return this.companies.filter(c => c.isActive).length;
  }

  get inactiveCompanies(): number {
    return this.companies.filter(c => !c.isActive).length;
  }

  get totalAdmins(): number {
    return this.users.filter(u => u.role === 'CompanyAdmin').length;
  }

  get companiesWithAdmin(): number {
    const covered = new Set(
      this.users
        .filter(u => u.role === 'CompanyAdmin' && u.companyId)
        .map(u => u.companyId!)
    );
    return this.companies.filter(c => covered.has(c.id)).length;
  }

  get uncoveredCompanies(): number {
    return this.companies.length - this.companiesWithAdmin;
  }

  get activeRatio(): number {
    return this.companies.length ? (this.activeCompanies / this.companies.length) * 100 : 0;
  }

  get coverageRatio(): number {
    return this.companies.length ? (this.companiesWithAdmin / this.companies.length) * 100 : 0;
  }

  get condominiumsWithCompany(): number {
    return this.condominiums.filter(c => !!c.companyId).length;
  }

  get condominiumCoverageRatio(): number {
    return this.condominiums.length
      ? (this.condominiumsWithCompany / this.condominiums.length) * 100
      : 0;
  }

  get companyCards(): CompanyCard[] {
    return this.companies.map(company => ({
      company,
      admins: this.users.filter(u => u.companyId === company.id && u.role === 'CompanyAdmin'),
      operators: this.users.filter(u => u.companyId === company.id && u.role === 'CompanyOperator'),
      condominiums: this.condominiums.filter(c => c.companyId === company.id),
      buildings: this.buildings.filter(b => b.companyId === company.id)
    }));
  }

  // ─── Movimientos y gráfico de actividad ──────────────────────────────────

  // Se arma una sola vez al cargar (no en cada ciclo de detección de cambios).
  private buildActivity(): void {
    // El servidor manda las fechas en UTC; sin zona explícita el navegador las tomaría como hora local.
    this.movements = (this.activity?.items ?? []).map(i => ({ ...i, atUtc: /Z|[+-]\d\d:?\d\d$/.test(i.atUtc) ? i.atUtc : i.atUtc + 'Z' }));
    this.chartPoints = this.computePoints();
    this.chartTicks = this.computeTicks();
    this.linePath = this.chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const base = CHART.height - CHART.bottom;
    const last = this.chartPoints[this.chartPoints.length - 1];
    this.areaPath = last ? `${this.linePath} L${last.x.toFixed(1)} ${base} L${this.chartPoints[0].x.toFixed(1)} ${base} Z` : '';
  }

  dotClass(kind: PlatformActivityItem['kind']): string {
    switch (kind) {
      case 'AdminCreated': return 'blue';
      case 'BuildingCreated': return 'teal';
      case 'CondominiumCreated': return 'purple';
      default: return 'green';
    }
  }

  // Escala vertical entera: de 0 al máximo redondeado hacia arriba (mínimo 4 para que una semana tranquila no se vea saturada).
  private get chartMax(): number {
    const max = Math.max(0, ...(this.activity?.days ?? []).map(d => d.count));
    return Math.max(4, max);
  }

  private computePoints(): ChartPoint[] {
    const days = this.activity?.days ?? [];
    if (!days.length) return [];

    const width = CHART.width - CHART.left - CHART.right;
    const height = CHART.height - CHART.top - CHART.bottom;
    const max = this.chartMax;

    return days.map((d, i) => ({
      x: CHART.left + (days.length === 1 ? width / 2 : (i * width) / (days.length - 1)),
      y: CHART.top + height - (d.count / max) * height,
      count: d.count,
      label: new Date(`${d.date}T12:00:00`).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' }).replace('.', '')
    }));
  }

  private computeTicks(): { value: number; y: number }[] {
    const height = CHART.height - CHART.top - CHART.bottom;
    const max = this.chartMax;
    const step = Math.max(1, Math.ceil(max / 4));
    const ticks: { value: number; y: number }[] = [];
    for (let v = 0; v <= max; v += step) ticks.push({ value: v, y: CHART.top + height - (v / max) * height });
    return ticks;
  }

  /* SVG Donut arc calculations */
  readonly circumference = 2 * Math.PI * 72;

  get totalArc(): number { return this.circumference; }

  get activeArc(): number {
    if (!this.companies.length) return 0;
    return (this.activeCompanies / this.companies.length) * this.circumference;
  }

  get inactiveArc(): number {
    if (!this.companies.length) return 0;
    return (this.inactiveCompanies / this.companies.length) * this.circumference;
  }

  get dashOffset(): number { return 0; }

  get inactiveOffset(): number { return -this.activeArc; }
}

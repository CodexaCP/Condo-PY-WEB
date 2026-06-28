import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { UsersApiService } from '../../api/users-api.service';
import { Building, Company, Condominium, ManagedUser } from '../../api/models';

interface CompanyCard {
  company: Company;
  admins: ManagedUser[];
  operators: ManagedUser[];
  condominiums: Condominium[];
  buildings: Building[];
}

@Component({
  standalone: true,
  selector: 'app-superadmin-dashboard-page',
  imports: [CommonModule, RouterLink],
  styleUrl: './superadmin-dashboard-page.component.css',
  template: `
    <!-- HEADER -->
    <section class="hero">
      <div class="hero-text">
        <div class="hero-badge">Centro de mando</div>
        <h1>Vista de plataforma</h1>
        <p>Empresas activas, cobertura administrativa y estado global del ecosistema</p>
      </div>
      <div class="hero-right">
        <div class="live-dot"></div>
        <span>{{ today }}</span>
      </div>
    </section>

    <!-- KPI ROW -->
    <section class="kpi-row" *ngIf="!loading">
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg,#0f4862,#1ab7af)">ðŸ¢</div>
        <div class="kpi-body">
          <span>Empresas totales</span>
          <strong>{{ companies.length }}</strong>
          <small>{{ activeCompanies }} activas Â· {{ inactiveCompanies }} inactivas</small>
        </div>
        <div class="kpi-bar-wrap">
          <div class="kpi-bar" [style.width.%]="activeRatio"></div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg,#1385b6,#6ac64a)">ðŸ‘¤</div>
        <div class="kpi-body">
          <span>Admins generales</span>
          <strong>{{ totalAdmins }}</strong>
          <small>{{ companiesWithAdmin }} empresas cubiertas</small>
        </div>
        <div class="kpi-bar-wrap">
          <div class="kpi-bar accent" [style.width.%]="coverageRatio"></div>
        </div>
      </div>

      <div class="kpi-card" [class.kpi-alert]="uncoveredCompanies > 0">
        <div class="kpi-icon" [style.background]="uncoveredCompanies > 0 ? 'linear-gradient(135deg,#c94d3f,#e07020)' : 'linear-gradient(135deg,#3d7d2d,#6ac64a)'">
          {{ uncoveredCompanies > 0 ? 'âš ' : 'âœ“' }}
        </div>
        <div class="kpi-body">
          <span>Sin cobertura</span>
          <strong>{{ uncoveredCompanies }}</strong>
          <small>{{ uncoveredCompanies > 0 ? 'empresas sin admin asignado' : 'Todas tienen admin asignado' }}</small>
        </div>
        <div class="kpi-bar-wrap">
          <div class="kpi-bar warn" [style.width.%]="uncoveredCompanies > 0 ? (uncoveredCompanies / companies.length * 100) : 0"></div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg,#7c3aed,#1ab7af)">ðŸ˜</div>
        <div class="kpi-body">
          <span>Condominios</span>
          <strong>{{ condominiums.length }}</strong>
          <small>{{ condominiumsWithCompany }} asignados a empresa</small>
        </div>
        <div class="kpi-bar-wrap">
          <div class="kpi-bar purple" [style.width.%]="condominiumCoverageRatio"></div>
        </div>
      </div>
    </section>

    <div class="loading-state" *ngIf="loading">
      <div class="spinner"></div>
      <span>Cargando plataforma...</span>
    </div>

    <!-- MAIN GRID -->
    <section class="main-grid" *ngIf="!loading">

      <!-- PORTFOLIO DE EMPRESAS -->
      <div class="panel portfolio-panel">
        <div class="panel-head">
          <div>
            <strong>Portfolio de empresas</strong>
            <span>Estado y cobertura por empresa</span>
          </div>
          <a routerLink="/companies" class="panel-action">+ Nueva empresa</a>
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
              <div class="cstat">
                <span>Condominios</span>
                <strong>{{ item.condominiums.length }}</strong>
              </div>
              <div class="cstat">
                <span>Edificios</span>
                <strong>{{ item.buildings.length }}</strong>
              </div>
              <div class="cstat">
                <span>Admins</span>
                <strong>{{ item.admins.length }}</strong>
              </div>
            </div>

            <div class="admin-chips" *ngIf="item.admins.length > 0">
              <div class="chip" *ngFor="let admin of item.admins">
                <div class="chip-avatar">{{ admin.fullName[0].toUpperCase() }}</div>
                <span>{{ admin.fullName }}</span>
                <div class="chip-dot" [class.active]="admin.isActive"></div>
              </div>
            </div>

            <div class="no-admin-warn" *ngIf="item.admins.length === 0">
              <span>âš  Sin administrador asignado</span>
              <a routerLink="/users" class="assign-link">Asignar â†’</a>
            </div>
          </div>
        </div>
      </div>

      <!-- LADO DERECHO -->
      <div class="side-col">

        <!-- DONUT CHART -->
        <div class="panel donut-panel">
          <div class="panel-head">
            <div>
              <strong>DistribuciÃ³n</strong>
              <span>Estado del portfolio</span>
            </div>
          </div>
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200" class="donut-svg">
              <!-- Base circle -->
              <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(19,133,182,0.08)" stroke-width="24"/>
              <!-- Active arc -->
              <circle cx="100" cy="100" r="72" fill="none"
                stroke="url(#g1)"
                stroke-width="24"
                [attr.stroke-dasharray]="activeArc + ' ' + totalArc"
                [attr.stroke-dashoffset]="dashOffset"
                stroke-linecap="round"
                transform="rotate(-90 100 100)"/>
              <!-- Inactive arc -->
              <circle cx="100" cy="100" r="72" fill="none"
                stroke="rgba(180,60,50,0.35)"
                stroke-width="24"
                [attr.stroke-dasharray]="inactiveArc + ' ' + totalArc"
                [attr.stroke-dashoffset]="inactiveOffset"
                stroke-linecap="round"
                transform="rotate(-90 100 100)"/>
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
              <div class="legend-item">
                <div class="legend-dot green"></div>
                <span>Activas</span>
                <strong>{{ activeCompanies }}</strong>
              </div>
              <div class="legend-item">
                <div class="legend-dot red"></div>
                <span>Inactivas</span>
                <strong>{{ inactiveCompanies }}</strong>
              </div>
              <div class="legend-item">
                <div class="legend-dot blue"></div>
                <span>Con admin</span>
                <strong>{{ companiesWithAdmin }}</strong>
              </div>
              <div class="legend-item">
                <div class="legend-dot orange"></div>
                <span>Sin admin</span>
                <strong>{{ uncoveredCompanies }}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- COBERTURA POR EMPRESA - barra horizontal -->
        <div class="panel coverage-panel">
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
                <div class="cov-bar"
                  [style.width.%]="item.admins.length > 0 ? 100 : 0"
                  [class.covered]="item.admins.length > 0"
                  [class.empty]="item.admins.length === 0">
                </div>
              </div>
              <div class="cov-val" [class.no-cover]="item.admins.length === 0">
                {{ item.admins.length > 0 ? item.admins.length + ' admin' + (item.admins.length > 1 ? 's' : '') : 'Sin admin' }}
              </div>
            </div>
            <div class="cov-empty" *ngIf="companyCards.length === 0">
              No hay empresas registradas.
            </div>
          </div>
        </div>

        <!-- QUICK ACTIONS -->
        <div class="panel actions-panel">
          <div class="panel-head">
            <div>
              <strong>Acciones rÃ¡pidas</strong>
            </div>
          </div>
          <div class="action-list">
            <a routerLink="/companies" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#0f4862,#1385b6)">ðŸ¢</div>
              <div>
                <strong>Nueva empresa</strong>
                <span>Registrar empresa administradora</span>
              </div>
              <div class="action-arrow">â†’</div>
            </a>
            <a routerLink="/users" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#6ac64a,#1ab7af)">ðŸ‘¤</div>
              <div>
                <strong>Nuevo admin general</strong>
                <span>Crear y asignar administrador</span>
              </div>
              <div class="action-arrow">â†’</div>
            </a>
            <a routerLink="/condominiums" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#7c3aed,#1ab7af)">ðŸ˜</div>
              <div>
                <strong>Nuevo condominio</strong>
                <span>Asignar condominio a empresa</span>
              </div>
              <div class="action-arrow">â†’</div>
            </a>
            <a routerLink="/buildings" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#0f4862,#6ac64a)">ðŸ—</div>
              <div>
                <strong>Nuevo edificio</strong>
                <span>Registrar edificio con condominio opcional</span>
              </div>
              <div class="action-arrow">â†’</div>
            </a>
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  companies: Company[] = [];
  condominiums: Condominium[] = [];
  buildings: Building[] = [];
  users: ManagedUser[] = [];
  loading = true;

  readonly today = new Date().toLocaleDateString('es-PY', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  ngOnInit(): void {
    forkJoin({
      companies: this.companiesApi.getAll(),
      condominiums: this.condominiumsApi.getAll(),
      buildings: this.buildingsApi.getAll(),
      users: this.usersApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ companies, condominiums, buildings, users }) => {
          this.companies = companies.sort((a, b) => a.name.localeCompare(b.name));
          this.condominiums = condominiums;
          this.buildings = buildings;
          this.users = users;
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

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
        <div class="kpi-icon" style="background: linear-gradient(135deg,#0f4862,#1ab7af)">🏢</div>
        <div class="kpi-body">
          <span>Empresas totales</span>
          <strong>{{ companies.length }}</strong>
          <small>{{ activeCompanies }} activas · {{ inactiveCompanies }} inactivas</small>
        </div>
        <div class="kpi-bar-wrap">
          <div class="kpi-bar" [style.width.%]="activeRatio"></div>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg,#1385b6,#6ac64a)">👤</div>
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
          {{ uncoveredCompanies > 0 ? '⚠' : '✓' }}
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
        <div class="kpi-icon" style="background: linear-gradient(135deg,#7c3aed,#1ab7af)">🏘</div>
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
              <span>⚠ Sin administrador asignado</span>
              <a routerLink="/users" class="assign-link">Asignar →</a>
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
              <strong>Distribución</strong>
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
              <strong>Acciones rápidas</strong>
            </div>
          </div>
          <div class="action-list">
            <a routerLink="/companies" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#0f4862,#1385b6)">🏢</div>
              <div>
                <strong>Nueva empresa</strong>
                <span>Registrar empresa administradora</span>
              </div>
              <div class="action-arrow">→</div>
            </a>
            <a routerLink="/users" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#6ac64a,#1ab7af)">👤</div>
              <div>
                <strong>Nuevo admin general</strong>
                <span>Crear y asignar administrador</span>
              </div>
              <div class="action-arrow">→</div>
            </a>
            <a routerLink="/condominiums" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#7c3aed,#1ab7af)">🏘</div>
              <div>
                <strong>Nuevo condominio</strong>
                <span>Asignar condominio a empresa</span>
              </div>
              <div class="action-arrow">→</div>
            </a>
            <a routerLink="/buildings" class="action-item">
              <div class="action-icon" style="background:linear-gradient(135deg,#0f4862,#6ac64a)">🏗</div>
              <div>
                <strong>Nuevo edificio</strong>
                <span>Registrar edificio con condominio opcional</span>
              </div>
              <div class="action-arrow">→</div>
            </a>
          </div>
        </div>

      </div>
    </section>
  `,
  styles: [`
    /* HERO */
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.6rem;
    }
    .hero-badge {
      display: inline-block;
      background: linear-gradient(90deg,rgba(26,183,175,0.14),rgba(106,198,74,0.12));
      border: 1px solid rgba(26,183,175,0.25);
      color: #0f4862;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.28rem 0.8rem;
      border-radius: 999px;
      margin-bottom: 0.5rem;
    }
    .hero h1 {
      margin: 0;
      font-size: 2.8rem;
      color: var(--brand-ink);
      letter-spacing: -0.04em;
      line-height: 1.1;
    }
    .hero p {
      margin: 0.4rem 0 0;
      color: var(--brand-muted);
      font-size: 1rem;
    }
    .hero-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.7);
      border: 1px solid rgba(19,133,182,0.1);
      border-radius: 999px;
      padding: 0.4rem 1rem;
      font-size: 0.85rem;
      color: var(--brand-muted);
      font-weight: 600;
      white-space: nowrap;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6ac64a;
      box-shadow: 0 0 0 3px rgba(106,198,74,0.25);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 3px rgba(106,198,74,0.25); }
      50% { box-shadow: 0 0 0 6px rgba(106,198,74,0.12); }
    }

    /* KPI ROW */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1.2rem;
    }
    .kpi-card {
      background: rgba(255,255,255,0.88);
      border: 1px solid rgba(19,133,182,0.08);
      border-radius: 22px;
      padding: 1.1rem 1.2rem 0.8rem;
      box-shadow: 0 8px 28px rgba(17,54,74,0.08);
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.7rem 0.9rem;
      align-items: start;
      transition: box-shadow 0.2s;
    }
    .kpi-card:hover {
      box-shadow: 0 16px 40px rgba(17,54,74,0.14);
    }
    .kpi-card.kpi-alert {
      border-color: rgba(201,77,63,0.2);
      background: rgba(255,248,246,0.92);
    }
    .kpi-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-size: 1.4rem;
      grid-row: span 2;
      box-shadow: 0 8px 20px rgba(11,59,82,0.18);
    }
    .kpi-body span {
      display: block;
      color: var(--brand-muted);
      font-size: 0.85rem;
    }
    .kpi-body strong {
      display: block;
      font-size: 2rem;
      color: var(--brand-ink);
      line-height: 1.1;
      margin: 0.1rem 0;
    }
    .kpi-body small {
      color: var(--brand-blue);
      font-weight: 700;
      font-size: 0.8rem;
    }
    .kpi-bar-wrap {
      grid-column: 1 / -1;
      height: 4px;
      background: rgba(19,133,182,0.1);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 0.2rem;
    }
    .kpi-bar {
      height: 100%;
      background: linear-gradient(90deg,#1ab7af,#6ac64a);
      border-radius: 999px;
      transition: width 0.8s cubic-bezier(.4,0,.2,1);
    }
    .kpi-bar.accent { background: linear-gradient(90deg,#1385b6,#1ab7af); }
    .kpi-bar.warn { background: linear-gradient(90deg,#c94d3f,#e07020); }
    .kpi-bar.purple { background: linear-gradient(90deg,#7c3aed,#1ab7af); }

    /* LOADING */
    .loading-state {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem;
      color: var(--brand-muted);
      font-weight: 600;
    }
    .spinner {
      width: 22px; height: 22px;
      border: 3px solid rgba(19,133,182,0.15);
      border-top-color: #1385b6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* MAIN GRID */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 1rem;
      align-items: start;
    }

    /* PANEL BASE */
    .panel {
      background: rgba(255,255,255,0.88);
      border: 1px solid rgba(19,133,182,0.08);
      border-radius: 24px;
      padding: 1.3rem 1.4rem;
      box-shadow: 0 8px 32px rgba(17,54,74,0.08);
    }
    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.1rem;
    }
    .panel-head strong {
      display: block;
      font-size: 1.1rem;
      color: var(--brand-ink);
    }
    .panel-head span {
      display: block;
      color: var(--brand-muted);
      font-size: 0.82rem;
      margin-top: 0.15rem;
    }
    .panel-action {
      text-decoration: none;
      background: linear-gradient(135deg,#0f4862,#1ab7af);
      color: white;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 0.38rem 0.9rem;
      border-radius: 999px;
      white-space: nowrap;
    }

    /* COMPANY GRID */
    .company-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .company-card {
      border: 1px solid rgba(19,133,182,0.1);
      border-radius: 18px;
      padding: 1rem 1.1rem;
      background: linear-gradient(145deg,rgba(243,251,251,0.8),rgba(238,249,250,0.8));
      transition: box-shadow 0.18s, transform 0.18s;
    }
    .company-card:hover {
      box-shadow: 0 12px 32px rgba(17,54,74,0.12);
      transform: translateY(-2px);
    }
    .company-card.inactive {
      background: rgba(245,245,248,0.7);
      opacity: 0.7;
    }
    .company-header {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.7rem;
      align-items: center;
      margin-bottom: 0.8rem;
    }
    .company-avatar {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg,#0f4862,#1ab7af);
      color: white;
      font-weight: 800;
      font-size: 1.1rem;
      display: grid;
      place-items: center;
      box-shadow: 0 6px 16px rgba(11,59,82,0.2);
    }
    .company-info strong { display: block; font-size: 0.95rem; color: var(--brand-ink); }
    .company-info code {
      font-size: 0.72rem;
      color: var(--brand-muted);
      background: rgba(19,133,182,0.07);
      padding: 0.1rem 0.35rem;
      border-radius: 5px;
    }
    .status-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.22rem 0.6rem;
      border-radius: 999px;
      background: rgba(180,60,50,0.1);
      color: #b64233;
    }
    .status-pill.active {
      background: rgba(106,198,74,0.14);
      color: #3d7d2d;
    }
    .company-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.8rem;
    }
    .cstat {
      background: rgba(255,255,255,0.7);
      border-radius: 10px;
      padding: 0.45rem 0.5rem;
      border: 1px solid rgba(19,133,182,0.07);
      text-align: center;
    }
    .cstat span { display: block; font-size: 0.68rem; color: var(--brand-muted); }
    .cstat strong { display: block; font-size: 1.2rem; color: var(--brand-ink); font-weight: 800; }

    .admin-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: linear-gradient(90deg,rgba(19,133,182,0.08),rgba(26,183,175,0.07));
      border: 1px solid rgba(19,133,182,0.12);
      border-radius: 999px;
      padding: 0.25rem 0.6rem 0.25rem 0.3rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--brand-ink);
    }
    .chip-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg,#1385b6,#1ab7af);
      color: white;
      font-size: 0.65rem;
      font-weight: 800;
      display: grid;
      place-items: center;
    }
    .chip-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(180,60,50,0.5);
    }
    .chip-dot.active { background: #6ac64a; }

    .no-admin-warn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(201,77,63,0.07);
      border: 1px dashed rgba(201,77,63,0.25);
      border-radius: 10px;
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      color: #b64233;
      font-weight: 600;
    }
    .assign-link {
      text-decoration: none;
      color: #1385b6;
      font-weight: 700;
    }

    /* SIDE COL */
    .side-col { display: grid; gap: 1rem; }

    /* DONUT */
    .donut-panel {}
    .donut-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .donut-svg {
      width: 160px;
      height: 160px;
    }
    .donut-center-val {
      font-size: 2.4rem;
      font-weight: 800;
      fill: var(--brand-ink, #0f3344);
    }
    .donut-center-lbl {
      font-size: 0.9rem;
      fill: #6b8090;
    }
    .donut-legend {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 1rem;
      width: 100%;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.82rem;
      color: var(--brand-muted);
    }
    .legend-item strong {
      margin-left: auto;
      color: var(--brand-ink);
      font-weight: 700;
    }
    .legend-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .legend-dot.green { background: #6ac64a; }
    .legend-dot.red { background: rgba(180,60,50,0.55); }
    .legend-dot.blue { background: #1ab7af; }
    .legend-dot.orange { background: #e07020; }

    /* COVERAGE LIST */
    .coverage-list { display: grid; gap: 0.65rem; }
    .cov-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.5rem; align-items: center; }
    .cov-name { font-size: 0.82rem; color: var(--brand-ink); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cov-bar-wrap { height: 6px; background: rgba(19,133,182,0.08); border-radius: 999px; overflow: hidden; }
    .cov-bar {
      height: 100%;
      border-radius: 999px;
      transition: width 0.8s cubic-bezier(.4,0,.2,1);
    }
    .cov-bar.covered { background: linear-gradient(90deg,#1ab7af,#6ac64a); }
    .cov-bar.empty { background: transparent; }
    .cov-val { font-size: 0.75rem; font-weight: 700; color: var(--brand-blue); white-space: nowrap; text-align: right; }
    .cov-val.no-cover { color: #b64233; }
    .cov-empty { color: var(--brand-muted); font-size: 0.85rem; text-align: center; padding: 1rem; }

    /* ACTIONS */
    .action-list { display: grid; gap: 0.6rem; }
    .action-item {
      text-decoration: none;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.75rem 0.9rem;
      border-radius: 14px;
      border: 1px solid rgba(19,133,182,0.08);
      background: linear-gradient(145deg,rgba(243,251,251,0.6),rgba(238,249,250,0.5));
      transition: box-shadow 0.18s, transform 0.15s;
      cursor: pointer;
    }
    .action-item:hover {
      box-shadow: 0 8px 24px rgba(17,54,74,0.12);
      transform: translateX(2px);
    }
    .action-icon {
      width: 40px; height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 1.1rem;
      box-shadow: 0 6px 16px rgba(11,59,82,0.18);
    }
    .action-item strong { display: block; font-size: 0.88rem; color: var(--brand-ink); }
    .action-item span { display: block; font-size: 0.75rem; color: var(--brand-muted); }
    .action-arrow { color: var(--brand-blue); font-weight: 700; font-size: 1.1rem; }

    /* RESPONSIVE */
    @media (max-width: 1200px) {
      .main-grid { grid-template-columns: 1fr; }
      .side-col { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .kpi-row { grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
    @media (max-width: 640px) {
      .kpi-row { grid-template-columns: 1fr; }
      .hero { flex-direction: column; gap: 0.75rem; }
      .hero h1 { font-size: 2rem; }
      .company-grid { grid-template-columns: 1fr; }
    }
  `]
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

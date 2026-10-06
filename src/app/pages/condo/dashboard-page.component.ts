import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { catchError, forkJoin, of } from 'rxjs';
import { CollectionsApiService } from '../../api/collections-api.service';
import { DashboardApiService } from '../../api/dashboard-api.service';
import { MorosityApiService } from '../../api/morosity-api.service';
import { CollectionReport, DashboardSummary, MorosityItem, MorosityReport } from '../../api/models';

// Paleta del tablero: la de la marca primero y tonos de apoyo para distinguir conceptos.
const TEAL = '#1AB7AF';
const BLUE = '#1385B6';
const GREEN = '#6AC64A';
const VIOLET = '#8B5CF6';
const AMBER = '#F59E0B';
const CORAL = '#e5675d';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

interface Kpi { icon: string; label: string; value: string; note: string; tone: 'teal' | 'blue' | 'green' | 'violet' | 'amber' | 'coral'; link?: string }
interface Insight { icon: string; text: string; tone: 'good' | 'warn' | 'info' }
interface BuildingRank { name: string; charged: number; collected: number; pending: number; rate: number }
interface Aging { label: string; units: number; amount: number; color: string; share: number }

// Tablero principal del administrador de la empresa y del administrador del edificio. Usa solo lo que ya existe: el resumen del
// tablero, el informe de cobranza del año y el de mora. Si alguno de los dos informes no está disponible para el usuario, esa
// parte simplemente no se muestra.
@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, ChartModule],
  template: `
    <!-- ══ HERO ══════════════════════════════════════════════════════════ -->
    <div class="hero">
      <span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>
      <div class="hero-main">
        <p class="eyebrow">Panel comercial</p>
        <h1>Así va tu negocio</h1>
        <p class="sub">{{ summary ? summary.totalUnits + ' unidades en ' + summary.totalBuildings + (summary.totalBuildings === 1 ? ' edificio' : ' edificios') + ' · año ' + year : 'Cargando indicadores...' }}</p>
        <div class="hero-actions">
          <label class="year-pick">
            <span>Año</span>
            <select [ngModel]="year" (ngModelChange)="onYear($event)">
              <option *ngFor="let y of years" [ngValue]="y">{{ y }}</option>
            </select>
          </label>
          <a routerLink="/collections" class="chip-link"><i class="pi pi-chart-bar"></i> Cobranza</a>
          <a routerLink="/morosity" class="chip-link"><i class="pi pi-exclamation-circle"></i> Mora</a>
          <a routerLink="/period-ledger" class="chip-link"><i class="pi pi-calendar"></i> Liquidaciones</a>
        </div>
      </div>

      <div class="hero-ring" *ngIf="summary">
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="heroRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="100%" stop-color="#c8f5a5"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="50" class="trk"/>
          <circle cx="60" cy="60" r="50" class="fil" [style.stroke-dashoffset]="ringOffset(rate)"/>
        </svg>
        <div class="ring-c"><strong>{{ rate }}%</strong><span>cobranza</span></div>
      </div>
    </div>

    <div *ngIf="loading" class="loading"><i class="pi pi-spin pi-spinner"></i> Cargando indicadores...</div>

    <ng-container *ngIf="summary">

      <!-- ══ KPIs de color ══════════════════════════════════════════════ -->
      <div class="kpis">
        <a *ngFor="let k of kpis" class="kpi" [ngClass]="'t-' + k.tone" [routerLink]="k.link">
          <div class="k-ico"><i class="pi" [ngClass]="k.icon"></i></div>
          <span class="k-lbl">{{ k.label }}</span>
          <strong class="k-val">{{ k.value }}</strong>
          <small class="k-note">{{ k.note }}</small>
        </a>
      </div>

      <!-- ══ Lectura rápida ═════════════════════════════════════════════ -->
      <div class="insights" *ngIf="insights.length">
        <div class="insight" *ngFor="let i of insights" [ngClass]="'i-' + i.tone">
          <i class="pi" [ngClass]="i.icon"></i><span>{{ i.text }}</span>
        </div>
      </div>

      <!-- ══ Facturado vs cobrado + mix de cargos ══════════════════════ -->
      <div class="grid g-main" *ngIf="monthlyData || mixSlices.length">
        <div class="card" *ngIf="monthlyData">
          <div class="c-head">
            <div><h3>Facturado vs. cobrado</h3><p>Mes a mes en {{ year }} y porcentaje de cobranza</p></div>
            <span class="pill" *ngIf="collection"><i class="pi pi-wallet"></i> {{ fmtCompact(collection.summary.totalCollectedAmount) }} cobrados</span>
          </div>
          <p-chart type="bar" [data]="monthlyData" [options]="monthlyOptions" height="290px"></p-chart>
        </div>

        <div class="card" *ngIf="mixSlices.length">
          <div class="c-head"><div><h3>De qué se compone lo emitido</h3><p>Mix de cargos de {{ year }}</p></div></div>
          <div class="mix">
            <div class="mix-ring">
              <p-chart type="doughnut" [data]="mixData" [options]="donutOptions" width="170px" height="170px"></p-chart>
              <div class="mix-c"><strong>{{ fmtCompact(mixTotal) }}</strong><span>emitido</span></div>
            </div>
            <div class="legend">
              <div *ngFor="let s of mixSlices">
                <i class="dot" [style.background]="s.color"></i>
                <span class="ln">{{ s.label }}</span>
                <em>{{ s.share }}%</em>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ Mora: antigüedad y quién debe ═════════════════════════════ -->
      <div class="grid g-two" *ngIf="morosity">
        <div class="card">
          <div class="c-head">
            <div><h3>Antigüedad de la mora</h3><p>{{ morosity.summary.totalUnitsInArrears }} unidades · {{ fmtCompact(morosity.summary.totalOverdueAmount) }} vencidos</p></div>
            <a routerLink="/morosity" class="more">Ver mora →</a>
          </div>
          <p class="empty" *ngIf="!morosity.summary.totalOverdueAmount"><i class="pi pi-check-circle"></i> No hay mora vencida. ¡Excelente!</p>
          <div class="aging" *ngIf="morosity.summary.totalOverdueAmount">
            <div class="ag-row" *ngFor="let a of aging">
              <div class="ag-top"><span>{{ a.label }}</span><strong>{{ fmtCompact(a.amount) }}</strong></div>
              <div class="ag-track"><div class="ag-fill" [style.width.%]="a.share" [style.background]="a.color"></div></div>
              <small>{{ a.units }} {{ a.units === 1 ? 'unidad' : 'unidades' }}</small>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="c-head">
            <div><h3>Mayores deudores</h3><p>Las cinco deudas más altas</p></div>
          </div>
          <p class="empty" *ngIf="!topDebtors.length"><i class="pi pi-check-circle"></i> Sin deudas para mostrar.</p>
          <div class="debtors" *ngIf="topDebtors.length">
            <div class="debtor" *ngFor="let d of topDebtors; let i = index">
              <span class="rank">{{ i + 1 }}</span>
              <div class="d-main">
                <strong>{{ d.buildingName }} · {{ d.unitCode }}</strong>
                <small>{{ d.responsibleName || d.ownerName || 'Sin responsable' }} · {{ d.daysOverdue }} días</small>
              </div>
              <span class="d-amt">{{ fmtCompact(d.balance) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ Por edificio + propietarios / residentes ═════════════════ -->
      <div class="grid g-two" *ngIf="buildingRanks.length || ownerSplit">
        <div class="card" *ngIf="buildingRanks.length">
          <div class="c-head"><div><h3>Cobranza por edificio</h3><p>Ordenado de mejor a peor</p></div></div>
          <div class="rank-list">
            <div class="rk" *ngFor="let b of buildingRanks">
              <div class="rk-top">
                <strong>{{ b.name }}</strong>
                <span class="rk-rate" [class.good]="b.rate >= 80" [class.mid]="b.rate >= 50 && b.rate < 80" [class.bad]="b.rate < 50">{{ b.rate }}%</span>
              </div>
              <div class="rk-track"><div class="rk-fill" [style.width.%]="b.rate" [class.good]="b.rate >= 80" [class.mid]="b.rate >= 50 && b.rate < 80" [class.bad]="b.rate < 50"></div></div>
              <small>Cobrado {{ fmtCompact(b.collected) }} de {{ fmtCompact(b.charged) }} · pendiente {{ fmtCompact(b.pending) }}</small>
            </div>
          </div>
        </div>

        <div class="card" *ngIf="ownerSplit">
          <div class="c-head"><div><h3>Propietarios y residentes</h3><p>Quién paga lo emitido</p></div></div>
          <div class="split">
            <div class="sp" *ngFor="let s of ownerSplit">
              <div class="sp-top"><span>{{ s.label }}</span><strong>{{ s.rate }}%</strong></div>
              <div class="sp-track"><div class="sp-fill" [style.width.%]="s.rate" [style.background]="s.color"></div></div>
              <small>Emitido {{ fmtCompact(s.charged) }} · cobrado {{ fmtCompact(s.collected) }} · pendiente {{ fmtCompact(s.pending) }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ Operación ═════════════════════════════════════════════════ -->
      <div class="grid g-three">
        <div class="card op" *ngFor="let o of ops">
          <div class="op-top"><span>{{ o.label }}</span><strong>{{ o.pct }}%</strong></div>
          <div class="op-track"><div class="op-fill" [style.width.%]="o.pct" [style.background]="o.color"></div></div>
          <small>{{ o.detail }}</small>
        </div>
      </div>

    </ng-container>
  `,
  styles: [`
    :host { display: block; }

    /* ── HERO ─────────────────────────────────────────────────────── */
    .hero {
      position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
      background: linear-gradient(120deg, #1AB7AF 0%, #1385B6 55%, #6AC64A 120%);
      border-radius: 26px; padding: 1.8rem 2.2rem; margin-bottom: 1.3rem; color: #fff;
      box-shadow: 0 18px 44px rgba(19,133,182,0.28);
    }
    .orb { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.09); pointer-events: none; }
    .o1 { width: 340px; height: 340px; top: -120px; right: -60px; }
    .o2 { width: 190px; height: 190px; bottom: -70px; right: 230px; background: rgba(255,255,255,0.06); }
    .o3 { width: 110px; height: 110px; top: 24px; right: 440px; background: rgba(255,255,255,0.07); }
    .hero-main { position: relative; z-index: 1; min-width: 0; }
    .eyebrow { margin: 0 0 0.35rem; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.75); }
    .hero h1 { margin: 0 0 0.35rem; font-size: 2.3rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; color: #fff; }
    .sub { margin: 0 0 1.1rem; color: rgba(255,255,255,0.82); font-size: 0.95rem; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
    .year-pick { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28); border-radius: 999px; padding: 0.25rem 0.4rem 0.25rem 0.9rem; font-size: 0.8rem; font-weight: 700; }
    .year-pick select { border: 0; border-radius: 999px; padding: 0.3rem 0.7rem; font: inherit; font-weight: 800; color: #11364a; background: #fff; cursor: pointer; }
    .chip-link { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.95rem; border-radius: 999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28); color: #fff; font-size: 0.8rem; font-weight: 700; text-decoration: none; transition: background .15s, transform .15s; }
    .chip-link:hover { background: rgba(255,255,255,0.28); transform: translateY(-1px); }

    .hero-ring { position: relative; z-index: 1; flex: 0 0 auto; width: 150px; height: 150px; }
    .hero-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .hero-ring .trk { fill: none; stroke: rgba(255,255,255,0.22); stroke-width: 10; }
    .hero-ring .fil { fill: none; stroke: url(#heroRing); stroke-width: 10; stroke-linecap: round; stroke-dasharray: 314.16; transition: stroke-dashoffset .9s cubic-bezier(.4,0,.2,1); }
    .ring-c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .ring-c strong { font-size: 2rem; font-weight: 800; line-height: 1; }
    .ring-c span { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.8); }

    .loading { display: flex; align-items: center; gap: 0.6rem; padding: 2rem; color: var(--brand-muted); font-weight: 500; }

    /* ── KPIs de color ────────────────────────────────────────────── */
    .kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.9rem; margin-bottom: 1.1rem; }
    .kpi { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 0.2rem; padding: 1.1rem 1.1rem 1rem; border-radius: 20px; color: #fff; text-decoration: none; box-shadow: 0 10px 26px rgba(17,54,74,0.14); transition: transform .18s, box-shadow .18s; }
    a.kpi:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(17,54,74,0.2); }
    .kpi::after { content: ''; position: absolute; width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,0.12); right: -34px; bottom: -44px; }
    .t-teal   { background: linear-gradient(135deg, #1AB7AF, #129a93); }
    .t-blue   { background: linear-gradient(135deg, #1b9bd1, #1385B6 60%, #0f6e96); }
    .t-green  { background: linear-gradient(135deg, #7fd45f, #4da033); }
    .t-violet { background: linear-gradient(135deg, #a58bf8, #7c4ddb); }
    .t-amber  { background: linear-gradient(135deg, #fbbf24, #e08a06); }
    .t-coral  { background: linear-gradient(135deg, #f0857b, #cf4b3f); }
    .k-ico { width: 34px; height: 34px; border-radius: 11px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 0.45rem; font-size: 0.95rem; }
    .k-lbl { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.88; }
    .k-val { font-size: 1.55rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }
    .k-note { font-size: 0.74rem; opacity: 0.85; position: relative; z-index: 1; }

    /* ── Lectura rápida ───────────────────────────────────────────── */
    .insights { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.2rem; }
    .insight { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.95rem; border-radius: 999px; font-size: 0.84rem; font-weight: 600; border: 1px solid transparent; }
    .i-good { background: rgba(106,198,74,0.12); color: #2f7a1b; border-color: rgba(106,198,74,0.3); }
    .i-warn { background: rgba(245,158,11,0.12); color: #a96300; border-color: rgba(245,158,11,0.32); }
    .i-info { background: rgba(19,133,182,0.1); color: #0f6e96; border-color: rgba(19,133,182,0.25); }

    /* ── Tarjetas ─────────────────────────────────────────────────── */
    .grid { display: grid; gap: 1.1rem; margin-bottom: 1.1rem; }
    .g-main  { grid-template-columns: 1.7fr 1fr; }
    .g-two   { grid-template-columns: 1fr 1fr; }
    .g-three { grid-template-columns: repeat(3, 1fr); }
    .card { background: var(--p-content-background, #fff); border-radius: 22px; padding: 1.4rem 1.5rem; border: 1px solid rgba(19,133,182,0.09); box-shadow: 0 8px 30px rgba(17,54,74,0.07); min-width: 0; }
    .c-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .c-head h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--p-text-color); }
    .c-head p { margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--brand-muted); }
    .pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.8rem; border-radius: 999px; background: rgba(106,198,74,0.14); color: #2f7a1b; font-size: 0.78rem; font-weight: 800; white-space: nowrap; }
    .more { font-size: 0.8rem; font-weight: 700; color: var(--brand-blue, #1385B6); text-decoration: none; white-space: nowrap; }
    .more:hover { text-decoration: underline; }
    .empty { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; color: #2f7a1b; font-weight: 600; font-size: 0.9rem; }

    /* ── Mix de cargos ────────────────────────────────────────────── */
    .mix { display: flex; align-items: center; gap: 1.2rem; flex-wrap: wrap; justify-content: center; }
    .mix-ring { position: relative; width: 170px; height: 170px; flex: 0 0 auto; }
    .mix-c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
    .mix-c strong { font-size: 1.15rem; font-weight: 800; color: var(--p-text-color); }
    .mix-c span { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand-muted); }
    .legend { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; min-width: 150px; }
    .legend > div { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
    .ln { flex: 1; color: var(--p-text-color); }
    .legend em { font-style: normal; font-weight: 800; color: var(--p-text-color); }

    /* ── Antigüedad de la mora ────────────────────────────────────── */
    .aging { display: flex; flex-direction: column; gap: 0.9rem; }
    .ag-top { display: flex; justify-content: space-between; font-size: 0.86rem; margin-bottom: 0.3rem; }
    .ag-top span { font-weight: 600; color: var(--p-text-color); }
    .ag-track, .rk-track, .sp-track, .op-track { height: 10px; border-radius: 999px; background: rgba(19,133,182,0.1); overflow: hidden; }
    .ag-fill, .rk-fill, .sp-fill, .op-fill { height: 100%; border-radius: 999px; min-width: 4px; transition: width .7s cubic-bezier(.4,0,.2,1); }
    .aging small, .rk small, .sp small, .op small { display: block; margin-top: 0.3rem; font-size: 0.76rem; color: var(--brand-muted); }

    /* ── Mayores deudores ─────────────────────────────────────────── */
    .debtors { display: flex; flex-direction: column; gap: 0.55rem; }
    .debtor { display: flex; align-items: center; gap: 0.8rem; padding: 0.6rem 0.8rem; border-radius: 14px; background: rgba(229,103,93,0.06); border: 1px solid rgba(229,103,93,0.14); }
    .rank { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #f0857b, #cf4b3f); color: #fff; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
    .d-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .d-main strong { font-size: 0.88rem; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-main small { font-size: 0.76rem; color: var(--brand-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-amt { font-weight: 800; color: #cf4b3f; font-size: 0.92rem; white-space: nowrap; }

    /* ── Ranking de edificios ─────────────────────────────────────── */
    .rank-list { display: flex; flex-direction: column; gap: 1rem; max-height: 360px; overflow-y: auto; padding-right: 0.2rem; }
    .rk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; font-size: 0.9rem; }
    .rk-top strong { color: var(--p-text-color); }
    .rk-rate { font-weight: 800; padding: 0.1rem 0.6rem; border-radius: 999px; font-size: 0.78rem; }
    .rk-rate.good { background: rgba(106,198,74,0.15); color: #2f7a1b; }
    .rk-rate.mid  { background: rgba(245,158,11,0.15); color: #a96300; }
    .rk-rate.bad  { background: rgba(229,103,93,0.15); color: #cf4b3f; }
    .rk-fill.good { background: linear-gradient(90deg, #6AC64A, #1AB7AF); }
    .rk-fill.mid  { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .rk-fill.bad  { background: linear-gradient(90deg, #f0857b, #cf4b3f); }

    /* ── Propietarios / residentes y operación ────────────────────── */
    .split { display: flex; flex-direction: column; gap: 1.2rem; }
    .sp-top, .op-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.4rem; font-size: 0.9rem; }
    .sp-top span, .op-top span { font-weight: 700; color: var(--p-text-color); }
    .sp-top strong, .op-top strong { font-size: 1.3rem; font-weight: 800; color: var(--p-text-color); }
    .op { padding: 1.2rem 1.4rem; }

    /* ── Responsive ───────────────────────────────────────────────── */
    @media (max-width: 1280px) { .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 1000px) {
      .g-main, .g-two, .g-three { grid-template-columns: 1fr; }
      .hero { flex-direction: column; align-items: flex-start; padding: 1.5rem; }
      .hero h1 { font-size: 1.8rem; }
    }
    @media (max-width: 560px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .k-val { font-size: 1.25rem; } }
  `]
})
export class DashboardPageComponent implements OnInit {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly collectionsApi = inject(CollectionsApiService);
  private readonly morosityApi = inject(MorosityApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  summary: DashboardSummary | null = null;
  collection: CollectionReport | null = null;
  morosity: MorosityReport | null = null;
  loading = true;

  readonly years = (() => { const y = new Date().getFullYear(); return [y, y - 1, y - 2, y - 3]; })();
  year = this.years[0];

  kpis: Kpi[] = [];
  insights: Insight[] = [];
  ops: { label: string; pct: number; detail: string; color: string }[] = [];
  aging: Aging[] = [];
  topDebtors: MorosityItem[] = [];
  buildingRanks: BuildingRank[] = [];
  ownerSplit: { label: string; charged: number; collected: number; pending: number; rate: number; color: string }[] | null = null;
  mixSlices: { label: string; amount: number; share: number; color: string }[] = [];
  mixTotal = 0;
  mixData: unknown = null;
  monthlyData: unknown = null;
  monthlyOptions: unknown = null;
  donutOptions: unknown = null;

  ngOnInit(): void {
    this.buildOptions();
    forkJoin({
      summary: this.dashboardApi.getSummary(),
      collection: this.collectionsApi.getReport({ year: this.year }).pipe(catchError(() => of(null))),
      morosity: this.morosityApi.getReport({ pageSize: 100 }).pipe(catchError(() => of(null)))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ summary, collection, morosity }) => {
        this.summary = summary;
        this.collection = collection;
        this.morosity = morosity;
        this.rebuild();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el resumen.', life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onYear(value: number): void {
    this.year = value;
    this.collectionsApi.getReport({ year: value }).pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef)).subscribe(report => {
      this.collection = report;
      this.rebuild();
      this.cdr.markForCheck();
    });
  }

  /** Porcentaje de cobranza que se muestra en el anillo: el del año elegido y, si no hay informe, el histórico del resumen. */
  get rate(): number {
    const r = this.collection?.summary.collectionRatePercentage ?? this.summary?.collectionRatePercentage ?? 0;
    return Math.round(r);
  }

  /** Offset del anillo SVG. Radio=50, circunferencia=2π×50≈314.16 */
  ringOffset(pct: number): number {
    return 314.16 * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  }

  fmt(v: number): string { return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(v ?? 0); }

  fmtCompact(v: number): string {
    const n = Number(v ?? 0);
    return '₲ ' + new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }

  private pct(v: number, t: number): number { return t ? Math.round((v / t) * 100) : 0; }

  private rebuild(): void {
    const s = this.summary;
    if (!s) return;
    const c = this.collection?.summary;
    const m = this.morosity?.summary;

    const charged = c?.totalChargedAmount ?? s.totalChargedAmount;
    const collected = c?.totalCollectedAmount ?? s.totalCollectedAmount;
    const pending = c?.totalPendingAmount ?? s.pendingBalanceAmount;
    const overdue = m?.totalOverdueAmount ?? s.overdueBalanceAmount;
    const occupancy = this.pct(s.occupiedUnits, s.totalUnits);

    this.kpis = [
      { icon: 'pi-send', label: c ? `Emitido ${this.year}` : 'Total emitido', value: this.fmtCompact(charged), note: `${s.totalExpensePeriods} periodos cargados`, tone: 'blue', link: '/period-ledger' },
      { icon: 'pi-check-circle', label: c ? `Cobrado ${this.year}` : 'Total cobrado', value: this.fmtCompact(collected), note: `${this.rate}% de cobranza`, tone: 'green', link: '/collections' },
      { icon: 'pi-clock', label: 'Por cobrar', value: this.fmtCompact(pending), note: `${s.unitsWithOutstandingBalance} unidades con saldo`, tone: 'amber', link: '/collections' },
      { icon: 'pi-exclamation-triangle', label: 'Mora vencida', value: this.fmtCompact(overdue), note: `${m?.totalUnitsInArrears ?? s.unitsWithOutstandingBalance} unidades en mora`, tone: 'coral', link: '/morosity' },
      { icon: 'pi-th-large', label: 'Unidades', value: String(s.totalUnits), note: `${occupancy}% ocupadas`, tone: 'teal', link: '/units' },
      { icon: 'pi-users', label: 'Residentes', value: String(s.activeResidents), note: `${s.unitsWithOwners} unidades con propietario`, tone: 'violet', link: '/residents' }
    ];

    this.buildMonthly();
    this.buildMix();
    this.buildBuildings();
    this.buildOwnerSplit();
    this.buildAging();
    this.buildOps(occupancy);
    this.buildInsights(charged, overdue, occupancy);
  }

  private buildInsights(charged: number, overdue: number, occupancy: number): void {
    const s = this.summary!;
    const list: Insight[] = [];
    if (this.collection && charged > 0) {
      list.push(this.rate >= 80
        ? { icon: 'pi-thumbs-up', text: `Cobranza sana: ${this.rate}% de lo emitido en ${this.year}`, tone: 'good' }
        : { icon: 'pi-flag', text: `Cobranza de ${this.rate}% en ${this.year}: hay margen para recuperar`, tone: 'warn' });
    }
    if (charged > 0 && overdue > 0) {
      list.push({ icon: 'pi-exclamation-circle', text: `La mora vencida equivale al ${this.pct(overdue, charged)}% de lo emitido`, tone: 'warn' });
    } else if (charged > 0) {
      list.push({ icon: 'pi-check-circle', text: 'Sin mora vencida', tone: 'good' });
    }
    list.push(occupancy >= 85
      ? { icon: 'pi-home', text: `Ocupación alta: ${occupancy}% de las unidades`, tone: 'good' }
      : { icon: 'pi-home', text: `${s.totalUnits - s.occupiedUnits} unidades sin ocupación activa (${100 - occupancy}%)`, tone: 'info' });
    if (s.draftExpensePeriods > 0) {
      list.push({ icon: 'pi-calendar', text: `${s.draftExpensePeriods} ${s.draftExpensePeriods === 1 ? 'periodo' : 'periodos'} en borrador por cerrar`, tone: 'info' });
    }
    if (this.buildingRanks.length > 1) {
      const best = this.buildingRanks[0];
      list.push({ icon: 'pi-star', text: `Mejor cobranza: ${best.name} (${best.rate}%)`, tone: 'good' });
    }
    this.insights = list;
  }

  private buildOps(occupancy: number): void {
    const s = this.summary!;
    this.ops = [
      { label: 'Ocupación de unidades', pct: occupancy, detail: `${s.occupiedUnits} de ${s.totalUnits} unidades con residente`, color: `linear-gradient(90deg, ${TEAL}, ${BLUE})` },
      { label: 'Residentes activos', pct: this.pct(s.activeResidents, s.totalResidents), detail: `${s.activeResidents} de ${s.totalResidents} activos`, color: `linear-gradient(90deg, ${VIOLET}, ${BLUE})` },
      { label: 'Edificios operativos', pct: this.pct(s.activeBuildings, s.totalBuildings), detail: `${s.activeBuildings} de ${s.totalBuildings} edificios`, color: `linear-gradient(90deg, ${GREEN}, ${TEAL})` }
    ];
  }

  private buildMonthly(): void {
    const items = this.collection?.items ?? [];
    if (!items.length) { this.monthlyData = null; return; }
    const charged = new Array(12).fill(0);
    const collected = new Array(12).fill(0);
    for (const it of items) {
      const i = it.month - 1;
      if (i < 0 || i > 11) continue;
      charged[i] += it.totalChargedAmount;
      collected[i] += it.totalCollectedAmount;
    }
    const last = Math.max(...items.map(i => i.month)) - 1;
    const upto = Math.min(Math.max(last, 0), 11) + 1;
    const labels = MONTHS_SHORT.slice(0, upto);
    this.monthlyData = {
      labels,
      datasets: [
        { type: 'line', label: '% cobranza', data: charged.slice(0, upto).map((c, i) => c ? Math.round((collected[i] / c) * 100) : null), borderColor: AMBER, backgroundColor: AMBER, pointRadius: 4, tension: 0.3, yAxisID: 'y1' },
        { type: 'bar', label: 'Facturado', data: charged.slice(0, upto), backgroundColor: BLUE, borderRadius: 6, yAxisID: 'y' },
        { type: 'bar', label: 'Cobrado', data: collected.slice(0, upto), backgroundColor: GREEN, borderRadius: 6, yAxisID: 'y' }
      ]
    };
  }

  private buildMix(): void {
    const c = this.collection?.summary;
    if (!c) { this.mixSlices = []; this.mixTotal = 0; return; }
    const raw = [
      { label: 'Ordinarias', amount: c.ordinaryChargedAmount, color: BLUE },
      { label: 'Fondo de reserva', amount: c.reserveFundChargedAmount, color: TEAL },
      { label: 'Extraordinarias', amount: c.extraordinaryChargedAmount, color: VIOLET },
      { label: 'Individuales', amount: c.individualChargedAmount, color: AMBER },
      { label: 'Ajustes', amount: c.adjustmentChargedAmount, color: CORAL }
    ].filter(x => x.amount > 0);
    const total = raw.reduce((a, x) => a + x.amount, 0);
    this.mixTotal = total;
    this.mixSlices = raw.map(x => ({ ...x, share: this.pct(x.amount, total) }));
    this.mixData = {
      labels: raw.map(x => x.label),
      datasets: [{ data: raw.map(x => x.amount), backgroundColor: raw.map(x => x.color), borderWidth: 3, borderColor: 'transparent', hoverOffset: 6 }]
    };
  }

  private buildBuildings(): void {
    const items = this.collection?.items ?? [];
    const map = new Map<string, BuildingRank>();
    for (const it of items) {
      const row = map.get(it.buildingId) ?? { name: it.buildingName, charged: 0, collected: 0, pending: 0, rate: 0 };
      row.charged += it.totalChargedAmount;
      row.collected += it.totalCollectedAmount;
      row.pending += it.pendingAmount;
      map.set(it.buildingId, row);
    }
    this.buildingRanks = [...map.values()]
      .map(b => ({ ...b, rate: Math.min(this.pct(b.collected, b.charged), 100) }))
      .sort((a, b) => b.rate - a.rate || b.charged - a.charged);
  }

  private buildOwnerSplit(): void {
    const c = this.collection?.summary;
    if (!c || (c.ownerChargedAmount <= 0 && c.residentChargedAmount <= 0)) { this.ownerSplit = null; return; }
    this.ownerSplit = [
      { label: 'Propietarios', charged: c.ownerChargedAmount, collected: c.ownerCollectedAmount, pending: c.ownerPendingAmount, rate: Math.min(this.pct(c.ownerCollectedAmount, c.ownerChargedAmount), 100), color: `linear-gradient(90deg, ${BLUE}, ${TEAL})` },
      { label: 'Residentes', charged: c.residentChargedAmount, collected: c.residentCollectedAmount, pending: c.residentPendingAmount, rate: Math.min(this.pct(c.residentCollectedAmount, c.residentChargedAmount), 100), color: `linear-gradient(90deg, ${VIOLET}, ${BLUE})` }
    ].filter(x => x.charged > 0);
  }

  private buildAging(): void {
    const m = this.morosity;
    if (!m) { this.aging = []; this.topDebtors = []; return; }
    const sm = m.summary;
    const total = sm.totalOverdueAmount || 1;
    const rows = [
      { label: '0 a 30 días', units: sm.units0To30, amount: sm.amount0To30, color: `linear-gradient(90deg, ${GREEN}, ${TEAL})` },
      { label: '31 a 60 días', units: sm.units31To60, amount: sm.amount31To60, color: `linear-gradient(90deg, #fbbf24, ${AMBER})` },
      { label: '61 a 90 días', units: sm.units61To90, amount: sm.amount61To90, color: `linear-gradient(90deg, #f59e0b, #e0701a)` },
      { label: 'Más de 90 días', units: sm.unitsOver90, amount: sm.amountOver90, color: `linear-gradient(90deg, #f0857b, #cf4b3f)` }
    ];
    this.aging = rows.map(r => ({ ...r, share: Math.round((r.amount / total) * 100) }));
    this.topDebtors = [...m.items].sort((a, b) => b.balance - a.balance).slice(0, 5);
  }

  private buildOptions(): void {
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color') || '#334155';
    const gridColor = style.getPropertyValue('--surface-border') || 'rgba(0,0,0,0.08)';
    const compact = (v: number | string) => new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));
    const gs = (v: number) => '₲ ' + Number(v).toLocaleString('es-PY', { maximumFractionDigits: 0 });

    this.monthlyOptions = {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: textColor, usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label: string }; parsed: { y: number } }) =>
              ctx.dataset.label === '% cobranza' ? ` % cobranza: ${ctx.parsed.y}%` : ` ${ctx.dataset.label}: ${gs(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: { position: 'left', ticks: { color: textColor, callback: compact }, grid: { color: gridColor } },
        y1: { position: 'right', min: 0, max: 100, ticks: { color: textColor, callback: (v: number | string) => `${v}%` }, grid: { drawOnChartArea: false } }
      }
    };

    this.donutOptions = {
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: { label: string; parsed: number }) => ` ${ctx.label}: ${gs(ctx.parsed)}` } }
      }
    };
  }
}

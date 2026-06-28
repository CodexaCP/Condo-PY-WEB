import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { DashboardApiService } from '../../api/dashboard-api.service';
import { DashboardSummary } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule],
  template: `
    <!-- ══ HERO ══════════════════════════════════════════════════════════ -->
    <div class="db-hero">
      <div class="db-hero-bg-circles">
        <span class="c1"></span><span class="c2"></span><span class="c3"></span>
      </div>
      <div class="db-hero-top">
        <p class="db-hero-eyebrow">Resumen general</p>
        <h1 class="db-hero-title">Estado del condominio</h1>
        <p class="db-hero-sub">Operativo y financiero en tiempo real</p>
      </div>
      <div class="db-hero-stats" *ngIf="summary">
        <div class="db-hero-stat" *ngFor="let s of heroStats" [class.db-hero-stat-warn]="s.warn">
          <i class="pi" [ngClass]="s.icon"></i>
          <strong>{{ s.value }}</strong>
          <span>{{ s.label }}</span>
          <small *ngIf="s.note">{{ s.note }}</small>
        </div>
      </div>
    </div>

    <div *ngIf="loading" class="db-loading">
      <i class="pi pi-spin pi-spinner"></i> Cargando datos...
    </div>

    <ng-container *ngIf="summary">

      <!-- ══ FILA 1: Cobranza destacada + Financiero ════════════════════ -->
      <div class="db-row db-row-finance">

        <!-- Anillo de cobranza -->
        <div class="db-ring-card">
          <p class="db-section-label">Recuperación</p>
          <div class="db-ring-wrap">
            <svg viewBox="0 0 120 120" class="db-ring-svg">
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stop-color="#1AB7AF"/>
                  <stop offset="55%"  stop-color="#1385B6"/>
                  <stop offset="100%" stop-color="#6AC64A"/>
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="50" class="db-ring-track"/>
              <circle cx="60" cy="60" r="50" class="db-ring-fill"
                [style.stroke-dashoffset]="ringOffset(summary.collectionRatePercentage)"/>
            </svg>
            <div class="db-ring-center">
              <strong>{{ summary.collectionRatePercentage }}%</strong>
              <span>cobrado</span>
            </div>
          </div>
          <div class="db-ring-meta">
            <div>
              <span>Cobrado</span>
              <strong>{{ fmt(summary.totalCollectedAmount) }}</strong>
            </div>
            <div>
              <span>Pendiente</span>
              <strong class="warn">{{ fmt(summary.pendingBalanceAmount) }}</strong>
            </div>
          </div>
        </div>

        <!-- Métricas financieras -->
        <div class="db-finance-col">
          <p class="db-section-label">Resumen financiero</p>
          <div class="db-finance-cards">
            <div class="db-fin-card db-fin-total">
              <div class="db-fin-icon"><i class="pi pi-send"></i></div>
              <div>
                <span>Total emitido</span>
                <strong>{{ fmt(summary.totalChargedAmount) }}</strong>
                <small>{{ summary.totalExpensePeriods }} periodos cargados</small>
              </div>
            </div>
            <div class="db-fin-card db-fin-pendiente">
              <div class="db-fin-icon"><i class="pi pi-clock"></i></div>
              <div>
                <span>Saldo pendiente</span>
                <strong>{{ fmt(summary.pendingBalanceAmount) }}</strong>
                <small>{{ summary.unitsWithOutstandingBalance }} unidades con saldo</small>
              </div>
            </div>
            <div class="db-fin-card db-fin-cobrado">
              <div class="db-fin-icon"><i class="pi pi-check-circle"></i></div>
              <div>
                <span>Total cobrado</span>
                <strong>{{ fmt(summary.totalCollectedAmount) }}</strong>
                <small>{{ summary.collectionRatePercentage }}% de recuperación</small>
              </div>
            </div>
            <div class="db-fin-card db-fin-revertido">
              <div class="db-fin-icon"><i class="pi pi-replay"></i></div>
              <div>
                <span>Total revertido</span>
                <strong>{{ fmt(summary.totalReversedAmount) }}</strong>
                <small>{{ summary.totalReversedPayments }} cargos revertidos</small>
              </div>
            </div>
            <div class="db-fin-card db-fin-mora db-fin-full">
              <div class="db-fin-icon"><i class="pi pi-exclamation-circle"></i></div>
              <div>
                <span>Mora vencida</span>
                <strong>{{ fmt(summary.overdueBalanceAmount) }}</strong>
                <small>{{ summary.unitsWithOutstandingBalance }} unidades con deuda</small>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ══ FILA 2: Barras operativas + Alertas ════════════════════════ -->
      <div class="db-row db-row-ops">

        <!-- Cobertura operativa (barras) -->
        <div class="db-ops-card">
          <p class="db-section-label">Cobertura operativa</p>

          <div class="db-bar-item">
            <div class="db-bar-head">
              <span>Ocupación de unidades</span>
              <strong>{{ occupancyPercentage }}%</strong>
            </div>
            <div class="db-bar-track">
              <div class="db-bar-fill" [style.width.%]="occupancyPercentage"></div>
            </div>
            <small>{{ summary.occupiedUnits }} de {{ summary.totalUnits }} unidades con residente</small>
          </div>

          <div class="db-bar-item">
            <div class="db-bar-head">
              <span>Residentes activos</span>
              <strong>{{ activeResidentsPercentage }}%</strong>
            </div>
            <div class="db-bar-track">
              <div class="db-bar-fill" [style.width.%]="activeResidentsPercentage"></div>
            </div>
            <small>{{ summary.activeResidents }} de {{ summary.totalResidents }} activos</small>
          </div>

          <div class="db-bar-item">
            <div class="db-bar-head">
              <span>Edificios operativos</span>
              <strong>{{ activeBuildingsPercentage }}%</strong>
            </div>
            <div class="db-bar-track">
              <div class="db-bar-fill" [style.width.%]="activeBuildingsPercentage"></div>
            </div>
            <small>{{ summary.activeBuildings }} de {{ summary.totalBuildings }} edificios</small>
          </div>
        </div>

        <!-- Alertas -->
        <div class="db-alerts-card">
          <p class="db-section-label">Alertas del sistema</p>
          <div class="db-alert-list">
            <div class="db-alert" *ngFor="let a of alerts" [class.db-alert-warn]="a.variant==='warn'" [class.db-alert-ok]="a.variant==='good'">
              <div class="db-alert-dot"></div>
              <div class="db-alert-body">
                <strong>{{ a.title }}</strong>
                <span>{{ a.detail }}</span>
              </div>
              <div class="db-alert-badge" [class.warn]="a.variant==='warn'" [class.ok]="a.variant==='good'">
                {{ a.variant === 'warn' ? '!' : '✓' }}
              </div>
            </div>
          </div>
        </div>

      </div>

    </ng-container>
  `,
  styles: [`
    /* ── HERO ─────────────────────────────────────────────────────── */
    .db-hero {
      position: relative;
      background: var(--brand-gradient);
      border-radius: 24px;
      padding: 1.4rem 2rem;
      overflow: hidden;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .db-hero-bg-circles span {
      position: absolute;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
      pointer-events: none;
    }
    .db-hero-bg-circles .c1 { width:320px;height:320px;top:-100px;right:-60px; }
    .db-hero-bg-circles .c2 { width:180px;height:180px;bottom:-40px;right:220px;background:rgba(255,255,255,0.05); }
    .db-hero-bg-circles .c3 { width:100px;height:100px;top:20px;right:400px;background:rgba(255,255,255,0.06); }

    .db-hero-top {
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }
    .db-hero-eyebrow {
      color: rgba(255,255,255,0.6);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      margin: 0 0 0.4rem;
    }
    .db-hero-title {
      color: #fff;
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.1;
      margin: 0 0 0.4rem;
      letter-spacing: -0.03em;
    }
    .db-hero-sub {
      color: rgba(255,255,255,0.6);
      font-size: 0.88rem;
      margin: 0;
    }

    .db-hero-stats {
      position: relative;
      z-index: 1;
      display: flex;
      gap: 0.45rem;
      flex: 1;
      justify-content: flex-end;
    }
    .db-hero-stat {
      background: rgba(255,255,255,0.13);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 12px;
      padding: 0.55rem 0.7rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      backdrop-filter: blur(8px);
      text-align: center;
      min-width: 72px;
    }
    .db-hero-stat-warn {
      background: rgba(255, 200, 120, 0.18);
      border-color: rgba(255, 200, 80, 0.35);
    }
    .db-hero-stat i { color: rgba(255,255,255,0.7); font-size: 0.85rem; }
    .db-hero-stat-warn i { color: rgba(255, 230, 130, 0.9); }
    .db-hero-stat strong { color: #fff; font-size: 1.2rem; font-weight: 800; line-height: 1; }
    .db-hero-stat span { color: rgba(255,255,255,0.6); font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .db-hero-stat small { color: rgba(255,255,255,0.45); font-size: 0.55rem; }

    /* ── LOADING ──────────────────────────────────────────────────── */
    .db-loading {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: var(--brand-muted);
      padding: 2rem;
      font-weight: 500;
    }

    /* ── LABEL DE SECCIÓN ─────────────────────────────────────────── */
    .db-section-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--brand-muted);
      margin: 0 0 1.2rem;
    }

    /* ── FILAS ────────────────────────────────────────────────────── */
    .db-row {
      display: grid;
      gap: 1.2rem;
      margin-bottom: 1.2rem;
    }
    .db-row-finance { grid-template-columns: 280px 1fr; }
    .db-row-ops     { grid-template-columns: 1.1fr 0.9fr; }

    /* ── CARD BASE ────────────────────────────────────────────────── */
    .db-ring-card,
    .db-finance-col,
    .db-ops-card,
    .db-alerts-card {
      background: var(--p-content-background, #fff);
      border-radius: 20px;
      padding: 1.5rem;
      border: 1px solid rgba(19,133,182,0.08);
      box-shadow: 0 8px 32px rgba(17,54,74,0.07);
    }

    /* ── ANILLO ───────────────────────────────────────────────────── */
    .db-ring-wrap {
      position: relative;
      width: 160px;
      height: 160px;
      margin: 0 auto 1.4rem;
    }
    .db-ring-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .db-ring-track {
      fill: none;
      stroke: rgba(19,133,182,0.1);
      stroke-width: 10;
    }
    .db-ring-fill {
      fill: none;
      stroke: url(#ringGrad);
      stroke-width: 10;
      stroke-linecap: round;
      stroke-dasharray: 314.16;
      transition: stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1);
    }
    .db-ring-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .db-ring-center strong {
      font-size: 2.2rem;
      font-weight: 800;
      background: var(--brand-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }
    .db-ring-center span {
      font-size: 0.75rem;
      color: var(--brand-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .db-ring-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
      border-top: 1px solid rgba(19,133,182,0.08);
      padding-top: 1rem;
    }
    .db-ring-meta div { display: flex; flex-direction: column; gap: 0.2rem; }
    .db-ring-meta span { font-size: 0.75rem; color: var(--brand-muted); font-weight: 600; text-transform: uppercase; }
    .db-ring-meta strong { font-size: 1rem; color: var(--p-text-color); font-weight: 700; }
    .db-ring-meta strong.warn { color: #d94f3d; }

    /* ── FINANZAS ─────────────────────────────────────────────────── */
    .db-finance-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .db-fin-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.2rem;
      border-radius: 14px;
      border-left: 4px solid;
    }
    .db-fin-full    { grid-column: 1 / -1; }
    .db-fin-total   { background: rgba(26,183,175,0.07);  border-color: #1AB7AF; }
    .db-fin-pendiente{ background: rgba(245,158,11,0.07); border-color: #F59E0B; }
    .db-fin-cobrado { background: rgba(106,198,74,0.08);  border-color: #6AC64A; }
    .db-fin-revertido{ background: rgba(139,92,246,0.07); border-color: #8B5CF6; }
    .db-fin-mora    { background: rgba(217,79,61,0.07);   border-color: #d94f3d; }

    .db-fin-icon {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .db-fin-total    .db-fin-icon { background: #1AB7AF; color: #fff; }
    .db-fin-pendiente .db-fin-icon { background: #F59E0B; color: #fff; }
    .db-fin-cobrado  .db-fin-icon { background: #6AC64A; color: #fff; }
    .db-fin-revertido .db-fin-icon { background: #8B5CF6; color: #fff; }
    .db-fin-mora     .db-fin-icon { background: #d94f3d; color: #fff; }
    .db-fin-icon i { font-size: 1.1rem; }

    .db-fin-card > div { display: flex; flex-direction: column; gap: 0.15rem; }
    .db-fin-card span  { font-size: 0.75rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .db-fin-card strong{ font-size: 1.25rem; font-weight: 800; color: var(--p-text-color); }
    .db-fin-card small { font-size: 0.78rem; color: var(--brand-muted); }

    /* ── BARRAS ───────────────────────────────────────────────────── */
    .db-bar-item { margin-bottom: 1.4rem; }
    .db-bar-item:last-child { margin-bottom: 0; }
    .db-bar-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
    .db-bar-head span { font-size: 0.88rem; color: var(--p-text-color); font-weight: 500; }
    .db-bar-head strong { font-size: 1.1rem; font-weight: 800; background: var(--brand-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .db-bar-track {
      height: 10px;
      background: rgba(19,133,182,0.1);
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 0.35rem;
    }
    .db-bar-fill {
      height: 100%;
      background: var(--brand-gradient);
      border-radius: 999px;
      transition: width 0.9s cubic-bezier(.4,0,.2,1);
    }
    .db-bar-item small { font-size: 0.76rem; color: var(--brand-muted); }

    /* ── ALERTAS ──────────────────────────────────────────────────── */
    .db-alert-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .db-alert {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.8rem 1rem;
      border-radius: 12px;
      background: rgba(19,133,182,0.04);
      border: 1px solid rgba(19,133,182,0.08);
    }
    .db-alert-warn { background: rgba(217,79,61,0.05); border-color: rgba(217,79,61,0.15); }
    .db-alert-ok   { background: rgba(106,198,74,0.06); border-color: rgba(106,198,74,0.15); }
    .db-alert-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(19,133,182,0.3);
      flex-shrink: 0;
    }
    .db-alert-warn .db-alert-dot { background: #d94f3d; }
    .db-alert-ok   .db-alert-dot { background: #6AC64A; }
    .db-alert-body { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
    .db-alert-body strong { font-size: 0.85rem; font-weight: 700; color: var(--p-text-color); }
    .db-alert-body span   { font-size: 0.78rem; color: var(--brand-muted); }
    .db-alert-badge {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.85rem; flex-shrink: 0;
      background: rgba(19,133,182,0.1); color: #1385B6;
    }
    .db-alert-badge.warn { background: rgba(217,79,61,0.12); color: #d94f3d; }
    .db-alert-badge.ok   { background: rgba(106,198,74,0.14); color: #3a7d28; }

    /* ── RESPONSIVE ───────────────────────────────────────────────── */
    @media (max-width: 1100px) {
      .db-row-finance { grid-template-columns: 1fr; }
      .db-ring-card { display: flex; flex-direction: column; align-items: center; }
      .db-ring-meta { width: 100%; max-width: 280px; }
    }
    @media (max-width: 900px) {
      .db-hero { flex-wrap: wrap; }
      .db-hero-stats { justify-content: flex-start; flex-wrap: wrap; }
      .db-row-ops { grid-template-columns: 1fr; }
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
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el resumen.', life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  get heroStats() {
    if (!this.summary) return [];
    return [
      {
        icon: 'pi-building',
        value: this.summary.totalBuildings,
        label: 'Edificios',
        note: `${this.summary.activeBuildings} activos`,
        warn: false
      },
      {
        icon: 'pi-th-large',
        value: this.summary.totalUnits,
        label: 'Unidades',
        note: `${this.summary.activeUnits} activas`,
        warn: false
      },
      {
        icon: 'pi-users',
        value: this.summary.totalResidents,
        label: 'Residentes',
        note: `${this.summary.activeResidents} activos`,
        warn: false
      },
      {
        icon: 'pi-id-card',
        value: this.summary.unitsWithOwners,
        label: 'Con propietario',
        note: null,
        warn: false
      },
      {
        icon: 'pi-ban',
        value: this.vacantUnits,
        label: 'Sin ocupación',
        note: null,
        warn: this.vacantUnits > 0
      },
      {
        icon: 'pi-id-card',
        value: this.summary.unitsWithoutPrimaryResident,
        label: 'Sin residente',
        note: null,
        warn: this.summary.unitsWithoutPrimaryResident > 0
      },
      {
        icon: 'pi-calendar',
        value: this.summary.draftExpensePeriods,
        label: 'En borrador',
        note: null,
        warn: this.summary.draftExpensePeriods > 0
      },
    ];
  }

  get alerts() {
    if (!this.summary) return [];
    return [
      {
        title: 'Unidades sin residente principal',
        detail: `${this.summary.unitsWithoutPrimaryResident} pendientes de normalización`,
        variant: this.summary.unitsWithoutPrimaryResident > 0 ? 'warn' : 'good'
      },
      {
        title: 'Unidades sin ocupación',
        detail: `${this.vacantUnits} unidades sin asignación activa`,
        variant: this.vacantUnits > 0 ? 'warn' : 'good'
      },
      {
        title: 'Mora vencida',
        detail: `${this.fmt(this.summary.overdueBalanceAmount)} fuera de vencimiento`,
        variant: this.summary.overdueBalanceAmount > 0 ? 'warn' : 'good'
      },
      {
        title: 'Periodos en borrador',
        detail: `${this.summary.draftExpensePeriods} periodos sin cerrar`,
        variant: this.summary.draftExpensePeriods > 0 ? 'warn' : 'good'
      },
      {
        title: 'Cobertura de asignaciones',
        detail: `${this.summary.activeAssignments} vínculos activos sostienen la operación`,
        variant: 'good'
      },
    ];
  }

  /** Offset del anillo SVG. Radio=50, circunferencia=2π×50≈314.16 */
  ringOffset(pct: number): number {
    return 314.16 * (1 - Math.min(pct, 100) / 100);
  }

  get occupancyPercentage()       { return this.pct(this.summary?.occupiedUnits  ?? 0, this.summary?.totalUnits     ?? 0); }
  get activeResidentsPercentage() { return this.pct(this.summary?.activeResidents ?? 0, this.summary?.totalResidents  ?? 0); }
  get activeBuildingsPercentage() { return this.pct(this.summary?.activeBuildings ?? 0, this.summary?.totalBuildings  ?? 0); }
  get vacantUnits()               { return Math.max((this.summary?.totalUnits ?? 0) - (this.summary?.occupiedUnits ?? 0), 0); }

  fmt(v: number) { return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(v ?? 0); }

  private pct(v: number, t: number) { return t ? Math.round((v / t) * 100) : 0; }
}

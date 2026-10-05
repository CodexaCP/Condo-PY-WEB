import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { Message } from 'primeng/message';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { CollectionsApiService } from '../../api/collections-api.service';
import { FinanceApiService } from '../../api/finance-api.service';
import { MorosityApiService } from '../../api/morosity-api.service';
import { CollectionReport, FinanceBuildingAccess, FinanceDashboard, FinanceMovement, FinanceRubroAmount, MorosityReport } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { FinanceExportButtonComponent, FinanceExportParams } from './finance-export-button.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, monthLabel, monthShort } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

// Cuanto cambio un monto contra el mes anterior. `good` dice si el cambio es favorable (mas ingresos es bueno, mas egresos no).
interface Delta { pct: number; good: boolean }

interface DonutSlice { label: string; amount: number; share: number; color: string }
interface Donut { data: unknown; slices: DonutSlice[]; total: number }

interface DashAlert { level: 'bad' | 'warn' | 'info' | 'ok'; title: string; detail: string; link?: string[] }

// Colores de los rubros: la paleta de marca primero y luego tonos de apoyo; el ultimo (gris) es siempre «Otros».
const SLICE_COLORS = ['#1385B6', '#1AB7AF', '#8B5CF6', '#F59E0B', '#6AC64A'];
const OTHERS_COLOR = '#94a3b8';

// Tablero del modulo «Finanzas del edificio»: ingresos y egresos del mes contra el mes anterior, cobranza y mora del edificio,
// saldos, evolucion, rubros, ultimos movimientos y alertas. Caja y saldos por lo percibido (cobrado y pagado), hasta hoy y desde
// la fecha de arranque.
@Component({
  standalone: true,
  selector: 'app-finance-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Card, ChartModule, Message, GsPipe, FinanceBuildingPickerComponent, FinanceExportButtonComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="hero">
          <div class="hero-ico"><i class="pi pi-chart-bar"></i></div>
          <div>
            <h1>Resumen financiero</h1>
            <p>Vista general de la situación económica del edificio.</p>
          </div>
        </div>
        <div class="controls">
          <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
          <label class="field" *ngIf="data">
            <span>Mes</span>
            <input type="month" [ngModel]="monthValue" (ngModelChange)="onMonth($event)" [min]="minMonth" [max]="maxMonth" />
          </label>
          <app-finance-export-button kind="accountant-pack" [buildingId]="buildingId" [params]="exportParams" fileLabel="paquete-contador"
                                     label="Paquete para el contador" [period]="data ? '' + data.fiscalYear : ''" [disabled]="!data"></app-finance-export-button>
        </div>
      </div>

      <div class="disclaimer">
        <i class="pi pi-info-circle"></i>
        <span>
          Caja y saldos por lo <strong>percibido</strong> (lo cobrado y pagado), desde la fecha de arranque y hasta hoy.
          Este módulo no reemplaza al contador.
        </span>
      </div>

      <app-finance-state [loading]="loading" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="data as d">
        <p class="asof">Datos al {{ d.asOf | date: 'dd/MM/yyyy' }} · en el mes de {{ monthText }}</p>

        <div class="k3">
          <div class="card kpi">
            <div class="ki ki-in"><i class="pi pi-arrow-down"></i></div>
            <div class="kb">
              <span class="kl">Ingresos del mes</span>
              <strong class="kv">{{ d.monthFlow.in | gs }}</strong>
              <span class="kd" *ngIf="deltaIn as x" [class.good]="x.good" [class.bad]="!x.good">{{ pct(x.pct) }} <em>vs. mes anterior</em></span>
            </div>
          </div>
          <div class="card kpi">
            <div class="ki ki-out"><i class="pi pi-arrow-up"></i></div>
            <div class="kb">
              <span class="kl">Egresos del mes</span>
              <strong class="kv">{{ d.monthFlow.out | gs }}</strong>
              <span class="kd" *ngIf="deltaOut as x" [class.good]="x.good" [class.bad]="!x.good">{{ pct(x.pct) }} <em>vs. mes anterior</em></span>
            </div>
          </div>
          <div class="card kpi main">
            <div class="ki ki-net"><i class="pi pi-chart-line"></i></div>
            <div class="kb">
              <span class="kl">Resultado del mes</span>
              <strong class="kv" [class.pos]="d.monthFlow.net >= 0" [class.neg]="d.monthFlow.net < 0">{{ d.monthFlow.net | gs }}</strong>
              <span class="kd" *ngIf="deltaNet as x" [class.good]="x.good" [class.bad]="!x.good">{{ pct(x.pct) }} <em>vs. mes anterior</em></span>
            </div>
          </div>
        </div>

        <div class="k4">
          <a class="card kpi link-card" *ngIf="porCobrar as p" routerLink="/collections">
            <div class="ki ki-due"><i class="pi pi-users"></i></div>
            <div class="kb">
              <span class="kl">Por cobrar</span>
              <strong class="kv sm">{{ p.amount | gs }}</strong>
              <span class="kd muted">Cobranza {{ p.rate | number: '1.0-1' }} %</span>
            </div>
          </a>
          <a class="card kpi link-card" *ngIf="mora as m" routerLink="/morosity">
            <div class="ki ki-late"><i class="pi pi-clock"></i></div>
            <div class="kb">
              <span class="kl">Mora vencida</span>
              <strong class="kv sm" [class.neg]="m.amount > 0">{{ m.amount | gs }}</strong>
              <span class="kd muted">{{ m.units }} {{ m.units === 1 ? 'unidad' : 'unidades' }}</span>
            </div>
          </a>
          <div class="card kpi">
            <div class="ki ki-cash"><i class="pi pi-wallet"></i></div>
            <div class="kb">
              <span class="kl">Saldo en caja</span>
              <strong class="kv sm">{{ d.balances.cashBalance | gs }}</strong>
              <span class="kd muted">Efectivo</span>
            </div>
          </div>
          <div class="card kpi">
            <div class="ki ki-bank"><i class="pi pi-building"></i></div>
            <div class="kb">
              <span class="kl">Saldo bancario</span>
              <strong class="kv sm">{{ d.balances.bankBalance | gs }}</strong>
              <span class="kd muted">Bancos</span>
            </div>
          </div>
        </div>

        <ng-container *ngFor="let w of d.balances.warnings">
          <p-message severity="warn" [text]="w"></p-message>
          <p class="link"><a [routerLink]="['/finance/settings']" [queryParams]="{ buildingId: d.buildingId }">Ir a Configuración</a></p>
        </ng-container>

        <div class="row3">
          <div class="card">
            <div class="ch">
              <h3>Ingresos vs. egresos</h3>
              <div class="tabs">
                <button type="button" [class.on]="range === 6" (click)="setRange(6)">6 meses</button>
                <button type="button" [class.on]="range === 12" (click)="setRange(12)">12 meses</button>
              </div>
            </div>
            <div class="chart-box" *ngIf="chartData">
              <p-chart type="bar" [data]="chartData" [options]="chartOptions" height="260px"></p-chart>
            </div>
          </div>

          <div class="card">
            <h3>Egresos por rubro</h3>
            <p class="muted small" *ngIf="!donutOut.slices.length">Sin egresos en el mes.</p>
            <div class="donut" *ngIf="donutOut.slices.length">
              <div class="ring">
                <p-chart type="doughnut" [data]="donutOut.data" [options]="donutOptions" width="130px" height="130px"></p-chart>
                <div class="ring-c"><strong>{{ compact(donutOut.total) }}</strong><span>egresos</span></div>
              </div>
              <div class="lg">
                <div *ngFor="let s of donutOut.slices"><i class="dot" [style.background]="s.color"></i><span class="ln">{{ s.label }}</span><em>{{ s.share | number: '1.0-0' }} %</em></div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3>Ingresos por rubro</h3>
            <p class="muted small" *ngIf="!donutIn.slices.length">Sin ingresos en el mes.</p>
            <div class="donut" *ngIf="donutIn.slices.length">
              <div class="ring">
                <p-chart type="doughnut" [data]="donutIn.data" [options]="donutOptions" width="130px" height="130px"></p-chart>
                <div class="ring-c"><strong>{{ compact(donutIn.total) }}</strong><span>ingresos</span></div>
              </div>
              <div class="lg">
                <div *ngFor="let s of donutIn.slices"><i class="dot" [style.background]="s.color"></i><span class="ln">{{ s.label }}</span><em>{{ s.share | number: '1.0-0' }} %</em></div>
              </div>
            </div>
          </div>
        </div>

        <div class="row2">
          <div class="card">
            <div class="ch">
              <h3>Últimos movimientos</h3>
              <a class="more" [routerLink]="['/finance/movements']" [queryParams]="{ buildingId: d.buildingId }">Ver todos →</a>
            </div>
            <p class="muted small" *ngIf="!movements.length">Sin movimientos para mostrar.</p>
            <div class="tbl-wrap" *ngIf="movements.length">
              <table class="mv">
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Rubro</th><th>Tipo</th><th class="num">Monto</th></tr></thead>
                <tbody>
                  <tr *ngFor="let m of movements">
                    <td>{{ m.date | date: 'dd/MM/yyyy' }}</td>
                    <td class="cc">{{ m.description || m.thirdParty || m.reference || '—' }}</td>
                    <td>{{ m.categoryName || 'Sin rubro' }}</td>
                    <td><span class="tag" [class.in]="m.direction === 'In'" [class.out]="m.direction === 'Out'">{{ m.direction === 'In' ? 'Ingreso' : 'Egreso' }}</span></td>
                    <td class="num">{{ m.amount | gs }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3>Alertas del edificio</h3>
            <ng-container *ngFor="let a of alerts">
              <a class="al" *ngIf="a.link; else plainAlert" [routerLink]="a.link" [queryParams]="{ buildingId: d.buildingId }">
                <span class="ad" [ngClass]="a.level"><i class="pi" [ngClass]="a.level === 'ok' ? 'pi-check' : 'pi-exclamation-circle'"></i></span>
                <span><strong>{{ a.title }}</strong><small>{{ a.detail }}</small></span>
              </a>
              <ng-template #plainAlert>
                <div class="al">
                  <span class="ad" [ngClass]="a.level"><i class="pi" [ngClass]="a.level === 'ok' ? 'pi-check' : 'pi-exclamation-circle'"></i></span>
                  <span><strong>{{ a.title }}</strong><small>{{ a.detail }}</small></span>
                </div>
              </ng-template>
            </ng-container>
          </div>
        </div>

        <h2>Cuentas <small class="muted">Saldo total {{ d.balances.totalBalance | gs }}</small></h2>
        <div class="app-list">
          <div class="app-row header acc-grid">
            <span>Cuenta</span>
            <span class="num">Saldo inicial</span>
            <span class="num">Entradas</span>
            <span class="num">Salidas</span>
            <span class="num">Saldo</span>
          </div>
          <div class="app-row acc-grid" *ngFor="let a of d.balances.accounts" [class.inactive]="!a.isActive">
            <span><strong>{{ a.name }}</strong> <small class="muted">{{ typeLabel(a.type) }}</small></span>
            <span class="num">{{ a.openingBalance | gs }}</span>
            <span class="num pos">{{ a.inflows | gs }}</span>
            <span class="num neg">{{ a.outflows | gs }}</span>
            <span class="num"><strong>{{ a.balance | gs }}</strong></span>
          </div>
          <div class="app-row acc-grid" *ngIf="d.balances.unassignedNet !== 0">
            <span><strong>Sin cuenta asignada</strong></span>
            <span></span><span></span><span></span>
            <span class="num"><strong>{{ d.balances.unassignedNet | gs }}</strong></span>
          </div>
        </div>
        <p class="muted small">Saldo = saldo inicial a la fecha de arranque ({{ d.financeStartDate | date: 'dd/MM/yyyy' }}) + entradas − salidas.</p>
        <p class="muted small">
          Ejercicio {{ d.fiscalYear }} (desde {{ d.fiscalYearStart | date: 'dd/MM/yyyy' }}): entradas {{ d.fiscalYearToDate.in | gs }}, salidas {{ d.fiscalYearToDate.out | gs }}, neto {{ d.fiscalYearToDate.net | gs }}.
        </p>

        <h2>Presupuesto de {{ monthText }}</h2>
        <ng-container *ngIf="d.budget.hasBudget; else noBudget">
          <div class="kpis three">
            <div class="kpi-plain">
              <span>Gastos del mes</span>
              <strong>{{ d.budget.monthExpenseActual | gs }}</strong>
              <small class="muted">presupuestado {{ d.budget.monthExpenseBudget | gs }}</small>
            </div>
            <div class="kpi-plain">
              <span>Ingresos cobrados del mes</span>
              <strong>{{ d.budget.monthIncomeActual | gs }}</strong>
              <small class="muted">presupuestado {{ d.budget.monthIncomeBudget | gs }}</small>
            </div>
            <div class="kpi-plain">
              <span>Rubros con desvío</span>
              <strong><i class="dot red"></i> {{ d.budget.redCount }} <i class="dot amber"></i> {{ d.budget.amberCount }}</strong>
              <small class="muted">rojo: más de 10 % · amarillo: hasta 10 %</small>
            </div>
          </div>
          <ng-container *ngIf="d.budget.topOverBudget.length">
            <h3 class="mt">Gastos que más se pasaron</h3>
            <div class="bar-row" *ngFor="let l of d.budget.topOverBudget">
              <div class="bar-label">
                <span>{{ l.code }} · {{ l.name }} <small class="muted">(presupuesto {{ l.monthBudget | gs }})</small></span>
                <strong class="neg">+{{ l.monthVariance | gs }}</strong>
              </div>
            </div>
          </ng-container>
          <p class="link"><a [routerLink]="['/finance/budget-vs-actual']" [queryParams]="{ buildingId: d.buildingId }">Ver presupuesto vs. real</a></p>
        </ng-container>
        <ng-template #noBudget>
          <p class="muted">Todavía no cargaste un presupuesto para este ejercicio.
            <a [routerLink]="['/finance/budget']" [queryParams]="{ buildingId: d.buildingId }">Cargar el presupuesto</a></p>
        </ng-template>

        <h2>Fondo de reserva</h2>
        <ng-container *ngIf="d.reserveFund.hasFundAccount; else noFund">
          <div class="kpis three">
            <div class="kpi-plain"><span>Saldo del fondo</span><strong>{{ d.reserveFund.balance | gs }}</strong></div>
            <div class="kpi-plain"><span>Aportes de {{ monthText }}</span><strong class="pos">{{ d.reserveFund.monthContributions | gs }}</strong></div>
            <div class="kpi-plain"><span>Usos de {{ monthText }}</span><strong class="neg">{{ d.reserveFund.monthUses | gs }}</strong></div>
          </div>
          <p class="link"><a [routerLink]="['/finance/reserve-fund']" [queryParams]="{ buildingId: d.buildingId }">Ver el libro del fondo</a></p>
        </ng-container>
        <ng-template #noFund>
          <p class="muted">Este edificio no tiene una cuenta de fondo de reserva. Se crea en Configuración → Cuentas.</p>
        </ng-template>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .hero { display: flex; align-items: center; gap: 0.9rem; }
    .hero h1 { margin: 0; font-size: 1.6rem; color: var(--brand-ink); }
    .hero p { margin: 0.15rem 0 0; color: var(--brand-muted); font-size: 0.9rem; }
    .hero-ico {
      width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; flex: none;
      background: var(--brand-gradient); color: var(--brand-on-gradient); font-size: 1.4rem;
    }
    .controls { display: flex; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .field { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .field input {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .disclaimer {
      display: flex; gap: 0.6rem; align-items: flex-start; margin-bottom: 1rem; padding: 0.7rem 1rem;
      border-radius: 12px; background: var(--brand-gradient-soft); color: var(--brand-ink-soft); font-size: 0.9rem; line-height: 1.45;
    }
    .disclaimer i { margin-top: 0.15rem; color: var(--brand-c2); }
    .asof { margin: 0 0 1rem; color: var(--brand-muted); font-size: 0.9rem; }
    h2 { margin: 1.6rem 0 0.7rem; font-size: 1.2rem; color: var(--brand-ink); }
    h2 small { font-size: 0.85rem; font-weight: 600; margin-left: 0.5rem; }
    h3 { margin: 0 0 0.6rem; font-size: 1rem; color: var(--brand-ink); }

    .card {
      background: var(--p-content-background, #fff); border: 1px solid var(--brand-border);
      border-radius: 14px; padding: 1rem 1.1rem; min-width: 0; margin: 0;
    }
    .k3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.9rem; margin-bottom: 0.9rem; }
    .k4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin-bottom: 0.9rem; }
    .row3 { display: grid; grid-template-columns: 1.7fr 1fr 1fr; gap: 0.9rem; margin-bottom: 0.9rem; }
    .row2 { display: grid; grid-template-columns: 1.7fr 1fr; gap: 0.9rem; }

    .kpi { display: flex; gap: 0.85rem; align-items: center; }
    .kpi.main { background: var(--brand-gradient-soft); border-color: transparent; }
    .link-card { text-decoration: none; color: inherit; transition: box-shadow .15s ease, transform .15s ease; }
    .link-card:hover { box-shadow: 0 6px 18px rgba(19,133,182,0.14); transform: translateY(-1px); }
    .ki { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; flex: none; font-size: 1.15rem; }
    .ki-in { background: rgba(106,198,74,0.18); color: #2f8f46; }
    .ki-out { background: rgba(217,79,61,0.13); color: #c9473b; }
    .ki-net { background: var(--brand-gradient); color: var(--brand-on-gradient); }
    .ki-due { background: rgba(245,158,11,0.16); color: #c98a0a; }
    .ki-late { background: rgba(217,79,61,0.13); color: #c9473b; }
    .ki-cash { background: rgba(26,183,175,0.16); color: #139089; }
    .ki-bank { background: rgba(19,133,182,0.14); color: #1385B6; }
    .kb { display: grid; gap: 0.15rem; min-width: 0; }
    .kl { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--brand-muted); }
    .kv { font-size: 1.5rem; color: var(--brand-ink); line-height: 1.15; }
    .kv.sm { font-size: 1.2rem; }
    .kd { font-size: 0.8rem; font-weight: 700; }
    .kd em { font-style: normal; font-weight: 400; color: var(--brand-muted); }
    .kd.good { color: #2f8f46; }
    .kd.bad { color: #c9473b; }
    .kd.muted { font-weight: 400; }

    .pos { color: #2f8f46 !important; }
    .neg { color: #c9473b !important; }
    .muted { color: var(--brand-muted); }
    small.muted { margin-left: 0.4rem; font-weight: 400; }
    .small { font-size: 0.85rem; }
    .link { margin: 0.4rem 0 0.8rem; font-weight: 600; }

    .ch { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.4rem; }
    .ch h3 { margin: 0; }
    .tabs { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--brand-gradient-soft); }
    .tabs button {
      border: 0; background: transparent; color: var(--brand-muted); font: inherit; font-size: 0.78rem; font-weight: 600;
      padding: 0.25rem 0.65rem; border-radius: 7px; cursor: pointer;
    }
    .tabs button.on { background: var(--brand-gradient); color: var(--brand-on-gradient); }
    .more { font-size: 0.85rem; font-weight: 600; color: var(--brand-c2); text-decoration: none; }
    .more:hover { text-decoration: underline; }
    .chart-box { padding: 0.25rem 0; }

    .donut { display: flex; align-items: center; gap: 0.9rem; }
    .ring { position: relative; width: 130px; height: 130px; flex: none; }
    .ring-c { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; }
    .ring-c strong { font-size: 0.95rem; color: var(--brand-ink); }
    .ring-c span { font-size: 0.7rem; color: var(--brand-muted); }
    .lg { display: grid; gap: 0.3rem; flex: 1; min-width: 0; font-size: 0.82rem; }
    .lg > div { display: flex; align-items: center; gap: 0.4rem; color: var(--brand-ink-soft); }
    .lg .ln { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lg em { margin-left: auto; font-style: normal; font-weight: 700; color: var(--brand-ink); }
    .dot { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 50%; flex: none; vertical-align: middle; }
    .dot.red { background: #d6483b; width: 0.8rem; height: 0.8rem; }
    .dot.amber { background: #e0a526; width: 0.8rem; height: 0.8rem; margin-left: 0.6rem; }

    .tbl-wrap { overflow-x: auto; }
    .mv { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    .mv th {
      text-align: left; padding: 0.45rem 0.6rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--brand-muted); background: var(--brand-gradient-soft);
    }
    .mv td { padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--brand-border); color: var(--brand-ink-soft); }
    .mv .cc { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--brand-ink); }
    .mv .num, .num { text-align: right; }
    .mv th.num { text-align: right; }
    .tag { display: inline-block; padding: 0.1rem 0.6rem; border-radius: 999px; font-size: 0.74rem; font-weight: 700; }
    .tag.in { background: rgba(106,198,74,0.18); color: #2f8f46; }
    .tag.out { background: rgba(217,79,61,0.13); color: #c9473b; }

    .al {
      display: flex; gap: 0.6rem; align-items: center; padding: 0.55rem 0.7rem; margin-bottom: 0.5rem;
      border: 1px solid var(--brand-border); border-radius: 12px; text-decoration: none; color: inherit;
    }
    a.al:hover { background: var(--brand-gradient-soft); }
    .al strong { display: block; font-size: 0.88rem; color: var(--brand-ink); }
    .al small { display: block; font-size: 0.78rem; color: var(--brand-muted); }
    .ad { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: 0.9rem; }
    .ad.bad { background: rgba(217,79,61,0.13); color: #c9473b; }
    .ad.warn { background: rgba(245,158,11,0.16); color: #c98a0a; }
    .ad.info { background: rgba(19,133,182,0.14); color: #1385B6; }
    .ad.ok { background: rgba(106,198,74,0.2); color: #2f8f46; }

    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; }
    .kpis.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kpi-plain {
      display: grid; gap: 0.3rem; padding: 1rem 1.1rem; border-radius: 14px;
      background: var(--p-content-background, #fff); border: 1px solid var(--brand-border);
    }
    .kpi-plain span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi-plain strong { font-size: 1.35rem; color: var(--brand-ink); }
    .acc-grid { grid-template-columns: 2fr 1fr 1fr 1fr 1.2fr; padding: 0.7rem 1rem; }
    .inactive { opacity: 0.6; }
    .bar-row { margin-bottom: 0.7rem; }
    .bar-label { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.88rem; color: var(--brand-ink-soft); }
    .mt { margin-top: 1.1rem; }

    @media (max-width: 1200px) {
      .row3, .row2 { grid-template-columns: 1fr; }
    }
    @media (max-width: 900px) {
      .k3 { grid-template-columns: 1fr; }
      .k4 { grid-template-columns: 1fr 1fr; }
      .kpis, .kpis.three { grid-template-columns: 1fr 1fr; }
      .acc-grid { grid-template-columns: 1fr 1fr; }
      .app-row.header { display: none; }
      .num { text-align: left; }
    }
    @media (max-width: 520px) {
      .k4, .kpis, .kpis.three { grid-template-columns: 1fr; }
    }
  `]
})
export class FinanceDashboardPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly morosityApi = inject(MorosityApiService);
  private readonly collectionsApi = inject(CollectionsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  data: FinanceDashboard | null = null;
  loading = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  // Mes elegido en formato yyyy-MM (el del servidor, que lo acota entre el arranque y el mes actual).
  monthValue = '';
  minMonth = '';
  maxMonth = '';

  // Meses que muestra el grafico de evolucion (el servidor entrega hasta 12).
  range: 6 | 12 = 6;

  chartData: unknown = null;
  chartOptions: unknown = null;
  donutOptions: unknown = null;
  donutOut: Donut = { data: null, slices: [], total: 0 };
  donutIn: Donut = { data: null, slices: [], total: 0 };

  deltaIn: Delta | null = null;
  deltaOut: Delta | null = null;
  deltaNet: Delta | null = null;

  // Datos de cobranza y movimientos: son de otras pantallas y si el usuario no puede verlos (o fallan) simplemente no se muestran.
  porCobrar: { amount: number; rate: number } | null = null;
  mora: { amount: number; units: number } | null = null;
  movements: FinanceMovement[] = [];
  alerts: DashAlert[] = [];

  private extrasSub: Subscription | null = null;

  get monthText(): string { return this.data ? monthLabel(this.data.year, this.data.month).toLowerCase() : ''; }

  // Paquete para el contador: resumen, plan de cuentas, saldos, movimientos, flujo, presupuesto, presupuesto vs. real y fondo del ejercicio.
  readonly exportParams = (): FinanceExportParams => ({ fiscalYear: this.data?.fiscalYear });

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.monthValue = '';
    this.resetExtras();
    this.load();
  }

  onError(err: unknown): void {
    this.setError(err, 'No se pudo cargar el tablero.');
  }

  onMonth(value: string): void {
    if (!value || value === this.monthValue) return;
    this.monthValue = value;
    this.load();
  }

  setRange(months: 6 | 12): void {
    if (this.range === months) return;
    this.range = months;
    if (this.data) this.buildChart(this.data);
    this.cdr.markForCheck();
  }

  pct(value: number): string {
    const sign = value > 0 ? '▲ +' : value < 0 ? '▼ ' : '';
    return `${sign}${value.toLocaleString('es-PY', { maximumFractionDigits: 1 })} %`;
  }

  // Monto abreviado para el centro de las donas: «₲ 12,8 M».
  compact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `₲ ${(value / 1_000_000).toLocaleString('es-PY', { maximumFractionDigits: 1 })} M`;
    if (abs >= 1_000) return `₲ ${(value / 1_000).toLocaleString('es-PY', { maximumFractionDigits: 0 })} mil`;
    return `₲ ${value.toLocaleString('es-PY', { maximumFractionDigits: 0 })}`;
  }

  typeLabel(type: string): string {
    return type === 'Cash' ? 'Caja' : type === 'Bank' ? 'Banco' : 'Fondo de reserva';
  }

  private resetExtras(): void {
    this.extrasSub?.unsubscribe();
    this.porCobrar = null;
    this.mora = null;
    this.movements = [];
  }

  private load(): void {
    const [year, month] = this.monthValue ? this.monthValue.split('-').map(Number) : [undefined, undefined];
    this.loading = true;
    this.errorKind = '';
    this.errorMessage = '';

    this.api.getDashboard(this.buildingId, year, month).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.monthValue = `${data.year}-${String(data.month).padStart(2, '0')}`;
        this.minMonth = data.financeStartDate.slice(0, 7);
        const now = new Date();
        this.maxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        this.buildView(data);
        this.loadExtras(data);
        this.cdr.markForCheck();
      },
      error: err => this.setError(err, 'No se pudo cargar el tablero.')
    });
  }

  // Cobranza, mora y ultimos movimientos del edificio. Cada pedido falla por separado sin romper el tablero.
  private loadExtras(d: FinanceDashboard): void {
    this.extrasSub?.unsubscribe();
    this.extrasSub = forkJoin({
      morosity: this.morosityApi.getReport({ buildingId: d.buildingId, page: 1, pageSize: 1 }).pipe(catchError(() => of(null as MorosityReport | null))),
      collections: this.collectionsApi.getReport({ buildingId: d.buildingId }).pipe(catchError(() => of(null as CollectionReport | null))),
      movements: this.api.getMovements(d.buildingId, { to: d.asOf, newestFirst: true, page: 1, pageSize: 5 }).pipe(catchError(() => of(null)))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(r => {
      this.mora = r.morosity ? { amount: r.morosity.summary.totalOverdueAmount, units: r.morosity.summary.totalUnitsInArrears } : null;
      this.porCobrar = r.collections ? { amount: r.collections.summary.totalPendingAmount, rate: r.collections.summary.collectionRatePercentage } : null;
      this.movements = r.movements?.items ?? [];
      this.alerts = this.buildAlerts(d);
      this.cdr.markForCheck();
    });
  }

  private setError(err: unknown, fallback: string): void {
    const { kind, message } = classifyFinanceError(err, fallback);
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }

  private buildView(d: FinanceDashboard): void {
    this.buildChart(d);

    // Mes anterior: el punto de la serie justo antes del elegido (no existe si el edificio arranco ese mes).
    const prevDate = new Date(d.year, d.month - 2, 1);
    const prev = d.series.find(p => p.year === prevDate.getFullYear() && p.month === prevDate.getMonth() + 1) ?? null;
    this.deltaIn = this.delta(d.monthFlow.in, prev?.in, true);
    this.deltaOut = this.delta(d.monthFlow.out, prev?.out, false);
    this.deltaNet = this.delta(d.monthFlow.net, prev?.net, true);

    this.donutOut = this.buildDonut(d.monthOut);
    this.donutIn = this.buildDonut(d.monthIn);
    this.alerts = this.buildAlerts(d);
  }

  private delta(current: number, previous: number | undefined, upIsGood: boolean): Delta | null {
    if (previous === undefined || previous === 0) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return { pct, good: upIsGood ? pct >= 0 : pct <= 0 };
  }

  // Los 5 rubros mas grandes y el resto agrupado en «Otros».
  private buildDonut(list: FinanceRubroAmount[]): Donut {
    const rows = list.filter(r => r.amount > 0).sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    if (!total) return { data: null, slices: [], total: 0 };

    const top = rows.slice(0, SLICE_COLORS.length);
    const slices: DonutSlice[] = top.map((r, i) => ({ label: r.name, amount: r.amount, share: (r.amount / total) * 100, color: SLICE_COLORS[i] }));
    const rest = rows.slice(SLICE_COLORS.length).reduce((s, r) => s + r.amount, 0);
    if (rest > 0) slices.push({ label: 'Otros', amount: rest, share: (rest / total) * 100, color: OTHERS_COLOR });

    return {
      total,
      slices,
      data: {
        labels: slices.map(s => s.label),
        datasets: [{ data: slices.map(s => s.amount), backgroundColor: slices.map(s => s.color), borderWidth: 2, borderColor: '#ffffff' }]
      }
    };
  }

  private buildAlerts(d: FinanceDashboard): DashAlert[] {
    const list: DashAlert[] = [];
    const gs = (v: number) => `₲ ${v.toLocaleString('es-PY', { maximumFractionDigits: 0 })}`;

    if (this.mora && this.mora.amount > 0) {
      list.push({ level: 'bad', title: 'Mora vencida', detail: `${gs(this.mora.amount)} en ${this.mora.units} ${this.mora.units === 1 ? 'unidad' : 'unidades'}`, link: ['/morosity'] });
    }
    for (const w of d.balances.warnings) {
      list.push({ level: 'warn', title: 'Revisar la configuración', detail: w, link: ['/finance/settings'] });
    }
    if (d.balances.unassignedNet !== 0) {
      list.push({ level: 'warn', title: 'Movimientos sin cuenta', detail: `${gs(d.balances.unassignedNet)} sin cuenta asignada`, link: ['/finance/movements'] });
    }
    if (!d.budget.hasBudget) {
      list.push({ level: 'info', title: 'Sin presupuesto cargado', detail: `Ejercicio ${d.fiscalYear}`, link: ['/finance/budget'] });
    } else if (d.budget.redCount > 0) {
      list.push({ level: 'bad', title: 'Gastos fuera de presupuesto', detail: `${d.budget.redCount} rubro(s) con desvío de más del 10 %`, link: ['/finance/budget-vs-actual'] });
    } else if (d.budget.amberCount > 0) {
      list.push({ level: 'warn', title: 'Gastos cerca del límite', detail: `${d.budget.amberCount} rubro(s) con desvío de hasta el 10 %`, link: ['/finance/budget-vs-actual'] });
    }
    if (!d.reserveFund.hasFundAccount) {
      list.push({ level: 'info', title: 'Sin cuenta de fondo de reserva', detail: 'Se crea en Configuración → Cuentas', link: ['/finance/settings'] });
    }
    if (!list.length) {
      list.push({ level: 'ok', title: 'Todo en orden', detail: 'No hay alertas para este edificio.' });
    }
    return list;
  }

  private buildChart(d: FinanceDashboard): void {
    const points = d.series.slice(-this.range);
    const labels = points.map(p => monthShort(p.year, p.month));
    this.chartData = {
      labels,
      datasets: [
        { type: 'line', label: 'Saldo total', data: points.map(p => p.endBalance), borderColor: '#1385B6', backgroundColor: '#1385B6', yAxisID: 'y1', tension: 0.25 },
        { type: 'bar', label: 'Ingresos', data: points.map(p => p.in), backgroundColor: '#6AC64A', borderRadius: 4, yAxisID: 'y' },
        { type: 'bar', label: 'Egresos', data: points.map(p => p.out), backgroundColor: '#e5675d', borderRadius: 4, yAxisID: 'y' }
      ]
    };

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color') || '#334155';
    const gridColor = style.getPropertyValue('--surface-border') || 'rgba(0,0,0,0.08)';
    const compact = (v: number | string) => new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));

    this.chartOptions = {
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { position: 'left', ticks: { color: textColor, callback: compact }, grid: { color: gridColor } },
        y1: { position: 'right', ticks: { color: textColor, callback: compact }, grid: { drawOnChartArea: false } }
      }
    };

    this.donutOptions = {
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { label: string; parsed: number }) => ` ${ctx.label}: ₲ ${Number(ctx.parsed).toLocaleString('es-PY', { maximumFractionDigits: 0 })}`
          }
        }
      }
    };
  }
}

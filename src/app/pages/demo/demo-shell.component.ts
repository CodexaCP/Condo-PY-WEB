import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LANGS, LangService } from '../../core/i18n/lang.service';
import { LangSwitcherComponent } from '../../core/i18n/lang-switcher.component';
import { SeoService } from '../../core/seo.service';
import { DemoContactKind, DemoStore } from './demo.store';

// Marco de la demostración pública: encabezado, navegación, misiones con progreso y el cierre comercial
// (paso 4 del embudo: diagnóstico; paso 5: contacto). Todo es ficticio y vive solo en el navegador.
@Component({
  standalone: true,
  selector: 'app-demo-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LangSwitcherComponent],
  template: `
    <div class="dm">
      <header class="dm-top">
        <a routerLink="/login" class="dm-brand" [attr.aria-label]="t().shell.backHome">
          <img src="/brand/expenses-icon.svg" alt="" />
          <b>EXPENSES</b>
        </a>
        <span class="dm-badge"><i class="pi pi-eye"></i> {{ t().shell.badge }}</span>
        <div class="dm-actions">
          <app-lang-switcher />
          <button type="button" class="dm-ghost" (click)="reset()" [title]="t().shell.resetTitle"><i class="pi pi-refresh"></i> <span>{{ t().shell.reset }}</span></button>
          <button type="button" class="dm-solid" (click)="showFinish.set(true)"><i class="pi pi-comments"></i> <span>{{ t().shell.talk }}</span></button>
          <a routerLink="/login" class="dm-ghost"><i class="pi pi-sign-out"></i> <span>{{ t().shell.exit }}</span></a>
        </div>
      </header>

      <section class="dm-context">
        <div>
          <strong>{{ store.buildingName() }}</strong>
          <span>{{ t().shell.contextLine(store.buildingCity(), store.units.length, store.currentPeriodLabel()) }}</span>
        </div>
        <span class="dm-note">{{ t().shell.note }}</span>
      </section>

      <nav class="dm-nav" [attr.aria-label]="t().shell.navAria">
        <a routerLink="/explorar/panel" routerLinkActive="on"><i class="pi pi-chart-bar"></i> {{ t().shell.nav.panel }}</a>
        <a routerLink="/explorar/unidades" routerLinkActive="on"><i class="pi pi-home"></i> {{ t().shell.nav.units }}</a>
        <a routerLink="/explorar/gastos" routerLinkActive="on"><i class="pi pi-wallet"></i> {{ t().shell.nav.expenses }}</a>
        <a routerLink="/explorar/informes" routerLinkActive="on"><i class="pi pi-file"></i> {{ t().shell.nav.reports }}</a>
        <a routerLink="/explorar/libro-diario" routerLinkActive="on"><i class="pi pi-book"></i> {{ t().shell.nav.journal }}</a>
        <span class="dm-nav-sep"></span>
        @for (key of locked; track key) {
          <a routerLink="/explorar/bloqueado" [queryParams]="{ f: key }" class="lock"><i class="pi pi-lock"></i> {{ t().lockedNav[key] }}</a>
        }
      </nav>

      <section class="dm-missions" [attr.aria-label]="t().shell.missionsAria">
        <div class="dm-mhead">
          <b>{{ t().shell.missionsTitle }}</b>
          <span>{{ t().shell.missionsProgress(store.completedCount(), store.missions().length) }}</span>
          <div class="dm-bar"><i [style.width.%]="(store.completedCount() / store.missions().length) * 100"></i></div>
        </div>
        <div class="dm-chips">
          @for (m of store.missions(); track m.id) {
            <a [routerLink]="m.route" class="dm-chip" [class.done]="isDone(m.id)">
              <i [class]="'pi ' + (isDone(m.id) ? 'pi-check-circle' : m.icon)"></i>
              {{ m.title }}
            </a>
          }
        </div>
        @if (store.nextMission(); as next) {
          <p class="dm-hint"><i class="pi pi-compass"></i> <span><b>{{ t().shell.next }}</b> {{ next.hint }}</span> <a [routerLink]="next.route">{{ t().shell.goNow }}</a></p>
        } @else {
          <p class="dm-hint ok"><i class="pi pi-star"></i> <span>{{ t().shell.allDone }}</span> <button type="button" (click)="showFinish.set(true)">{{ t().shell.nextStep }}</button></p>
        }
      </section>

      <main class="dm-main"><router-outlet /></main>

      <footer class="dm-foot">
        <span>{{ t().shell.footText }}</span>
        <button type="button" class="dm-solid" (click)="showFinish.set(true)">{{ t().shell.footCta }}</button>
      </footer>

      @if (showFinish()) {
        <div class="dm-overlay" (click)="showFinish.set(false)">
          <div class="dm-modal" role="dialog" aria-modal="true" aria-labelledby="dm-fin-title" (click)="$event.stopPropagation()">
            <button type="button" class="dm-x" (click)="showFinish.set(false)" [attr.aria-label]="t().shell.keepExploring"><i class="pi pi-times"></i></button>
            <h2 id="dm-fin-title">{{ store.allDone() ? t().shell.finishDone : t().shell.finishTodo }}</h2>
            <p class="dm-lead">{{ t().shell.finishLead }}</p>

            <div class="dm-diag">
              @for (q of questions(); track q.key) {
                <div class="dm-q">
                  <span>{{ q.title }}</span>
                  <div class="dm-opts">
                    @for (o of q.options; track o[0]) {
                      <button type="button" [class.on]="store.diagnosis()[q.key] === o[0]" (click)="store.answer(q.key, o[0])">{{ o[1] }}</button>
                    }
                  </div>
                </div>
              }
              @if (store.recommendation()) {
                <p class="dm-reco"><i class="pi pi-lightbulb"></i> <span><b>{{ t().shell.forYou }}</b> {{ store.recommendation() }}</span></p>
              }
            </div>

            <div class="dm-cta">
              <a class="dm-solid big" [href]="store.whatsappUrl('demostracion')" target="_blank" rel="noopener noreferrer" (click)="contact('demostracion')"><i class="pi pi-video"></i> {{ t().shell.ctaDemo }}</a>
              <a class="dm-line big" [href]="store.whatsappUrl('planes')" target="_blank" rel="noopener noreferrer" (click)="contact('planes')"><i class="pi pi-tag"></i> {{ t().shell.ctaPlans }}</a>
              <a class="dm-wa big" [href]="store.whatsappUrl('presupuesto')" target="_blank" rel="noopener noreferrer" (click)="contact('presupuesto')"><i class="pi pi-whatsapp"></i> {{ t().shell.ctaQuote }}</a>
            </div>
            <button type="button" class="dm-back" (click)="showFinish.set(false)">{{ t().shell.keepExploring }}</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .dm { min-height: 100vh; background: #f4f8fb; color: var(--ex-ink, #16324a); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; display: flex; flex-direction: column; }
      .dm a { text-decoration: none; }
      .dm-top { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; padding: 0.7rem 1.25rem; background: #fff; border-bottom: 1px solid var(--ex-line, #dbe6ef); }
      .dm-brand { display: flex; align-items: center; gap: 0.5rem; color: var(--ex-ink, #16324a); }
      .dm-brand img { width: 30px; height: 30px; }
      .dm-brand b { letter-spacing: 0.08em; font-size: 1rem; }
      .dm-badge { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.7rem; border-radius: 999px; background: #e6f7f6; color: #0f8a84; font-size: 0.78rem; font-weight: 700; }
      .dm-actions { margin-left: auto; display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .dm-ghost, .dm-solid, .dm-line, .dm-wa { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; cursor: pointer; font: inherit; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 0.9rem; border-radius: 0.6rem; border: 1px solid transparent; }
      .dm-ghost { background: transparent; color: var(--ex-muted, #5f7b88); border-color: var(--ex-line, #dbe6ef); }
      .dm-ghost:hover { background: #f1f6fa; }
      .dm-solid { background: #1ab7af; color: #fff; }
      .dm-solid:hover { background: #14a29b; }
      .dm-line { background: #fff; color: #1385b6; border-color: #1385b6; }
      .dm-line:hover { background: rgba(19, 133, 182, 0.08); }
      .dm-wa { background: #25d366; color: #fff; }
      .dm-wa:hover { background: #1fb858; }
      .dm-context { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; padding: 0.9rem 1.25rem 0.2rem; }
      .dm-context strong { display: block; font-size: 1.15rem; }
      .dm-context span { font-size: 0.85rem; color: var(--ex-muted, #5f7b88); }
      .dm-note { font-size: 0.8rem; }
      .dm-nav { display: flex; align-items: center; gap: 0.35rem; padding: 0.6rem 1.25rem; overflow-x: auto; white-space: nowrap; }
      .dm-nav a { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.85rem; border-radius: 0.6rem; font-size: 0.88rem; font-weight: 600; color: var(--ex-muted, #5f7b88); }
      .dm-nav a:hover { background: #e9f1f7; }
      .dm-nav a.on { background: #1385b6; color: #fff; }
      .dm-nav a.lock { font-weight: 500; font-size: 0.82rem; opacity: 0.85; }
      .dm-nav-sep { width: 1px; height: 1.4rem; background: var(--ex-line, #dbe6ef); margin: 0 0.4rem; flex: none; }
      .dm-missions { margin: 0.25rem 1.25rem 0.5rem; padding: 0.9rem 1rem; background: #fff; border: 1px solid var(--ex-line, #dbe6ef); border-radius: 0.9rem; }
      .dm-mhead { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
      .dm-mhead span { font-size: 0.82rem; color: var(--ex-muted, #5f7b88); }
      .dm-bar { flex: 1; min-width: 120px; height: 8px; border-radius: 999px; background: #e6eef4; overflow: hidden; }
      .dm-bar i { display: block; height: 100%; background: linear-gradient(90deg, #1ab7af, #5cc36a); transition: width 0.4s ease; }
      .dm-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.7rem; }
      .dm-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; border-radius: 999px; border: 1px solid var(--ex-line, #dbe6ef); font-size: 0.82rem; font-weight: 600; color: var(--ex-ink, #16324a); background: #fafcfe; }
      .dm-chip:hover { border-color: #1ab7af; }
      .dm-chip.done { background: #e8f7ee; border-color: #8fd6a8; color: #1f7a45; }
      .dm-hint { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin: 0.8rem 0 0; padding: 0.6rem 0.8rem; border-radius: 0.6rem; background: #eef6fb; font-size: 0.88rem; }
      .dm-hint i { color: #1385b6; }
      .dm-hint span { flex: 1; min-width: 200px; }
      .dm-hint a, .dm-hint button { color: #1385b6; font-weight: 700; background: none; border: 0; cursor: pointer; font: inherit; font-weight: 700; }
      .dm-hint.ok { background: #e8f7ee; }
      .dm-hint.ok i { color: #1f7a45; }
      .dm-main { flex: 1; padding: 0.5rem 1.25rem 1.5rem; }
      .dm-foot { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; padding: 1rem 1.25rem; background: #fff; border-top: 1px solid var(--ex-line, #dbe6ef); font-size: 0.9rem; text-align: center; }
      .dm-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(12, 30, 46, 0.55); display: flex; align-items: center; justify-content: center; padding: 1rem; overflow-y: auto; }
      .dm-modal { position: relative; width: 100%; max-width: 640px; max-height: 94vh; overflow-y: auto; background: #fff; border-radius: 1.1rem; padding: 1.6rem 1.5rem 1.2rem; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3); }
      .dm-modal h2 { margin: 0 2rem 0.4rem 0; font-size: 1.4rem; font-weight: 800; }
      .dm-lead { margin: 0 0 1rem; color: var(--ex-muted, #5f7b88); line-height: 1.5; font-size: 0.93rem; }
      .dm-x { position: absolute; top: 0.8rem; right: 0.8rem; width: 2rem; height: 2rem; border-radius: 50%; border: 0; background: #eef3f7; cursor: pointer; color: var(--ex-ink, #16324a); }
      .dm-diag { display: grid; gap: 0.8rem; padding: 0.9rem; border-radius: 0.8rem; background: #f6fafc; border: 1px solid var(--ex-line, #dbe6ef); }
      .dm-q > span { display: block; font-size: 0.84rem; font-weight: 700; margin-bottom: 0.4rem; }
      .dm-opts { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .dm-opts button { cursor: pointer; font: inherit; font-size: 0.82rem; padding: 0.38rem 0.75rem; border-radius: 999px; border: 1px solid var(--ex-line, #dbe6ef); background: #fff; color: var(--ex-ink, #16324a); }
      .dm-opts button:hover { border-color: #1ab7af; }
      .dm-opts button.on { background: #1ab7af; border-color: #1ab7af; color: #fff; font-weight: 700; }
      .dm-reco { display: flex; gap: 0.6rem; margin: 0; padding: 0.7rem 0.8rem; border-radius: 0.6rem; background: #e8f7ee; font-size: 0.86rem; line-height: 1.45; }
      .dm-reco i { color: #1f7a45; margin-top: 0.15rem; }
      .dm-cta { display: grid; gap: 0.55rem; margin-top: 1rem; }
      .big { padding: 0.8rem 1rem; font-size: 0.95rem; }
      .dm-back { display: block; margin: 0.8rem auto 0; background: none; border: 0; cursor: pointer; font: inherit; font-size: 0.85rem; color: var(--ex-muted, #5f7b88); text-decoration: underline; }
      @media (max-width: 640px) {
        .dm-actions { margin-left: 0; width: 100%; }
        .dm-actions > * { flex: 1; }
        .dm-ghost span { display: none; }
        .dm-note { display: none; }
      }
    `
  ]
})
export class DemoShell {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  private readonly router = inject(Router);
  private readonly lang = inject(LangService);

  // Las tres preguntas del diagnóstico, en el idioma actual.
  readonly questions = computed(() => (['units', 'method', 'pain'] as const).map((key) => ({ key, ...this.t().diagnosis[key] })));
  readonly locked = ['conciliacion', 'facturacion', 'votaciones', 'app'];
  readonly showFinish = signal(false);

  // El cierre se abre solo al completar la quinta misión (no al cargar con el recorrido ya terminado).
  private autoShown = this.store.allDone();

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const info = LANGS.find((l) => l.code === this.lang.lang());
      seo.set({ title: this.t().shell.seoTitle, description: this.t().shell.seoDescription, path: '/explorar', lang: info?.htmlLang, ogLocale: info?.ogLocale });
    });
    try {
      if (!sessionStorage.getItem('expenses-demo-started')) {
        sessionStorage.setItem('expenses-demo-started', '1');
        this.store.track('demo_start');
      }
    } catch {
      this.store.track('demo_start');
    }

    effect(() => {
      if (this.store.allDone() && !this.autoShown) {
        this.autoShown = true;
        untracked(() => this.showFinish.set(true));
      }
    });
  }

  isDone(id: string): boolean {
    return this.store.completed().includes(id);
  }

  contact(kind: DemoContactKind): void {
    this.store.track('contact_click', kind);
  }

  reset(): void {
    this.store.reset();
    this.autoShown = false;
    this.showFinish.set(false);
    void this.router.navigateByUrl('/explorar/panel');
  }
}

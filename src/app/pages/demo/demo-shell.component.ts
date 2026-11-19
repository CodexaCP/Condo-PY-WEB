import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LayoutService } from '@/app/layout/service/layout.service';
import { LANGS, LangService } from '../../core/i18n/lang.service';
import { LangSwitcherComponent } from '../../core/i18n/lang-switcher.component';
import { SeoService } from '../../core/seo.service';
import { DemoCountry } from './demo.country';
import { DemoMenuComponent } from './demo-menu.component';
import { DemoContactKind, DemoStore } from './demo.store';
import { ExpensesGuideComponent } from './guide/expenses-guide.component';

// Marco de la demostración pública (mismo layout que el panel real): barra superior, menú lateral, misiones con progreso y el cierre comercial
// (paso 4 del embudo: diagnóstico; paso 5: contacto). Todo es ficticio y vive solo en el navegador.
@Component({
  standalone: true,
  selector: 'app-demo-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, LangSwitcherComponent, DemoMenuComponent, ExpensesGuideComponent],
  template: `
    <div class="layout-wrapper layout-static" [class.layout-mobile-active]="layout.layoutState().mobileMenuActive">
      <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
          <button type="button" class="layout-menu-button layout-topbar-action" (click)="layout.onMenuToggle()"><i class="pi pi-bars"></i></button>
          <a class="layout-topbar-logo" routerLink="/explorar/panel">
            <img src="/brand/expenses-icon-white.svg" alt="" aria-hidden="true" style="width:2.6rem;height:auto;flex-shrink:0" />
            <span>Expenses</span>
          </a>
        </div>
        <div class="layout-topbar-actions">
          <div class="dm-country" role="group" [attr.aria-label]="t().shell.countryAria">
            @for (c of store.countryOptions(); track c.code) {
              <button type="button" [class.on]="store.country() === c.code" [attr.aria-pressed]="store.country() === c.code" (click)="chooseCountry(c.code)">{{ c.label }}</button>
            }
          </div>
          <app-lang-switcher />
          <span class="dm-greeting">Hola, {{ t().shell.greeting }}</span>
          <button type="button" class="layout-topbar-action notif-btn">
            <i class="pi pi-bell"></i>
            <span class="notif-badge">3</span>
          </button>
          <button type="button" class="dm-solid" (click)="showFinish.set(true)"><i class="pi pi-comments"></i> <span>{{ t().shell.talk }}</span></button>
          <button type="button" class="layout-topbar-action" (click)="reset()" [title]="t().shell.resetTitle"><i class="pi pi-refresh"></i></button>
          <button type="button" class="layout-topbar-action" routerLink="/login" [title]="t().shell.exit"><i class="pi pi-sign-out"></i></button>
        </div>
      </div>

      <div class="layout-sidebar"><app-demo-menu /></div>

      <div class="layout-main-container">
        <div class="layout-main">
          <section class="dm-context">
            <div>
              <strong>{{ store.buildingName() }}</strong>
              <span>{{ t().shell.contextLine(store.buildingCity(), store.units.length, store.currentPeriodLabel()) }}</span>
            </div>
            <span class="dm-note">{{ t().shell.note }}</span>
          </section>

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

          <router-outlet />
        </div>

        <footer class="dm-foot">
          <span>{{ t().shell.footText }}</span>
          <button type="button" class="dm-solid" (click)="showFinish.set(true)">{{ t().shell.footCta }}</button>
        </footer>
      </div>
      <div class="layout-mask" (click)="closeMenu()"></div>

      @defer (on idle) {
        <app-expenses-guide corner="right" />
      }
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
      .dm-greeting { color: #fff; font-size: 0.9rem; font-weight: 500; opacity: 0.9; }
      .dm-solid, .dm-line, .dm-wa { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; cursor: pointer; font: inherit; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 0.9rem; border-radius: 0.6rem; border: 1px solid transparent; text-decoration: none; }
      .dm-country { display: inline-flex; gap: 0.25rem; }
      .dm-country button { cursor: pointer; font: inherit; font-size: 0.82rem; font-weight: 700; padding: 0.4rem 0.75rem; border: 0; border-radius: 999px; background: rgba(255, 255, 255, 0.16); color: #fff; }
      .dm-country button:hover { background: rgba(255, 255, 255, 0.28); }
      .dm-country button.on { background: #fff; color: #1385b6; }
      .notif-btn { position: relative; }
      .notif-badge { position: absolute; top: 4px; right: 4px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 700; line-height: 1; min-width: 1.1rem; height: 1.1rem; border-radius: 0.55rem; display: flex; align-items: center; justify-content: center; padding: 0 0.25rem; pointer-events: none; }
      .dm-solid { background: #1ab7af; color: #fff; }
      .dm-solid:hover { background: #14a29b; }
      .dm-line { background: #fff; color: #1385b6; border-color: #1385b6; }
      .dm-line:hover { background: rgba(19, 133, 182, 0.08); }
      .dm-wa { background: #25d366; color: #fff; }
      .dm-wa:hover { background: #1fb858; }
      .dm-context { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.1rem; }
      .dm-context strong { display: block; font-size: 1.15rem; }
      .dm-context span { font-size: 0.85rem; color: var(--brand-muted); }
      .dm-note { font-size: 0.8rem; }
      .dm-missions { background: var(--p-content-background, #fff); border-radius: 22px; border: 1px solid rgba(19, 133, 182, 0.09); box-shadow: 0 8px 30px rgba(17, 54, 74, 0.07); padding: 1rem 1.25rem; margin-bottom: 1.1rem; }
      .dm-mhead { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
      .dm-mhead span { font-size: 0.82rem; color: var(--brand-muted); }
      .dm-bar { flex: 1; min-width: 120px; height: 8px; border-radius: 999px; background: rgba(19, 133, 182, 0.1); overflow: hidden; }
      .dm-bar i { display: block; height: 100%; background: linear-gradient(90deg, #1ab7af, #6ac64a); transition: width 0.4s ease; }
      .dm-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.7rem; }
      .dm-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; border-radius: 999px; border: 1px solid rgba(19, 133, 182, 0.25); font-size: 0.82rem; font-weight: 600; color: var(--p-text-color); background: #fff; text-decoration: none; }
      .dm-chip:hover { border-color: #1ab7af; }
      .dm-chip.done { background: rgba(106, 198, 74, 0.15); border-color: rgba(106, 198, 74, 0.4); color: #2f7a1b; }
      .dm-hint { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin: 0.8rem 0 0; padding: 0.6rem 0.8rem; border-radius: 0.6rem; background: rgba(19, 133, 182, 0.08); font-size: 0.88rem; }
      .dm-hint i { color: #1385b6; }
      .dm-hint span { flex: 1; min-width: 200px; }
      .dm-hint a, .dm-hint button { color: #1385b6; font-weight: 700; background: none; border: 0; cursor: pointer; font: inherit; font-weight: 700; text-decoration: none; }
      .dm-hint.ok { background: rgba(106, 198, 74, 0.15); }
      .dm-hint.ok i { color: #2f7a1b; }
      .dm-foot { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; padding: 1rem 1.25rem; font-size: 0.9rem; text-align: center; }
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
        .dm-greeting { display: none; }
        .dm-solid span { display: none; }
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
  readonly layout = inject(LayoutService);

  // Las tres preguntas del diagnóstico, en el idioma actual.
  readonly questions = computed(() => (['units', 'method', 'pain'] as const).map((key) => ({ key, ...this.t().diagnosis[key] })));
  readonly showFinish = signal(false);

  // El cierre se abre solo al completar la quinta misión (no al cargar con el recorrido ya terminado).
  private autoShown = this.store.allDone();

  constructor() {
    // Al navegar se cierra el menú móvil y se avisa al menú qué pantalla está activa (igual que AppSidebar).
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe((e) => this.onRouteChange(e.urlAfterRedirects));
    this.onRouteChange(this.router.url);

    const seo = inject(SeoService);
    effect(() => {
      const info = LANGS.find((l) => l.code === this.lang.lang());
      seo.set({ title: this.t().shell.seoTitle, description: this.t().shell.seoDescription, path: '/explorar', noindex: true, lang: info?.htmlLang, ogLocale: info?.ogLocale });
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

  closeMenu(): void {
    this.layout.layoutState.update((s) => ({ ...s, mobileMenuActive: false, staticMenuMobileActive: false, overlayMenuActive: false }));
  }

  private onRouteChange(url: string): void {
    this.layout.layoutState.update((s) => ({ ...s, mobileMenuActive: false, staticMenuMobileActive: false, overlayMenuActive: false, activePath: url.split(/[?#]/)[0] }));
  }

  isDone(id: string): boolean {
    return this.store.completed().includes(id);
  }

  contact(kind: DemoContactKind): void {
    this.store.track('contact_click', kind);
  }

  // Cambiar de país reinicia la demo (otros datos, otra moneda, otras misiones) y deja la dirección lista para compartir (?pais=ar).
  chooseCountry(country: DemoCountry): void {
    if (country === this.store.country()) return;
    this.store.setCountry(country);
    this.autoShown = false;
    this.showFinish.set(false);
    void this.router.navigate(['/explorar/panel'], { queryParams: { pais: country } });
  }

  reset(): void {
    this.store.reset();
    this.autoShown = false;
    this.showFinish.set(false);
    void this.router.navigateByUrl('/explorar/panel');
  }
}

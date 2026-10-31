import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { salesWhatsAppUrlFor } from '../../config/sales.config';
import { gaEvent } from '../../core/analytics';
import { LangService } from '../../core/i18n/lang.service';
import { SITE_URL, SeoService } from '../../core/seo.service';
import { LANDING_LANGS, LandingContent, landingContent } from './landing.content';

// Página pública de inicio: español en «/», portugués en «/pt/» e inglés en «/en/» (mismo diseño, textos de landing.content.ts).
// Es lo que ve Google y quien llega por primera vez: qué es Expenses, qué hace y cómo probarlo.
// Se prerenderiza al compilar, así el contenido ya viene escrito en el HTML.
@Component({
  standalone: true,
  selector: 'app-home-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { '(click)': 'trackClick($event)', '(document:click)': 'closeLangMenu($event)' },
  template: `
    @if (offer(); as o) {
      <div class="lang-bar">
        <a [routerLink]="o.path" [attr.hreflang]="o.code" [attr.lang]="o.code" (click)="pick(o.code)">{{ o.hint }} →</a>
        <button type="button" (click)="offer.set(null)" aria-label="×">×</button>
      </div>
    }
    <header class="hd">
      <a [routerLink]="t.path" class="brand" [attr.aria-label]="t.brandAria">
        <img src="/brand/expenses-icon.svg" alt="" width="34" height="34" />
        <b>EXPENSES</b>
      </a>
      <nav [attr.aria-label]="t.navAria">
        <a [routerLink]="t.path" fragment="funciones">{{ t.nav.features }}</a>
        <a [routerLink]="t.path" fragment="perfiles">{{ t.nav.profiles }}</a>
        <a [routerLink]="t.path" fragment="planes">{{ t.nav.plans }}</a>
        <a [routerLink]="t.path" fragment="preguntas">{{ t.nav.faq }}</a>
      </nav>
      <div class="hd-act">
        <details class="lang-dd">
          <summary aria-label="Idioma / Language"><span class="globe" aria-hidden="true">🌐</span> {{ t.lang.toUpperCase() }} <span class="caret" aria-hidden="true">▾</span></summary>
          <div class="lang-menu">
            @for (l of langs; track l.code) {
              <a [routerLink]="l.path" [class.on]="l.code === t.lang" [attr.hreflang]="l.code" [attr.lang]="l.code" [attr.aria-current]="l.code === t.lang ? 'true' : null" (click)="pick(l.code)">{{ l.label }}</a>
            }
          </div>
        </details>
        <a routerLink="/login" class="btn ghost">{{ t.login }}</a>
        <a routerLink="/explorar" class="btn solid">{{ t.tryDemo }}</a>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="hero-txt">
          <span class="eyebrow">{{ t.hero.eyebrow }}</span>
          <h1>{{ t.hero.h1 }}</h1>
          <p class="lead">{{ t.hero.lead }}</p>
          <div class="cta">
            <a routerLink="/explorar" class="btn solid big">{{ t.hero.ctaDemo }}</a>
            @if (whatsapp) {
              <a [href]="whatsapp" class="btn line big" target="_blank" rel="noopener noreferrer">{{ t.hero.ctaQuote }}</a>
            }
          </div>
          <ul class="chips">
            @for (c of t.hero.chips; track c) { <li>{{ c }}</li> }
          </ul>
        </div>
        <div class="mock" aria-hidden="true">
          <div class="mock-head"><b>{{ t.mock.head }}</b><span>{{ t.mock.sample }}</span></div>
          <div class="mock-kpis">
            @for (k of t.mock.kpis; track k.label) {
              <div><small>{{ k.label }}</small><strong>{{ k.value }}</strong><em>{{ k.note }}</em></div>
            }
          </div>
          <div class="mock-bars"><i style="height: 62%"></i><i style="height: 78%"></i><i style="height: 70%"></i><i style="height: 92%"></i><i style="height: 84%"></i><i style="height: 96%"></i></div>
        </div>
      </section>

      <section class="sec alt">
        <h2>{{ t.why.h2 }}</h2>
        <p class="sub">{{ t.why.sub }}</p>
        <div class="grid3">
          @for (c of t.why.cards; track c.title) {
            <article class="card"><h3>{{ c.title }}</h3><p>{{ c.text }}</p></article>
          }
        </div>
      </section>

      <section class="sec" id="funciones">
        <h2>{{ t.featuresSec.h2 }}</h2>
        <p class="sub">{{ t.featuresSec.sub }}</p>
        <div class="grid4">
          @for (f of t.featuresSec.items; track f.title) {
            <article class="card feat"><h3>{{ f.title }}</h3><p>{{ f.text }}</p></article>
          }
        </div>
      </section>

      <section class="sec alt" id="perfiles">
        <h2>{{ t.profilesSec.h2 }}</h2>
        <p class="sub">{{ t.profilesSec.sub }}</p>
        <div class="grid3">
          @for (p of t.profilesSec.items; track p.title) {
            <article class="card">
              <span class="tag">{{ p.where }}</span>
              <h3>{{ p.title }}</h3>
              <ul>
                @for (i of p.items; track i) { <li>{{ i }}</li> }
              </ul>
            </article>
          }
        </div>
        <p class="app-line">
          <a href="/downloads/expenses.apk" download="Expenses.apk" class="btn line">{{ t.profilesSec.downloadApp }}</a>
          <a routerLink="/explorar" class="btn line">{{ t.profilesSec.seeDemo }}</a>
        </p>
      </section>

      <section class="sec">
        <h2>{{ t.start.h2 }}</h2>
        <ol class="steps">
          @for (s of t.start.steps; track s.title) {
            <li><b>{{ s.title }}</b><span>{{ s.text }}</span></li>
          }
        </ol>
      </section>

      <section class="sec alt" id="planes">
        <h2>{{ t.plans.h2 }}</h2>
        <p class="sub">{{ t.plans.sub }}</p>
        <div class="grid3">
          @for (c of t.plans.cards; track c.title) {
            <article class="card"><h3>{{ c.title }}</h3><p>{{ c.text }}</p></article>
          }
        </div>
        <p class="app-line">
          @if (whatsapp) { <a [href]="whatsapp" class="btn solid big" target="_blank" rel="noopener noreferrer">{{ t.plans.quote }}</a> }
        </p>
      </section>

      <section class="sec" id="preguntas">
        <h2>{{ t.faqH2 }}</h2>
        <div class="faq">
          @for (q of t.faqs; track q.question) {
            <details>
              <summary>{{ q.question }}</summary>
              <p>{{ q.answer }}</p>
            </details>
          }
        </div>
      </section>

      <section class="final">
        <h2>{{ t.final.h2 }}</h2>
        <p>{{ t.final.text }}</p>
        <div class="cta center">
          <a routerLink="/explorar" class="btn white big">{{ t.final.ctaDemo }}</a>
          @if (whatsapp) { <a [href]="whatsapp" class="btn outw big" target="_blank" rel="noopener noreferrer">{{ t.final.ctaWhatsapp }}</a> }
        </div>
      </section>
    </main>

    <footer class="ft">
      <div>
        <b>EXPENSES</b>
        <p>{{ t.footer.tagline }}</p>
      </div>
      <nav [attr.aria-label]="t.navAria">
        <a routerLink="/explorar">{{ t.footer.demo }}</a>
        <a routerLink="/login">{{ t.footer.login }}</a>
        <a href="/downloads/expenses.apk" download="Expenses.apk">{{ t.footer.app }}</a>
        <a href="https://www.linkedin.com/company/expensespy/home/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        @for (l of langs; track l.code) {
          @if (l.code !== t.lang) {
            <a [routerLink]="l.path" [attr.hreflang]="l.code" [attr.lang]="l.code" (click)="pick(l.code)">{{ l.label }}</a>
          }
        }
      </nav>
      <small>© {{ year }} Expenses · expenses.com.py</small>
    </footer>
  `,
  styles: [
    `
      :host { display: block; color: var(--ex-ink, #16324a); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #fff; line-height: 1.55; }
      a { text-decoration: none; color: inherit; }
      h1, h2, h3 { color: #11364a; line-height: 1.2; margin: 0; }
      .lang-bar { display: flex; justify-content: center; align-items: center; gap: 0.8rem; padding: 0.45rem 1rem; background: #11364a; color: #fff; font-size: 0.85rem; font-weight: 600; }
      .lang-bar button { background: none; border: 0; color: #cfe3ee; font-size: 1.1rem; cursor: pointer; line-height: 1; }
      .hd { display: flex; align-items: center; gap: 1.5rem; padding: 0.9rem 1.5rem; max-width: 1180px; margin: 0 auto; }
      .brand { display: flex; align-items: center; gap: 0.5rem; letter-spacing: 0.08em; }
      .hd nav { display: flex; gap: 1.4rem; margin-left: 1rem; font-size: 0.92rem; font-weight: 600; color: #4a6270; }
      .hd nav a:hover { color: #1385b6; }
      .hd-act { margin-left: auto; display: flex; gap: 0.5rem; align-items: center; }
      .lang-dd { position: relative; }
      .lang-dd summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.5rem 0.75rem; border: 1.5px solid #cfe3ee; border-radius: 0.7rem; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.04em; color: #4a6270; user-select: none; }
      .lang-dd summary::-webkit-details-marker { display: none; }
      .lang-dd summary:hover, .lang-dd[open] summary { background: #eef6fb; }
      .lang-dd .caret { font-size: 0.7rem; }
      .lang-menu { position: absolute; right: 0; top: calc(100% + 0.35rem); z-index: 30; min-width: 9.5rem; display: grid; padding: 0.3rem; background: #fff; border: 1px solid #dbe6ef; border-radius: 0.7rem; box-shadow: 0 12px 28px rgba(17, 54, 74, 0.16); }
      .lang-menu a { padding: 0.5rem 0.7rem; border-radius: 0.5rem; font-size: 0.9rem; font-weight: 600; color: #16324a; }
      .lang-menu a:hover { background: #eef6fb; }
      .lang-menu a.on { background: #1385b6; color: #fff; }
      .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.55rem 1.1rem; border-radius: 0.7rem; font-weight: 700; font-size: 0.9rem; border: 1.5px solid transparent; cursor: pointer; transition: background 0.15s, transform 0.15s; }
      .btn:hover { transform: translateY(-1px); }
      .btn.solid { background: #1ab7af; color: #fff; }
      .btn.solid:hover { background: #14a29b; }
      .btn.ghost { color: #1385b6; border-color: #cfe3ee; }
      .btn.line { color: #1385b6; border-color: #1385b6; background: #fff; }
      .btn.white { background: #fff; color: #11364a; }
      .btn.outw { color: #fff; border-color: #fff; }
      .btn.big { padding: 0.85rem 1.5rem; font-size: 1rem; }
      .hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2.5rem; align-items: center; max-width: 1180px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
      .eyebrow { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #0f8a84; }
      h1 { font-size: clamp(2rem, 4.4vw, 3.1rem); font-weight: 800; margin: 0.7rem 0 1rem; letter-spacing: -0.02em; }
      .lead { font-size: 1.12rem; color: #4a6270; margin: 0 0 1.6rem; max-width: 36rem; }
      .cta { display: flex; gap: 0.8rem; flex-wrap: wrap; }
      .cta.center { justify-content: center; }
      .chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; margin: 1.4rem 0 0; }
      .chips li { font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.75rem; border-radius: 999px; background: #eef6fb; color: #1b5e9e; }
      .mock { background: linear-gradient(160deg, #f4f9fd, #e9f6f5); border: 1px solid #dbe6ef; border-radius: 1.2rem; padding: 1.2rem; box-shadow: 0 24px 50px rgba(17, 54, 74, 0.12); }
      .mock-head { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.9rem; }
      .mock-head span { color: #5f7b88; font-size: 0.74rem; }
      .mock-kpis { display: grid; gap: 0.6rem; }
      .mock-kpis div { background: #fff; border-radius: 0.8rem; padding: 0.7rem 0.9rem; border: 1px solid #e3edf4; display: grid; }
      .mock-kpis small { color: #5f7b88; font-size: 0.74rem; }
      .mock-kpis strong { font-size: 1.15rem; }
      .mock-kpis em { font-style: normal; font-size: 0.74rem; color: #1f7a45; }
      .mock-bars { display: flex; align-items: flex-end; gap: 0.5rem; height: 90px; margin-top: 1rem; }
      .mock-bars i { flex: 1; background: linear-gradient(180deg, #1ab7af, #5cc36a); border-radius: 6px 6px 0 0; }
      .sec { padding: 4rem 1.5rem; max-width: 1180px; margin: 0 auto; }
      .sec.alt { max-width: none; background: #f4f9fc; }
      .sec.alt > * { max-width: 1180px; margin-left: auto; margin-right: auto; }
      .sec h2 { font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 800; text-align: center; }
      .sub { text-align: center; color: #4a6270; margin: 0.6rem auto 2rem; max-width: 40rem; }
      .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
      .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1rem; }
      .card { background: #fff; border: 1px solid #dbe6ef; border-radius: 1rem; padding: 1.3rem; }
      .card h3 { font-size: 1.05rem; margin-bottom: 0.4rem; }
      .card p { margin: 0; color: #4a6270; font-size: 0.93rem; }
      .card ul { margin: 0.6rem 0 0; padding-left: 1.1rem; color: #4a6270; font-size: 0.92rem; }
      .tag { display: inline-block; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #0f8a84; margin-bottom: 0.5rem; }
      .app-line { display: flex; justify-content: center; gap: 0.8rem; flex-wrap: wrap; margin: 2rem auto 0; }
      .steps { list-style: none; counter-reset: s; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; padding: 0; margin: 2rem 0 0; }
      .steps li { counter-increment: s; background: #fff; border: 1px solid #dbe6ef; border-radius: 1rem; padding: 1.3rem; display: grid; gap: 0.3rem; }
      .steps li::before { content: counter(s); width: 2rem; height: 2rem; border-radius: 50%; background: #1ab7af; color: #fff; font-weight: 800; display: grid; place-items: center; }
      .steps span { color: #4a6270; font-size: 0.93rem; }
      .faq { max-width: 52rem; margin: 2rem auto 0; }
      details { border-bottom: 1px solid #dbe6ef; }
      summary { cursor: pointer; padding: 1rem 2rem 1rem 0; font-weight: 700; list-style: none; position: relative; }
      summary::-webkit-details-marker { display: none; }
      summary::after { content: '+'; position: absolute; right: 0.3rem; top: 50%; transform: translateY(-50%); font-size: 1.4rem; font-weight: 400; color: #1385b6; }
      details[open] summary::after { content: '–'; }
      details p { margin: 0 0 1rem; color: #4a6270; }
      .final { text-align: center; padding: 4rem 1.5rem; background: linear-gradient(160deg, #11364a, #1385b6 65%, #1ab7af); color: #fff; }
      .final h2 { color: #fff; font-size: clamp(1.5rem, 3vw, 2.1rem); }
      .final p { max-width: 38rem; margin: 0.8rem auto 1.6rem; color: #e6f4f6; }
      .ft { display: grid; grid-template-columns: 1fr auto; gap: 1.5rem; max-width: 1180px; margin: 0 auto; padding: 2.5rem 1.5rem; font-size: 0.9rem; }
      .ft p { margin: 0.3rem 0 0; color: #5f7b88; }
      .ft nav { display: flex; flex-direction: column; gap: 0.4rem; font-weight: 600; color: #1385b6; }
      .ft small { grid-column: 1 / -1; color: #7a8fa0; }
      @media (max-width: 860px) {
        .hero { grid-template-columns: 1fr; padding-top: 1.5rem; }
        .hd nav { display: none; }
        .hd-act .ghost { display: none; }
        .ft { grid-template-columns: 1fr; }
      }
    `
  ]
})

export class HomeComponent {
  private readonly seo = inject(SeoService);
  private readonly lang = inject(LangService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly langs = LANDING_LANGS;

  // El idioma viene de la ruta: «/» es español y «/pt/» es portugués (data: { lang: 'pt' }).
  readonly t: LandingContent = landingContent(inject(ActivatedRoute).snapshot.data['lang']);
  readonly whatsapp = salesWhatsAppUrlFor(this.t.whatsappMessage);
  readonly year = new Date().getFullYear();
  // Aviso discreto (no una redirección automática, que perjudica al buscador) para quien navega con el celular o el
  // navegador en otro de los tres idiomas y llegó a una versión distinta.
  readonly offer = signal<(typeof LANDING_LANGS)[number] | null>(null);

  // El desplegable de idioma se cierra al tocar fuera de él.
  closeLangMenu(event: Event): void {
    const menu = (this.host.nativeElement as HTMLElement).querySelector('details.lang-dd');
    if (menu && !menu.contains(event.target as Node)) menu.removeAttribute('open');
  }

  // Quien elige un idioma con el selector lo conserva en el resto del sitio (login, demostración).
  pick(code: LandingContent['lang']): void {
    this.lang.choose(code);
  }

  // Mide los clics que importan para ventas: WhatsApp (contacto) y entrada a la demostración.
  trackClick(event: Event): void {
    const link = (event.target as HTMLElement | null)?.closest?.('a');
    const href = link?.getAttribute('href') ?? '';
    if (href.includes('wa.me')) gaEvent('generate_lead', { method: 'whatsapp_landing', language: this.t.lang });
    else if (href.startsWith('/explorar')) gaEvent('demo_click', { language: this.t.lang });
  }

  constructor() {
    const t = this.t;

    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const chosen = this.lang.chosen();
      if (chosen && chosen !== t.lang && t.lang === 'es') {
        // Quien ya eligió otro idioma y vuelve a la raíz «/» pasa a su versión (el buscador no tiene elección guardada, así que ve la de siempre).
        const target = LANDING_LANGS.find((l) => l.code === chosen)?.path ?? '/';
        void this.router.navigateByUrl(target.length > 1 ? target.replace(/\/$/, '') : target, { replaceUrl: true });
      } else if (!chosen) {
        const wanted = this.lang.browserLang();
        this.offer.set(wanted && wanted !== t.lang ? (LANDING_LANGS.find((l) => l.code === wanted) ?? null) : null);
      }
    }

    // El resto de la visita (login, demostración) sigue en el idioma de esta portada.
    this.lang.follow(t.lang);

    this.seo.set({
      title: t.seoTitle,
      description: t.seoDescription,
      path: t.path,
      lang: t.htmlLang,
      ogLocale: t.ogLocale,
      alternates: [...LANDING_LANGS.map((l) => ({ hreflang: l.code as string, path: l.path })), { hreflang: 'x-default', path: '/' }],
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Expenses',
          url: SITE_URL + '/',
          logo: SITE_URL + '/favicon.svg',
          sameAs: ['https://www.linkedin.com/company/expensespy/home/'],
          contactPoint: { '@type': 'ContactPoint', telephone: '+595986645450', contactType: 'sales', areaServed: 'PY', availableLanguage: ['es', 'pt', 'en'] }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Expenses',
          url: SITE_URL + t.path,
          inLanguage: t.lang === 'es' ? 'es-PY' : t.lang
        },
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Expenses',
          description: t.jsonLdDescription,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web, Android',
          inLanguage: t.lang === 'es' ? 'es-PY' : t.lang,
          url: SITE_URL + t.path,
          areaServed: { '@type': 'Country', name: t.areaServed },
          featureList: t.featuresSec.items.map((f) => f.title)
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          inLanguage: t.lang === 'es' ? 'es-PY' : t.lang,
          mainEntity: t.faqs.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } }))
        }
      ]
    });
  }
}

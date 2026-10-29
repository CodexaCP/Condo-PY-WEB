import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FAQS } from '../../config/faq.data';
import { salesWhatsAppUrl } from '../../config/sales.config';
import { SITE_URL, SeoService } from '../../core/seo.service';

const TITLE = 'Expenses | Software para administrar edificios en Paraguay';
const DESCRIPTION =
  'Expensas, cobranza, gastos, facturación y contabilidad de tu edificio en un solo sistema, con app para el Encargado y propietarios. Prueba la demo gratis.';

// Página pública de inicio (/). Es lo que ve Google y quien llega por primera vez: qué es Expenses, qué hace y cómo probarlo.
// Se prerenderiza al compilar, así el contenido ya viene escrito en el HTML.
@Component({
  standalone: true,
  selector: 'app-home-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="hd">
      <a routerLink="/" class="brand" aria-label="Expenses, inicio">
        <img src="/brand/expenses-icon.svg" alt="" width="34" height="34" />
        <b>EXPENSES</b>
      </a>
      <nav aria-label="Secciones">
        <a routerLink="/" fragment="funciones">Funciones</a>
        <a routerLink="/" fragment="perfiles">Para quién</a>
        <a routerLink="/" fragment="planes">Planes</a>
        <a routerLink="/" fragment="preguntas">Preguntas</a>
      </nav>
      <div class="hd-act">
        <a routerLink="/login" class="btn ghost">Ingresar</a>
        <a routerLink="/explorar" class="btn solid">Probar demo</a>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="hero-txt">
          <span class="eyebrow">Software de administración de edificios · Paraguay</span>
          <h1>Software para administrar edificios y condominios en Paraguay</h1>
          <p class="lead">
            Expensas, cobranza, gastos, facturación y contabilidad de tu edificio en un solo sistema. Panel web para el administrador y app para el Encargado y los propietarios.
          </p>
          <div class="cta">
            <a routerLink="/explorar" class="btn solid big">Explorar demostración gratuita →</a>
            @if (whatsapp) {
              <a [href]="whatsapp" class="btn line big" target="_blank" rel="noopener noreferrer">Pedí tu cotización</a>
            }
          </div>
          <ul class="chips">
            <li>Todo en guaraníes</li>
            <li>IVA y timbrado</li>
            <li>Propiedad horizontal</li>
            <li>La demo no pide registro</li>
          </ul>
        </div>
        <div class="mock" aria-hidden="true">
          <div class="mock-head"><b>Resumen del edificio</b><span>Vista de ejemplo</span></div>
          <div class="mock-kpis">
            <div><small>Cobrado del mes</small><strong>Gs. 31.134.000</strong><em>82 % de lo emitido</em></div>
            <div><small>Gastos del mes</small><strong>Gs. 30.730.000</strong><em>8 gastos registrados</em></div>
            <div><small>Morosidad</small><strong>17,5 %</strong><em>7 de 40 unidades</em></div>
          </div>
          <div class="mock-bars"><i style="height: 62%"></i><i style="height: 78%"></i><i style="height: 70%"></i><i style="height: 92%"></i><i style="height: 84%"></i><i style="height: 96%"></i></div>
        </div>
      </section>

      <section class="sec alt">
        <h2>Deja las planillas, los cuadernos y el WhatsApp</h2>
        <p class="sub">Un solo lugar para cobrar, pagar, registrar y rendir cuentas, con historial de cada operación.</p>
        <div class="grid3">
          <article class="card"><h3>Cobra sin perseguir</h3><p>Cálculo automático de expensas, recargo por mora y estado de cuenta de cada unidad, siempre al día.</p></article>
          <article class="card"><h3>Controla cada guaraní</h3><p>Gastos por rubro, proveedores, presupuesto contra lo real y conciliación bancaria en una sola pantalla.</p></article>
          <article class="card"><h3>Rinde cuentas con confianza</h3><p>Informe de asamblea, libro diario y balance listos para presentar a los propietarios y entregar al contador.</p></article>
        </div>
      </section>

      <section class="sec" id="funciones">
        <h2>Todo lo que necesita la administración de un edificio</h2>
        <p class="sub">Funciones pensadas para la realidad de Paraguay: guaraníes, IVA, timbrado y asambleas de propietarios.</p>
        <div class="grid4">
          @for (f of features; track f.title) {
            <article class="card feat"><h3>{{ f.title }}</h3><p>{{ f.text }}</p></article>
          }
        </div>
      </section>

      <section class="sec alt" id="perfiles">
        <h2>Una plataforma, tres formas de trabajar</h2>
        <p class="sub">Todos ven la misma información, cada uno con los permisos que le corresponden.</p>
        <div class="grid3">
          @for (p of profiles; track p.title) {
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
          <a href="/downloads/expenses.apk" download="Expenses.apk" class="btn line">Descargar app para Android</a>
          <a routerLink="/explorar" class="btn line">Ver la demo del panel</a>
        </p>
      </section>

      <section class="sec">
        <h2>Empezar es simple</h2>
        <ol class="steps">
          <li><b>Prueba la demostración</b><span>Recorre un edificio de ejemplo en 5 minutos, sin registrarte.</span></li>
          <li><b>Cuéntanos de tu edificio</b><span>Te ayudamos a evaluar cómo adaptar Expenses a tu administración.</span></li>
          <li><b>Importamos tus datos</b><span>Propietarios, residentes y plan de cuentas desde Excel, para arrancar rápido.</span></li>
        </ol>
      </section>

      <section class="sec alt" id="planes">
        <h2>Planes por edificio</h2>
        <p class="sub">Comienzas con lo esencial y sumas módulos cuando los necesitas, sin cambiar de sistema.</p>
        <div class="grid3">
          <article class="card"><h3>Por edificio</h3><p>Pagas según los edificios que administras, con ciclo mensual, trimestral, semestral o anual.</p></article>
          <article class="card"><h3>Módulos opcionales</h3><p>Finanzas del edificio, Marketplace de espacios y publicidad se activan por edificio, según tu plan.</p></article>
          <article class="card"><h3>Período de prueba</h3><p>Todo edificio nuevo comienza con un período de prueba para que lo uses con tus datos reales.</p></article>
        </div>
        <p class="app-line">
          @if (whatsapp) { <a [href]="whatsapp" class="btn solid big" target="_blank" rel="noopener noreferrer">Pedí tu cotización</a> }
        </p>
      </section>

      <section class="sec" id="preguntas">
        <h2>Preguntas frecuentes sobre Expenses</h2>
        <div class="faq">
          @for (q of faqs; track q.question) {
            <details>
              <summary>{{ q.question }}</summary>
              <p>{{ q.answer }}</p>
            </details>
          }
        </div>
      </section>

      <section class="final">
        <h2>¿Listo para administrar tu edificio con claridad?</h2>
        <p>Prueba la demostración gratuita o escríbenos y te contamos cómo implementar Expenses en tu edificio o en tu cartera de condominios.</p>
        <div class="cta center">
          <a routerLink="/explorar" class="btn white big">Explorar demostración gratuita →</a>
          @if (whatsapp) { <a [href]="whatsapp" class="btn outw big" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a> }
        </div>
      </section>
    </main>

    <footer class="ft">
      <div>
        <b>EXPENSES</b>
        <p>Plataforma de administración de edificios y condominios en Paraguay.</p>
      </div>
      <nav aria-label="Enlaces del pie">
        <a routerLink="/explorar">Demostración gratuita</a>
        <a routerLink="/login">Ingresar al sistema</a>
        <a href="/downloads/expenses.apk" download="Expenses.apk">App para Android</a>
        <a href="https://www.linkedin.com/company/expensespy/home/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      </nav>
      <small>© {{ year }} Expenses · expenses.com.py</small>
    </footer>
  `,
  styles: [
    `
      :host { display: block; color: var(--ex-ink, #16324a); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #fff; line-height: 1.55; }
      a { text-decoration: none; color: inherit; }
      h1, h2, h3 { color: #11364a; line-height: 1.2; margin: 0; }
      .hd { display: flex; align-items: center; gap: 1.5rem; padding: 0.9rem 1.5rem; max-width: 1180px; margin: 0 auto; }
      .brand { display: flex; align-items: center; gap: 0.5rem; letter-spacing: 0.08em; }
      .hd nav { display: flex; gap: 1.4rem; margin-left: 1rem; font-size: 0.92rem; font-weight: 600; color: #4a6270; }
      .hd nav a:hover { color: #1385b6; }
      .hd-act { margin-left: auto; display: flex; gap: 0.5rem; }
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

  readonly whatsapp = salesWhatsAppUrl();
  readonly faqs = FAQS;
  readonly year = new Date().getFullYear();

  readonly features = [
    { title: 'Expensas y cobranza', text: 'Expensas ordinarias y extraordinarias, fondo de reserva, recargo por mora automático, estados de cuenta y morosidad.' },
    { title: 'Pagos con comprobante', text: 'El propietario informa su pago desde la app; el Encargado lo aprueba y se aplica al cargo más antiguo, con recibo.' },
    { title: 'Gastos y proveedores', text: 'Gastos por rubro, proveedores, cuentas por pagar, notas de crédito de proveedor y gastos recurrentes.' },
    { title: 'Facturación', text: 'Timbrados, facturas, recibos y notas de crédito, más el libro de compras con IVA crédito fiscal.' },
    { title: 'Finanzas del edificio', text: 'Flujo de caja, presupuesto contra lo real, fondo de reserva, conciliación bancaria e informe de asamblea.' },
    { title: 'Contabilidad', text: 'Plan de cuentas configurable, libro diario, libro mayor, balance y cierre de ejercicio, con exportación a Excel.' },
    { title: 'Comunidad', text: 'Comunicados, reclamos, reservas de espacios comunes, votaciones de asamblea y avisos en el celular.' },
    { title: 'App del Encargado', text: 'Pagos, reclamos, reservas, morosidad y caja desde el celular, con los permisos que define el administrador.' }
  ];

  readonly profiles = [
    {
      where: 'Panel web',
      title: 'Administrador',
      items: ['Gestiona uno o muchos edificios', 'Expensas, cobranza y facturación', 'Finanzas, contabilidad y reportes', 'Configuración y permisos por edificio']
    },
    {
      where: 'App Android',
      title: 'Encargado del edificio',
      items: ['Aprueba pagos con comprobante', 'Atiende reclamos y reservas', 'Ve morosidad y estado de caja', 'Concilia el banco si el administrador lo habilita']
    },
    {
      where: 'App Android',
      title: 'Propietario',
      items: ['Consulta su estado de cuenta y saldo', 'Informa pagos con foto del comprobante', 'Reserva espacios y presenta reclamos', 'Recibe comunicados y avisos']
    }
  ];

  constructor() {
    this.seo.set({
      title: TITLE,
      description: DESCRIPTION,
      path: '/',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Expenses',
          url: SITE_URL + '/',
          logo: SITE_URL + '/favicon.svg',
          sameAs: ['https://www.linkedin.com/company/expensespy/home/'],
          contactPoint: { '@type': 'ContactPoint', telephone: '+595986645450', contactType: 'sales', areaServed: 'PY', availableLanguage: 'es' }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Expenses',
          url: SITE_URL + '/',
          inLanguage: 'es-PY'
        },
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Expenses',
          description: DESCRIPTION,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web, Android',
          inLanguage: 'es-PY',
          url: SITE_URL + '/',
          areaServed: { '@type': 'Country', name: 'Paraguay' },
          featureList: this.features.map((f) => f.title)
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } }))
        }
      ]
    });
  }
}

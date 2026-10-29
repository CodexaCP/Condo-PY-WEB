import { FAQS, FAQS_PT, Faq } from '../../config/faq.data';

export type LandingLang = 'es' | 'pt';

interface TitledText {
  title: string;
  text: string;
}

interface Profile {
  where: string;
  title: string;
  items: string[];
}

// Todos los textos de la página de inicio en un idioma. La página (home.component) solo los pinta: así español y portugués
// comparten diseño y la versión en portugués es una URL propia (/pt/) que Google puede indexar por separado.
export interface LandingContent {
  lang: LandingLang;
  // Valor del atributo lang del <html> y de og:locale.
  htmlLang: string;
  ogLocale: string;
  // Ruta de esta versión y de la otra, para el selector de idioma y las etiquetas hreflang.
  path: string;
  otherPath: string;
  otherLabel: string;
  otherHint: string;
  seoTitle: string;
  seoDescription: string;
  jsonLdDescription: string;
  areaServed: string;
  whatsappMessage: string;
  brandAria: string;
  navAria: string;
  nav: { features: string; profiles: string; plans: string; faq: string };
  login: string;
  tryDemo: string;
  hero: { eyebrow: string; h1: string; lead: string; ctaDemo: string; ctaQuote: string; chips: string[] };
  mock: { head: string; sample: string; kpis: { label: string; value: string; note: string }[] };
  why: { h2: string; sub: string; cards: TitledText[] };
  featuresSec: { h2: string; sub: string; items: TitledText[] };
  profilesSec: { h2: string; sub: string; items: Profile[]; downloadApp: string; seeDemo: string };
  start: { h2: string; steps: { title: string; text: string }[] };
  plans: { h2: string; sub: string; cards: TitledText[]; quote: string };
  faqH2: string;
  faqs: Faq[];
  final: { h2: string; text: string; ctaDemo: string; ctaWhatsapp: string };
  footer: { tagline: string; demo: string; login: string; app: string };
}

export const LANDING_ES: LandingContent = {
  lang: 'es',
  htmlLang: 'es',
  ogLocale: 'es_PY',
  path: '/',
  otherPath: '/pt/',
  otherLabel: 'Português',
  otherHint: 'Ver esta página em português',
  seoTitle: 'Expenses | Software para administrar edificios en Paraguay',
  seoDescription:
    'Expensas, cobranza, gastos, facturación y contabilidad de tu edificio en un solo sistema, con app para el Encargado y propietarios. Prueba la demo gratis.',
  jsonLdDescription:
    'Expensas, cobranza, gastos, facturación y contabilidad de tu edificio en un solo sistema, con app para el Encargado y propietarios. Prueba la demo gratis.',
  areaServed: 'Paraguay',
  whatsappMessage: 'Hola, vi la página de Expenses y quiero pedir una cotización para mi edificio. ¿Me pueden contactar?',
  brandAria: 'Expenses, inicio',
  navAria: 'Secciones',
  nav: { features: 'Funciones', profiles: 'Para quién', plans: 'Planes', faq: 'Preguntas' },
  login: 'Ingresar',
  tryDemo: 'Probar demo',
  hero: {
    eyebrow: 'Software de administración de edificios · Paraguay',
    h1: 'Software para administrar edificios y condominios en Paraguay',
    lead: 'Expensas, cobranza, gastos, facturación y contabilidad de tu edificio en un solo sistema. Panel web para el administrador y app para el Encargado y los propietarios.',
    ctaDemo: 'Explorar demostración gratuita →',
    ctaQuote: 'Pedí tu cotización',
    chips: ['Todo en guaraníes', 'IVA y timbrado', 'Propiedad horizontal', 'La demo no pide registro']
  },
  mock: {
    head: 'Resumen del edificio',
    sample: 'Vista de ejemplo',
    kpis: [
      { label: 'Cobrado del mes', value: 'Gs. 31.134.000', note: '82 % de lo emitido' },
      { label: 'Gastos del mes', value: 'Gs. 30.730.000', note: '8 gastos registrados' },
      { label: 'Morosidad', value: '17,5 %', note: '7 de 40 unidades' }
    ]
  },
  why: {
    h2: 'Deja las planillas, los cuadernos y el WhatsApp',
    sub: 'Un solo lugar para cobrar, pagar, registrar y rendir cuentas, con historial de cada operación.',
    cards: [
      { title: 'Cobra sin perseguir', text: 'Cálculo automático de expensas, recargo por mora y estado de cuenta de cada unidad, siempre al día.' },
      { title: 'Controla cada guaraní', text: 'Gastos por rubro, proveedores, presupuesto contra lo real y conciliación bancaria en una sola pantalla.' },
      { title: 'Rinde cuentas con confianza', text: 'Informe de asamblea, libro diario y balance listos para presentar a los propietarios y entregar al contador.' }
    ]
  },
  featuresSec: {
    h2: 'Todo lo que necesita la administración de un edificio',
    sub: 'Funciones pensadas para la realidad de Paraguay: guaraníes, IVA, timbrado y asambleas de propietarios.',
    items: [
      { title: 'Expensas y cobranza', text: 'Expensas ordinarias y extraordinarias, fondo de reserva, recargo por mora automático, estados de cuenta y morosidad.' },
      { title: 'Pagos con comprobante', text: 'El propietario informa su pago desde la app; el Encargado lo aprueba y se aplica al cargo más antiguo, con recibo.' },
      { title: 'Gastos y proveedores', text: 'Gastos por rubro, proveedores, cuentas por pagar, notas de crédito de proveedor y gastos recurrentes.' },
      { title: 'Facturación', text: 'Timbrados, facturas, recibos y notas de crédito, más el libro de compras con IVA crédito fiscal.' },
      { title: 'Finanzas del edificio', text: 'Flujo de caja, presupuesto contra lo real, fondo de reserva, conciliación bancaria e informe de asamblea.' },
      { title: 'Contabilidad', text: 'Plan de cuentas configurable, libro diario, libro mayor, balance y cierre de ejercicio, con exportación a Excel.' },
      { title: 'Comunidad', text: 'Comunicados, reclamos, reservas de espacios comunes, votaciones de asamblea y avisos en el celular.' },
      { title: 'App del Encargado', text: 'Pagos, reclamos, reservas, morosidad y caja desde el celular, con los permisos que define el administrador.' }
    ]
  },
  profilesSec: {
    h2: 'Una plataforma, tres formas de trabajar',
    sub: 'Todos ven la misma información, cada uno con los permisos que le corresponden.',
    items: [
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
    ],
    downloadApp: 'Descargar app para Android',
    seeDemo: 'Ver la demo del panel'
  },
  start: {
    h2: 'Empezar es simple',
    steps: [
      { title: 'Prueba la demostración', text: 'Recorre un edificio de ejemplo en 5 minutos, sin registrarte.' },
      { title: 'Cuéntanos de tu edificio', text: 'Te ayudamos a evaluar cómo adaptar Expenses a tu administración.' },
      { title: 'Importamos tus datos', text: 'Propietarios, residentes y plan de cuentas desde Excel, para arrancar rápido.' }
    ]
  },
  plans: {
    h2: 'Planes por edificio',
    sub: 'Comienzas con lo esencial y sumas módulos cuando los necesitas, sin cambiar de sistema.',
    cards: [
      { title: 'Por edificio', text: 'Pagas según los edificios que administras, con ciclo mensual, trimestral, semestral o anual.' },
      { title: 'Módulos opcionales', text: 'Finanzas del edificio, Marketplace de espacios y publicidad se activan por edificio, según tu plan.' },
      { title: 'Período de prueba', text: 'Todo edificio nuevo comienza con un período de prueba para que lo uses con tus datos reales.' }
    ],
    quote: 'Pedí tu cotización'
  },
  faqH2: 'Preguntas frecuentes sobre Expenses',
  faqs: FAQS,
  final: {
    h2: '¿Listo para administrar tu edificio con claridad?',
    text: 'Prueba la demostración gratuita o escríbenos y te contamos cómo implementar Expenses en tu edificio o en tu cartera de condominios.',
    ctaDemo: 'Explorar demostración gratuita →',
    ctaWhatsapp: 'Hablar por WhatsApp'
  },
  footer: {
    tagline: 'Plataforma de administración de edificios y condominios en Paraguay.',
    demo: 'Demostración gratuita',
    login: 'Ingresar al sistema',
    app: 'App para Android'
  }
};

// Versión en portugués para quienes administran o tienen inmuebles en Paraguay y buscan en portugués. Usa los términos de
// Brasil (condomínio, taxa condominial, inadimplência) y mantiene los fiscales de Paraguay tal cual (timbrado, IVA, guaranis).
export const LANDING_PT: LandingContent = {
  lang: 'pt',
  htmlLang: 'pt',
  ogLocale: 'pt_BR',
  path: '/pt/',
  otherPath: '/',
  otherLabel: 'Español',
  otherHint: 'Ver esta página en español',
  seoTitle: 'Expenses | Software para administrar condomínios no Paraguai',
  seoDescription:
    'Taxas condominiais, cobrança, despesas, faturamento e contabilidade do seu condomínio em um só sistema, com app para o encarregado e os proprietários. Teste a demo grátis.',
  jsonLdDescription:
    'Taxas condominiais, cobrança, despesas, faturamento e contabilidade do seu condomínio em um só sistema, com app para o encarregado e os proprietários.',
  areaServed: 'Paraguai',
  whatsappMessage: 'Olá, vi a página da Expenses em português e quero pedir um orçamento para o meu condomínio. Podem entrar em contato?',
  brandAria: 'Expenses, início',
  navAria: 'Seções',
  nav: { features: 'Funções', profiles: 'Para quem', plans: 'Planos', faq: 'Perguntas' },
  login: 'Entrar',
  tryDemo: 'Testar demo',
  hero: {
    eyebrow: 'Software de gestão de condomínios · Paraguai',
    h1: 'Software para administrar condomínios e edifícios no Paraguai',
    lead: 'Taxas condominiais, cobrança, despesas, faturamento e contabilidade do seu condomínio em um só sistema. Painel web para o administrador e app para o encarregado e os proprietários.',
    ctaDemo: 'Explorar demonstração gratuita →',
    ctaQuote: 'Peça seu orçamento',
    chips: ['Tudo em guaranis', 'IVA e timbrado', 'Propriedade horizontal', 'Demo sem cadastro, em espanhol']
  },
  mock: {
    head: 'Resumo do condomínio',
    sample: 'Exemplo ilustrativo',
    kpis: [
      { label: 'Recebido no mês', value: 'Gs. 31.134.000', note: '82% do valor emitido' },
      { label: 'Despesas do mês', value: 'Gs. 30.730.000', note: '8 despesas registradas' },
      { label: 'Inadimplência', value: '17,5%', note: '7 de 40 unidades' }
    ]
  },
  why: {
    h2: 'Largue as planilhas, os cadernos e o WhatsApp',
    sub: 'Um só lugar para cobrar, pagar, registrar e prestar contas, com histórico de cada operação.',
    cards: [
      { title: 'Cobre sem correr atrás', text: 'Cálculo automático da taxa condominial, multa e juros por atraso e extrato de cada unidade, sempre em dia.' },
      { title: 'Controle cada guarani', text: 'Despesas por categoria, fornecedores, orçamento contra o realizado e conciliação bancária em uma só tela.' },
      { title: 'Preste contas com confiança', text: 'Relatório de assembleia, livro diário e balanço prontos para apresentar aos proprietários e entregar ao contador.' }
    ]
  },
  featuresSec: {
    h2: 'Tudo o que a administração de um condomínio precisa',
    sub: 'Funções pensadas para a realidade do Paraguai: guaranis, IVA, timbrado e assembleias de proprietários.',
    items: [
      { title: 'Taxa condominial e cobrança', text: 'Taxas ordinárias e extraordinárias, fundo de reserva, multa por atraso automática, extratos e inadimplência.' },
      { title: 'Pagamentos com comprovante', text: 'O proprietário informa o pagamento pelo app; o encarregado aprova e ele é aplicado à cobrança mais antiga, com recibo.' },
      { title: 'Despesas e fornecedores', text: 'Despesas por categoria, fornecedores, contas a pagar, notas de crédito de fornecedor e despesas recorrentes.' },
      { title: 'Faturamento', text: 'Timbrados, faturas, recibos e notas de crédito, além do livro de compras com IVA crédito fiscal.' },
      { title: 'Finanças do condomínio', text: 'Fluxo de caixa, orçamento contra o realizado, fundo de reserva, conciliação bancária e relatório de assembleia.' },
      { title: 'Contabilidade', text: 'Plano de contas configurável, livro diário, livro razão, balanço e encerramento do exercício, com exportação para Excel.' },
      { title: 'Comunidade', text: 'Comunicados, reclamações, reservas de áreas comuns, votações de assembleia e avisos no celular.' },
      { title: 'App do encarregado', text: 'Pagamentos, reclamações, reservas, inadimplência e caixa pelo celular, com as permissões definidas pelo administrador.' }
    ]
  },
  profilesSec: {
    h2: 'Uma plataforma, três formas de trabalhar',
    sub: 'Todos veem a mesma informação, cada um com as permissões que lhe correspondem.',
    items: [
      {
        where: 'Painel web',
        title: 'Administrador',
        items: ['Gerencia um ou vários condomínios', 'Taxas, cobrança e faturamento', 'Finanças, contabilidade e relatórios', 'Configuração e permissões por condomínio']
      },
      {
        where: 'App Android',
        title: 'Encarregado (zelador) do condomínio',
        items: ['Aprova pagamentos com comprovante', 'Atende reclamações e reservas', 'Vê a inadimplência e o estado do caixa', 'Concilia o banco se o administrador habilitar']
      },
      {
        where: 'App Android',
        title: 'Proprietário',
        items: ['Consulta seu extrato e saldo', 'Informa pagamentos com foto do comprovante', 'Reserva áreas comuns e registra reclamações', 'Recebe comunicados e avisos']
      }
    ],
    downloadApp: 'Baixar o app para Android',
    seeDemo: 'Ver a demo do painel'
  },
  start: {
    h2: 'Começar é simples',
    steps: [
      { title: 'Teste a demonstração', text: 'Percorra um condomínio de exemplo em 5 minutos, sem cadastro. A demo está em espanhol.' },
      { title: 'Conte-nos sobre o seu condomínio', text: 'Ajudamos você a avaliar como adaptar a Expenses à sua administração.' },
      { title: 'Importamos seus dados', text: 'Proprietários, moradores e plano de contas a partir do Excel, para começar rápido.' }
    ]
  },
  plans: {
    h2: 'Planos por condomínio',
    sub: 'Você começa com o essencial e soma módulos quando precisar, sem trocar de sistema.',
    cards: [
      { title: 'Por condomínio', text: 'Você paga conforme os condomínios que administra, com ciclo mensal, trimestral, semestral ou anual.' },
      { title: 'Módulos opcionais', text: 'Finanças do condomínio, Marketplace de espaços e publicidade são ativados por condomínio, conforme o seu plano.' },
      { title: 'Período de teste', text: 'Todo condomínio novo começa com um período de teste para você usar com seus dados reais.' }
    ],
    quote: 'Peça seu orçamento'
  },
  faqH2: 'Perguntas frequentes sobre a Expenses',
  faqs: FAQS_PT,
  final: {
    h2: 'Pronto para administrar seu condomínio com clareza?',
    text: 'Teste a demonstração gratuita ou escreva para nós e contamos como implementar a Expenses no seu condomínio ou na sua carteira de condomínios.',
    ctaDemo: 'Explorar demonstração gratuita →',
    ctaWhatsapp: 'Falar pelo WhatsApp'
  },
  footer: {
    tagline: 'Plataforma de administração de condomínios e edifícios no Paraguai.',
    demo: 'Demonstração gratuita',
    login: 'Entrar no sistema',
    app: 'App para Android'
  }
};

export function landingContent(lang: string | undefined): LandingContent {
  return lang === 'pt' ? LANDING_PT : LANDING_ES;
}

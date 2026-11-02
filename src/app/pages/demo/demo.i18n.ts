import { Dict } from '../../core/i18n/lang.service';
import { DemoCountry } from './demo.country';

// Todos los textos de la demostración pública («Explora Expenses») en español, portugués e inglés.
// Los datos ficticios (demo.data.ts) guardan identificadores neutros; aquí está cómo se llama cada cosa en cada idioma.

export type CategoryId = 'utilities' | 'payroll' | 'security' | 'maintenance' | 'cleaning' | 'admin' | 'insurance' | 'other';
export type MethodId = 'transfer' | 'cash' | 'deposit' | 'card';
export type ExpenseItemId = 'staff' | 'guard' | 'power' | 'water' | 'elevator' | 'supplies' | 'insurance' | 'adminFee' | 'pump';
export type MissionId = 'panel' | 'unidad' | 'gasto' | 'informes' | 'libro' | 'certificado';
export type LockedId = 'estado-pdf' | 'conciliacion' | 'facturacion' | 'votaciones' | 'app' | 'mas';
export type PainId = 'collections' | 'expenses' | 'accounting' | 'assembly' | 'communication';
export type JournalKind = 'liquidacion' | 'cobro' | 'gasto';
export type ContactKind = 'presupuesto' | 'demostracion' | 'planes' | 'general';

const pad2 = (n: number): string => String(n).padStart(2, '0');

// Fecha «dd/mm/aaaa» (español y portugués) o «dd Mmm aaaa» (inglés, sin ambigüedad entre día y mes).
const dateNumeric = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateEnglish = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${pad2(d)} ${EN_MONTHS[m - 1]} ${y}`;
};

const ES = {
  months: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthsShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  date: dateNumeric,
  decimal: (n: number): string => String(n).replace('.', ','),
  percent: (n: number | string): string => `${n} %`,

  countries: { py: 'Paraguay', ar: 'Argentina' } as Record<DemoCountry, string>,
  building: { name: 'Edificio Torre Mirador', city: 'Asunción' },
  defaultSupplier: 'Proveedor de ejemplo',
  categories: { utilities: 'Servicios', payroll: 'Personal', security: 'Seguridad', maintenance: 'Mantenimiento', cleaning: 'Limpieza', admin: 'Administración', insurance: 'Seguros', other: 'Otros' } as Record<CategoryId, string>,
  accountNames: { utilities: 'Servicios básicos', payroll: 'Sueldos y cargas sociales', security: 'Seguridad y vigilancia', maintenance: 'Mantenimiento y reparaciones', cleaning: 'Limpieza', admin: 'Honorarios de administración', insurance: 'Seguros', other: 'Otros gastos' } as Record<CategoryId, string>,
  accounts: { receivable: 'Expensas a cobrar', ordinaryIncome: 'Ingresos por expensas ordinarias', extraIncome: 'Ingresos por expensas extraordinarias', cash: 'Caja y bancos', vat: 'IVA crédito fiscal' },
  methods: { transfer: 'Transferencia', cash: 'Efectivo', deposit: 'Depósito', card: 'Tarjeta' } as Record<MethodId, string>,
  expenseItems: {
    staff: { supplier: 'Nómina del edificio', concept: 'Sueldos de encargado y limpieza' },
    guard: { supplier: 'Guardián Seguridad S.A.', concept: 'Servicio de vigilancia' },
    power: { supplier: 'ANDE', concept: 'Energía eléctrica de áreas comunes' },
    water: { supplier: 'ESSAP', concept: 'Agua y alcantarillado' },
    elevator: { supplier: 'Elevadores del Sur S.A.', concept: 'Mantenimiento mensual de ascensores' },
    supplies: { supplier: 'Distribuidora Limpia SRL', concept: 'Insumos de limpieza' },
    insurance: { supplier: 'Seguros Integrales Demo S.A.', concept: 'Seguro integral del edificio' },
    adminFee: { supplier: 'Administración Demo S.A.', concept: 'Honorarios de administración' },
    pump: { supplier: 'Hidrosistemas Paraguay', concept: 'Reparación de bomba de agua' }
  } as Record<ExpenseItemId, { supplier: string; concept: string }>,
  charge: {
    ordinary: (period: string) => `Expensa ordinaria ${period}`,
    extra: 'Cuota extraordinaria · pintura de fachada',
    surcharge: (period: string) => `Recargo por mora · ${period}`,
    paymentReceived: (method: string) => `Pago recibido · ${method}`
  },
  journalText: {
    liquidation: (period: string) => `Liquidación de expensas ${period}`,
    liquidationOrigin: (units: number) => `Liquidación del período · ${units} unidades`,
    collection: (unit: string) => `Cobro de expensas · Unidad ${unit}`,
    collectionOrigin: (receipt: string, owner: string, method: string) => `Recibo ${receipt} · ${owner} · ${method}`,
    expenseOriginSimulated: 'Gasto simulado en esta demostración',
    expenseOrigin: (category: string) => `Gasto registrado · rubro ${category}`
  },
  movementCollection: (unit: string, owner: string) => `Cobro · Unidad ${unit} · ${owner}`,
  aging: ['1 mes vencido', '2 meses vencidos', '3 o más meses'],
  missions: {
    panel: { title: 'Conoce el edificio', hint: 'Haz clic en cualquier indicador del panel para ver de dónde sale la cifra.' },
    unidad: { title: 'Revisa una unidad', hint: 'Busca un departamento con deuda y abre su estado de cuenta.' },
    gasto: { title: 'Registra un gasto', hint: 'Carga un gasto simulado y mira cómo impacta en el edificio.' },
    informes: { title: 'Descubre los informes', hint: 'Cambia entre los informes de ingresos y gastos, morosidad y rubros.' },
    libro: { title: 'Comprueba el control contable', hint: 'Abre un asiento del libro diario y mira de qué movimiento sale.' },
    certificado: { title: 'Genera un certificado de deudas', hint: 'Elige una unidad y mira el certificado de deudas y créditos que se entrega a quien lo pide.' }
  } as Record<MissionId, { title: string; hint: string }>,
  locked: {
    'estado-pdf': { title: 'Estados de cuenta en PDF y envío al propietario', text: 'Genera el estado de cuenta de cada unidad en PDF y envíalo por correo o por la app, con un solo clic.' },
    conciliacion: { title: 'Conciliación bancaria', text: 'Importa el extracto del banco y concilia cobros y pagos contra lo registrado en Expenses.' },
    facturacion: { title: 'Facturación y recibos', text: 'Emite facturas y recibos con tu timbrado, con notas de crédito y libro de ventas.' },
    votaciones: { title: 'Votaciones de asamblea', text: 'Convoca y registra votaciones de propietarios con resultados en tiempo real.' },
    app: { title: 'App para propietarios y encargados', text: 'Cada propietario consulta su deuda, paga y recibe avisos desde el celular.' },
    mas: { title: 'Más módulos de Expenses', text: 'Comunicados, reclamos, reservas de espacios comunes, presupuesto, fondo de reserva y más.' }
  } as Record<LockedId, { title: string; text: string }>,
  lockedNav: { conciliacion: 'Conciliación bancaria', facturacion: 'Facturación', votaciones: 'Votaciones', app: 'App' } as Record<string, string>,
  diagnosis: {
    units: { title: '¿Cuántas unidades administras?', options: [['u30', 'Hasta 30'], ['u100', '31 a 100'], ['u300', '101 a 300'], ['u300p', 'Más de 300']] as [string, string][] },
    method: { title: '¿Cómo llevas hoy las expensas?', options: [['excel', 'Planillas de Excel'], ['software', 'Otro software'], ['paper', 'Cuaderno o papel'], ['accountant', 'Lo lleva mi contador']] as [string, string][] },
    pain: { title: '¿Qué te quita más tiempo o te preocupa más?', options: [['collections', 'Cobrar y la morosidad'], ['expenses', 'Controlar gastos y proveedores'], ['accounting', 'La contabilidad'], ['assembly', 'Rendir cuentas en la asamblea'], ['communication', 'Comunicarme con propietarios']] as [string, string][] }
  },
  recommendation: {
    collections: 'Expensas con recargo por mora automático, estados de cuenta por unidad y el informe de morosidad que viste en la demo.',
    expenses: 'Gastos por rubro, proveedores, cuentas por pagar y la nota de crédito de proveedor, con el impacto contable al instante.',
    accounting: 'Libro diario, libro mayor, balance y libro de compras con IVA, listos para tu contador.',
    assembly: 'Informe de asamblea, presupuesto contra lo real y fondo de reserva, para presentar cuentas claras.',
    communication: 'Comunicados, reclamos, avisos en la app y votaciones, para que todos estén informados.'
  } as Record<PainId, string>,
  whatsapp: {
    intro: {
      presupuesto: 'Hola, probé la demostración de Expenses y quiero pedir un presupuesto para mi edificio.',
      demostracion: 'Hola, probé la demostración de Expenses y quiero solicitar una demostración personalizada.',
      planes: 'Hola, probé la demostración de Expenses y quiero consultar planes y condiciones.',
      general: 'Hola, estuve explorando Expenses y quiero más información.'
    } as Record<ContactKind, string>,
    explored: (list: string) => ` En la demo exploré: ${list}.`,
    profile: (units: string, method: string, pain: string) => ` Administro ${units} unidades, hoy llevo las expensas con ${method} y lo que más me preocupa es: ${pain}.`,
    country: (country: string) => ` Mi administración está en ${country}.`
  },

  shell: {
    backHome: 'Volver al inicio',
    badge: 'Demostración · datos ficticios',
    resetTitle: 'Borra lo que hiciste en la demostración y empieza de nuevo',
    reset: 'Reiniciar',
    talk: 'Hablar con Expenses',
    exit: 'Salir',
    contextLine: (city: string, units: number, period: string) => `${city} · ${units} unidades · ${period}`,
    note: 'Nada de lo que hagas aquí se guarda ni afecta datos reales.',
    country: 'País',
    countryAria: 'País de la demostración',
    navAria: 'Módulos de la demostración',
    nav: { panel: 'Panel', units: 'Unidades', expenses: 'Gastos', reports: 'Informes', journal: 'Libro diario', certificate: 'Certificado de deudas' },
    missionsAria: 'Recorrido guiado',
    missionsTitle: 'Recorrido guiado',
    missionsProgress: (done: number, total: number) => `${done} de ${total} herramientas descubiertas`,
    next: 'Siguiente:',
    goNow: 'Ir ahora →',
    allDone: '¡Recorrido completo! Ya viste cómo Expenses ayuda a controlar un edificio.',
    nextStep: 'Siguiente paso →',
    footText: '¿Te gustó lo que viste? Podemos adaptar Expenses a tu administración.',
    footCta: 'Quiero esto para mi edificio',
    keepExploring: 'Seguir explorando',
    finishDone: '¡Completaste el recorrido!',
    finishTodo: '¿Listo para administrar tu propio edificio?',
    finishLead: 'Ya viste cómo funciona Expenses en un entorno de prueba. Cuéntanos tu caso y te ayudamos a evaluar cómo adaptarlo a tu administración.',
    forYou: 'Para ti, Expenses ofrece:',
    ctaDemo: 'Solicitar una demostración personalizada',
    ctaPlans: 'Consultar planes y condiciones',
    ctaQuote: 'Pedir presupuesto por WhatsApp',
    seoTitle: 'Demostración gratuita de Expenses | Edificio de ejemplo',
    seoDescription: 'Explora Expenses sin registrarte: un edificio de demostración con unidades, expensas, gastos, informes y libro diario, con datos ficticios.'
  },
  panel: {
    title: 'Así está el edificio hoy',
    sub: 'Haz clic en un indicador para descubrir de dónde sale la cifra.',
    whereFrom: (label: string) => `¿De dónde sale «${label}»?`,
    chartTitle: 'Ingresos y gastos · últimos 6 meses',
    collectedTip: 'Cobrado',
    expensesTip: 'Gastos',
    lastMovements: 'Últimos movimientos',
    seeAll: 'Ver todos en el libro diario →',
    alert: (n: number, amount: string) => ({ bold: `${n} unidades`, rest: ` tienen deuda vencida por ${amount}. ` }),
    alertLink: 'Ver quiénes son →',
    kpi: {
      cash: {
        label: 'Caja y bancos', note: 'Saldo disponible hoy',
        text: 'Es el saldo de apertura del mes, más lo cobrado a los propietarios, menos los gastos pagados.',
        opening: 'Saldo de apertura del mes', plus: '+ Cobrado en el mes', minus: '− Gastos pagados en el mes', equals: '= Saldo de hoy', link: 'Ver los asientos en el libro diario'
      },
      collected: {
        label: 'Cobrado del mes', note: (rate: string) => `${rate} de lo emitido`,
        text: 'Suma de los pagos registrados este mes contra lo emitido en la liquidación de expensas.',
        issued: 'Emitido en la liquidación', collectedWith: (n: number) => `Cobrado (${n} pagos)`, rate: 'Porcentaje de cobranza', link: 'Revisar las unidades'
      },
      expenses: {
        label: 'Gastos del mes', note: (n: number) => `${n} gastos registrados`,
        text: 'Todos los gastos cargados este mes, agrupados por rubro. Si registras un gasto simulado, esta cifra cambia.',
        link: 'Ir a Gastos'
      },
      morosity: {
        label: 'Morosidad', note: (a: number, b: number) => `${a} de ${b} unidades`,
        text: 'Unidades con al menos una expensa vencida y sin pagar, sobre el total de unidades del edificio.',
        withDebt: 'Unidades con deuda vencida', totalUnits: 'Total de unidades', totalDebt: 'Deuda vencida total', link: 'Ver las unidades con deuda'
      },
      pending: {
        label: 'Pendiente de cobro', note: 'Vencido y por vencer',
        text: 'Todo lo emitido que todavía no se cobró: la deuda vencida más las expensas del mes que aún no vencen.',
        overdue: 'Deuda vencida', upcoming: 'Por vencer'
      },
      reserve: {
        label: 'Fondo de reserva', note: 'Ahorro del edificio',
        text: 'Dinero apartado para imprevistos y obras mayores, separado del saldo operativo.',
        balance: 'Saldo del fondo de reserva'
      }
    }
  },
  units: {
    title: 'Unidades y propietarios',
    sub: 'Busca un departamento y abre su estado de cuenta para ver cargos, pagos y saldo.',
    searchPlaceholder: 'Buscar por unidad o propietario...',
    searchAria: 'Buscar unidad',
    onlyDebt: 'Solo con deuda vencida',
    count: (shown: number, total: number) => `${shown} de ${total} unidades`,
    cols: { unit: 'Unidad', owner: 'Propietario', area: 'Superficie', fee: 'Cuota ordinaria', debt: 'Deuda vencida', status: 'Estado' },
    floor: (n: number) => `piso ${n}`,
    owes: (months: number) => `Debe ${months} ${months === 1 ? 'mes' : 'meses'}`,
    upToDate: 'Al día',
    statementLink: 'Estado de cuenta →',
    none: 'Ninguna unidad coincide con la búsqueda.'
  },
  statement: {
    back: '← Volver a unidades',
    title: (code: string) => `Estado de cuenta · Unidad ${code}`,
    sub: (owner: string, floor: number, metric: string, fee: string) => `${owner} · piso ${floor} · ${metric} · cuota ordinaria ${fee}`,
    pending: 'Saldo pendiente',
    overdueOf: 'De los cuales vencidos',
    lastPayment: 'Último pago',
    status: 'Estado',
    withDebt: 'Con deuda vencida',
    upToDate: 'Al día',
    pdf: 'Descargar PDF',
    send: 'Enviar al propietario',
    movements: 'Movimientos',
    cols: { date: 'Fecha', concept: 'Concepto', reference: 'Referencia', charge: 'Cargo', payment: 'Pago', balance: 'Saldo' },
    overdueBadge: 'Vencido',
    notFoundTitle: 'Unidad no encontrada',
    notFound: 'Esa unidad no existe en la demostración. ',
    backShort: 'Volver a unidades'
  },
  expenses: {
    title: 'Gastos del edificio',
    sub: 'Registra un gasto de prueba y mira cómo cambia el panel y el libro diario. No se guarda: es solo una simulación.',
    formTitle: 'Registrar un gasto simulado',
    concept: 'Concepto',
    conceptPlaceholder: 'Ej.: Reparación del portón del garaje',
    supplier: 'Proveedor (opcional)',
    supplierPlaceholder: 'Ej.: Taller Central',
    category: 'Rubro',
    amount: 'Importe en guaraníes (con IVA)',
    amountPlaceholder: 'Ej.: 850000',
    preview: 'Estás por registrar ',
    vatIncluded: (vat: string) => ` · incluye IVA 10 % de ${vat}`,
    submit: 'Registrar gasto simulado',
    errConcept: 'Escribe un concepto para el gasto.',
    errAmount: 'Ingresa un importe mayor que cero.',
    addedTitle: '¡Gasto registrado!',
    added: (concept: string, amount: string) => ` «${concept}» por ${amount}. El saldo de caja bajó y el asiento contable ya se generó.`,
    seeEntry: 'Ver el asiento en el libro diario →',
    seePanel: 'Ver el panel →',
    summary: 'Resumen del mes',
    listTitle: (period: string) => `Gastos de ${period}`,
    cols: { date: 'Fecha', concept: 'Concepto', supplier: 'Proveedor', category: 'Rubro', amount: 'Importe' },
    simulated: 'Simulado'
  },
  reports: {
    title: 'Informes',
    sub: 'Lo que necesitas para decidir y para rendir cuentas en la asamblea. Cambia de informe con las pestañas.',
    tabs: { ingresos: 'Ingresos y gastos', morosidad: 'Morosidad', rubros: 'Gastos por rubro' },
    monthlyTitle: 'Resultado mensual · últimos 6 meses',
    monthlyCols: { month: 'Mes', issued: 'Emitido', collected: 'Cobrado', rate: 'Cobranza', expenses: 'Gastos', result: 'Resultado' },
    monthlyNote: 'El resultado del mes actual cambia si registras gastos simulados en la sección Gastos.',
    unitCount: (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`,
    overdueTitle: 'Unidades con deuda vencida',
    overdueCols: { unit: 'Unidad', owner: 'Propietario', months: 'Meses vencidos', debt: 'Deuda vencida' },
    statementLink: 'Estado de cuenta →',
    byCategory: (period: string) => `Gastos de ${period} por rubro`,
    more: 'En la versión completa también tienes el ',
    moreBold: 'informe de asamblea',
    moreRest: ', presupuesto contra lo real, flujo de caja y exportación a Excel.',
    learnMore: 'Conocer más →'
  },
  journal: {
    title: 'Libro diario',
    sub: 'Cada cobro, gasto y liquidación genera su asiento contable. Abre uno para ver las cuentas y el movimiento de origen.',
    filters: { todos: 'Todos', gasto: 'Gastos', cobro: 'Cobros', liquidacion: 'Liquidación' } as Record<string, string>,
    kinds: { liquidacion: 'Liquidación', cobro: 'Cobro', gasto: 'Gasto' } as Record<JournalKind, string>,
    count: (n: number) => `${n} asientos`,
    number: 'N.º',
    cols: { account: 'Cuenta', name: 'Nombre', debit: 'Debe', credit: 'Haber' },
    totals: 'Totales',
    balanced: 'Asiento balanceado',
    origin: 'Origen:',
    seeMovement: 'Ver el movimiento →',
    more: 'La versión completa suma ',
    moreBold: 'libro mayor, balance, libro de compras con IVA y cierre de ejercicio',
    moreRest: '. Lo ya asentado no se modifica: los errores se corrigen con un contraasiento.',
    learnMore: 'Conocer más →'
  },
  certificate: {
    title: 'Certificado de deudas y créditos',
    sub: 'El documento que la administración entrega a pedido de un interesado (por ejemplo, para transmitir una unidad): lo adeudado por período y el saldo a favor.',
    pick: 'Unidad',
    statementLink: 'Estado de cuenta →',
    issued: (date: string, unit: string, building: string, place: string) => `A la fecha de emisión (${date}), la administración certifica el estado de cuenta de la unidad ${unit} del ${building}, ubicado en ${place}.`,
    owner: 'Propietario',
    cols: { period: 'Período', due: 'Vencimiento', charged: 'Emitido', paid: 'Pagado', pending: 'Pendiente' },
    total: 'Total adeudado',
    credit: 'Saldo a favor del propietario en la administración',
    noDebt: 'La unidad no registra expensas ni intereses pendientes de pago a la fecha de emisión.',
    hasDebt: 'La unidad registra expensas e intereses pendientes de pago por el importe indicado.',
    none: 'Sin períodos con saldo pendiente.',
    note: 'El saldo a favor pertenece al propietario y puede incluir importes generados por otras unidades. Este certificado refleja los registros de la administración a la fecha indicada; los pagos acreditados después no figuran.',
    signature: 'Administración Demo S.A.',
    registry: 'Registro N.º 1234 (dato de ejemplo)',
    pdf: 'Descargar PDF',
    place: 'Asunción'
  },
  lockedPage: {
    badge: 'Disponible en la versión completa',
    cta: 'Ver esta función en una demostración',
    back: 'Seguir explorando'
  }
};

export type DemoTx = typeof ES;

const PT: DemoTx = {
  months: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthsShort: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  date: dateNumeric,
  decimal: (n: number): string => String(n).replace('.', ','),
  percent: (n: number | string): string => `${n}%`,

  countries: { py: 'Paraguai', ar: 'Argentina' } as Record<DemoCountry, string>,
  building: { name: 'Edifício Torre Mirador', city: 'Assunção' },
  defaultSupplier: 'Fornecedor de exemplo',
  categories: { utilities: 'Serviços', payroll: 'Pessoal', security: 'Segurança', maintenance: 'Manutenção', cleaning: 'Limpeza', admin: 'Administração', insurance: 'Seguros', other: 'Outros' },
  accountNames: { utilities: 'Serviços básicos', payroll: 'Salários e encargos sociais', security: 'Segurança e vigilância', maintenance: 'Manutenção e reparos', cleaning: 'Limpeza', admin: 'Honorários de administração', insurance: 'Seguros', other: 'Outras despesas' },
  accounts: { receivable: 'Taxas a receber', ordinaryIncome: 'Receitas de taxas ordinárias', extraIncome: 'Receitas de taxas extraordinárias', cash: 'Caixa e bancos', vat: 'IVA crédito fiscal' },
  methods: { transfer: 'Transferência', cash: 'Dinheiro', deposit: 'Depósito', card: 'Cartão' },
  expenseItems: {
    staff: { supplier: 'Folha do edifício', concept: 'Salários do encarregado e da limpeza' },
    guard: { supplier: 'Guardián Seguridad S.A.', concept: 'Serviço de vigilância' },
    power: { supplier: 'ANDE', concept: 'Energia elétrica das áreas comuns' },
    water: { supplier: 'ESSAP', concept: 'Água e esgoto' },
    elevator: { supplier: 'Elevadores del Sur S.A.', concept: 'Manutenção mensal dos elevadores' },
    supplies: { supplier: 'Distribuidora Limpia SRL', concept: 'Material de limpeza' },
    insurance: { supplier: 'Seguros Integrales Demo S.A.', concept: 'Seguro integral do edifício' },
    adminFee: { supplier: 'Administración Demo S.A.', concept: 'Honorários de administração' },
    pump: { supplier: 'Hidrosistemas Paraguay', concept: 'Reparo da bomba d’água' }
  },
  charge: {
    ordinary: (period: string) => `Taxa ordinária ${period}`,
    extra: 'Taxa extraordinária · pintura da fachada',
    surcharge: (period: string) => `Multa e juros por atraso · ${period}`,
    paymentReceived: (method: string) => `Pagamento recebido · ${method}`
  },
  journalText: {
    liquidation: (period: string) => `Apuração das taxas ${period}`,
    liquidationOrigin: (units: number) => `Apuração do período · ${units} unidades`,
    collection: (unit: string) => `Recebimento de taxa · Unidade ${unit}`,
    collectionOrigin: (receipt: string, owner: string, method: string) => `Recibo ${receipt} · ${owner} · ${method}`,
    expenseOriginSimulated: 'Despesa simulada nesta demonstração',
    expenseOrigin: (category: string) => `Despesa registrada · categoria ${category}`
  },
  movementCollection: (unit: string, owner: string) => `Recebimento · Unidade ${unit} · ${owner}`,
  aging: ['1 mês vencido', '2 meses vencidos', '3 ou mais meses'],
  missions: {
    panel: { title: 'Conheça o edifício', hint: 'Clique em qualquer indicador do painel para ver de onde vem o valor.' },
    unidad: { title: 'Confira uma unidade', hint: 'Procure um apartamento com dívida e abra o extrato.' },
    gasto: { title: 'Registre uma despesa', hint: 'Lance uma despesa simulada e veja como ela impacta o edifício.' },
    informes: { title: 'Descubra os relatórios', hint: 'Alterne entre os relatórios de receitas e despesas, inadimplência e categorias.' },
    libro: { title: 'Confira o controle contábil', hint: 'Abra um lançamento do livro diário e veja de qual movimento ele vem.' },
    certificado: { title: 'Gere uma certidão de débitos', hint: 'Escolha uma unidade e veja a certidão de débitos e créditos entregue a quem a solicita.' }
  },
  locked: {
    'estado-pdf': { title: 'Extratos em PDF e envio ao proprietário', text: 'Gere o extrato de cada unidade em PDF e envie por e-mail ou pelo app, com um só clique.' },
    conciliacion: { title: 'Conciliação bancária', text: 'Importe o extrato do banco e concilie recebimentos e pagamentos com o que está registrado na Expenses.' },
    facturacion: { title: 'Faturamento e recibos', text: 'Emita faturas e recibos com o seu timbrado, com notas de crédito e livro de vendas.' },
    votaciones: { title: 'Votações de assembleia', text: 'Convoque e registre votações dos proprietários com resultados em tempo real.' },
    app: { title: 'App para proprietários e encarregados', text: 'Cada proprietário consulta a sua dívida, paga e recebe avisos pelo celular.' },
    mas: { title: 'Mais módulos da Expenses', text: 'Comunicados, reclamações, reservas de áreas comuns, orçamento, fundo de reserva e muito mais.' }
  },
  lockedNav: { conciliacion: 'Conciliação bancária', facturacion: 'Faturamento', votaciones: 'Votações', app: 'App' },
  diagnosis: {
    units: { title: 'Quantas unidades você administra?', options: [['u30', 'Até 30'], ['u100', '31 a 100'], ['u300', '101 a 300'], ['u300p', 'Mais de 300']] },
    method: { title: 'Como você controla as taxas hoje?', options: [['excel', 'Planilhas de Excel'], ['software', 'Outro software'], ['paper', 'Caderno ou papel'], ['accountant', 'Meu contador cuida disso']] },
    pain: { title: 'O que mais toma o seu tempo ou preocupa você?', options: [['collections', 'Cobrar e a inadimplência'], ['expenses', 'Controlar despesas e fornecedores'], ['accounting', 'A contabilidade'], ['assembly', 'Prestar contas na assembleia'], ['communication', 'Comunicar-me com os proprietários']] }
  },
  recommendation: {
    collections: 'Taxas com multa e juros por atraso automáticos, extratos por unidade e o relatório de inadimplência que você viu na demo.',
    expenses: 'Despesas por categoria, fornecedores, contas a pagar e a nota de crédito de fornecedor, com o impacto contábil na hora.',
    accounting: 'Livro diário, livro razão, balanço e livro de compras com IVA, prontos para o seu contador.',
    assembly: 'Relatório de assembleia, orçamento contra o realizado e fundo de reserva, para apresentar contas claras.',
    communication: 'Comunicados, reclamações, avisos no app e votações, para que todos estejam informados.'
  },
  whatsapp: {
    intro: {
      presupuesto: 'Olá, testei a demonstração da Expenses e quero pedir um orçamento para o meu condomínio.',
      demostracion: 'Olá, testei a demonstração da Expenses e quero solicitar uma demonstração personalizada.',
      planes: 'Olá, testei a demonstração da Expenses e quero saber sobre planos e condições.',
      general: 'Olá, estive explorando a Expenses e quero mais informações.'
    },
    explored: (list: string) => ` Na demo explorei: ${list}.`,
    profile: (units: string, method: string, pain: string) => ` Administro ${units} unidades, hoje controlo as taxas com ${method} e o que mais me preocupa é: ${pain}.`,
    country: (country: string) => ` Minha administração fica em ${country}.`
  },

  shell: {
    backHome: 'Voltar ao início',
    badge: 'Demonstração · dados fictícios',
    resetTitle: 'Apaga o que você fez na demonstração e recomeça',
    reset: 'Reiniciar',
    talk: 'Falar com a Expenses',
    exit: 'Sair',
    contextLine: (city: string, units: number, period: string) => `${city} · ${units} unidades · ${period}`,
    note: 'Nada do que você fizer aqui é salvo nem afeta dados reais.',
    country: 'País',
    countryAria: 'País da demonstração',
    navAria: 'Módulos da demonstração',
    nav: { panel: 'Painel', units: 'Unidades', expenses: 'Despesas', reports: 'Relatórios', journal: 'Livro diário', certificate: 'Certidão de débitos' },
    missionsAria: 'Roteiro guiado',
    missionsTitle: 'Roteiro guiado',
    missionsProgress: (done: number, total: number) => `${done} de ${total} ferramentas descobertas`,
    next: 'Próximo:',
    goNow: 'Ir agora →',
    allDone: 'Roteiro completo! Você já viu como a Expenses ajuda a controlar um edifício.',
    nextStep: 'Próximo passo →',
    footText: 'Gostou do que viu? Podemos adaptar a Expenses à sua administração.',
    footCta: 'Quero isto para o meu edifício',
    keepExploring: 'Continuar explorando',
    finishDone: 'Você completou o roteiro!',
    finishTodo: 'Pronto para administrar o seu próprio edifício?',
    finishLead: 'Você já viu como a Expenses funciona em um ambiente de teste. Conte-nos o seu caso e ajudamos a avaliar como adaptá-la à sua administração.',
    forYou: 'Para você, a Expenses oferece:',
    ctaDemo: 'Solicitar uma demonstração personalizada',
    ctaPlans: 'Consultar planos e condições',
    ctaQuote: 'Pedir orçamento pelo WhatsApp',
    seoTitle: 'Demonstração gratuita da Expenses | Edifício de exemplo',
    seoDescription: 'Explore a Expenses sem cadastro: um edifício de demonstração com unidades, taxas, despesas, relatórios e livro diário, com dados fictícios.'
  },
  panel: {
    title: 'Assim está o edifício hoje',
    sub: 'Clique em um indicador para descobrir de onde vem o valor.',
    whereFrom: (label: string) => `De onde vem «${label}»?`,
    chartTitle: 'Receitas e despesas · últimos 6 meses',
    collectedTip: 'Recebido',
    expensesTip: 'Despesas',
    lastMovements: 'Últimas movimentações',
    seeAll: 'Ver todas no livro diário →',
    alert: (n: number, amount: string) => ({ bold: `${n} unidades`, rest: ` têm dívida vencida de ${amount}. ` }),
    alertLink: 'Ver quem são →',
    kpi: {
      cash: {
        label: 'Caixa e bancos', note: 'Saldo disponível hoje',
        text: 'É o saldo de abertura do mês, mais o recebido dos proprietários, menos as despesas pagas.',
        opening: 'Saldo de abertura do mês', plus: '+ Recebido no mês', minus: '− Despesas pagas no mês', equals: '= Saldo de hoje', link: 'Ver os lançamentos no livro diário'
      },
      collected: {
        label: 'Recebido no mês', note: (rate: string) => `${rate} do valor emitido`,
        text: 'Soma dos pagamentos registrados neste mês contra o emitido na apuração das taxas.',
        issued: 'Emitido na apuração', collectedWith: (n: number) => `Recebido (${n} pagamentos)`, rate: 'Percentual de cobrança', link: 'Conferir as unidades'
      },
      expenses: {
        label: 'Despesas do mês', note: (n: number) => `${n} despesas registradas`,
        text: 'Todas as despesas lançadas neste mês, agrupadas por categoria. Se você registrar uma despesa simulada, este valor muda.',
        link: 'Ir para Despesas'
      },
      morosity: {
        label: 'Inadimplência', note: (a: number, b: number) => `${a} de ${b} unidades`,
        text: 'Unidades com pelo menos uma taxa vencida e não paga, sobre o total de unidades do edifício.',
        withDebt: 'Unidades com dívida vencida', totalUnits: 'Total de unidades', totalDebt: 'Dívida vencida total', link: 'Ver as unidades com dívida'
      },
      pending: {
        label: 'A receber', note: 'Vencido e a vencer',
        text: 'Tudo o que foi emitido e ainda não foi recebido: a dívida vencida mais as taxas do mês que ainda não venceram.',
        overdue: 'Dívida vencida', upcoming: 'A vencer'
      },
      reserve: {
        label: 'Fundo de reserva', note: 'Poupança do edifício',
        text: 'Dinheiro reservado para imprevistos e obras maiores, separado do saldo operacional.',
        balance: 'Saldo do fundo de reserva'
      }
    }
  },
  units: {
    title: 'Unidades e proprietários',
    sub: 'Procure um apartamento e abra o extrato para ver cobranças, pagamentos e saldo.',
    searchPlaceholder: 'Buscar por unidade ou proprietário...',
    searchAria: 'Buscar unidade',
    onlyDebt: 'Somente com dívida vencida',
    count: (shown: number, total: number) => `${shown} de ${total} unidades`,
    cols: { unit: 'Unidade', owner: 'Proprietário', area: 'Área', fee: 'Taxa ordinária', debt: 'Dívida vencida', status: 'Situação' },
    floor: (n: number) => `andar ${n}`,
    owes: (months: number) => `Deve ${months} ${months === 1 ? 'mês' : 'meses'}`,
    upToDate: 'Em dia',
    statementLink: 'Extrato →',
    none: 'Nenhuma unidade corresponde à busca.'
  },
  statement: {
    back: '← Voltar às unidades',
    title: (code: string) => `Extrato · Unidade ${code}`,
    sub: (owner: string, floor: number, metric: string, fee: string) => `${owner} · andar ${floor} · ${metric} · taxa ordinária ${fee}`,
    pending: 'Saldo pendente',
    overdueOf: 'Dos quais vencidos',
    lastPayment: 'Último pagamento',
    status: 'Situação',
    withDebt: 'Com dívida vencida',
    upToDate: 'Em dia',
    pdf: 'Baixar PDF',
    send: 'Enviar ao proprietário',
    movements: 'Movimentações',
    cols: { date: 'Data', concept: 'Descrição', reference: 'Referência', charge: 'Cobrança', payment: 'Pagamento', balance: 'Saldo' },
    overdueBadge: 'Vencido',
    notFoundTitle: 'Unidade não encontrada',
    notFound: 'Essa unidade não existe na demonstração. ',
    backShort: 'Voltar às unidades'
  },
  expenses: {
    title: 'Despesas do edifício',
    sub: 'Registre uma despesa de teste e veja como mudam o painel e o livro diário. Nada é salvo: é apenas uma simulação.',
    formTitle: 'Registrar uma despesa simulada',
    concept: 'Descrição',
    conceptPlaceholder: 'Ex.: Reparo do portão da garagem',
    supplier: 'Fornecedor (opcional)',
    supplierPlaceholder: 'Ex.: Oficina Central',
    category: 'Categoria',
    amount: 'Valor em guaranis (com IVA)',
    amountPlaceholder: 'Ex.: 850000',
    preview: 'Você vai registrar ',
    vatIncluded: (vat: string) => ` · inclui IVA de 10% de ${vat}`,
    submit: 'Registrar despesa simulada',
    errConcept: 'Digite uma descrição para a despesa.',
    errAmount: 'Informe um valor maior que zero.',
    addedTitle: 'Despesa registrada!',
    added: (concept: string, amount: string) => ` «${concept}» no valor de ${amount}. O saldo do caixa diminuiu e o lançamento contábil já foi gerado.`,
    seeEntry: 'Ver o lançamento no livro diário →',
    seePanel: 'Ver o painel →',
    summary: 'Resumo do mês',
    listTitle: (period: string) => `Despesas de ${period}`,
    cols: { date: 'Data', concept: 'Descrição', supplier: 'Fornecedor', category: 'Categoria', amount: 'Valor' },
    simulated: 'Simulada'
  },
  reports: {
    title: 'Relatórios',
    sub: 'O que você precisa para decidir e prestar contas na assembleia. Alterne entre os relatórios pelas abas.',
    tabs: { ingresos: 'Receitas e despesas', morosidad: 'Inadimplência', rubros: 'Despesas por categoria' },
    monthlyTitle: 'Resultado mensal · últimos 6 meses',
    monthlyCols: { month: 'Mês', issued: 'Emitido', collected: 'Recebido', rate: 'Cobrança', expenses: 'Despesas', result: 'Resultado' },
    monthlyNote: 'O resultado do mês atual muda se você registrar despesas simuladas na seção Despesas.',
    unitCount: (n: number) => `${n} ${n === 1 ? 'unidade' : 'unidades'}`,
    overdueTitle: 'Unidades com dívida vencida',
    overdueCols: { unit: 'Unidade', owner: 'Proprietário', months: 'Meses vencidos', debt: 'Dívida vencida' },
    statementLink: 'Extrato →',
    byCategory: (period: string) => `Despesas de ${period} por categoria`,
    more: 'Na versão completa você também tem o ',
    moreBold: 'relatório de assembleia',
    moreRest: ', orçamento contra o realizado, fluxo de caixa e exportação para Excel.',
    learnMore: 'Saiba mais →'
  },
  journal: {
    title: 'Livro diário',
    sub: 'Cada recebimento, despesa e apuração gera o seu lançamento contábil. Abra um para ver as contas e o movimento de origem.',
    filters: { todos: 'Todos', gasto: 'Despesas', cobro: 'Recebimentos', liquidacion: 'Apuração' },
    kinds: { liquidacion: 'Apuração', cobro: 'Recebimento', gasto: 'Despesa' },
    count: (n: number) => `${n} lançamentos`,
    number: 'N.º',
    cols: { account: 'Conta', name: 'Nome', debit: 'Débito', credit: 'Crédito' },
    totals: 'Totais',
    balanced: 'Lançamento balanceado',
    origin: 'Origem:',
    seeMovement: 'Ver o movimento →',
    more: 'A versão completa soma ',
    moreBold: 'livro razão, balanço, livro de compras com IVA e encerramento do exercício',
    moreRest: '. O que já foi lançado não é alterado: os erros se corrigem com um estorno.',
    learnMore: 'Saiba mais →'
  },
  certificate: {
    title: 'Certidão de débitos e créditos',
    sub: 'O documento que a administração entrega a pedido de um interessado (por exemplo, para transferir uma unidade): o devido por período e o saldo credor.',
    pick: 'Unidade',
    statementLink: 'Extrato →',
    issued: (date: string, unit: string, building: string, place: string) => `Na data de emissão (${date}), a administração certifica a situação da unidade ${unit} do ${building}, localizado em ${place}.`,
    owner: 'Proprietário',
    cols: { period: 'Período', due: 'Vencimento', charged: 'Emitido', paid: 'Pago', pending: 'Pendente' },
    total: 'Total devido',
    credit: 'Saldo credor do proprietário na administração',
    noDebt: 'A unidade não tem taxas nem juros pendentes de pagamento na data de emissão.',
    hasDebt: 'A unidade tem taxas e juros pendentes de pagamento no valor indicado.',
    none: 'Sem períodos com saldo pendente.',
    note: 'O saldo credor pertence ao proprietário e pode incluir valores gerados por outras unidades. Esta certidão reflete os registros da administração na data indicada; pagamentos creditados depois não constam.',
    signature: 'Administración Demo S.A.',
    registry: 'Registro nº 1234 (dado de exemplo)',
    pdf: 'Baixar PDF',
    place: 'Assunção'
  },
  lockedPage: {
    badge: 'Disponível na versão completa',
    cta: 'Ver esta função em uma demonstração',
    back: 'Continuar explorando'
  }
};

const EN: DemoTx = {
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  date: dateEnglish,
  decimal: (n: number): string => String(n),
  percent: (n: number | string): string => `${n}%`,

  countries: { py: 'Paraguay', ar: 'Argentina' } as Record<DemoCountry, string>,
  building: { name: 'Torre Mirador Building', city: 'Asunción' },
  defaultSupplier: 'Sample supplier',
  categories: { utilities: 'Utilities', payroll: 'Staff', security: 'Security', maintenance: 'Maintenance', cleaning: 'Cleaning', admin: 'Administration', insurance: 'Insurance', other: 'Other' },
  accountNames: { utilities: 'Utilities', payroll: 'Salaries and social charges', security: 'Security and surveillance', maintenance: 'Maintenance and repairs', cleaning: 'Cleaning', admin: 'Administration fees', insurance: 'Insurance', other: 'Other expenses' },
  accounts: { receivable: 'Fees receivable', ordinaryIncome: 'Ordinary fee income', extraIncome: 'Extraordinary fee income', cash: 'Cash and banks', vat: 'VAT input credit' },
  methods: { transfer: 'Bank transfer', cash: 'Cash', deposit: 'Deposit', card: 'Card' },
  expenseItems: {
    staff: { supplier: 'Building payroll', concept: 'Salaries of the on-site manager and cleaning staff' },
    guard: { supplier: 'Guardián Seguridad S.A.', concept: 'Security guard service' },
    power: { supplier: 'ANDE', concept: 'Electricity for common areas' },
    water: { supplier: 'ESSAP', concept: 'Water and sewage' },
    elevator: { supplier: 'Elevadores del Sur S.A.', concept: 'Monthly elevator maintenance' },
    supplies: { supplier: 'Distribuidora Limpia SRL', concept: 'Cleaning supplies' },
    insurance: { supplier: 'Seguros Integrales Demo S.A.', concept: 'Comprehensive building insurance' },
    adminFee: { supplier: 'Administración Demo S.A.', concept: 'Administration fees' },
    pump: { supplier: 'Hidrosistemas Paraguay', concept: 'Water pump repair' }
  },
  charge: {
    ordinary: (period: string) => `Ordinary fee ${period}`,
    extra: 'Extraordinary fee · facade painting',
    surcharge: (period: string) => `Late charge · ${period}`,
    paymentReceived: (method: string) => `Payment received · ${method}`
  },
  journalText: {
    liquidation: (period: string) => `Fee settlement ${period}`,
    liquidationOrigin: (units: number) => `Period settlement · ${units} units`,
    collection: (unit: string) => `Fee collection · Unit ${unit}`,
    collectionOrigin: (receipt: string, owner: string, method: string) => `Receipt ${receipt} · ${owner} · ${method}`,
    expenseOriginSimulated: 'Expense simulated in this demo',
    expenseOrigin: (category: string) => `Recorded expense · category ${category}`
  },
  movementCollection: (unit: string, owner: string) => `Collection · Unit ${unit} · ${owner}`,
  aging: ['1 month overdue', '2 months overdue', '3 or more months'],
  missions: {
    panel: { title: 'Get to know the building', hint: 'Click any indicator on the dashboard to see where the figure comes from.' },
    unidad: { title: 'Review a unit', hint: 'Look up an apartment with a debt and open its account statement.' },
    gasto: { title: 'Record an expense', hint: 'Enter a simulated expense and see how it affects the building.' },
    informes: { title: 'Discover the reports', hint: 'Switch between the income and expenses, arrears and category reports.' },
    libro: { title: 'Check the accounting control', hint: 'Open a general journal entry and see which movement it comes from.' },
    certificado: { title: 'Issue a debt certificate', hint: 'Pick a unit and see the certificate of debts and credits handed to whoever requests it.' }
  },
  locked: {
    'estado-pdf': { title: 'PDF account statements sent to the owner', text: 'Generate each unit\'s account statement as a PDF and send it by email or through the app, with a single click.' },
    conciliacion: { title: 'Bank reconciliation', text: 'Import the bank statement and reconcile collections and payments against what is recorded in Expenses.' },
    facturacion: { title: 'Invoicing and receipts', text: 'Issue invoices and receipts with your timbrado, with credit notes and a sales ledger.' },
    votaciones: { title: 'Owners\' meeting votes', text: 'Call and record owner votes with results in real time.' },
    app: { title: 'App for owners and on-site managers', text: 'Each owner checks their debt, pays and receives notices from their phone.' },
    mas: { title: 'More Expenses modules', text: 'Announcements, complaints, common-area bookings, budget, reserve fund and more.' }
  },
  lockedNav: { conciliacion: 'Bank reconciliation', facturacion: 'Invoicing', votaciones: 'Votes', app: 'App' },
  diagnosis: {
    units: { title: 'How many units do you manage?', options: [['u30', 'Up to 30'], ['u100', '31 to 100'], ['u300', '101 to 300'], ['u300p', 'More than 300']] },
    method: { title: 'How do you handle fees today?', options: [['excel', 'Excel spreadsheets'], ['software', 'Other software'], ['paper', 'Notebook or paper'], ['accountant', 'My accountant handles it']] },
    pain: { title: 'What takes most of your time or worries you most?', options: [['collections', 'Collections and arrears'], ['expenses', 'Controlling expenses and suppliers'], ['accounting', 'Accounting'], ['assembly', 'Reporting to the owners\' meeting'], ['communication', 'Communicating with owners']] }
  },
  recommendation: {
    collections: 'Fees with automatic late charges, account statements per unit and the arrears report you saw in the demo.',
    expenses: 'Expenses by category, suppliers, accounts payable and supplier credit notes, with the accounting impact instantly.',
    accounting: 'General journal, general ledger, balance sheet and purchases ledger with VAT, ready for your accountant.',
    assembly: 'Owners\' meeting report, budget versus actual and reserve fund, so you can present clear accounts.',
    communication: 'Announcements, complaints, in-app notices and votes, so everyone stays informed.'
  },
  whatsapp: {
    intro: {
      presupuesto: 'Hello, I tried the Expenses demo and I would like to request a quote for my building.',
      demostracion: 'Hello, I tried the Expenses demo and I would like to request a personalized demonstration.',
      planes: 'Hello, I tried the Expenses demo and I would like to ask about plans and conditions.',
      general: 'Hello, I have been exploring Expenses and I would like more information.'
    },
    explored: (list: string) => ` In the demo I explored: ${list}.`,
    profile: (units: string, method: string, pain: string) => ` I manage ${units} units, I currently handle fees with ${method} and what worries me most is: ${pain}.`,
    country: (country: string) => ` My administration is in ${country}.`
  },

  shell: {
    backHome: 'Back to home',
    badge: 'Demo · fictitious data',
    resetTitle: 'Clears what you did in the demo and starts over',
    reset: 'Restart',
    talk: 'Talk to Expenses',
    exit: 'Exit',
    contextLine: (city: string, units: number, period: string) => `${city} · ${units} units · ${period}`,
    note: 'Nothing you do here is saved or affects real data.',
    country: 'Country',
    countryAria: 'Demo country',
    navAria: 'Demo modules',
    nav: { panel: 'Dashboard', units: 'Units', expenses: 'Expenses', reports: 'Reports', journal: 'General journal', certificate: 'Debt certificate' },
    missionsAria: 'Guided tour',
    missionsTitle: 'Guided tour',
    missionsProgress: (done: number, total: number) => `${done} of ${total} tools discovered`,
    next: 'Next:',
    goNow: 'Go now →',
    allDone: 'Tour complete! You have seen how Expenses helps control a building.',
    nextStep: 'Next step →',
    footText: 'Did you like what you saw? We can adapt Expenses to your administration.',
    footCta: 'I want this for my building',
    keepExploring: 'Keep exploring',
    finishDone: 'You completed the tour!',
    finishTodo: 'Ready to manage your own building?',
    finishLead: 'You have seen how Expenses works in a test environment. Tell us about your case and we will help you evaluate how to adapt it to your administration.',
    forYou: 'For you, Expenses offers:',
    ctaDemo: 'Request a personalized demo',
    ctaPlans: 'Ask about plans and conditions',
    ctaQuote: 'Request a quote on WhatsApp',
    seoTitle: 'Free Expenses demo | Sample building',
    seoDescription: 'Explore Expenses without signing up: a demo building with units, fees, expenses, reports and general journal, with fictitious data.'
  },
  panel: {
    title: 'This is how the building stands today',
    sub: 'Click an indicator to find out where the figure comes from.',
    whereFrom: (label: string) => `Where does "${label}" come from?`,
    chartTitle: 'Income and expenses · last 6 months',
    collectedTip: 'Collected',
    expensesTip: 'Expenses',
    lastMovements: 'Latest movements',
    seeAll: 'See all in the general journal →',
    alert: (n: number, amount: string) => ({ bold: `${n} units`, rest: ` have overdue debt of ${amount}. ` }),
    alertLink: 'See who they are →',
    kpi: {
      cash: {
        label: 'Cash and banks', note: 'Balance available today',
        text: 'It is the opening balance of the month, plus what was collected from owners, minus the expenses paid.',
        opening: 'Opening balance of the month', plus: '+ Collected in the month', minus: '− Expenses paid in the month', equals: '= Balance today', link: 'See the entries in the general journal'
      },
      collected: {
        label: 'Collected this month', note: (rate: string) => `${rate} of the amount billed`,
        text: 'Sum of the payments recorded this month against the amount billed in the fee settlement.',
        issued: 'Billed in the settlement', collectedWith: (n: number) => `Collected (${n} payments)`, rate: 'Collection rate', link: 'Review the units'
      },
      expenses: {
        label: 'Expenses this month', note: (n: number) => `${n} expenses recorded`,
        text: 'All the expenses entered this month, grouped by category. If you record a simulated expense, this figure changes.',
        link: 'Go to Expenses'
      },
      morosity: {
        label: 'Arrears', note: (a: number, b: number) => `${a} of ${b} units`,
        text: 'Units with at least one overdue, unpaid fee, out of the building\'s total units.',
        withDebt: 'Units with overdue debt', totalUnits: 'Total units', totalDebt: 'Total overdue debt', link: 'See the units with debt'
      },
      pending: {
        label: 'Pending collection', note: 'Overdue and upcoming',
        text: 'Everything billed that has not been collected yet: the overdue debt plus the month\'s fees that are not yet due.',
        overdue: 'Overdue debt', upcoming: 'Not yet due'
      },
      reserve: {
        label: 'Reserve fund', note: 'Building savings',
        text: 'Money set aside for unforeseen events and major works, separate from the operating balance.',
        balance: 'Reserve fund balance'
      }
    }
  },
  units: {
    title: 'Units and owners',
    sub: 'Look up an apartment and open its account statement to see charges, payments and balance.',
    searchPlaceholder: 'Search by unit or owner...',
    searchAria: 'Search unit',
    onlyDebt: 'Only with overdue debt',
    count: (shown: number, total: number) => `${shown} of ${total} units`,
    cols: { unit: 'Unit', owner: 'Owner', area: 'Area', fee: 'Ordinary fee', debt: 'Overdue debt', status: 'Status' },
    floor: (n: number) => `floor ${n}`,
    owes: (months: number) => `Owes ${months} ${months === 1 ? 'month' : 'months'}`,
    upToDate: 'Up to date',
    statementLink: 'Account statement →',
    none: 'No unit matches the search.'
  },
  statement: {
    back: '← Back to units',
    title: (code: string) => `Account statement · Unit ${code}`,
    sub: (owner: string, floor: number, metric: string, fee: string) => `${owner} · floor ${floor} · ${metric} · ordinary fee ${fee}`,
    pending: 'Balance due',
    overdueOf: 'Of which overdue',
    lastPayment: 'Last payment',
    status: 'Status',
    withDebt: 'With overdue debt',
    upToDate: 'Up to date',
    pdf: 'Download PDF',
    send: 'Send to the owner',
    movements: 'Movements',
    cols: { date: 'Date', concept: 'Description', reference: 'Reference', charge: 'Charge', payment: 'Payment', balance: 'Balance' },
    overdueBadge: 'Overdue',
    notFoundTitle: 'Unit not found',
    notFound: 'That unit does not exist in the demo. ',
    backShort: 'Back to units'
  },
  expenses: {
    title: 'Building expenses',
    sub: 'Record a test expense and see how the dashboard and the general journal change. Nothing is saved: it is only a simulation.',
    formTitle: 'Record a simulated expense',
    concept: 'Description',
    conceptPlaceholder: 'E.g.: Garage gate repair',
    supplier: 'Supplier (optional)',
    supplierPlaceholder: 'E.g.: Central Workshop',
    category: 'Category',
    amount: 'Amount in Guaraníes (VAT included)',
    amountPlaceholder: 'E.g.: 850000',
    preview: 'You are about to record ',
    vatIncluded: (vat: string) => ` · includes 10% VAT of ${vat}`,
    submit: 'Record simulated expense',
    errConcept: 'Enter a description for the expense.',
    errAmount: 'Enter an amount greater than zero.',
    addedTitle: 'Expense recorded!',
    added: (concept: string, amount: string) => ` "${concept}" for ${amount}. The cash balance went down and the accounting entry has been generated.`,
    seeEntry: 'See the entry in the general journal →',
    seePanel: 'See the dashboard →',
    summary: 'Month summary',
    listTitle: (period: string) => `Expenses of ${period}`,
    cols: { date: 'Date', concept: 'Description', supplier: 'Supplier', category: 'Category', amount: 'Amount' },
    simulated: 'Simulated'
  },
  reports: {
    title: 'Reports',
    sub: 'What you need to decide and to report to the owners\' meeting. Switch reports with the tabs.',
    tabs: { ingresos: 'Income and expenses', morosidad: 'Arrears', rubros: 'Expenses by category' },
    monthlyTitle: 'Monthly result · last 6 months',
    monthlyCols: { month: 'Month', issued: 'Billed', collected: 'Collected', rate: 'Collection', expenses: 'Expenses', result: 'Result' },
    monthlyNote: 'The current month\'s result changes if you record simulated expenses in the Expenses section.',
    unitCount: (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`,
    overdueTitle: 'Units with overdue debt',
    overdueCols: { unit: 'Unit', owner: 'Owner', months: 'Months overdue', debt: 'Overdue debt' },
    statementLink: 'Account statement →',
    byCategory: (period: string) => `Expenses of ${period} by category`,
    more: 'The full version also gives you the ',
    moreBold: 'owners\' meeting report',
    moreRest: ', budget versus actual, cash flow and Excel export.',
    learnMore: 'Learn more →'
  },
  journal: {
    title: 'General journal',
    sub: 'Every collection, expense and settlement generates its accounting entry. Open one to see the accounts and the originating movement.',
    filters: { todos: 'All', gasto: 'Expenses', cobro: 'Collections', liquidacion: 'Settlement' },
    kinds: { liquidacion: 'Settlement', cobro: 'Collection', gasto: 'Expense' },
    count: (n: number) => `${n} entries`,
    number: 'No.',
    cols: { account: 'Account', name: 'Name', debit: 'Debit', credit: 'Credit' },
    totals: 'Totals',
    balanced: 'Balanced entry',
    origin: 'Origin:',
    seeMovement: 'See the movement →',
    more: 'The full version adds ',
    moreBold: 'general ledger, balance sheet, purchases ledger with VAT and year-end closing',
    moreRest: '. What has already been posted is not edited: errors are corrected with a reversing entry.',
    learnMore: 'Learn more →'
  },
  certificate: {
    title: 'Certificate of debts and credits',
    sub: 'The document the administration hands out at the request of an interested party (for example, to transfer a unit): what is owed per period and the credit balance.',
    pick: 'Unit',
    statementLink: 'Account statement →',
    issued: (date: string, unit: string, building: string, place: string) => `As of the issue date (${date}), the administration certifies the account status of unit ${unit} of ${building}, located in ${place}.`,
    owner: 'Owner',
    cols: { period: 'Period', due: 'Due date', charged: 'Issued', paid: 'Paid', pending: 'Pending' },
    total: 'Total owed',
    credit: 'Owner credit balance with the administration',
    noDebt: 'The unit has no fees or interest pending payment as of the issue date.',
    hasDebt: 'The unit has fees and interest pending payment for the amount shown.',
    none: 'No periods with a pending balance.',
    note: 'The credit balance belongs to the owner and may include amounts generated by other units. This certificate reflects the administration\'s records as of the date shown; payments credited afterwards are not included.',
    signature: 'Administración Demo S.A.',
    registry: 'Registry No. 1234 (sample data)',
    pdf: 'Download PDF',
    place: 'Asunción'
  },
  lockedPage: {
    badge: 'Available in the full version',
    cta: 'See this feature in a demo',
    back: 'Keep exploring'
  }
};

export const DEMO_TX: Dict<DemoTx> = { es: ES, pt: PT, en: EN };

// ─── Argentina ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Versión Argentina de la demostración: parte de los textos base de cada idioma y reemplaza solo lo que cambia (consorcio de la CABA, pesos,
// expensas, unidad funcional, porcentual, intereses por mora; sin IVA, RUC, timbrado, facturas ni libro diario). Son datos ficticios y no
// afirman cumplimiento legal: las reglas (vencimientos, intereses, mayorías) se configuran por consorcio.

type DeepPartial<T> = T extends (...args: never[]) => unknown ? T : T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

function mergeTx<T>(base: T, patch: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = out[key];
    const plain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
    out[key] = plain(value) && plain(current) ? mergeTx(current, value as DeepPartial<typeof current>) : value;
  }
  return out as T;
}

const AR_ES: DeepPartial<DemoTx> = {
  building: { name: 'Consorcio Rivadavia 1450', city: 'CABA' },
  expenseItems: {
    staff: { supplier: 'Nómina del consorcio', concept: 'Sueldo y cargas sociales del encargado' },
    power: { supplier: 'Empresa de energía', concept: 'Luz de áreas comunes' },
    water: { supplier: 'Servicio de agua y cloacas', concept: 'Agua y cloacas' },
    elevator: { supplier: 'Ascensores del Plata S.A.', concept: 'Mantenimiento mensual de ascensores' },
    supplies: { supplier: 'Distribuidora Limpia S.R.L.', concept: 'Insumos de limpieza' },
    insurance: { supplier: 'Seguros Integrales Demo S.A.', concept: 'Seguro integral del consorcio' },
    adminFee: { supplier: 'Administración Demo S.A.', concept: 'Honorarios de administración' },
    pump: { supplier: 'Hidráulica Demo S.R.L.', concept: 'Reparación de bomba de agua' }
  },
  charge: {
    extra: 'Expensa extraordinaria · impermeabilización de la terraza',
    surcharge: (period: string) => `Intereses por mora (3 % mensual) · ${period}`
  },
  missions: {
    panel: { title: 'Conocé el consorcio', hint: 'Tocá cualquier indicador del panel para ver de dónde sale la cifra.' },
    unidad: { title: 'Revisá una unidad funcional', hint: 'Buscá una unidad con deuda y abrí su estado de cuenta.' },
    gasto: { title: 'Registrá un gasto', hint: 'Cargá un gasto común simulado y mirá cómo impacta en el consorcio.' },
    informes: { title: 'Descubrí los informes', hint: 'Cambiá entre los informes de ingresos y gastos, morosidad y rubros.' },
    certificado: { title: 'Generá un certificado de deudas', hint: 'Elegí una unidad funcional y mirá el certificado de deudas y créditos que se entrega a quien lo pide.' }
  },
  locked: {
    'estado-pdf': { title: 'Estados de cuenta y certificados en PDF', text: 'Generá el estado de cuenta o el certificado de deudas de cada unidad funcional en PDF y enviáselo al propietario por correo o por la app.' },
    conciliacion: { text: 'Importá el extracto del banco y conciliá cobros y pagos contra lo registrado en Expenses.' },
    votaciones: { title: 'Votaciones de propietarios', text: 'Convocá y registrá votaciones con mayoría absoluta sobre el total de unidades y de porcentual. En la app son consultas informativas: no reemplazan el acta de la asamblea.' }
  },
  diagnosis: {
    units: { title: '¿Cuántas unidades funcionales administrás?', options: [['u30', 'Hasta 30'], ['u100', '31 a 100'], ['u300', '101 a 300'], ['u300p', 'Más de 300']] },
    method: { title: '¿Cómo llevás hoy las expensas?', options: [['excel', 'Planillas de Excel'], ['software', 'Otro software'], ['paper', 'Cuaderno o papel'], ['accountant', 'Lo lleva mi estudio contable']] },
    pain: { title: '¿Qué te quita más tiempo o te preocupa más?', options: [['collections', 'Cobrar y la morosidad'], ['expenses', 'Controlar gastos y proveedores'], ['accounting', 'La liquidación de expensas'], ['assembly', 'Rendir cuentas en la asamblea'], ['communication', 'Comunicarme con los propietarios']] }
  },
  recommendation: {
    collections: 'Intereses por mora mensuales configurables, estados de cuenta por unidad funcional y el informe de morosidad que viste en la demo.',
    expenses: 'Gastos comunes por rubro, proveedores y cuentas por pagar, con el impacto en las expensas al instante.',
    accounting: 'Liquidación de expensas, certificados de deudas y la información ordenada para tu contador.',
    assembly: 'Informe para la asamblea, presupuesto contra lo real y fondo de reserva, para rendir cuentas claras.',
    communication: 'Comunicados, reclamos, avisos en la app y consultas a los propietarios, para que todos estén informados.'
  },
  whatsapp: {
    intro: {
      presupuesto: 'Hola, probé la demostración de Expenses y quiero pedir un presupuesto para mi consorcio.',
      demostracion: 'Hola, probé la demostración de Expenses y quiero solicitar una demostración personalizada.',
      planes: 'Hola, probé la demostración de Expenses y quiero consultar planes y condiciones.',
      general: 'Hola, estuve explorando Expenses y quiero más información.'
    },
    profile: (units: string, method: string, pain: string) => ` Administro ${units} unidades funcionales, hoy llevo las expensas con ${method} y lo que más me preocupa es: ${pain}.`
  },
  shell: {
    note: 'Datos ficticios. Las reglas (vencimientos, intereses, mayorías) se configuran por consorcio.',
    contextLine: (city: string, units: number, period: string) => `${city} · ${units} unidades funcionales · ${period}`,
    nav: { units: 'Unidades funcionales' },
    allDone: '¡Recorrido completo! Ya viste cómo Expenses ayuda a controlar un consorcio.',
    footCta: 'Quiero esto para mi consorcio',
    finishTodo: '¿Listo para administrar tu propio consorcio?',
    finishLead: 'Ya viste cómo funciona Expenses en un entorno de prueba. Contanos tu caso y te ayudamos a evaluar cómo adaptarlo a tu administración.',
    seoTitle: 'Demostración gratuita de Expenses | Consorcio de ejemplo',
    seoDescription: 'Explorá Expenses sin registrarte: un consorcio de demostración con unidades funcionales, expensas, gastos, informes y certificado de deudas, con datos ficticios.'
  },
  panel: {
    title: 'Así está el consorcio hoy',
    sub: 'Tocá un indicador para descubrir de dónde sale la cifra.',
    seeAll: 'Ver el resultado mensual en Informes →',
    alert: (n: number, amount: string) => ({ bold: `${n} unidades funcionales`, rest: ` tienen deuda vencida por ${amount}. ` }),
    kpi: {
      cash: { text: 'Es el saldo de apertura del mes, más lo cobrado a los propietarios, menos los gastos comunes pagados.', link: 'Ver el resultado mensual' },
      collected: { text: 'Suma de los pagos registrados este mes contra lo emitido en la liquidación de expensas.' },
      morosity: { text: 'Unidades funcionales con al menos una expensa vencida y sin pagar, sobre el total del consorcio.', withDebt: 'Unidades funcionales con deuda vencida', totalUnits: 'Total de unidades funcionales' },
      pending: { text: 'Todo lo emitido que todavía no se cobró: la deuda vencida (con intereses) más las expensas del mes que aún no vencen.' }
    }
  },
  units: {
    title: 'Unidades funcionales y propietarios',
    sub: 'Buscá una unidad funcional y abrí su estado de cuenta para ver cargos, pagos y saldo.',
    count: (shown: number, total: number) => `${shown} de ${total} unidades funcionales`,
    cols: { unit: 'Unidad funcional', area: 'Porcentual', fee: 'Expensa ordinaria' }
  },
  statement: {
    title: (code: string) => `Estado de cuenta · UF ${code}`,
    sub: (owner: string, floor: number, metric: string, fee: string) => `${owner} · piso ${floor} · porcentual ${metric} · expensa ordinaria ${fee}`,
    pdf: 'Descargar PDF'
  },
  expenses: {
    title: 'Gastos comunes del consorcio',
    sub: 'Registrá un gasto común de prueba y mirá cómo cambia el panel y los informes. No se guarda: es solo una simulación.',
    amount: 'Importe en pesos',
    amountPlaceholder: 'Ej.: 85000',
    errConcept: 'Escribí un concepto para el gasto.',
    errAmount: 'Ingresá un importe mayor que cero.',
    added: (concept: string, amount: string) => ` «${concept}» por ${amount}. El saldo de caja bajó y el gasto ya figura en el panel y en los informes.`,
    seeEntry: 'Ver el impacto en Informes →'
  },
  reports: {
    sub: 'Lo que necesitás para decidir y para rendir cuentas en la asamblea. Cambiá de informe con las pestañas.',
    monthlyNote: 'El resultado del mes actual cambia si registrás gastos simulados en la sección Gastos.',
    unitCount: (n: number) => `${n} ${n === 1 ? 'unidad funcional' : 'unidades funcionales'}`,
    more: 'En la versión completa también tenés el ',
    moreBold: 'informe para la asamblea',
    moreRest: ', presupuesto contra lo real, flujo de caja y exportación a Excel.'
  },
  certificate: {
    pick: 'Unidad funcional',
    issued: (date: string, unit: string, building: string, place: string) => `A la fecha de emisión (${date}), la administración certifica el estado de cuenta de la unidad funcional ${unit} del ${building}, ubicado en ${place}.`,
    noDebt: 'La unidad funcional no registra expensas ni intereses pendientes de pago a la fecha de emisión.',
    hasDebt: 'La unidad funcional registra expensas e intereses pendientes de pago por el importe indicado.',
    place: 'Ciudad Autónoma de Buenos Aires'
  }
};

const AR_PT: DeepPartial<DemoTx> = {
  building: { name: 'Condomínio Rivadavia 1450', city: 'CABA' },
  expenseItems: {
    staff: { supplier: 'Folha do condomínio', concept: 'Salário e encargos do zelador' },
    power: { supplier: 'Empresa de energia', concept: 'Luz das áreas comuns' },
    water: { supplier: 'Serviço de água e esgoto', concept: 'Água e esgoto' },
    elevator: { supplier: 'Ascensores del Plata S.A.', concept: 'Manutenção mensal dos elevadores' },
    supplies: { supplier: 'Distribuidora Limpia S.R.L.', concept: 'Material de limpeza' },
    insurance: { supplier: 'Seguros Integrales Demo S.A.', concept: 'Seguro integral do condomínio' },
    adminFee: { supplier: 'Administración Demo S.A.', concept: 'Honorários de administração' },
    pump: { supplier: 'Hidráulica Demo S.R.L.', concept: 'Reparo da bomba d’água' }
  },
  charge: {
    extra: 'Taxa extraordinária · impermeabilização do terraço',
    surcharge: (period: string) => `Juros por atraso (3% ao mês) · ${period}`
  },
  missions: {
    panel: { title: 'Conheça o condomínio', hint: 'Clique em qualquer indicador do painel para ver de onde vem o valor.' },
    unidad: { title: 'Confira uma unidade funcional', hint: 'Procure uma unidade com dívida e abra o extrato.' },
    gasto: { title: 'Registre uma despesa', hint: 'Lance uma despesa comum simulada e veja como ela impacta o condomínio.' }
  },
  locked: {
    'estado-pdf': { title: 'Extratos e certidões em PDF', text: 'Gere o extrato ou a certidão de débitos de cada unidade funcional em PDF e envie ao proprietário por e-mail ou pelo app.' },
    votaciones: { title: 'Votações de proprietários', text: 'Convoque e registre votações com maioria absoluta sobre o total de unidades e de percentual. No app são consultas informativas: não substituem a ata da assembleia.' }
  },
  diagnosis: {
    units: { title: 'Quantas unidades funcionais você administra?', options: [['u30', 'Até 30'], ['u100', '31 a 100'], ['u300', '101 a 300'], ['u300p', 'Mais de 300']] },
    method: { title: 'Como você controla as taxas hoje?', options: [['excel', 'Planilhas de Excel'], ['software', 'Outro software'], ['paper', 'Caderno ou papel'], ['accountant', 'Meu escritório contábil cuida']] }
  },
  recommendation: {
    collections: 'Juros por atraso mensais configuráveis, extratos por unidade funcional e o relatório de inadimplência que você viu na demo.',
    expenses: 'Despesas comuns por categoria, fornecedores e contas a pagar, com o impacto nas taxas na hora.',
    accounting: 'Apuração das taxas, certidões de débitos e a informação organizada para o seu contador.',
    assembly: 'Relatório para a assembleia, orçamento contra o realizado e fundo de reserva, para apresentar contas claras.'
  },
  whatsapp: {
    intro: {
      presupuesto: 'Olá, testei a demonstração da Expenses e quero pedir um orçamento para o meu condomínio.'
    },
    profile: (units: string, method: string, pain: string) => ` Administro ${units} unidades funcionais, hoje controlo as taxas com ${method} e o que mais me preocupa é: ${pain}.`
  },
  shell: {
    note: 'Dados fictícios. As regras (vencimentos, juros, maiorias) são configuradas por condomínio.',
    contextLine: (city: string, units: number, period: string) => `${city} · ${units} unidades funcionais · ${period}`,
    nav: { units: 'Unidades funcionais' },
    footCta: 'Quero isto para o meu condomínio',
    finishTodo: 'Pronto para administrar o seu próprio condomínio?',
    seoTitle: 'Demonstração gratuita da Expenses | Condomínio de exemplo',
    seoDescription: 'Explore a Expenses sem cadastro: um condomínio de demonstração com unidades funcionais, taxas, despesas, relatórios e certidão de débitos, com dados fictícios.'
  },
  panel: {
    title: 'Assim está o condomínio hoje',
    seeAll: 'Ver o resultado mensal em Relatórios →',
    alert: (n: number, amount: string) => ({ bold: `${n} unidades funcionais`, rest: ` têm dívida vencida de ${amount}. ` }),
    kpi: {
      cash: { link: 'Ver o resultado mensal' },
      morosity: { withDebt: 'Unidades funcionais com dívida vencida', totalUnits: 'Total de unidades funcionais' }
    }
  },
  units: {
    title: 'Unidades funcionais e proprietários',
    sub: 'Procure uma unidade funcional e abra o extrato para ver cobranças, pagamentos e saldo.',
    count: (shown: number, total: number) => `${shown} de ${total} unidades funcionais`,
    cols: { unit: 'Unidade funcional', area: 'Percentual', fee: 'Taxa ordinária' }
  },
  statement: {
    title: (code: string) => `Extrato · UF ${code}`,
    sub: (owner: string, floor: number, metric: string, fee: string) => `${owner} · andar ${floor} · percentual ${metric} · taxa ordinária ${fee}`
  },
  expenses: {
    title: 'Despesas comuns do condomínio',
    sub: 'Registre uma despesa comum de teste e veja como mudam o painel e os relatórios. Nada é salvo: é apenas uma simulação.',
    amount: 'Valor em pesos',
    amountPlaceholder: 'Ex.: 85000',
    added: (concept: string, amount: string) => ` «${concept}» de ${amount}. O saldo do caixa diminuiu e a despesa já aparece no painel e nos relatórios.`,
    seeEntry: 'Ver o impacto nos Relatórios →'
  },
  reports: {
    unitCount: (n: number) => `${n} ${n === 1 ? 'unidade funcional' : 'unidades funcionais'}`,
    more: 'Na versão completa você também tem o ',
    moreBold: 'relatório para a assembleia',
    moreRest: ', orçamento contra o realizado, fluxo de caixa e exportação para Excel.'
  },
  certificate: {
    pick: 'Unidade funcional',
    issued: (date: string, unit: string, building: string, place: string) => `Na data de emissão (${date}), a administração certifica a situação da unidade funcional ${unit} do ${building}, localizado em ${place}.`,
    noDebt: 'A unidade funcional não tem taxas nem juros pendentes de pagamento na data de emissão.',
    hasDebt: 'A unidade funcional tem taxas e juros pendentes de pagamento no valor indicado.',
    place: 'Cidade Autônoma de Buenos Aires'
  }
};

const AR_EN: DeepPartial<DemoTx> = {
  building: { name: 'Rivadavia 1450 Condominium', city: 'CABA' },
  expenseItems: {
    staff: { supplier: 'Condominium payroll', concept: 'Salary and social charges of the on-site manager' },
    power: { supplier: 'Electricity company', concept: 'Electricity for common areas' },
    water: { supplier: 'Water and sewage service', concept: 'Water and sewage' },
    elevator: { supplier: 'Ascensores del Plata S.A.', concept: 'Monthly elevator maintenance' },
    supplies: { supplier: 'Distribuidora Limpia S.R.L.', concept: 'Cleaning supplies' },
    insurance: { supplier: 'Seguros Integrales Demo S.A.', concept: 'Comprehensive condominium insurance' },
    adminFee: { supplier: 'Administración Demo S.A.', concept: 'Administration fees' },
    pump: { supplier: 'Hidráulica Demo S.R.L.', concept: 'Water pump repair' }
  },
  charge: {
    extra: 'Extraordinary fee · terrace waterproofing',
    surcharge: (period: string) => `Late interest (3% per month) · ${period}`
  },
  missions: {
    panel: { title: 'Get to know the condominium', hint: 'Click any indicator on the dashboard to see where the figure comes from.' },
    unidad: { title: 'Review a functional unit', hint: 'Look up a unit with a debt and open its account statement.' },
    gasto: { title: 'Record an expense', hint: 'Enter a simulated common expense and see how it affects the condominium.' }
  },
  locked: {
    'estado-pdf': { title: 'PDF account statements and certificates', text: 'Generate the account statement or the debt certificate of each functional unit as a PDF and send it to the owner by email or through the app.' },
    votaciones: { title: 'Owner votes', text: 'Call and record votes with an absolute majority over the total of units and of ownership share. In the app they are informative polls: they do not replace the meeting minutes.' }
  },
  diagnosis: {
    units: { title: 'How many functional units do you manage?', options: [['u30', 'Up to 30'], ['u100', '31 to 100'], ['u300', '101 to 300'], ['u300p', 'More than 300']] },
    method: { title: 'How do you handle expenses today?', options: [['excel', 'Excel spreadsheets'], ['software', 'Other software'], ['paper', 'Notebook or paper'], ['accountant', 'My accounting firm handles it']] }
  },
  recommendation: {
    collections: 'Configurable monthly late interest, account statements per functional unit and the arrears report you saw in the demo.',
    expenses: 'Common expenses by category, suppliers and accounts payable, with the impact on the monthly expenses instantly.',
    accounting: 'Monthly expense settlement, debt certificates and the information organized for your accountant.',
    assembly: 'Meeting report, budget versus actual and reserve fund, so you can present clear accounts.'
  },
  whatsapp: {
    intro: {
      presupuesto: 'Hello, I tried the Expenses demo and I would like to request a quote for my condominium.'
    },
    profile: (units: string, method: string, pain: string) => ` I manage ${units} functional units, I currently handle expenses with ${method} and what worries me most is: ${pain}.`
  },
  shell: {
    note: 'Fictitious data. The rules (due dates, interest, majorities) are configured per condominium.',
    contextLine: (city: string, units: number, period: string) => `${city} · ${units} functional units · ${period}`,
    nav: { units: 'Functional units' },
    footCta: 'I want this for my condominium',
    finishTodo: 'Ready to manage your own condominium?',
    seoTitle: 'Free Expenses demo | Sample condominium',
    seoDescription: 'Explore Expenses without signing up: a demo condominium with functional units, expenses, reports and a debt certificate, with fictitious data.'
  },
  panel: {
    title: 'This is the condominium today',
    seeAll: 'See the monthly result in Reports →',
    alert: (n: number, amount: string) => ({ bold: `${n} functional units`, rest: ` have overdue debt of ${amount}. ` }),
    kpi: {
      cash: { link: 'See the monthly result' },
      morosity: { withDebt: 'Functional units with overdue debt', totalUnits: 'Total functional units' }
    }
  },
  units: {
    title: 'Functional units and owners',
    sub: 'Look up a functional unit and open its account statement to see charges, payments and balance.',
    count: (shown: number, total: number) => `${shown} of ${total} functional units`,
    cols: { unit: 'Functional unit', area: 'Share', fee: 'Ordinary expense' }
  },
  statement: {
    title: (code: string) => `Account statement · FU ${code}`,
    sub: (owner: string, floor: number, metric: string, fee: string) => `${owner} · floor ${floor} · share ${metric} · ordinary expense ${fee}`
  },
  expenses: {
    title: 'Common expenses of the condominium',
    sub: 'Record a test common expense and see how the dashboard and the reports change. Nothing is saved: it is only a simulation.',
    amount: 'Amount in pesos',
    amountPlaceholder: 'E.g.: 85000',
    added: (concept: string, amount: string) => ` “${concept}” for ${amount}. The cash balance went down and the expense already shows on the dashboard and in the reports.`,
    seeEntry: 'See the impact in Reports →'
  },
  reports: {
    unitCount: (n: number) => `${n} ${n === 1 ? 'functional unit' : 'functional units'}`,
    more: 'The full version also includes the ',
    moreBold: 'owners\' meeting report',
    moreRest: ', budget versus actual, cash flow and Excel export.'
  },
  certificate: {
    pick: 'Functional unit',
    issued: (date: string, unit: string, building: string, place: string) => `As of the issue date (${date}), the administration certifies the account status of functional unit ${unit} of ${building}, located in ${place}.`,
    noDebt: 'The functional unit has no expenses or interest pending payment as of the issue date.',
    hasDebt: 'The functional unit has expenses and interest pending payment for the amount shown.',
    place: 'Autonomous City of Buenos Aires'
  }
};

// Textos de la versión Argentina en los tres idiomas (ver el bloque de arriba).
export const DEMO_TX_AR: Dict<DemoTx> = { es: mergeTx(ES, AR_ES), pt: mergeTx(PT, AR_PT), en: mergeTx(EN, AR_EN) };


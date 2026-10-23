// Embudo de la demostración (medición simple en el navegador, sin enviar nada a un servidor):
// 1 visita la web → 2 inicia la demo → 3 descubre funciones → 4 identifica su necesidad → 5 pide contacto.

export type DemoFunnelEvent = 'portal_visit' | 'demo_start' | 'mission_complete' | 'demo_complete' | 'diagnosis_done' | 'contact_click' | 'locked_click' | 'demo_reset';

const EVENTS_KEY = 'expenses-demo-events';
const ANON_KEY = 'expenses-demo-anon';

function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function trackDemoEvent(event: DemoFunnelEvent, detail?: string): void {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const list: { t: number; e: string; d?: string; a: string }[] = raw ? JSON.parse(raw) : [];
    list.push({ t: Date.now(), e: event, d: detail, a: anonId() });
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list.slice(-100)));
  } catch {
    // Sin almacenamiento disponible: la demostración funciona igual.
  }
}

// Una sola visita de portada por pestaña.
export function trackPortalVisitOnce(): void {
  try {
    if (sessionStorage.getItem('expenses-portal-visit')) return;
    sessionStorage.setItem('expenses-portal-visit', '1');
  } catch {
    // Si no hay sessionStorage se cuenta igual.
  }
  trackDemoEvent('portal_visit');
}

export interface DemoDiagnosisQuestion {
  key: 'units' | 'method' | 'pain';
  title: string;
  options: string[];
}

// Paso 4 del embudo: tres preguntas para entender qué necesita la persona.
export const DEMO_DIAGNOSIS: DemoDiagnosisQuestion[] = [
  { key: 'units', title: '¿Cuántas unidades administras?', options: ['Hasta 30', '31 a 100', '101 a 300', 'Más de 300'] },
  { key: 'method', title: '¿Cómo llevas hoy las expensas?', options: ['Planillas de Excel', 'Otro software', 'Cuaderno o papel', 'Lo lleva mi contador'] },
  { key: 'pain', title: '¿Qué te quita más tiempo o te preocupa más?', options: ['Cobrar y la morosidad', 'Controlar gastos y proveedores', 'La contabilidad', 'Rendir cuentas en la asamblea', 'Comunicarme con propietarios'] }
];

export type DemoDiagnosisAnswers = Partial<Record<'units' | 'method' | 'pain', string>>;

// Qué le mostraría Expenses a cada perfil según su mayor preocupación.
export const DEMO_PAIN_RECOMMENDATION: Record<string, string> = {
  'Cobrar y la morosidad': 'Expensas con recargo por mora automático, estados de cuenta por unidad y el informe de morosidad que viste en la demo.',
  'Controlar gastos y proveedores': 'Gastos por rubro, proveedores, cuentas por pagar y la nota de crédito de proveedor, con el impacto contable al instante.',
  'La contabilidad': 'Libro diario, libro mayor, balance y libro de compras con IVA, listos para tu contador.',
  'Rendir cuentas en la asamblea': 'Informe de asamblea, presupuesto contra lo real y fondo de reserva, para presentar cuentas claras.',
  'Comunicarme con propietarios': 'Comunicados, reclamos, avisos en la app y votaciones, para que todos estén informados.'
};

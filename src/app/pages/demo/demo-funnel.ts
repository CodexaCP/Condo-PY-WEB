import { gaEvent } from '../../core/analytics';

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
  // Además del registro local, el contacto y los pasos del embudo van a Google Analytics (la visita de portada ya la cuenta page_view).
  if (event === 'contact_click') gaEvent('generate_lead', { method: 'whatsapp_demo', contact_type: detail ?? '' });
  else if (event !== 'portal_visit') gaEvent(event, detail ? { detail } : undefined);
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

// Paso 4 del embudo: tres preguntas para entender qué necesita la persona. Los textos de las preguntas y sus opciones
// están en demo.i18n.ts; aquí solo se guardan los identificadores de lo que eligió.
export type DemoDiagnosisAnswers = Partial<Record<'units' | 'method' | 'pain', string>>;

import { trackDemoEvent } from './demo-funnel';

type Call = unknown[];

// El contacto de la demostración va a Google como whatsapp_click (un clic) y nunca como generate_lead; los demás pasos del embudo siguen igual.
describe('trackDemoEvent', () => {
  let calls: Call[];
  let previousLang: string;

  beforeEach(() => {
    calls = [];
    (globalThis as { gtag?: (...args: unknown[]) => void }).gtag = (...args: unknown[]) => calls.push(args);
    previousLang = document.documentElement.lang;
    document.documentElement.lang = 'es';
    localStorage.removeItem('expenses-demo-events');
  });

  afterEach(() => {
    delete (globalThis as { gtag?: unknown }).gtag;
    document.documentElement.lang = previousLang;
    localStorage.removeItem('expenses-demo-events');
  });

  const localEvents = (): { e: string; d?: string }[] => JSON.parse(localStorage.getItem('expenses-demo-events') ?? '[]');

  it('contact_click con «botón · país» envía whatsapp_click con placement demo, contact_type y country', () => {
    trackDemoEvent('contact_click', 'demostracion · ar');

    expect(calls).toEqual([['event', 'whatsapp_click', { placement: 'demo', language: 'es', country: 'ar', contact_type: 'demostracion' }]]);
  });

  it('cada botón de contacto conserva su tipo', () => {
    trackDemoEvent('contact_click', 'planes · py');
    trackDemoEvent('contact_click', 'presupuesto · py');

    expect(calls.map((c) => (c[2] as Record<string, unknown>)['contact_type'])).toEqual(['planes', 'presupuesto']);
  });

  it('toma el idioma de la página', () => {
    document.documentElement.lang = 'pt';

    trackDemoEvent('contact_click', 'planes · py');

    expect((calls[0][2] as Record<string, unknown>)['language']).toBe('pt');
  });

  it('si el detalle trae solo el botón, no inventa país', () => {
    trackDemoEvent('contact_click', 'planes');

    const params = calls[0][2] as Record<string, unknown>;
    expect(params['contact_type']).toBe('planes');
    expect('country' in params).toBeFalse();
  });

  it('nunca envía generate_lead desde el contacto de la demo', () => {
    trackDemoEvent('contact_click', 'demostracion · py');
    trackDemoEvent('contact_click', 'planes · ar');
    trackDemoEvent('contact_click', 'presupuesto · py');

    expect(calls.map((c) => c[1])).toEqual(['whatsapp_click', 'whatsapp_click', 'whatsapp_click']);
  });

  it('el registro local conserva el nombre contact_click', () => {
    trackDemoEvent('contact_click', 'planes · py');

    expect(localEvents().map((x) => x.e)).toEqual(['contact_click']);
    expect(localEvents()[0].d).toBe('planes · py');
  });

  it('los demás eventos del embudo se envían igual que antes', () => {
    trackDemoEvent('demo_start', 'py');
    trackDemoEvent('mission_complete', 'panel · py');
    trackDemoEvent('diagnosis_done', 'a | b | c · ar');
    trackDemoEvent('locked_click', 'facturacion · py');
    trackDemoEvent('country_change', 'ar');
    trackDemoEvent('demo_reset', 'py');

    expect(calls).toEqual([
      ['event', 'demo_start', { detail: 'py' }],
      ['event', 'mission_complete', { detail: 'panel · py' }],
      ['event', 'diagnosis_done', { detail: 'a | b | c · ar' }],
      ['event', 'locked_click', { detail: 'facturacion · py' }],
      ['event', 'country_change', { detail: 'ar' }],
      ['event', 'demo_reset', { detail: 'py' }]
    ]);
  });

  it('portal_visit sigue sin enviarse a Google (solo queda en el registro local)', () => {
    trackDemoEvent('portal_visit');

    expect(calls).toEqual([]);
    expect(localEvents().map((x) => x.e)).toEqual(['portal_visit']);
  });
});

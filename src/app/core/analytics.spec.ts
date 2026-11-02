import { gaEvent, trackWhatsAppClick } from './analytics';

type Call = unknown[];

// Pruebas del clic en WhatsApp: se envía whatsapp_click con sus parámetros y nunca generate_lead.
describe('trackWhatsAppClick', () => {
  let calls: Call[];
  let previousLang: string;

  beforeEach(() => {
    calls = [];
    (globalThis as { gtag?: (...args: unknown[]) => void }).gtag = (...args: unknown[]) => calls.push(args);
    previousLang = document.documentElement.lang;
  });

  afterEach(() => {
    delete (globalThis as { gtag?: unknown }).gtag;
    document.documentElement.lang = previousLang;
  });

  const names = (): unknown[] => calls.map((c) => c[1]);

  it('portada: envía whatsapp_click con placement landing y el idioma', () => {
    trackWhatsAppClick({ placement: 'landing', language: 'pt' });

    expect(calls).toEqual([['event', 'whatsapp_click', { placement: 'landing', language: 'pt' }]]);
  });

  it('login: envía whatsapp_click con placement login y el idioma', () => {
    trackWhatsAppClick({ placement: 'login', language: 'en' });

    expect(calls).toEqual([['event', 'whatsapp_click', { placement: 'login', language: 'en' }]]);
  });

  it('demo: envía país y tipo de contacto cuando los hay', () => {
    trackWhatsAppClick({ placement: 'demo', language: 'es', country: 'ar', contactType: 'presupuesto' });

    expect(calls).toEqual([['event', 'whatsapp_click', { placement: 'demo', language: 'es', country: 'ar', contact_type: 'presupuesto' }]]);
  });

  it('no manda country ni contact_type cuando no corresponden', () => {
    trackWhatsAppClick({ placement: 'landing', language: 'es' });

    const params = calls[0][2] as Record<string, unknown>;
    expect('country' in params).toBeFalse();
    expect('contact_type' in params).toBeFalse();
  });

  it('sin idioma explícito usa el de la página', () => {
    document.documentElement.lang = 'pt';

    trackWhatsAppClick({ placement: 'demo' });

    expect((calls[0][2] as Record<string, unknown>)['language']).toBe('pt');
  });

  it('nunca envía generate_lead ni otro evento: solo whatsapp_click', () => {
    trackWhatsAppClick({ placement: 'landing', language: 'es' });
    trackWhatsAppClick({ placement: 'login', language: 'es' });
    trackWhatsAppClick({ placement: 'demo', language: 'es', country: 'py', contactType: 'planes' });

    expect(names()).toEqual(['whatsapp_click', 'whatsapp_click', 'whatsapp_click']);
    expect(names()).not.toContain('generate_lead');
  });

  it('no rompe la página si gtag no existe (bloqueado o prerenderizado)', () => {
    delete (globalThis as { gtag?: unknown }).gtag;

    expect(() => trackWhatsAppClick({ placement: 'landing', language: 'es' })).not.toThrow();
  });

  it('gaEvent sigue enviando los demás eventos tal cual', () => {
    gaEvent('demo_click', { language: 'es' });

    expect(calls).toEqual([['event', 'demo_click', { language: 'es' }]]);
  });
});

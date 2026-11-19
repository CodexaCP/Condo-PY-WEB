// Eventos de conversión hacia Google Analytics (gtag se carga en index.html). No hace nada en el prerenderizado ni si gtag está bloqueado.
export function gaEvent(name: string, params?: Record<string, string | number>): void {
  try {
    const g = (globalThis as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof g === 'function') g('event', name, params ?? {});
  } catch {
    // La medición nunca debe romper la página.
  }
}

// Desde dónde se tocó un enlace de WhatsApp.
export type WhatsAppPlacement = 'landing' | 'login' | 'demo';

export interface WhatsAppClickInfo {
  placement: WhatsAppPlacement;
  // Idioma del sitio. Si no se indica se toma el de la página (atributo lang del <html>).
  language?: string;
  // País de la demostración («py» o «ar»). Solo la demostración lo tiene.
  country?: string;
  // Qué botón de contacto se tocó (en la demostración: demostracion, planes, presupuesto; en la portada: hero, morosidad, expensas, admin, app, promo, general, flotante).
  contactType?: string;
}

function pageLanguage(): string {
  try {
    return (document.documentElement.lang || 'es').slice(0, 2).toLowerCase();
  } catch {
    return 'es';
  }
}

// Un clic en un enlace de WhatsApp. Es un clic y nada más: no se sabe si la persona llegó a escribir, así que NO se envía generate_lead
// (ese evento queda reservado para un contacto real y verificable).
export function trackWhatsAppClick(info: WhatsAppClickInfo): void {
  const params: Record<string, string | number> = { placement: info.placement, language: info.language ?? pageLanguage() };
  if (info.country) params['country'] = info.country;
  if (info.contactType) params['contact_type'] = info.contactType;
  gaEvent('whatsapp_click', params);
}

// Asistente animado (personaje con preguntas). Solo se envían el tema, el idioma y el lugar: nunca texto escrito por la persona.
export type AssistantEvent = 'assistant_open' | 'assistant_question' | 'assistant_complete' | 'assistant_exit';

export function trackAssistant(event: AssistantEvent, params: { placement: 'landing' | 'demo'; topic?: string; source?: 'chip' | 'texto'; step?: number }): void {
  const p: Record<string, string | number> = { placement: params.placement, language: pageLanguage() };
  if (params.topic) p['topic'] = params.topic;
  if (params.source) p['source'] = params.source;
  if (params.step !== undefined) p['step'] = params.step;
  gaEvent(event, p);
}

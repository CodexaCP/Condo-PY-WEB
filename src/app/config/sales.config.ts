import type { Lang } from '../core/i18n/lang.service';

// Contacto de ventas que ven los visitantes antes de iniciar sesión (botón flotante de WhatsApp en la pantalla de login).
export const SALES_CONTACT = {
  // WhatsApp con código de país y sin signos ni espacios. Vacío = el botón no se muestra.
  whatsapp: '595986645450',
  // Mensaje que llega escrito al abrir el chat; el visitante puede editarlo antes de enviarlo.
  message: 'Hola, vi la página de Expenses y quiero pedir una cotización para mi edificio. ¿Me pueden contactar?'
};

// El mismo mensaje en el idioma que el visitante está usando en el sitio.
const SALES_MESSAGES: Record<Lang, string> = {
  es: SALES_CONTACT.message,
  pt: 'Olá, vi a página da Expenses e quero pedir um orçamento para o meu condomínio. Podem entrar em contato?',
  en: 'Hello, I saw the Expenses page and I would like to request a quote for my building. Could you contact me?'
};

// Igual que salesWhatsAppUrl, pero con un mensaje propio (la demostración manda qué módulos exploró el visitante).
export function salesWhatsAppUrlFor(message: string): string | null {
  const phone = SALES_CONTACT.whatsapp.replace(/\D/g, '');
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
}

export function salesWhatsAppUrl(lang: Lang = 'es'): string | null {
  return salesWhatsAppUrlFor(SALES_MESSAGES[lang]);
}

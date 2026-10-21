// Contacto de ventas que ven los visitantes antes de iniciar sesión (botón flotante de WhatsApp en la pantalla de login).
export const SALES_CONTACT = {
  // WhatsApp con código de país y sin signos ni espacios. Vacío = el botón no se muestra.
  whatsapp: '595986645450',
  // Mensaje que llega escrito al abrir el chat; el visitante puede editarlo antes de enviarlo.
  message: 'Hola, vi la página de Expenses y quiero pedir una cotización para mi edificio. ¿Me pueden contactar?'
};

export function salesWhatsAppUrl(): string | null {
  const phone = SALES_CONTACT.whatsapp.replace(/\D/g, '');
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(SALES_CONTACT.message)}` : null;
}

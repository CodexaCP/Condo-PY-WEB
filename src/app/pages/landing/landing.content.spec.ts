import { LANDING_EN, LANDING_ES, LANDING_PT, WaSource, buildWhatsAppMessage } from './landing.content';

// Pruebas del mensaje de WhatsApp de la portada: mensaje base comercial + línea del tema según el botón.
describe('buildWhatsAppMessage', () => {
  it('incluye el mensaje base y la línea del tema en el origen promo', () => {
    const msg = buildWhatsAppMessage(LANDING_ES, 'promo');
    expect(msg).toContain('2 meses gratis');
    expect(msg).toContain('___ edificio(s)');
    expect(msg).toContain('coordinar una demostración');
    expect(msg).toContain('Quiero activar mis 2 meses gratis.');
  });

  it('el origen general no lleva línea de tema', () => {
    const t = LANDING_ES;
    expect(buildWhatsAppMessage(t, 'general')).toBe(t.wa.intro + '\n\n' + t.wa.buildings + '\n\n' + t.wa.demo);
  });

  for (const [name, t] of [['ES', LANDING_ES], ['PT', LANDING_PT], ['EN', LANDING_EN]] as const) {
    it(`cada origen tiene etiqueta y mensaje con ___ (${name})`, () => {
      for (const source of Object.keys(t.wa.topics) as WaSource[]) {
        expect(t.wa.topics[source].label).not.toBe('');
        expect(buildWhatsAppMessage(t, source)).toContain('___');
      }
    });
  }
});

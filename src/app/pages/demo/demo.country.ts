// País de la demostración pública («Explora Expenses»). La demo no depende del login: el país se elige con el selector de la
// cabecera (o con ?pais=ar) y cambia los datos de ejemplo, la moneda y el vocabulario. Paraguay es la demo de siempre.

export type DemoCountry = 'py' | 'ar';

export const DEMO_COUNTRIES: DemoCountry[] = ['py', 'ar'];

export const isDemoCountry = (v: unknown): v is DemoCountry => v === 'py' || v === 'ar';

const COUNTRY_KEY = 'expenses-demo-country';

// Orden de preferencia: ?pais= de la dirección → lo que la persona eligió en esta pestaña → navegador en español de Argentina → Paraguay.
export function detectDemoCountry(): DemoCountry {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('pais')?.toLowerCase();
    if (isDemoCountry(fromUrl)) return fromUrl;
  } catch {
    // Sin ventana (prerenderizado): se sigue con Paraguay.
  }
  try {
    const saved = sessionStorage.getItem(COUNTRY_KEY);
    if (isDemoCountry(saved)) return saved;
  } catch {
    // Sin almacenamiento de sesión: no se recuerda.
  }
  try {
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    if (list.some((l) => (l ?? '').toLowerCase() === 'es-ar')) return 'ar';
  } catch {
    // Sin navegador: Paraguay.
  }
  return 'py';
}

export function rememberDemoCountry(country: DemoCountry): void {
  try {
    sessionStorage.setItem(COUNTRY_KEY, country);
  } catch {
    // La elección dura mientras la página siga abierta.
  }
}

// Número con puntos de miles y, si la moneda los tiene, dos decimales con coma: «1.234.567» o «1.234,50».
function groupNumber(value: number, decimals: number): string {
  const abs = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = abs.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 && Number(abs) !== 0 ? '-' : '';
  return sign + grouped + (fraction ? ',' + fraction : '');
}

// Importe en la moneda del país de la demo: guaraníes sin decimales («Gs. 1.234.567») o pesos con dos decimales («$ 1.234,50»).
export function formatDemoMoney(country: DemoCountry, value: number): string {
  return country === 'ar' ? `$ ${groupNumber(value, 2)}` : `Gs. ${groupNumber(value, 0)}`;
}

import { API_BASE_URL } from '../config/api.config';

// El backend devuelve las URLs de /api/uploads como ruta relativa (/uploads/archivo.jpg) para no
// atarlas al dominio del momento en que se subieron. Las URLs absolutas ya guardadas antes de ese
// cambio se respetan tal cual.
export function resolveUploadUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function isPdfUrl(url: string | null | undefined): boolean {
  return !!url && /\.pdf(\?|$)/i.test(url);
}

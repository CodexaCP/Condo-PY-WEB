// Eventos de conversión hacia Google Analytics (gtag se carga en index.html). No hace nada en el prerenderizado ni si gtag está bloqueado.
export function gaEvent(name: string, params?: Record<string, string | number>): void {
  try {
    const g = (globalThis as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof g === 'function') g('event', name, params ?? {});
  } catch {
    // La medición nunca debe romper la página.
  }
}

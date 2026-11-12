import { RenderMode, ServerRoute } from '@angular/ssr';

// Se prerenderiza el inicio (HTML listo para Google) y las páginas legales en borrador, para que su «noindex» ya venga escrito
// en el HTML. El resto del sistema sigue funcionando en el navegador como hasta ahora.
export const serverRoutes: ServerRoute[] = [
    { path: '', renderMode: RenderMode.Prerender },
    { path: 'pt', renderMode: RenderMode.Prerender },
    { path: 'en', renderMode: RenderMode.Prerender },
    { path: 'privacidad', renderMode: RenderMode.Prerender },
    { path: 'terminos', renderMode: RenderMode.Prerender },
    { path: '**', renderMode: RenderMode.Client }
];

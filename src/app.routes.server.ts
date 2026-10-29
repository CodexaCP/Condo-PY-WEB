import { RenderMode, ServerRoute } from '@angular/ssr';

// Solo el inicio se prerenderiza (HTML listo para Google). El resto del sistema sigue funcionando en el navegador como hasta ahora.
export const serverRoutes: ServerRoute[] = [
    { path: '', renderMode: RenderMode.Prerender },
    { path: 'pt', renderMode: RenderMode.Prerender },
    { path: '**', renderMode: RenderMode.Client }
];

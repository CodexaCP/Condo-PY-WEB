import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { AppComponent } from './app.component';

// index.html marca el <html> con «no-prerender» en toda ruta que no sea la portada y oculta lo que hay dentro de <app-root>, para que la
// portada prerenderizada no parpadee antes de que Angular arranque. Cuando Angular termina de arrancar ya reemplazó ese contenido por el
// suyo: la marca se quita aquí, o la aplicación entera quedaría oculta (página en blanco al abrir /login, /explorar o recargar).
// Si el arranque falla también se quita: es mejor mostrar lo que haya (y el error en la consola) que dejar la página en blanco.
const revealApp = (): void => document.documentElement.classList.remove('no-prerender');

bootstrapApplication(AppComponent, appConfig)
  .then(revealApp)
  .catch((err) => {
    console.error(err);
    revealApp();
  });

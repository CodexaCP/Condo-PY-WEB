import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { config } from './app.config.server';

// Arranque para el prerenderizado: genera el HTML de las rutas indicadas en app.routes.server.ts al compilar.
const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, config, context);

export default bootstrap;

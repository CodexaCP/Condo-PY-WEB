import { Component } from '@angular/core';
import { Card } from 'primeng/card';

// Soporte (SuperAdmin): el espacio queda reservado en el menú hasta armar sus opciones internas.
@Component({
  standalone: true,
  selector: 'app-support-page',
  imports: [Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Soporte</h1>
          <p>Estamos preparando esta sección: consultas, incidencias y ayuda para las empresas administradoras.</p>
        </div>
      </div>
      <p class="app-state">Próximamente.</p>
    </p-card>
  `
})
export class SupportPageComponent {}

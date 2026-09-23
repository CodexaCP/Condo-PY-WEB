import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Card } from 'primeng/card';

interface Tutorial {
  title: string;
  description: string;
  url: string;
  icon: string;
}

// Lista fija a mano: cada tutorial es un video (Drive u otro link) con titulo y descripcion breve.
// Para agregar uno nuevo, sumar un item aca — no hace falta backend ni CRUD.
const TUTORIALS: Tutorial[] = [
  {
    title: 'Crear un Periodo de Expensas para todos mis edificios',
    description: '¿Administras varios edificios? Esto te va a ahorrar tiempo. Con CONDO-PY, puedes crear el período de expensas de todos tus edificios en una sola operación. Sin repetir el mismo proceso edificio por edificio. Una sola acción, todos tus edificios listos. Una función pensada para simplificar la gestión, reducir tareas repetitivas y aprovechar mejor tu tiempo.',
    url: 'https://drive.google.com/file/d/1_YQ9IK03KU36wVfkFDQmJZCdHDSqJrRW/view?usp=sharing',
    icon: 'pi pi-calendar-plus'
  },
  {
    title: 'Plantillas recurrentes',
    description: 'Crea una vez y úsala todas las veces que necesites. En CONDO-PY puedes crear plantillas de gastos independientes del edificio y del período. Luego, reutilízalas sin límites, aplicándolas al edificio y período que necesites. Menos carga manual, menos errores y más velocidad en la gestión de expensas.',
    url: 'https://drive.google.com/file/d/1aPovgo3ywA-NvLgQopz7s67yfvQOKGgm/view?usp=sharing',
    icon: 'pi pi-calendar-plus'
  },
  {
    title: 'Clonar al mes siguiente',
    description: '¿Por qué volver a cargar lo que ya tienes creado? Con CONDO-PY, puedes clonar un período publicado al mes siguiente con un solo clic. Se copia el período con todos sus gastos, ahorrándote el trabajo de cargar todo nuevamente. Y tienes el control: puedes editar cada gasto individualmente, eliminar lo que ya no corresponda y agregar nuevos gastos. Clona, ajusta y publica. Así de simple.',
    url: 'https://drive.google.com/file/d/12VznPRLZV4P63tb_YFzadYIeEhtqVkHR/view?usp=sharing',
    icon: 'pi pi-calendar-plus'
  }
];

@Component({
  standalone: true,
  selector: 'app-tutorials-page',
  imports: [CommonModule, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Tutoriales</h1>
          <p>Videos guía para administrar el sistema.</p>
        </div>
      </div>

      <p class="empty-state" *ngIf="tutorials.length === 0">Todavía no hay tutoriales cargados.</p>

      <div class="tutorial-grid" *ngIf="tutorials.length > 0">
        <a class="tutorial-card" *ngFor="let t of tutorials" [href]="t.url" target="_blank" rel="noopener">
          <div class="tutorial-icon"><i [class]="t.icon"></i></div>
          <div class="tutorial-body">
            <strong>{{ t.title }}</strong>
            <p>{{ t.description }}</p>
          </div>
        </a>
      </div>
    </p-card>
  `,
  styles: [`
    .empty-state { color: var(--brand-muted); padding: 1rem 0; }
    .tutorial-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .tutorial-card {
      display: flex;
      gap: 0.85rem;
      padding: 1rem;
      border: 1.5px solid rgba(19,133,182,0.18);
      border-radius: 14px;
      background: #fff;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    }
    .tutorial-card:hover {
      border-color: var(--brand-blue);
      box-shadow: 0 4px 14px rgba(19,133,182,0.15);
      transform: translateY(-1px);
    }
    .tutorial-icon {
      flex-shrink: 0;
      width: 42px; height: 42px;
      border-radius: 10px;
      background: rgba(19,133,182,0.1);
      color: var(--brand-blue);
      display: grid; place-items: center;
      font-size: 1.2rem;
    }
    .tutorial-body strong { display: block; color: var(--brand-ink); margin-bottom: 0.25rem; }
    .tutorial-body p { margin: 0; font-size: 0.85rem; color: var(--brand-muted); line-height: 1.4; }
  `]
})
export class TutorialsPageComponent {
  readonly tutorials = TUTORIALS;
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { FinanceErrorKind } from './finance-format';

// Mensajes de estado comunes a las pantallas de Finanzas: cargando, sin edificios habilitados, modulo apagado,
// configuracion inicial incompleta (con enlace a Configuracion) y errores.
@Component({
  standalone: true,
  selector: 'app-finance-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, Message],
  template: `
    <p class="app-state" *ngIf="loading">Cargando...</p>
    <p-message *ngIf="noBuilding" severity="warn" text="El módulo Finanzas del edificio no está habilitado en ninguno de tus edificios."></p-message>
    <p-message *ngIf="kind === 'blocked'" severity="warn" [text]="message"></p-message>
    <ng-container *ngIf="kind === 'setup'">
      <p-message severity="info" [text]="message"></p-message>
      <p class="setup-link"><a [routerLink]="['/finance/settings']" [queryParams]="{ buildingId: buildingId }">Ir a Configuración</a></p>
    </ng-container>
    <p-message *ngIf="kind === 'other' && message" severity="error" [text]="message"></p-message>
  `,
  styles: [`.setup-link { margin: 0.75rem 0 0; font-weight: 600; }`]
})
export class FinanceStateComponent {
  @Input() loading = false;
  @Input() noBuilding = false;
  @Input() kind: FinanceErrorKind | '' = '';
  @Input() message = '';
  @Input() buildingId = '';
}

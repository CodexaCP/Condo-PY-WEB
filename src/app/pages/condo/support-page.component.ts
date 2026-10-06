import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Card } from 'primeng/card';
import { SUPPORT_CONTACT } from '../../config/support.config';

// Soporte para los clientes (administradores de empresa, operadores y encargados): canales de contacto.
@Component({
  standalone: true,
  selector: 'app-support-page',
  imports: [CommonModule, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Soporte</h1>
          <p>¿Necesitás ayuda con CONDOPY? Estos son nuestros canales de contacto.</p>
        </div>
      </div>

      <div class="support-grid">
        <a *ngIf="contact.email" class="support-card" [href]="'mailto:' + contact.email">
          <div class="support-icon"><i class="pi pi-envelope"></i></div>
          <div>
            <strong>Escribinos por correo</strong>
            <span>{{ contact.email }}</span>
          </div>
          <i class="pi pi-angle-right support-go"></i>
        </a>

        <a *ngIf="contact.whatsapp" class="support-card" [href]="'https://wa.me/' + contact.whatsapp" target="_blank" rel="noopener">
          <div class="support-icon"><i class="pi pi-whatsapp"></i></div>
          <div>
            <strong>WhatsApp</strong>
            <span>Hablá con el equipo de soporte.</span>
          </div>
          <i class="pi pi-angle-right support-go"></i>
        </a>
      </div>

      <p class="support-hours" *ngIf="contact.hours"><i class="pi pi-clock"></i> {{ contact.hours }}</p>
      <p class="support-hours" *ngIf="!contact.email && !contact.whatsapp">
        <i class="pi pi-info-circle"></i> Pronto vas a poder comunicarte con soporte desde esta sección.
      </p>
    </p-card>
  `,
  styles: [`
    .support-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; margin-top: 1.25rem; }
    .support-card {
      display: grid; grid-template-columns: auto 1fr auto; gap: 0.9rem; align-items: center;
      padding: 1rem 1.1rem; border-radius: 16px; text-decoration: none; color: inherit;
      border: 1px solid rgba(19,133,182,0.12); background: rgba(255,255,255,0.8);
      transition: box-shadow 0.18s, transform 0.15s;
    }
    .support-card:hover { box-shadow: 0 10px 28px rgba(17,54,74,0.12); transform: translateY(-2px); }
    .support-icon {
      width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center;
      color: #fff; font-size: 1.2rem; background: var(--brand-gradient); box-shadow: 0 6px 16px rgba(19,133,182,0.28);
    }
    .support-card strong { display: block; color: var(--brand-ink); font-size: 0.98rem; }
    .support-card span { display: block; color: var(--brand-muted); font-size: 0.84rem; margin-top: 0.15rem; }
    .support-go { color: var(--brand-muted); }
    .support-hours { display: flex; align-items: center; gap: 0.5rem; margin: 1.25rem 0 0; color: var(--brand-muted); font-size: 0.88rem; }
  `]
})
export class SupportPageComponent {
  readonly contact = SUPPORT_CONTACT;
}

import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { OwnersApiService } from '../../api/owners-api.service';
import { Owner } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-propietarios-page',
  imports: [CommonModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Propietarios</h1>
            <p>Fichas de propietarios para asignación a unidades.</p>
          </div>
        </div>
        <p-button label="Nuevo propietario" icon="pi pi-user-plus" (onClick)="goToCreate()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando propietarios...</p>
      <p class="app-state" *ngIf="!loading && !items.length && !pageError">No hay propietarios registrados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header grid-prop">
          <span>Nombre</span>
          <span>Usuario</span>
          <span>Correo</span>
          <span>Teléfono</span>
          <span>Estado</span>
        </div>
        <div class="app-row grid-prop" *ngFor="let item of items">
          <button class="row-link" (click)="goToEdit(item.id)">
            {{ item.fullName || (item.firstName + ' ' + item.lastName) }}
          </button>
          <span class="username-col">{{ item.username }}</span>
          <span>{{ item.email }}</span>
          <span class="phone-col">
            {{ item.phonePrefix && item.phone ? (item.phonePrefix + ' ' + item.phone) : (item.phone || '—') }}
          </span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'"
                 [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .grid-prop { grid-template-columns: 1.2fr 0.9fr 1.3fr 0.9fr 0.6fr; }
    .username-col { font-family: monospace; font-size: 0.88rem; color: var(--brand-muted); }
    .phone-col    { font-size: 0.9rem; color: var(--brand-muted); }
    .row-link {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left;
      text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }
  `]
})
export class PropietariosPageComponent implements OnInit {
  private readonly api        = inject(OwnersApiService);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr        = inject(ChangeDetectorRef);

  items:    Owner[] = [];
  loading   = true;
  pageError = '';

  ngOnInit(): void {
    this.api.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: owners => {
          this.items   = owners.sort((a, b) =>
            (a.fullName || a.firstName).localeCompare(b.fullName || b.firstName));
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pageError = 'No se pudieron cargar los propietarios.';
          this.loading   = false;
          this.cdr.markForCheck();
        }
      });
  }

  goToCreate(): void { this.router.navigate(['/propietarios/create']); }
  goToEdit(id: string): void { this.router.navigate(['/propietarios', id]); }
}

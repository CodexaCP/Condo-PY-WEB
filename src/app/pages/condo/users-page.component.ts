import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { UsersApiService } from '../../api/users-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { Company, ManagedUser } from '../../api/models';
import { AuthService } from '../../auth/auth.service';
import { roleLabel } from '../../auth/role-labels';

@Component({
  standalone: true,
  selector: 'app-users-page',
  imports: [CommonModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Usuarios</h1>
            <p>Alta y edición de usuarios con acceso por alcance.</p>
          </div>
        </div>
        <p-button label="Nuevo usuario" icon="pi pi-user-plus" (onClick)="goToCreate()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando usuarios...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay usuarios registrados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header" [ngClass]="gridClass">
          <span *ngIf="isSuperAdmin">Empresa</span>
          <span>Nombre</span>
          <span>Usuario</span>
          <span>Correo</span>
          <span>Rol</span>
          <span>Estado</span>
        </div>
        <div class="app-row" [ngClass]="gridClass" *ngFor="let item of items">
          <span *ngIf="isSuperAdmin" class="company-col">{{ companyName(item.companyId) }}</span>
          <button class="row-link" (click)="goToEdit(item.id)">
            {{ item.fullName || (item.firstName + ' ' + item.lastName) }}
          </button>
          <span class="username-col">{{ item.username }}</span>
          <span>{{ item.email }}</span>
          <span>{{ roleLabel(item.role) }}</span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'"
                 [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .grid-sa { grid-template-columns: 0.8fr 1fr 0.9fr 1.2fr 0.9fr 0.6fr; }
    .grid-nm { grid-template-columns: 1fr 0.9fr 1.2fr 0.9fr 0.6fr; }
    .company-col  { color: var(--brand-blue); font-weight: 600; font-size: 0.87rem; }
    .username-col { font-family: monospace; font-size: 0.88rem; color: var(--brand-muted); }
    .row-link {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left;
      text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }
  `]
})
export class UsersPageComponent implements OnInit {
  private readonly api          = inject(UsersApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth         = inject(AuthService);
  private readonly router       = inject(Router);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly cdr          = inject(ChangeDetectorRef);

  items:     ManagedUser[] = [];
  companies: Company[]     = [];
  loading   = true;
  pageError = '';
  readonly roleLabel = roleLabel;

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }
  get gridClass(): string     { return this.isSuperAdmin ? 'grid-sa' : 'grid-nm'; }

  companyName(id: string | null): string {
    if (!id) return '—';
    return this.companies.find(c => c.id === id)?.name ?? id;
  }

  ngOnInit(): void {
    forkJoin({
      users:     this.api.getAll(),
      companies: this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[])
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ users, companies }) => {
        this.items     = users.sort((a, b) =>
          (a.fullName || a.firstName).localeCompare(b.fullName || b.firstName));
        this.companies = companies;
        this.loading   = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageError = 'No se pudieron cargar los usuarios.';
        this.loading   = false;
        this.cdr.markForCheck();
      }
    });
  }

  goToCreate(): void { this.router.navigate(['/users/create']); }
  goToEdit(id: string): void { this.router.navigate(['/users', id]); }
}

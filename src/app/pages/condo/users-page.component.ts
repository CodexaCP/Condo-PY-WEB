import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, of, Subject, switchMap, tap } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { UsersApiService } from '../../api/users-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { Company, ManagedUser, UserPage } from '../../api/models';
import { AuthService } from '../../auth/auth.service';
import { roleLabel } from '../../auth/role-labels';
import { LIST_FILTERS_STYLES } from './list-filters.styles';
import { ListPagerComponent } from './list-pager.component';
import { loadListState, saveListState } from './list-state.util';

interface UserFilters {
  search: string;
  // 'staff' = personal (sin propietarios ni residentes), '' = todos, o el nombre exacto de un rol.
  role: string;
  status: '' | 'active' | 'inactive';
  companyId: string;
  pageSize: number;
}

const DEFAULT_FILTERS: UserFilters = { search: '', role: 'staff', status: '', companyId: '', pageSize: 25 };

@Component({
  standalone: true,
  selector: 'app-users-page',
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Message, Tag, ListPagerComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>{{ onlyAdmins ? 'Administradores' : 'Usuarios' }}</h1>
            <p *ngIf="!onlyAdmins">Alta y edición de usuarios con acceso por alcance. Los propietarios y residentes se ven en su pestaña o en sus propias pantallas.</p>
            <p *ngIf="onlyAdmins">Administradores generales de las empresas. <a routerLink="/users">Ver todos los usuarios</a></p>
          </div>
        </div>
        <p-button label="Nuevo usuario" icon="pi pi-user-plus" (onClick)="goToCreate()"></p-button>
      </div>

      <!-- Búsqueda y filtros -->
      <div class="filters-bar">
        <div class="field-block search-field">
          <span>Buscar</span>
          <div class="search-box">
            <span class="pi pi-search"></span>
            <input type="text" [ngModel]="filters.search" (ngModelChange)="onSearchInput($event)" name="search"
                   placeholder="Nombre, usuario, correo o teléfono" autocomplete="off" />
            <button type="button" class="search-clear" *ngIf="filters.search" (click)="clearSearch()" aria-label="Borrar búsqueda"><i class="pi pi-times"></i></button>
          </div>
        </div>
        <div class="field-block" *ngIf="isSuperAdmin">
          <span>Empresa</span>
          <select [ngModel]="filters.companyId" (ngModelChange)="onCompanyChange($event)" name="company">
            <option value="">Todas las empresas</option>
            <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="field-block" *ngIf="!onlyAdmins">
          <span>Rol</span>
          <select [ngModel]="filters.role" (ngModelChange)="setRole($event)" name="role">
            <option value="staff">Personal (sin propietarios ni residentes)</option>
            <option *ngFor="let r of roleOptions" [value]="r">{{ roleLabel(r) }}</option>
            <option value="">Todos</option>
          </select>
        </div>
        <div class="field-block">
          <span>Estado</span>
          <select [ngModel]="filters.status" (ngModelChange)="setStatus($event)" name="status">
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" size="small"
                  (onClick)="resetFilters()" [disabled]="!hasFilters"></p-button>
      </div>

      <!-- Grupos con su cantidad: atajo para pasar de personal a propietarios o residentes -->
      <div class="chip-row" *ngIf="page && !onlyAdmins">
        <span class="chip-label">Ver</span>
        <button type="button" class="chip-btn" [class.active]="filters.role === 'staff'" (click)="setRole('staff')">Personal <strong>{{ page.counts.staff }}</strong></button>
        <button type="button" class="chip-btn" [class.active]="filters.role === 'Owner'" (click)="setRole('Owner')">Propietarios <strong>{{ page.counts.owners }}</strong></button>
        <button type="button" class="chip-btn" [class.active]="filters.role === 'Resident'" (click)="setRole('Resident')">Residentes <strong>{{ page.counts.residents }}</strong></button>
        <button type="button" class="chip-btn" [class.active]="filters.role === ''" (click)="setRole('')">Todos <strong>{{ page.counts.all }}</strong></button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading && !page">Cargando usuarios...</p>
      <p class="app-state" *ngIf="page && !page.items.length && !pageError">
        {{ hasFilters ? 'Ningún usuario coincide con la búsqueda o los filtros.' : (onlyAdmins ? 'No hay administradores registrados.' : 'No hay usuarios registrados.') }}
      </p>

      <div class="app-list" *ngIf="page && page.items.length" [class.is-loading]="loading">
        <div class="app-row header" [ngClass]="gridClass">
          <span *ngIf="isSuperAdmin">Empresa</span>
          <span>Nombre</span>
          <span>Usuario</span>
          <span>Correo</span>
          <span>Rol</span>
          <span>Estado</span>
        </div>
        <div class="app-row" [ngClass]="gridClass" *ngFor="let item of page.items; trackBy: trackUser">
          <span *ngIf="isSuperAdmin" class="company-col">{{ companyName(item.companyId) }}</span>
          <button class="row-link" (click)="goToEdit(item)">
            {{ item.fullName || (item.firstName + ' ' + item.lastName) }}
          </button>
          <span class="username-col">{{ item.username }}</span>
          <span>{{ item.email }}</span>
          <span>{{ roleLabel(item.role) }}</span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'"
                 [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>

      <app-list-pager *ngIf="page" [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount"
                      (pageChange)="goToPage($event)" (pageSizeChange)="setPageSize($event)"></app-list-pager>
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
    ${LIST_FILTERS_STYLES}
  `]
})
export class UsersPageComponent implements OnInit {
  private readonly api          = inject(UsersApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth         = inject(AuthService);
  private readonly router       = inject(Router);
  private readonly route        = inject(ActivatedRoute);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly cdr          = inject(ChangeDetectorRef);

  page:      UserPage | null = null;
  companies: Company[]       = [];
  filters:   UserFilters     = { ...DEFAULT_FILTERS };
  loading   = true;
  pageError = '';
  readonly roleLabel = roleLabel;

  // ?role=CompanyAdmin (desde el menu "Administradores" del SuperAdmin): solo los administradores de empresa.
  onlyAdmins = false;

  private pageNumber = 1;
  private appliedSearch = '';
  private readonly reload$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }
  get gridClass(): string     { return this.isSuperAdmin ? 'grid-sa' : 'grid-nm'; }

  // Roles que se pueden elegir de a uno (el SuperAdmin solo lo ve otro SuperAdmin).
  get roleOptions(): string[] {
    const roles = ['CompanyAdmin', 'CompanyOperator', 'BuildingManager', 'Porter', 'Owner', 'Resident'];
    return this.isSuperAdmin ? ['SuperAdmin', ...roles] : roles;
  }

  // Lo que no es el valor de fábrica cuenta como filtro activo (el rol fijo de "Administradores" no).
  get hasFilters(): boolean {
    return !!(this.filters.search || this.filters.status || this.filters.companyId
      || (!this.onlyAdmins && this.filters.role !== DEFAULT_FILTERS.role));
  }

  trackUser = (_: number, u: ManagedUser): string => u.id;

  companyName(id: string | null): string {
    if (!id) return '—';
    return this.companies.find(c => c.id === id)?.name ?? id;
  }

  private get stateKey(): string { return this.onlyAdmins ? 'users-admins' : 'users'; }

  ngOnInit(): void {
    this.reload$.pipe(
      tap(() => { this.loading = true; this.pageError = ''; this.cdr.markForCheck(); }),
      switchMap(() => this.api.getPaged({
        search: this.filters.search,
        role: this.onlyAdmins ? 'CompanyAdmin' : this.filters.role,
        status: this.filters.status,
        companyId: this.isSuperAdmin ? this.filters.companyId : '',
        page: this.pageNumber,
        pageSize: this.filters.pageSize
      }).pipe(catchError(() => {
        this.pageError = 'No se pudieron cargar los usuarios.';
        return of(null);
      }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      this.loading = false;
      if (result) {
        // La página pedida ya no existe (se filtró o se borraron usuarios): se vuelve a la última que haya.
        if (!result.items.length && result.totalCount > 0 && this.pageNumber > 1) {
          this.pageNumber = Math.ceil(result.totalCount / result.pageSize);
          this.reload$.next();
          return;
        }
        this.page = result;
      }
      this.cdr.markForCheck();
    });

    // Se busca al dejar de escribir, no en cada tecla.
    this.search$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(text => {
      if (text === this.appliedSearch) return;
      this.appliedSearch = text;
      this.filters.search = text;
      this.pageNumber = 1;
      this.changed();
    });

    if (this.isSuperAdmin) {
      this.companiesApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: companies => { this.companies = companies; this.cdr.markForCheck(); }
      });
    }

    // El menú "Administradores" y "Usuarios" son la misma pantalla con o sin ?role=CompanyAdmin.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.onlyAdmins = params.get('role') === 'CompanyAdmin';
      this.filters = loadListState<UserFilters>(this.stateKey, { ...DEFAULT_FILTERS });
      this.appliedSearch = this.filters.search.trim();
      this.pageNumber = 1;
      this.load();
    });
  }

  private load(): void { this.reload$.next(); }

  private changed(): void {
    saveListState(this.stateKey, this.filters);
    this.load();
  }

  onSearchInput(value: string): void {
    this.filters.search = value ?? '';
    this.search$.next((value ?? '').trim());
  }

  clearSearch(): void {
    this.filters.search = '';
    this.appliedSearch = '';
    this.pageNumber = 1;
    this.changed();
  }

  setRole(role: string): void {
    this.filters.role = role;
    this.pageNumber = 1;
    this.changed();
  }

  setStatus(status: '' | 'active' | 'inactive'): void {
    this.filters.status = status;
    this.pageNumber = 1;
    this.changed();
  }

  onCompanyChange(companyId: string): void {
    this.filters.companyId = companyId ?? '';
    this.pageNumber = 1;
    this.changed();
  }

  resetFilters(): void {
    this.filters = { ...DEFAULT_FILTERS, pageSize: this.filters.pageSize };
    this.appliedSearch = '';
    this.pageNumber = 1;
    this.changed();
  }

  goToPage(p: number): void {
    this.pageNumber = p;
    this.load();
  }

  setPageSize(size: number): void {
    this.filters.pageSize = size;
    this.pageNumber = 1;
    this.changed();
  }

  goToCreate(): void { this.router.navigate(['/users/create']); }
  // Los propietarios se editan en su propia pantalla (presidente de consorcio y firma viven ahí).
  goToEdit(item: ManagedUser): void {
    const base = item.role === 'Owner' ? '/propietarios' : '/users';
    this.router.navigate([base, item.id]);
  }
}

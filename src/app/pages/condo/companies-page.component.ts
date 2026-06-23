import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { CompaniesApiService } from '../../api/companies-api.service';
import { Company } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-companies-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Empresas administradoras</h1>
            <p>Alta y edicion de empresas operadoras dentro del sistema.</p>
          </div>
        </div>
        <p-button label="Nueva empresa" icon="pi pi-plus" (onClick)="goToCreate()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando empresas...</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header companies-grid">
          <span>Nombre</span>
          <span>Slug</span>
          <span>Estado</span>
        </div>
        <div class="app-row companies-grid" *ngFor="let item of items">
          <button class="row-link" (click)="goToEdit(item.id)">{{ item.name }}</button>
          <span>{{ item.slug }}</span>
          <p-tag [value]="item.isActive ? 'Activa' : 'Inactiva'" [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>

    <!-- BACKDROP -->
    <div class="ov-backdrop" *ngIf="dialogVisible" (click)="closeDialog()"></div>

    <!-- FICHA -->
    <div class="ov-panel" *ngIf="dialogVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ selected ? selected.name : 'Nueva empresa' }}</strong>
        <button class="ov-close" (click)="closeDialog()">✕</button>
      </div>

      <form class="ficha-form" (ngSubmit)="save()">
        <label>
          <span>Nombre</span>
          <input [(ngModel)]="form.name" name="name" required maxlength="120" />
        </label>
        <label>
          <span>Slug</span>
          <input [(ngModel)]="form.slug" name="slug" required maxlength="120" />
          <small>Solo minusculas, numeros y guiones medios.</small>
        </label>
        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Empresa activa</span>
        </label>
        <div class="ficha-footer">
          <p-button type="submit" [loading]="isSaving" [label]="selected ? 'Guardar cambios' : 'Crear empresa'"></p-button>
          <p-button *ngIf="selected" type="button" label="Eliminar" severity="danger"
                    [outlined]="true" (onClick)="askDelete()"></p-button>
        </div>
      </form>
    </div>

    <!-- BACKDROP CONFIRM -->
    <div class="ov-backdrop ov-backdrop-top" *ngIf="confirmVisible" (click)="cancelDelete()"></div>

    <!-- CONFIRM -->
    <div class="ov-panel ov-panel-sm" *ngIf="confirmVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Confirmar eliminacion</strong>
        <button class="ov-close" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar la empresa <strong>{{ selected?.name }}</strong> de forma permanente?
        Esta accion no se puede deshacer.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger" [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .companies-grid { grid-template-columns: 1.4fr 1fr 0.8fr; }
    .row-link { background: none; border: none; padding: 0; font: inherit; font-weight: 700;
                color: var(--brand-blue); cursor: pointer; text-align: left; text-decoration: underline dotted; }
    .row-link:hover { color: var(--brand-ink); }

    /* OVERLAY */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px);
      animation: fadeIn 0.15s ease;
    }
    .ov-backdrop-top { z-index: 1002; }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(500px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28);
      padding: 1.6rem; animation: slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    .ov-panel-sm {
      width: min(420px, calc(100vw - 2rem));
      z-index: 1003;
    }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
                         to   { opacity: 1; transform: translate(-50%, -50%); } }
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.2rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }

    .ficha-form { display: grid; gap: 1rem; }
    .ficha-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; }
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class CompaniesPageComponent implements OnInit {
  private readonly api = inject(CompaniesApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: Company[] = [];
  loading = true;
  pageError = '';

  dialogVisible = false;
  confirmVisible = false;
  selected: Company | null = null;
  form = this.emptyForm();
  isSaving = false;
  isDeleting = false;

  ngOnInit(): void {
    this.api.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => { this.items = items.sort((a, b) => a.name.localeCompare(b.name)); this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.pageError = 'No se pudieron cargar las empresas.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }

  goToCreate(): void { this.router.navigate(['/companies/create']); }
  goToEdit(id: string): void { this.router.navigate(['/companies', id]); }

  openCreate(): void {
    this.selected = null;
    this.form = this.emptyForm();
    this.dialogVisible = true;
  }

  openFicha(item: Company): void {
    this.selected = item;
    this.form = { name: item.name, slug: item.slug, isActive: item.isActive };
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
    this.confirmVisible = false;
    this.selected = null;
  }

  save(): void {
    const req = { name: this.form.name.trim(), slug: this.form.slug.trim().toLowerCase(), isActive: this.form.isActive };
    if (!req.name) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!req.slug) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El slug es obligatorio.', life: 5000 }); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.slug)) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Slug invalido: solo minusculas, numeros y guiones.', life: 5000 }); return; }

    this.isSaving = true;
    const op = this.selected ? this.api.update(this.selected.id, req) : this.api.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: item => {
        this.items = this.selected
          ? this.items.map(x => x.id === item.id ? item : x).sort((a, b) => a.name.localeCompare(b.name))
          : [...this.items, item].sort((a, b) => a.name.localeCompare(b.name));
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.selected ? 'Empresa actualizada.' : 'Empresa creada.', life: 4000 });
        this.selected = item;
        this.cdr.markForCheck();
      },
      error: err => { this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 }); this.isSaving = false; this.cdr.markForCheck(); }
    });
  }

  askDelete(): void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    if (!this.selected) return;
    this.isDeleting = true;
    this.api.delete(this.selected.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter(x => x.id !== this.selected!.id);
        this.isDeleting = false;
        this.confirmVisible = false;
        this.dialogVisible = false;
        this.selected = null;
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar la empresa.'), life: 5000 });
        this.isDeleting = false;
        this.confirmVisible = false;
        this.cdr.markForCheck();
      }
    });
  }

  private emptyForm() { return { name: '', slug: '', isActive: true }; }
}

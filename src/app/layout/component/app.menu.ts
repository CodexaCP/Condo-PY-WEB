import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '@/app/auth/auth.service';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of menuItems(); track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul>`
})
export class AppMenu {
    private readonly auth = inject(AuthService);

    readonly menuItems = computed<MenuItem[]>(() => {
        const isSuperAdmin = this.auth.hasRole('SuperAdmin');
        const isAdmin = this.auth.hasRole('CompanyAdmin', 'CompanyOperator', 'BuildingManager');

        // ── Secciones de la plantilla (siempre visibles) ──────────────────
        const templateItems: MenuItem[] = [
            {
                label: 'Home',
                items: [
                    { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/dashboard'] }
                ]
            },
            {
                label: 'UI Kit',
                items: [
                    { label: 'Form Layout', icon: 'pi pi-fw pi-id-card', routerLink: ['/uikit/formlayout'] },
                    { label: 'Input', icon: 'pi pi-fw pi-check-square', routerLink: ['/uikit/input'] },
                    { label: 'Button', icon: 'pi pi-fw pi-mobile', class: 'rotated-icon', routerLink: ['/uikit/button'] },
                    { label: 'Table', icon: 'pi pi-fw pi-table', routerLink: ['/uikit/table'] },
                    { label: 'List', icon: 'pi pi-fw pi-list', routerLink: ['/uikit/list'] },
                    { label: 'Tree', icon: 'pi pi-fw pi-share-alt', routerLink: ['/uikit/tree'] },
                    { label: 'Panel', icon: 'pi pi-fw pi-tablet', routerLink: ['/uikit/panel'] },
                    { label: 'Overlay', icon: 'pi pi-fw pi-clone', routerLink: ['/uikit/overlay'] },
                    { label: 'Media', icon: 'pi pi-fw pi-image', routerLink: ['/uikit/media'] },
                    { label: 'Menu', icon: 'pi pi-fw pi-bars', routerLink: ['/uikit/menu'] },
                    { label: 'Messages', icon: 'pi pi-fw pi-comment', routerLink: ['/uikit/message'] },
                    { label: 'Misc', icon: 'pi pi-fw pi-circle', routerLink: ['/uikit/misc'] },
                    { label: 'Charts', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/uikit/charts'] },
                    { label: 'File', icon: 'pi pi-fw pi-file', routerLink: ['/uikit/file'] },
                    { label: 'Timeline', icon: 'pi pi-fw pi-calendar', routerLink: ['/uikit/timeline'] }
                ]
            },
            {
                label: 'Pages',
                items: [
                    { label: 'Landing', icon: 'pi pi-fw pi-globe', routerLink: ['/landing'] },
                    { label: 'Auth', icon: 'pi pi-fw pi-sign-in', routerLink: ['/auth/login'] },
                    { label: 'Crud', icon: 'pi pi-fw pi-pencil', routerLink: ['/pages/crud'] },
                    { label: 'Not Found', icon: 'pi pi-fw pi-exclamation-circle', routerLink: ['/notfound'] },
                    { label: 'Empty', icon: 'pi pi-fw pi-circle-off', routerLink: ['/pages/empty'] }
                ]
            },
            {
                label: 'Utilities',
                items: [
                    { label: 'Documentation', icon: 'pi pi-fw pi-question', routerLink: ['/pages/documentation'] }
                ]
            },
            { separator: true }
        ];

        // ── Secciones del condo (según rol) ───────────────────────────────
        const superAdminItems: MenuItem[] = isSuperAdmin
            ? [
                  {
                      label: 'Administración',
                      items: [
                          { label: 'Panel SuperAdmin', icon: 'pi pi-fw pi-shield', routerLink: ['/superadmin'] },
                          { label: 'Empresas', icon: 'pi pi-fw pi-building', routerLink: ['/companies'] },
                          { label: 'Condominios', icon: 'pi pi-fw pi-map', routerLink: ['/condominiums'] },
                          { label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] },
                          { label: 'Edificios', icon: 'pi pi-fw pi-home', routerLink: ['/buildings'] }
                      ]
                  }
              ]
            : [];

        const adminItems: MenuItem[] = isAdmin || isSuperAdmin
            ? [
                  {
                      label: 'General',
                      items: [
                          { label: 'Resumen', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/dashboard'] },
                          { label: 'Edificios', icon: 'pi pi-fw pi-home', routerLink: ['/buildings'] }
                      ]
                  },
                  {
                      label: 'Finanzas',
                      items: [
                          { label: 'Gastos', icon: 'pi pi-fw pi-arrow-circle-down', routerLink: ['/building-expenses'] },
                          { label: 'Ingresos', icon: 'pi pi-fw pi-arrow-circle-up', routerLink: ['/building-incomes'] },
                          { label: 'Periodos', icon: 'pi pi-fw pi-calendar', routerLink: ['/expense-periods'] },
                          { label: 'Cargos', icon: 'pi pi-fw pi-tags', routerLink: ['/expense-charges'] },
                          { label: 'Pagos', icon: 'pi pi-fw pi-credit-card', routerLink: ['/payments'] }
                      ]
                  },
                  {
                      label: 'Residentes',
                      items: [
                          { label: 'Unidades', icon: 'pi pi-fw pi-th-large', routerLink: ['/units'] },
                          { label: 'Residentes', icon: 'pi pi-fw pi-user', routerLink: ['/residents'] },
                          { label: 'Asignaciones', icon: 'pi pi-fw pi-link', routerLink: ['/assignments'] }
                      ]
                  },
                  {
                      label: 'Cobranza',
                      items: [
                          { label: 'Estado de cuenta', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/account-statements'] },
                          { label: 'Morosidad', icon: 'pi pi-fw pi-exclamation-triangle', routerLink: ['/morosity'] },
                          { label: 'Cobranza', icon: 'pi pi-fw pi-dollar', routerLink: ['/collections'] }
                      ]
                  }
              ]
            : [];

        return [...templateItems, ...superAdminItems, ...adminItems];
    });
}

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
        const isCompanyAdmin = this.auth.hasRole('CompanyAdmin');
        const isAdmin = this.auth.hasRole('CompanyAdmin', 'CompanyOperator', 'BuildingManager');

        if (isSuperAdmin) {
            return [
                {
                    label: 'Administración',
                    items: [
                        { label: 'Panel', icon: 'pi pi-fw pi-shield', routerLink: ['/superadmin'] },
                        { label: 'Empresas', icon: 'pi pi-fw pi-building', routerLink: ['/companies'] },
                        { label: 'Condominios', icon: 'pi pi-fw pi-map', routerLink: ['/condominiums'] },
                        { label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] },
                        { label: 'Edificios', icon: 'pi pi-fw pi-home', routerLink: ['/buildings'] }
                    ]
                }
            ];
        }

        if (isAdmin) {
            return [
                {
                    label: 'General',
                    items: [
                        { label: 'Resumen', icon: 'pi pi-fw pi-chart-pie', routerLink: ['/dashboard'] },
                        { label: 'Edificios', icon: 'pi pi-fw pi-home', routerLink: ['/buildings'] },
                        ...(isCompanyAdmin ? [{ label: 'Condominios', icon: 'pi pi-fw pi-map', routerLink: ['/condominiums'] }] : []),
                        ...(isCompanyAdmin ? [{ label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] }] : [])
                    ]
                },
                {
                    label: 'Finanzas',
                    items: [
                        { label: 'Gastos', icon: 'pi pi-fw pi-arrow-circle-down', routerLink: ['/building-expenses'] },
                        { label: 'Ingresos', icon: 'pi pi-fw pi-arrow-circle-up', routerLink: ['/building-incomes'] },
                        { label: 'Periodos', icon: 'pi pi-fw pi-calendar', routerLink: ['/expense-periods'] },
                        { label: 'Cargos', icon: 'pi pi-fw pi-tags', routerLink: ['/expense-charges'] },
                        { label: 'Pagos', icon: 'pi pi-fw pi-credit-card', routerLink: ['/payments'] },
                        { label: 'Pagos Propietarios', icon: 'pi pi-fw pi-wallet', routerLink: ['/owner-payments'] }
                    ]
                },
                {
                    label: 'Propietarios',
                    items: [
                        { label: 'Propietarios', icon: 'pi pi-fw pi-id-card', routerLink: ['/propietarios'] }
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
                },
                {
                    label: 'Comunicados',
                    items: [
                        { label: 'Notificaciones', icon: 'pi pi-fw pi-bell', routerLink: ['/notificaciones'] },
                        { label: 'Comunicados', icon: 'pi pi-fw pi-megaphone', routerLink: ['/comunicados'] },
                        { label: 'Reclamos', icon: 'pi pi-fw pi-comments', routerLink: ['/claims'] }
                    ]
                },
                {
                    label: 'Votaciones',
                    items: [
                        { label: 'Votaciones', icon: 'pi pi-fw pi-check-square', routerLink: ['/votaciones'] }
                    ]
                }
            ];
        }

        return [];
    });
}

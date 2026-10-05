import { Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '@/app/auth/auth.service';
import { FinanceAccessService } from '@/app/api/finance-access.service';
import { MarketplaceAccessService } from '@/app/api/marketplace-access.service';

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
    private readonly finance = inject(FinanceAccessService);
    private readonly marketplace = inject(MarketplaceAccessService);

    constructor() {
        // Al iniciar o cerrar sesión se vuelve a consultar en qué edificios están disponibles «Finanzas del edificio» y el Marketplace.
        effect(() => {
            this.auth.currentUser();
            untracked(() => {
                this.finance.refresh();
                this.marketplace.refresh();
            });
        });
    }

    readonly menuItems = computed<MenuItem[]>(() => {
        const isSuperAdmin = this.auth.hasRole('SuperAdmin');
        // Con el módulo apagado (o sin plan que lo incluya) el grupo no aparece.
        const hasFinanceModule = this.finance.available();
        // Marketplace: la revisión de pagos y la cuenta aparte aparecen solo si hay un edificio con el módulo disponible
        // donde el rol de este usuario puede usarlas (la cuenta no la ve el Operador).
        const canReviewMarketplace = this.marketplace.canReviewPayments();
        const canViewMarketplaceAccount = this.marketplace.canViewAccount();
        const isCompanyAdmin = this.auth.hasRole('CompanyAdmin');
        const isAdmin = this.auth.hasRole('CompanyAdmin', 'CompanyOperator', 'BuildingManager');
        // Timbrados: el operador de empresa no puede administrarlos (lo bloquea el backend);
        // se oculta el ítem en vez de mostrarlo y dejar que falle con un error 403.
        const canManageInvoicing = this.auth.hasRole('CompanyAdmin', 'BuildingManager');

        if (isSuperAdmin) {
            return [
                {
                    label: 'Administración',
                    items: [
                        { label: 'Panel', icon: 'pi pi-fw pi-shield', routerLink: ['/superadmin'] },
                        { label: 'Empresas', icon: 'pi pi-fw pi-building', routerLink: ['/companies'] },
                        { label: 'Condominios', icon: 'pi pi-fw pi-map', routerLink: ['/condominiums'] },
                        { label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] },
                        { label: 'Edificios', icon: 'pi pi-fw pi-home', routerLink: ['/buildings'] },
                        { label: 'Unidades', icon: 'pi pi-fw pi-th-large', routerLink: ['/units'] }
                    ]
                },
                {
                    label: 'Planes',
                    items: [
                        { label: 'Planes', icon: 'pi pi-fw pi-list-check', routerLink: ['/plans'] },
                        { label: 'Asignaciones', icon: 'pi pi-fw pi-sitemap', routerLink: ['/building-plans'] },
                        { label: 'Pagos de planes', icon: 'pi pi-fw pi-credit-card', routerLink: ['/building-plan-payments'] },
                        { label: 'Finanzas por edificio', icon: 'pi pi-fw pi-calculator', routerLink: ['/finance-admin'] },
                        { label: 'Marketplace por edificio', icon: 'pi pi-fw pi-shop', routerLink: ['/marketplace-admin'] },
                        { label: 'Publicidad por edificio', icon: 'pi pi-fw pi-megaphone', routerLink: ['/ad-buildings'] },
                        { label: 'Campañas de publicidad', icon: 'pi pi-fw pi-images', routerLink: ['/ad-campaigns'] },
                        ...(canViewMarketplaceAccount ? [{ label: 'Cuenta del Marketplace', icon: 'pi pi-fw pi-wallet', routerLink: ['/marketplace-account'] }] : [])
                    ]
                },
                // Pantallas del módulo de los edificios habilitados (la configuración se abre también desde «Finanzas por edificio»).
                ...(hasFinanceModule ? [{
                    label: 'Finanzas del edificio',
                    items: [
                        { label: 'Tablero', icon: 'pi pi-fw pi-chart-line', routerLink: ['/finance/dashboard'] },
                        { label: 'Movimientos', icon: 'pi pi-fw pi-list', routerLink: ['/finance/movements'] },
                        { label: 'Flujo de caja', icon: 'pi pi-fw pi-table', routerLink: ['/finance/cash-flow'] },
                        { label: 'Presupuesto', icon: 'pi pi-fw pi-calendar-plus', routerLink: ['/finance/budget'] },
                        { label: 'Presupuesto vs. real', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/finance/budget-vs-actual'] },
                        { label: 'Fondo de reserva', icon: 'pi pi-fw pi-shield', routerLink: ['/finance/reserve-fund'] },
                        { label: 'Configuración', icon: 'pi pi-fw pi-cog', routerLink: ['/finance/settings'] }
                    ]
                }] : []),
                {
                    label: 'Liquidaciones',
                    items: [
                        { label: 'Todas las empresas', icon: 'pi pi-fw pi-history', routerLink: ['/superadmin-settlements'] }
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
                        { label: 'Gastos y cargos', icon: 'pi pi-fw pi-list', routerLink: ['/period-ledger'] },
                        { label: 'Periodos', icon: 'pi pi-fw pi-calendar', routerLink: ['/expense-periods'] },
                        { label: 'Pagos', icon: 'pi pi-fw pi-wallet', routerLink: ['/owner-payments'] }
                    ]
                },
                ...(hasFinanceModule ? [{
                    label: 'Finanzas del edificio',
                    items: [
                        { label: 'Tablero', icon: 'pi pi-fw pi-chart-line', routerLink: ['/finance/dashboard'] },
                        { label: 'Movimientos', icon: 'pi pi-fw pi-list', routerLink: ['/finance/movements'] },
                        { label: 'Flujo de caja', icon: 'pi pi-fw pi-table', routerLink: ['/finance/cash-flow'] },
                        { label: 'Presupuesto', icon: 'pi pi-fw pi-calendar-plus', routerLink: ['/finance/budget'] },
                        { label: 'Presupuesto vs. real', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/finance/budget-vs-actual'] },
                        { label: 'Fondo de reserva', icon: 'pi pi-fw pi-shield', routerLink: ['/finance/reserve-fund'] },
                        { label: 'Configuración', icon: 'pi pi-fw pi-cog', routerLink: ['/finance/settings'] }
                    ]
                }] : []),
                {
                    label: 'Facturación',
                    items: [
                        ...(canManageInvoicing ? [{ label: 'Timbrados', icon: 'pi pi-fw pi-receipt', routerLink: ['/invoice-series'] }] : []),
                        { label: 'Facturas', icon: 'pi pi-fw pi-file-edit', routerLink: ['/invoices'] },
                        { label: 'Notas de Crédito', icon: 'pi pi-fw pi-file-excel', routerLink: ['/credit-notes'] },
                        { label: 'Pagos sin facturar', icon: 'pi pi-fw pi-exclamation-triangle', routerLink: ['/unbilled-payments'] }
                    ]
                },
                {
                    label: 'Unidades',
                    items: [
                        { label: 'Unidades', icon: 'pi pi-fw pi-th-large', routerLink: ['/units'] },
                        { label: 'Asignaciones', icon: 'pi pi-fw pi-link', routerLink: ['/assignments'] }
                    ]
                },
                {
                    label: 'Propietarios y residentes',
                    items: [
                        { label: 'Propietarios', icon: 'pi pi-fw pi-id-card', routerLink: ['/propietarios'] },
                        { label: 'Residentes', icon: 'pi pi-fw pi-user', routerLink: ['/residents'] }
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
                    label: 'Reportes',
                    items: [
                        { label: 'Libro de movimientos', icon: 'pi pi-fw pi-book', routerLink: ['/reportes/libro-movimientos'] },
                        { label: 'Estado de resultados', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/reportes/estado-resultados'] },
                        { label: 'Comparativo de edificios', icon: 'pi pi-fw pi-sitemap', routerLink: ['/reportes/comparativo-edificios'] }
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
                    label: 'Amenities',
                    items: [
                        { label: 'Amenities y reservas', icon: 'pi pi-fw pi-calendar-plus', routerLink: ['/amenities'] },
                        ...(canReviewMarketplace ? [{ label: 'Pagos del Marketplace', icon: 'pi pi-fw pi-shop', routerLink: ['/marketplace-payments'] }] : []),
                        ...(canReviewMarketplace ? [{ label: 'Reembolsos y reclamos', icon: 'pi pi-fw pi-replay', routerLink: ['/marketplace-followup'] }] : []),
                        ...(canViewMarketplaceAccount ? [{ label: 'Cuenta del Marketplace', icon: 'pi pi-fw pi-wallet', routerLink: ['/marketplace-account'] }] : [])
                    ]
                },
                {
                    label: 'Votaciones',
                    items: [
                        { label: 'Votaciones', icon: 'pi pi-fw pi-check-square', routerLink: ['/votaciones'] }
                    ]
                },
                {
                    label: 'Plan',
                    items: [
                        { label: 'Mi plan', icon: 'pi pi-fw pi-bookmark', routerLink: ['/my-plan'] }
                    ]
                },
                {
                    label: 'Ayuda',
                    items: [
                        { label: 'Tutoriales', icon: 'pi pi-fw pi-play-circle', routerLink: ['/tutorials'] }
                    ]
                }
            ];
        }

        return [];
    });
}

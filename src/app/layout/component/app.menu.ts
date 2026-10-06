import { Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '@/app/auth/auth.service';
import { FinanceAccessService } from '@/app/api/finance-access.service';
import { MarketplaceAccessService } from '@/app/api/marketplace-access.service';
import { LayoutService } from '@/app/layout/service/layout.service';

// Los grupos del menú son plegables (acordeón): cada uno lleva un `path` propio, que usa AppMenuitem para saber cuál está abierto.
// El prefijo evita que un grupo se confunda con la URL de una pantalla (el sidebar guarda la URL como ruta activa).
const GROUP_PREFIX = '/g-';

function group(label: string, icon: string, key: string, items: MenuItem[]): MenuItem {
    return { label, icon, path: `${GROUP_PREFIX}${key}`, items } as MenuItem;
}

// Grupo del menú que contiene la pantalla de esta URL (la coincidencia más específica gana; sirve también para sub-rutas
// como /buildings/new o /invoice-series/:id/calibrate).
function groupPathForUrl(items: MenuItem[], rawUrl: string): string | null {
    const url = rawUrl.split(/[?#]/)[0];
    let best: { path: string; length: number } | null = null;

    for (const root of items) {
        for (const child of root.items ?? []) {
            const groupPath = (child as { path?: string }).path;
            if (!groupPath || !child.items) continue;
            for (const leaf of child.items) {
                const link = Array.isArray(leaf.routerLink) ? leaf.routerLink[0] : leaf.routerLink;
                if (typeof link !== 'string') continue;
                if ((url === link || url.startsWith(link + '/')) && (!best || link.length > best.length)) {
                    best = { path: groupPath, length: link.length };
                }
            }
        }
    }

    return best?.path ?? null;
}

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
    private readonly layout = inject(LayoutService);

    constructor() {
        // Al iniciar o cerrar sesión se vuelve a consultar en qué edificios están disponibles «Finanzas del edificio» y el Marketplace.
        effect(() => {
            this.auth.currentUser();
            untracked(() => {
                this.finance.refresh();
                this.marketplace.refresh();
            });
        });

        // Abre el grupo de la pantalla actual, también al entrar directo a una URL o con el botón atrás del navegador
        // (las pantallas de un grupo cerrado no están dibujadas, así que no pueden avisar que están activas).
        effect(() => {
            const active = this.layout.layoutState().activePath;
            const items = this.menuItems();
            if (!active || active.startsWith(GROUP_PREFIX)) return;

            const groupPath = groupPathForUrl(items, active);
            if (groupPath) {
                untracked(() => this.layout.layoutState.update((state) => ({ ...state, activePath: groupPath })));
            }
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

        // Pantallas del módulo de los edificios habilitados (la configuración se abre también desde «Finanzas por edificio» del SuperAdmin).
        const financeModuleGroup = group('Finanzas (módulo)', 'pi pi-fw pi-calculator', 'finanzas', [
            { label: 'Tablero', icon: 'pi pi-fw pi-chart-line', routerLink: ['/finance/dashboard'] },
            { label: 'Movimientos', icon: 'pi pi-fw pi-list', routerLink: ['/finance/movements'] },
            { label: 'Flujo de caja', icon: 'pi pi-fw pi-table', routerLink: ['/finance/cash-flow'] },
            { label: 'Presupuesto', icon: 'pi pi-fw pi-calendar-plus', routerLink: ['/finance/budget'] },
            { label: 'Presupuesto vs. real', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/finance/budget-vs-actual'] },
            { label: 'Fondo de reserva', icon: 'pi pi-fw pi-shield', routerLink: ['/finance/reserve-fund'] },
            { label: 'Configuración', icon: 'pi pi-fw pi-cog', routerLink: ['/finance/settings'] }
        ]);

        if (isSuperAdmin) {
            return [
                {
                    label: 'Principal',
                    items: [
                        { label: 'Panel', icon: 'pi pi-fw pi-shield', routerLink: ['/superadmin'] },
                        { label: 'Liquidaciones', icon: 'pi pi-fw pi-history', routerLink: ['/superadmin-settlements'] }
                    ]
                },
                {
                    label: 'Gestión',
                    items: [
                        group('Administración', 'pi pi-fw pi-cog', 'administracion', [
                            { label: 'Empresas', icon: 'pi pi-fw pi-building', routerLink: ['/companies'] },
                            { label: 'Condominios', icon: 'pi pi-fw pi-map', routerLink: ['/condominiums'] },
                            { label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] },
                            { label: 'Edificios', icon: 'pi pi-fw pi-home', routerLink: ['/buildings'] },
                            { label: 'Unidades', icon: 'pi pi-fw pi-th-large', routerLink: ['/units'] }
                        ]),
                        group('Planes', 'pi pi-fw pi-list-check', 'planes', [
                            { label: 'Planes', icon: 'pi pi-fw pi-list-check', routerLink: ['/plans'] },
                            { label: 'Asignaciones de planes', icon: 'pi pi-fw pi-sitemap', routerLink: ['/building-plans'] },
                            { label: 'Pagos de planes', icon: 'pi pi-fw pi-credit-card', routerLink: ['/building-plan-payments'] }
                        ]),
                        group('Módulos por edificio', 'pi pi-fw pi-box', 'modulos', [
                            { label: 'Finanzas por edificio', icon: 'pi pi-fw pi-calculator', routerLink: ['/finance-admin'] },
                            { label: 'Marketplace por edificio', icon: 'pi pi-fw pi-shop', routerLink: ['/marketplace-admin'] },
                            { label: 'Publicidad por edificio', icon: 'pi pi-fw pi-megaphone', routerLink: ['/ad-buildings'] },
                            { label: 'Campañas de publicidad', icon: 'pi pi-fw pi-images', routerLink: ['/ad-campaigns'] },
                            ...(canViewMarketplaceAccount ? [{ label: 'Cuenta del Marketplace', icon: 'pi pi-fw pi-wallet', routerLink: ['/marketplace-account'] }] : [])
                        ]),
                        ...(hasFinanceModule ? [financeModuleGroup] : [])
                    ]
                }
            ];
        }

        if (isAdmin) {
            return [
                {
                    label: 'Principal',
                    items: [
                        { label: 'Resumen', icon: 'pi pi-fw pi-chart-pie', routerLink: ['/dashboard'] },
                        { label: 'Pagos', icon: 'pi pi-fw pi-wallet', routerLink: ['/owner-payments'] }
                    ]
                },
                {
                    label: 'Gestión',
                    items: [
                        group('Inmuebles y personas', 'pi pi-fw pi-home', 'inmuebles', [
                            { label: 'Edificios', icon: 'pi pi-fw pi-home', routerLink: ['/buildings'] },
                            ...(isCompanyAdmin ? [{ label: 'Condominios', icon: 'pi pi-fw pi-map', routerLink: ['/condominiums'] }] : []),
                            { label: 'Unidades', icon: 'pi pi-fw pi-th-large', routerLink: ['/units'] },
                            { label: 'Asignaciones', icon: 'pi pi-fw pi-link', routerLink: ['/assignments'] },
                            { label: 'Propietarios', icon: 'pi pi-fw pi-id-card', routerLink: ['/propietarios'] },
                            { label: 'Residentes', icon: 'pi pi-fw pi-user', routerLink: ['/residents'] },
                            ...(isCompanyAdmin ? [{ label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'] }] : [])
                        ]),
                        group('Períodos y cobros', 'pi pi-fw pi-calendar', 'cobros', [
                            { label: 'Gastos y cargos', icon: 'pi pi-fw pi-list', routerLink: ['/period-ledger'] },
                            { label: 'Periodos', icon: 'pi pi-fw pi-calendar', routerLink: ['/expense-periods'] },
                            { label: 'Estado de cuenta', icon: 'pi pi-fw pi-file-pdf', routerLink: ['/account-statements'] },
                            { label: 'Morosidad', icon: 'pi pi-fw pi-exclamation-triangle', routerLink: ['/morosity'] },
                            { label: 'Cobranza', icon: 'pi pi-fw pi-dollar', routerLink: ['/collections'] }
                        ]),
                        group('Facturación', 'pi pi-fw pi-receipt', 'facturacion', [
                            ...(canManageInvoicing ? [{ label: 'Timbrados', icon: 'pi pi-fw pi-receipt', routerLink: ['/invoice-series'] }] : []),
                            { label: 'Facturas', icon: 'pi pi-fw pi-file-edit', routerLink: ['/invoices'] },
                            { label: 'Notas de Crédito', icon: 'pi pi-fw pi-file-excel', routerLink: ['/credit-notes'] },
                            { label: 'Pagos sin facturar', icon: 'pi pi-fw pi-inbox', routerLink: ['/unbilled-payments'] }
                        ]),
                        ...(hasFinanceModule ? [financeModuleGroup] : []),
                        group('Reportes', 'pi pi-fw pi-chart-bar', 'reportes', [
                            { label: 'Libro de movimientos', icon: 'pi pi-fw pi-book', routerLink: ['/reportes/libro-movimientos'] },
                            { label: 'Estado de resultados', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/reportes/estado-resultados'] },
                            { label: 'Comparativo de edificios', icon: 'pi pi-fw pi-sitemap', routerLink: ['/reportes/comparativo-edificios'] }
                        ]),
                        group('Comunidad', 'pi pi-fw pi-comments', 'comunidad', [
                            { label: 'Notificaciones', icon: 'pi pi-fw pi-bell', routerLink: ['/notificaciones'] },
                            { label: 'Comunicados', icon: 'pi pi-fw pi-megaphone', routerLink: ['/comunicados'] },
                            { label: 'Reclamos', icon: 'pi pi-fw pi-comments', routerLink: ['/claims'] },
                            { label: 'Votaciones', icon: 'pi pi-fw pi-check-square', routerLink: ['/votaciones'] },
                            { label: 'Amenities y reservas', icon: 'pi pi-fw pi-calendar-plus', routerLink: ['/amenities'] },
                            ...(canReviewMarketplace ? [{ label: 'Pagos del Marketplace', icon: 'pi pi-fw pi-shop', routerLink: ['/marketplace-payments'] }] : []),
                            ...(canReviewMarketplace ? [{ label: 'Reembolsos y reclamos', icon: 'pi pi-fw pi-replay', routerLink: ['/marketplace-followup'] }] : []),
                            ...(canViewMarketplaceAccount ? [{ label: 'Cuenta del Marketplace', icon: 'pi pi-fw pi-wallet', routerLink: ['/marketplace-account'] }] : [])
                        ]),
                        group('Mi cuenta', 'pi pi-fw pi-user', 'cuenta', [
                            { label: 'Mi plan', icon: 'pi pi-fw pi-bookmark', routerLink: ['/my-plan'] },
                            { label: 'Tutoriales', icon: 'pi pi-fw pi-play-circle', routerLink: ['/tutorials'] }
                        ])
                    ]
                }
            ];
        }

        return [];
    });
}

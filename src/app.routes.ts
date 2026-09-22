import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { authGuard, guestGuard, homeRedirectGuard, passwordChangeGuard } from './app/auth/auth.guard';

export const appRoutes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./app/pages/auth/login').then(m => m.Login),
        canActivate: [guestGuard]
    },

    // Cambio de contraseña (protegido, sin requerir layout completo)
    {
        path: 'change-password',
        loadComponent: () => import('./app/pages/condo/change-password-page.component').then(m => m.ChangePasswordPageComponent),
        canActivate: [passwordChangeGuard]
    },

    // Área principal con layout (sidebar + topbar de la plantilla)
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            // Redirige / al home según el rol
            { path: '', canActivate: [homeRedirectGuard], children: [] },

            // ── Condo: SuperAdmin ─────────────────────────────────────────
            {
                path: 'superadmin',
                loadComponent: () => import('./app/pages/condo/superadmin-dashboard-page.component').then(m => m.SuperadminDashboardPageComponent)
            },
            {
                path: 'companies',
                loadComponent: () => import('./app/pages/condo/companies-page.component').then(m => m.CompaniesPageComponent)
            },
            {
                path: 'companies/create',
                loadComponent: () => import('./app/pages/condo/company-create-page.component').then(m => m.CompanyCreatePageComponent)
            },
            {
                path: 'companies/:id',
                loadComponent: () => import('./app/pages/condo/company-create-page.component').then(m => m.CompanyCreatePageComponent)
            },
            {
                path: 'condominiums',
                loadComponent: () => import('./app/pages/condo/condominiums-page.component').then(m => m.CondominiumsPageComponent)
            },
            {
                path: 'condominiums/create',
                loadComponent: () => import('./app/pages/condo/condominium-create-page.component').then(m => m.CondominiumCreatePageComponent)
            },
            {
                path: 'condominiums/:id',
                loadComponent: () => import('./app/pages/condo/condominium-create-page.component').then(m => m.CondominiumCreatePageComponent)
            },
            {
                path: 'users',
                loadComponent: () => import('./app/pages/condo/users-page.component').then(m => m.UsersPageComponent)
            },
            {
                path: 'users/create',
                loadComponent: () => import('./app/pages/condo/user-create-page.component').then(m => m.UserCreatePageComponent)
            },
            {
                path: 'users/:id',
                loadComponent: () => import('./app/pages/condo/user-create-page.component').then(m => m.UserCreatePageComponent)
            },

            // ── Condo: Propietarios ───────────────────────────────────────
            {
                path: 'propietarios',
                loadComponent: () => import('./app/pages/condo/propietarios-page.component').then(m => m.PropietariosPageComponent)
            },
            {
                path: 'propietarios/create',
                loadComponent: () => import('./app/pages/condo/propietario-create-page.component').then(m => m.PropietarioCreatePageComponent)
            },
            {
                path: 'propietarios/:id',
                loadComponent: () => import('./app/pages/condo/propietario-create-page.component').then(m => m.PropietarioCreatePageComponent)
            },

            // ── Condo: Admin/General ──────────────────────────────────────
            {
                path: 'dashboard',
                loadComponent: () => import('./app/pages/condo/dashboard-page.component').then(m => m.DashboardPageComponent)
            },
            {
                path: 'buildings',
                loadComponent: () => import('./app/pages/condo/buildings-page.component').then(m => m.BuildingsPageComponent)
            },
            {
                path: 'buildings/create',
                loadComponent: () => import('./app/pages/condo/building-create-page.component').then(m => m.BuildingCreatePageComponent)
            },
            {
                path: 'buildings/:id',
                loadComponent: () => import('./app/pages/condo/building-create-page.component').then(m => m.BuildingCreatePageComponent)
            },

            {
                path: 'units/create',
                loadComponent: () => import('./app/pages/condo/unit-create-page.component').then(m => m.UnitCreatePageComponent)
            },
            {
                path: 'units/:id',
                loadComponent: () => import('./app/pages/condo/unit-create-page.component').then(m => m.UnitCreatePageComponent)
            },

            // ── Condo: Finanzas ───────────────────────────────────────────
            {
                path: 'building-expenses',
                loadComponent: () => import('./app/pages/condo/building-expenses-page.component').then(m => m.BuildingExpensesPageComponent)
            },
            {
                path: 'building-incomes',
                loadComponent: () => import('./app/pages/condo/building-incomes-page.component').then(m => m.BuildingIncomesPageComponent)
            },
            {
                path: 'expense-periods',
                loadComponent: () => import('./app/pages/condo/expense-periods-page.component').then(m => m.ExpensePeriodsPageComponent)
            },
            {
                path: 'expense-charges',
                loadComponent: () => import('./app/pages/condo/expense-charges-page.component').then(m => m.ExpenseChargesPageComponent)
            },
            {
                path: 'payments',
                loadComponent: () => import('./app/pages/condo/payments-page.component').then(m => m.PaymentsPageComponent)
            },
            {
                path: 'invoice-series',
                loadComponent: () => import('./app/pages/condo/invoice-series-page.component').then(m => m.InvoiceSeriesPageComponent)
            },
            {
                path: 'invoices',
                loadComponent: () => import('./app/pages/condo/invoices-page.component').then(m => m.InvoicesPageComponent)
            },
            {
                path: 'credit-notes',
                loadComponent: () => import('./app/pages/condo/credit-notes-page.component').then(m => m.CreditNotesPageComponent)
            },

            // ── Condo: Residentes ─────────────────────────────────────────
            {
                path: 'units',
                loadComponent: () => import('./app/pages/condo/units-page.component').then(m => m.UnitsPageComponent)
            },
            {
                path: 'residents',
                loadComponent: () => import('./app/pages/condo/residents-page.component').then(m => m.ResidentsPageComponent)
            },
            {
                path: 'assignments',
                loadComponent: () => import('./app/pages/condo/assignments-page.component').then(m => m.AssignmentsPageComponent)
            },

            // ── Condo: Cobranza ───────────────────────────────────────────
            {
                path: 'account-statements',
                loadComponent: () => import('./app/pages/condo/account-statements-page.component').then(m => m.AccountStatementsPageComponent)
            },
            {
                path: 'morosity',
                loadComponent: () => import('./app/pages/condo/morosity-page.component').then(m => m.MorosityPageComponent)
            },
            {
                path: 'collections',
                loadComponent: () => import('./app/pages/condo/collections-page.component').then(m => m.CollectionsPageComponent)
            },

            // ── Notificaciones ────────────────────────────────────────────
            {
                path: 'notificaciones',
                loadComponent: () => import('./app/pages/condo/notificaciones-page.component').then(m => m.NotificacionesPageComponent)
            },

            // ── Pagos de propietarios ─────────────────────────────────────
            {
                path: 'owner-payments',
                loadComponent: () => import('./app/pages/condo/owner-payments-page.component').then(m => m.OwnerPaymentsPageComponent)
            },
            {
                path: 'owner-payments/:id',
                loadComponent: () => import('./app/pages/condo/owner-payment-detail-page.component').then(m => m.OwnerPaymentDetailPageComponent)
            },

            // ── Comunicados ───────────────────────────────────────────────
            {
                path: 'comunicados',
                loadComponent: () => import('./app/pages/condo/comunicados-page.component').then(m => m.ComunicadosPageComponent)
            },

            // ── Planes ───────────────────────────────────────────────────
            {
                path: 'plans',
                loadComponent: () => import('./app/pages/condo/plans-page.component').then(m => m.PlansPageComponent)
            },
            {
                path: 'building-plans',
                loadComponent: () => import('./app/pages/condo/building-plans-page.component').then(m => m.BuildingPlansPageComponent)
            },
            {
                path: 'building-plan-payments',
                loadComponent: () => import('./app/pages/condo/building-plan-payments-page.component').then(m => m.BuildingPlanPaymentsPageComponent)
            },
            {
                path: 'my-plan',
                loadComponent: () => import('./app/pages/condo/my-plan-page.component').then(m => m.MyPlanPageComponent)
            },

            // ── Amenities ─────────────────────────────────────────────────
            {
                path: 'amenities',
                loadComponent: () => import('./app/pages/condo/amenities-page.component').then(m => m.AmenitiesPageComponent)
            },

            // ── Votaciones ────────────────────────────────────────────────
            {
                path: 'claims',
                loadComponent: () => import('./app/pages/condo/claims-page.component').then(m => m.ClaimsPageComponent)
            },
            {
                path: 'votaciones',
                loadComponent: () => import('./app/pages/condo/votaciones-page.component').then(m => m.VotacionesPageComponent)
            }
        ]
    },

    { path: 'notfound', loadComponent: () => import('./app/pages/notfound/notfound').then(m => m.Notfound) },
    { path: '**', redirectTo: '/notfound' }
];

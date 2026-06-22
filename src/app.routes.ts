import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { authGuard, guestGuard, homeRedirectGuard, passwordChangeGuard } from './app/auth/auth.guard';

export const appRoutes: Routes = [
    // Login de la plantilla (sin layout, sin auth requerido)
    {
        path: 'login',
        loadComponent: () => import('./app/pages/auth/login').then(m => m.Login),
        canActivate: [guestGuard]
    },

    // Landing pública de la plantilla
    {
        path: 'landing',
        loadComponent: () => import('./app/pages/landing/landing').then(m => m.Landing)
    },

    // Auth pages de la plantilla (access, error, etc.)
    {
        path: 'auth',
        loadChildren: () => import('./app/pages/auth/auth.routes')
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

            // ── Demo pages de la plantilla (UIKit, Pages, etc.) ──────────
            {
                path: 'uikit',
                loadChildren: () => import('./app/pages/uikit/uikit.routes')
            },
            {
                path: 'pages',
                loadChildren: () => import('./app/pages/pages.routes')
            },
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
            }
        ]
    },

    { path: 'notfound', loadComponent: () => import('./app/pages/notfound/notfound').then(m => m.Notfound) },
    { path: '**', redirectTo: '/notfound' }
];

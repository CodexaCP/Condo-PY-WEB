import { Component, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AuthService } from '@/app/auth/auth.service';
import { NotificationAlertService } from '@/app/core/notification-alert.service';
import { PushService } from '@/app/core/push.service';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()">
                <i class="pi pi-bars"></i>
            </button>
            <a class="layout-topbar-logo" routerLink="/dashboard">
                <!-- Ícono blanco sobre fondo degradado -->
                <img src="/brand/expenses-icon-white.svg" alt="" aria-hidden="true" style="width:2.6rem;height:auto;flex-shrink:0" />
                <span>Expenses</span>
            </a>
        </div>

        <div class="layout-topbar-actions">
            @if (currentUser() && isSuperAdmin) {
                <button type="button" class="layout-topbar-action notif-btn" (click)="goToNotificaciones()" title="Notificaciones">
                    <i class="pi pi-bell"></i>
                    @if (unreadCount() > 0) {
                        <span class="notif-badge">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
                    }
                </button>
                <div class="sa-user">
                    <button type="button" class="sa-user-btn" (click)="toggleUserMenu($event)" aria-haspopup="menu" [attr.aria-expanded]="userMenuOpen()">
                        <span class="sa-avatar">{{ currentUser()!.avatar }}</span>
                        <span class="sa-user-text">
                            <strong>{{ currentUser()!.fullName }}</strong>
                            <small>Administrador del sistema</small>
                        </span>
                        <i class="pi pi-angle-down"></i>
                    </button>
                    @if (userMenuOpen()) {
                        <div class="sa-user-menu" role="menu">
                            <button type="button" role="menuitem" (click)="logout()"><i class="pi pi-sign-out"></i> Cerrar sesión</button>
                        </div>
                    }
                </div>
            } @else if (currentUser()) {
                <span style="color:#ffffff; font-size:0.9rem; font-weight:500; opacity:0.9">
                    Hola, {{ currentUser()!.fullName.split(' ')[0] }}
                </span>
                <button
                    type="button"
                    class="layout-topbar-action notif-btn"
                    (click)="goToNotificaciones()"
                    title="Notificaciones">
                    <i class="pi pi-bell"></i>
                    @if (unreadCount() > 0) {
                        <span class="notif-badge">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
                    }
                </button>
                <button type="button" class="layout-topbar-action" (click)="logout()" title="Cerrar sesión">
                    <i class="pi pi-sign-out"></i>
                </button>
            }
        </div>
    </div>`,
    styles: [`
        .notif-btn  { position: relative; }
        .notif-badge {
            position: absolute; top: 4px; right: 4px;
            background: #ef4444; color: #fff;
            font-size: 0.65rem; font-weight: 700; line-height: 1;
            min-width: 1.1rem; height: 1.1rem; border-radius: 0.55rem;
            display: flex; align-items: center; justify-content: center;
            padding: 0 0.25rem; pointer-events: none;
        }
    `]
})
export class AppTopbar implements OnInit {
    layoutService = inject(LayoutService);
    private readonly auth       = inject(AuthService);
    private readonly router     = inject(Router);
    private readonly alerts     = inject(NotificationAlertService);
    private readonly pushSvc    = inject(PushService);
    private readonly destroyRef = inject(DestroyRef);

    readonly currentUser = this.auth.currentUser;
    readonly unreadCount = this.alerts.unreadCount;
    readonly userMenuOpen = signal(false);

    get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }

    toggleUserMenu(event: Event): void {
        event.stopPropagation();
        this.userMenuOpen.update(open => !open);
    }

    @HostListener('document:click')
    closeUserMenu(): void { this.userMenuOpen.set(false); }

    // El panel entero (con la campana y los avisos en pantalla) vive mientras haya sesión: al salir del layout se detiene.
    ngOnInit(): void {
        this.alerts.start();
        this.destroyRef.onDestroy(() => this.alerts.stop());
    }

    goToNotificaciones(): void {
        void this.router.navigate(['/notificaciones']);
    }

    logout() {
        this.pushSvc.unregister();
        this.auth.logout();
        void this.router.navigateByUrl('/login');
    }
}

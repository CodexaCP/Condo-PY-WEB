import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AuthService } from '@/app/auth/auth.service';
import { NotificationsApiService } from '@/app/api/notifications-api.service';

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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 188" style="width:2.1rem;height:2rem;flex-shrink:0">
                  <rect x="8" y="10" width="76" height="138" fill="white"/>
                  <rect x="16" y="20" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="36" y="20" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="56" y="20" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="16" y="48" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="36" y="48" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="56" y="48" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="16" y="76" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="36" y="76" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="56" y="76" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="16" y="104" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="36" y="104" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="56" y="104" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="4" y="148" width="82" height="8" fill="rgba(255,255,255,0.7)"/>
                  <rect x="90" y="24" width="60" height="124" fill="white"/>
                  <rect x="98" y="34" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="115" y="34" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="98" y="57" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="115" y="57" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="98" y="80" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="115" y="80" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="98" y="103" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="115" y="103" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="148" y="94" width="44" height="54" fill="white"/>
                  <rect x="156" y="104" width="12" height="15" rx="2" fill="rgba(0,0,0,0.13)"/>
                  <rect x="88" y="148" width="106" height="8" fill="rgba(255,255,255,0.7)"/>
                </svg>
                <span>CONDOPY</span>
            </a>
        </div>

        <div class="layout-topbar-actions">
            @if (currentUser()) {
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
    private readonly notifSvc   = inject(NotificationsApiService);
    private readonly destroyRef = inject(DestroyRef);

    readonly currentUser = this.auth.currentUser;
    readonly unreadCount = signal(0);

    ngOnInit(): void {
        interval(30_000).pipe(
            startWith(0),
            switchMap(() => this.notifSvc.getUnreadCount()),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: dto  => this.unreadCount.set(dto.count),
            error: ()  => { /* silencioso — el badge queda en 0 si el endpoint falla */ }
        });
    }

    goToNotificaciones(): void {
        void this.router.navigate(['/notificaciones']);
    }

    logout() {
        this.auth.logout();
        void this.router.navigateByUrl('/login');
    }
}

import { Component, computed, effect, inject } from '@angular/core';
import { NotificationToastData } from '@/app/core/notification-alert.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Toast } from 'primeng/toast';
import { SharedModule } from 'primeng/api';
import { AppTopbar } from './app.topbar';
import { AppSidebar } from './app.sidebar';
import { AppFooter } from './app.footer';
import { LayoutService } from '@/app/layout/service/layout.service';
import { AuthService } from '@/app/auth/auth.service';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [CommonModule, AppTopbar, AppSidebar, RouterModule, AppFooter, Toast, SharedModule],
    template: `<div class="layout-wrapper" [ngClass]="containerClass()">
        <p-toast position="top-right" [life]="4500" [breakpoints]="{'960px': {width: '100%', right: '0', left: '0'}}"></p-toast>
        <!-- Avisos de notificaciones nuevas: se tocan para abrir el detalle (NotificationAlertService). -->
        <p-toast key="notif" position="top-right" [life]="8000" [breakpoints]="{'960px': {width: '100%', right: '0', left: '0'}}">
            <ng-template let-message pTemplate="message">
                <div class="notif-toast" role="button" tabindex="0" (click)="openAlert(message)" (keydown.enter)="openAlert(message)">
                    <div class="notif-toast-icon" [style.background]="alertData(message).color">
                        <i class="pi" [ngClass]="alertData(message).icon"></i>
                    </div>
                    <div class="notif-toast-text">
                        <div class="notif-toast-title">{{ message.summary }}</div>
                        <div class="notif-toast-body">{{ message.detail }}</div>
                    </div>
                </div>
            </ng-template>
        </p-toast>
        <app-topbar></app-topbar>
        <app-sidebar></app-sidebar>
        <div class="layout-main-container">
            <div class="layout-main">
                <router-outlet></router-outlet>
            </div>
            <app-footer></app-footer>
        </div>
        <div class="layout-mask"></div>
    </div> `,
    styles: [`
        .notif-toast { display: flex; align-items: flex-start; gap: 0.85rem; flex: 1; min-width: 0; cursor: pointer; }
        .notif-toast-icon { flex-shrink: 0; width: 2.4rem; height: 2.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .notif-toast-icon .pi { color: #fff; font-size: 1.05rem; }
        .notif-toast-text { min-width: 0; }
        .notif-toast-title { font-weight: 700; font-size: 0.92rem; line-height: 1.25; }
        .notif-toast-body { margin-top: 0.15rem; font-size: 0.84rem; line-height: 1.35; opacity: 0.85; overflow-wrap: anywhere; }
    `]
})
export class AppLayout {
    layoutService = inject(LayoutService);
    private readonly auth = inject(AuthService);

    alertData(message: { data?: NotificationToastData }): NotificationToastData {
        return message.data ?? { icon: 'pi-bell', color: '#3b82f6', onTap: () => {} };
    }

    openAlert(message: { data?: NotificationToastData }): void {
        message.data?.onTap();
    }

    constructor() {
        effect(() => {
            const state = this.layoutService.layoutState();
            if (state.mobileMenuActive) {
                document.body.classList.add('blocked-scroll');
            } else {
                document.body.classList.remove('blocked-scroll');
            }
        });
    }

    containerClass = computed(() => {
        const config = this.layoutService.layoutConfig();
        const state = this.layoutService.layoutState();
        return {
            'layout-overlay': config.menuMode === 'overlay',
            'layout-static': config.menuMode === 'static',
            'layout-static-inactive': state.staticMenuDesktopInactive && config.menuMode === 'static',
            'layout-overlay-active': state.overlayMenuActive,
            'layout-mobile-active': state.mobileMenuActive,
            // Panel del SuperAdmin: menu a toda la altura y barra superior clara (assets/layout/_shell-sa.scss).
            'layout-sa': this.auth.hasRole('SuperAdmin')
        };
    })
}

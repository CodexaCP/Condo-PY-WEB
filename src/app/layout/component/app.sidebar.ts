import { Component, computed, effect, ElementRef, inject, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { AppMenu } from './app.menu';
import { LayoutService } from '@/app/layout/service/layout.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [AppMenu, RouterModule],
    template: `
        <div class="layout-sidebar">
            <!-- La marca arriba y abajo solo se ve en el panel del SuperAdmin (.layout-sa). -->
            <a class="sa-brand sa-only" routerLink="/superadmin">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 188" aria-hidden="true">
                    <rect x="8" y="10" width="76" height="138" fill="white" />
                    <rect x="16" y="20" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="36" y="20" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="56" y="20" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="16" y="48" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="36" y="48" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="56" y="48" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="16" y="76" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="36" y="76" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="56" y="76" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="16" y="104" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="36" y="104" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="56" y="104" width="14" height="21" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="4" y="148" width="82" height="8" fill="rgba(255,255,255,0.7)" />
                    <rect x="90" y="24" width="60" height="124" fill="white" />
                    <rect x="98" y="34" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="115" y="34" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="98" y="57" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="115" y="57" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="98" y="80" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="115" y="80" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="98" y="103" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="115" y="103" width="12" height="17" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="148" y="94" width="44" height="54" fill="white" />
                    <rect x="156" y="104" width="12" height="15" rx="2" fill="rgba(0,0,0,0.13)" />
                    <rect x="88" y="148" width="106" height="8" fill="rgba(255,255,255,0.7)" />
                </svg>
                <span>
                    <span class="sa-brand-name">Condo-PY</span>
                    <span class="sa-brand-sub">Gestión de Expensas</span>
                </span>
            </a>

            <app-menu></app-menu>

            <div class="sa-foot sa-only">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 188" aria-hidden="true">
                    <rect x="8" y="10" width="76" height="138" fill="white" />
                    <rect x="90" y="24" width="60" height="124" fill="white" />
                    <rect x="148" y="94" width="44" height="54" fill="white" />
                    <rect x="4" y="148" width="190" height="8" fill="rgba(255,255,255,0.7)" />
                </svg>
                <span>
                    <span class="sa-brand-name">Condo-PY</span>
                    <span class="sa-brand-sub">Más control, mejores edificios</span>
                </span>
            </div>
        </div>
    `
})
export class AppSidebar implements OnInit, OnDestroy {
    layoutService = inject(LayoutService);

    router = inject(Router);

    el = inject(ElementRef);

    private outsideClickListener: ((event: MouseEvent) => void) | null = null;

    private destroy$ = new Subject<void>();

    constructor() {
        effect(() => {
            const state = this.layoutService.layoutState();

            if (this.layoutService.isDesktop()) {
                if (state.overlayMenuActive) {
                    this.bindOutsideClickListener();
                } else {
                    this.unbindOutsideClickListener();
                }
            } else {
                if (state.mobileMenuActive) {
                    this.bindOutsideClickListener();
                } else {
                    this.unbindOutsideClickListener();
                }
            }
        });
    }

    ngOnInit() {
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                takeUntil(this.destroy$)
            )
            .subscribe((event) => {
                const navEvent = event as NavigationEnd;
                this.onRouteChange(navEvent.urlAfterRedirects);
            });

        this.onRouteChange(this.router.url);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.unbindOutsideClickListener();
    }

    private onRouteChange(path: string) {
        this.layoutService.layoutState.update((val) => ({
            ...val,
            activePath: path,
            overlayMenuActive: false,
            staticMenuMobileActive: false,
            mobileMenuActive: false,
            menuHoverActive: false
        }));
    }

    private bindOutsideClickListener() {
        if (!this.outsideClickListener) {
            this.outsideClickListener = (event: MouseEvent) => {
                if (this.isOutsideClicked(event)) {
                    this.layoutService.layoutState.update((val) => ({
                        ...val,
                        overlayMenuActive: false,
                        staticMenuMobileActive: false,
                        mobileMenuActive: false,
                        menuHoverActive: false
                    }));
                }
            };

            document.addEventListener('click', this.outsideClickListener);
        }
    }

    private unbindOutsideClickListener() {
        if (this.outsideClickListener) {
            document.removeEventListener('click', this.outsideClickListener);
            this.outsideClickListener = null;
        }
    }

    private isOutsideClicked(event: MouseEvent): boolean {
        const topbarButtonEl = document.querySelector('.topbar-start > button');
        const sidebarEl = this.el.nativeElement;

        return !(
            sidebarEl?.isSameNode(event.target as Node) ||
            sidebarEl?.contains(event.target as Node) ||
            topbarButtonEl?.isSameNode(event.target as Node) ||
            topbarButtonEl?.contains(event.target as Node)
        );
    }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from '@/app/layout/component/app.menuitem';
import { GROUP_PREFIX, group, groupPathForUrl } from '@/app/layout/component/app.menu';
import { LayoutService } from '@/app/layout/service/layout.service';
import { DemoStore } from './demo.store';

// Menú lateral de la demostración: espeja el del administrador real, con rutas /explorar y las funciones no incluidas apuntando a /explorar/bloqueado.
@Component({
  standalone: true,
  selector: 'app-demo-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AppMenuitem],
  template: `<ul class="layout-menu">
    @for (item of menuItems(); track item.label) {
      <li app-menuitem [item]="item" [root]="true"></li>
    }
  </ul>`
})
export class DemoMenuComponent {
  private readonly store = inject(DemoStore);
  private readonly layout = inject(LayoutService);

  constructor() {
    // Abre el grupo de la pantalla actual (igual que el menú real).
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
    const tx = this.store.t().shell;
    const m = tx.menu;
    const locked = (f: string) => ({ routerLink: ['/explorar/bloqueado'], queryParams: { f }, class: 'demo-lock' });
    const py = this.store.country() === 'py';

    return [
      {
        label: m.main,
        items: [
          { label: m.summary, icon: 'pi pi-fw pi-chart-pie', routerLink: ['/explorar/panel'] },
          { label: m.payments, icon: 'pi pi-fw pi-wallet', ...locked('mas') }
        ]
      },
      {
        label: m.manage,
        items: [
          group(m.properties, 'pi pi-fw pi-home', 'inmuebles', [
            { label: tx.nav.units, icon: 'pi pi-fw pi-th-large', routerLink: ['/explorar/unidades'] }
          ]),
          group(m.periods, 'pi pi-fw pi-calendar', 'cobros', [
            { label: m.charges, icon: 'pi pi-fw pi-list', routerLink: ['/explorar/gastos'] },
            { label: m.statement, icon: 'pi pi-fw pi-file-pdf', routerLink: ['/explorar/unidades'] },
            {
              label: m.morosity, icon: 'pi pi-fw pi-exclamation-triangle', routerLink: ['/explorar/unidades'], queryParams: { deuda: 1 },
              routerLinkActiveOptions: { paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored' }
            }
          ]),
          ...(py ? [group(m.invoicing, 'pi pi-fw pi-receipt', 'facturacion', [
            { label: m.invoices, icon: 'pi pi-fw pi-file-edit', ...locked('facturacion') }
          ])] : []),
          group(m.finance, 'pi pi-fw pi-calculator', 'finanzas', [
            this.store.hasJournal()
              ? { label: m.journal, icon: 'pi pi-fw pi-sort-alt', routerLink: ['/explorar/libro-diario'] }
              : { label: tx.nav.certificate, icon: 'pi pi-fw pi-verified', routerLink: ['/explorar/certificado'] },
            { label: m.reconciliation, icon: 'pi pi-fw pi-check-square', ...locked('conciliacion') }
          ]),
          group(m.reports, 'pi pi-fw pi-chart-bar', 'reportes', [
            { label: tx.nav.reports, icon: 'pi pi-fw pi-book', routerLink: ['/explorar/informes'] }
          ]),
          group(m.community, 'pi pi-fw pi-comments', 'comunidad', [
            { label: m.votes, icon: 'pi pi-fw pi-check-square', ...locked('votaciones') },
            { label: m.app, icon: 'pi pi-fw pi-mobile', ...locked('app') }
          ])
        ]
      }
    ];
  });
}

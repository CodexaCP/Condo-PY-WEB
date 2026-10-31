import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DEMO_PAGE_STYLES } from './demo.styles';
import { DemoContactKind, DemoStore } from './demo.store';

// Función que la demostración no incluye: se explica qué hace y se invita a contactar (el interés aparece justo aquí).
@Component({
  standalone: true,
  selector: 'app-demo-locked',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="card lock">
      <span class="ico"><i [class]="'pi ' + info().icon"></i></span>
      <span class="badge info"><i class="pi pi-lock"></i> {{ t().lockedPage.badge }}</span>
      <h1>{{ info().title }}</h1>
      <p class="sub">{{ info().text }}</p>
      <div class="row ctas">
        <a class="btn" [href]="store.whatsappUrl('demostracion')" target="_blank" rel="noopener noreferrer" (click)="contact('demostracion')"><i class="pi pi-video"></i> {{ t().lockedPage.cta }}</a>
        <a class="btn line" routerLink="/explorar/panel"><i class="pi pi-arrow-left"></i> {{ t().lockedPage.back }}</a>
      </div>
    </div>
  `,
  styles: [
    DEMO_PAGE_STYLES,
    `
      .lock { max-width: 640px; margin: 1.5rem auto; text-align: center; display: grid; justify-items: center; gap: 0.5rem; padding: 2rem 1.5rem; }
      .ico { width: 4rem; height: 4rem; border-radius: 1rem; display: grid; place-items: center; background: #e6f7f6; color: #0f8a84; font-size: 1.7rem; }
      .lock h1 { margin: 0.4rem 0 0; }
      .lock .sub { max-width: 46ch; margin: 0; line-height: 1.5; }
      .ctas { justify-content: center; margin-top: 0.8rem; }
    `
  ]
})
export class DemoLockedComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  private readonly feature = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('f') ?? 'mas')), { initialValue: 'mas' });
  readonly info = computed(() => this.store.lockedInfo(this.feature()));

  constructor() {
    effect(() => this.store.track('locked_click', this.feature()));
  }

  contact(kind: DemoContactKind): void {
    this.store.track('contact_click', kind);
  }
}

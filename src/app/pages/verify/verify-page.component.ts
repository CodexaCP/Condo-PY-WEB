import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../config/api.config';
import { LANGS, LangService } from '../../core/i18n/lang.service';
import { LangSwitcherComponent } from '../../core/i18n/lang-switcher.component';
import { SeoService } from '../../core/seo.service';
import { VERIFY_TX } from './verify.i18n';

type VerifyStatus = 'valid' | 'draft' | 'superseded' | 'revoked' | 'unavailable' | 'notfound' | 'error';

interface VerifyResult {
  status: Exclude<VerifyStatus, 'error'>;
  title?: string | null;
  buildingName?: string | null;
  administratorName?: string | null;
  periodName?: string | null;
  totalFormatted?: string | null;
  issuedAtUtc?: string | null;
  replacedAtUtc?: string | null;
  // Botones (solo en un documento vigente).
  dueDate?: string | null;
  whatsAppUrl?: string | null;
  appDownloadUrl?: string | null;
  bankAccounts?: { bankName: string; accountType: string; accountNumber: string; holderName: string; holderDocument?: string | null; alias?: string | null }[];
}

// Página pública a la que lleva el QR de la liquidación: sin sesión, solo muestra si el documento es auténtico y vigente.
// Lo que se ve lo decide el servidor (el QR solo trae un código aleatorio) y nunca incluye unidades ni datos personales.
@Component({
  selector: 'app-verify-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LangSwitcherComponent],
  template: `
    <div class="vf-page">
      <div class="vf-lang"><app-lang-switcher /></div>
      <main class="vf-card" [attr.data-status]="status()">
        <header class="vf-head">
          <img src="/brand/expenses-icon.svg" alt="Expenses" class="vf-logo" />
          <span class="vf-brand">EXPENSES</span>
        </header>

        @if (loading()) {
          <p class="vf-loading" role="status">{{ t().loading }}</p>
        } @else {
          <div class="vf-badge" [class]="'vf-badge is-' + tone()" role="status">
            <span class="vf-icon" aria-hidden="true">{{ icon() }}</span>
            <div>
              <h1>{{ t().badge[status()] }}</h1>
              <p>{{ t().lead[status()] }}</p>
            </div>
          </div>

          @if (result(); as r) {
            @if (r.status !== 'notfound') {
              <dl class="vf-data">
                <div><dt>{{ r.title }}</dt><dd>{{ r.periodName }}</dd></div>
                <div><dt>{{ t().building }}</dt><dd>{{ r.buildingName }}</dd></div>
                @if (r.administratorName) {
                  <div><dt>{{ t().administrator }}</dt><dd>{{ r.administratorName }}</dd></div>
                }
                <div><dt>{{ t().total }}</dt><dd class="vf-total">{{ r.totalFormatted }}</dd></div>
                <div><dt>{{ t().issued }}</dt><dd>{{ dateText(r.issuedAtUtc) }}</dd></div>
                @if (r.replacedAtUtc) {
                  <div><dt>{{ t().replaced }}</dt><dd>{{ dateText(r.replacedAtUtc) }}</dd></div>
                }
              </dl>
              <p class="vf-note">{{ t().check }}</p>

              @if (r.status === 'valid') {
                <h2 class="vf-actions-title">{{ t().actionsTitle }}</h2>
                <div class="vf-actions">
                  <button type="button" class="vf-btn is-primary" [attr.aria-expanded]="accountOpen()" (click)="accountOpen.set(!accountOpen())">
                    <span aria-hidden="true">🔐</span> {{ t().account.button }}
                  </button>
                  @if (accountOpen()) {
                    <div class="vf-panel">
                      <strong>{{ t().account.ownersTitle }}</strong>
                      <p>{{ t().account.ownersText }}</p>
                      @if (r.appDownloadUrl) {
                        <a class="vf-link" [href]="r.appDownloadUrl">{{ t().app }}</a>
                      }
                      <p class="vf-admin">{{ t().account.adminText }}
                        <a class="vf-link" routerLink="/account-statements">{{ t().account.adminButton }}</a>
                      </p>
                    </div>
                  }

                  @if (r.whatsAppUrl) {
                    <a class="vf-btn" [href]="r.whatsAppUrl" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">💬</span> {{ t().whatsapp }}</a>
                  }

                  @if (r.bankAccounts?.length) {
                    <button type="button" class="vf-btn" [attr.aria-expanded]="transferOpen()" (click)="transferOpen.set(!transferOpen())">
                      <span aria-hidden="true">🏦</span> {{ t().transfer.button }}
                    </button>
                    @if (transferOpen()) {
                      @for (a of r.bankAccounts; track a.accountNumber + a.bankName) {
                        <div class="vf-panel">
                          <dl class="vf-bank">
                            <div><dt>{{ t().transfer.bank }}</dt><dd>{{ a.bankName }}</dd></div>
                            <div><dt>{{ t().transfer.type }}</dt><dd>{{ a.accountType === 'Savings' ? t().transfer.savings : t().transfer.checking }}</dd></div>
                            <div><dt>{{ t().transfer.number }}</dt><dd>{{ a.accountNumber }} <button type="button" class="vf-copy" (click)="copy(a.accountNumber)">{{ copied() === a.accountNumber ? t().transfer.copied : t().transfer.copy }}</button></dd></div>
                            <div><dt>{{ t().transfer.holder }}</dt><dd>{{ a.holderName }}</dd></div>
                            @if (a.holderDocument) {
                              <div><dt>{{ t().transfer.document }}</dt><dd>{{ a.holderDocument }}</dd></div>
                            }
                            @if (a.alias) {
                              <div><dt>{{ t().transfer.alias }}</dt><dd>{{ a.alias }} <button type="button" class="vf-copy" (click)="copy(a.alias)">{{ copied() === a.alias ? t().transfer.copied : t().transfer.copy }}</button></dd></div>
                            }
                          </dl>
                        </div>
                      }
                    }
                  }

                  @if (r.appDownloadUrl) {
                    <a class="vf-btn" [href]="r.appDownloadUrl"><span aria-hidden="true">📱</span> {{ t().app }}</a>
                  }

                  @if (r.dueDate) {
                    <button type="button" class="vf-btn" (click)="downloadCalendar(r)"><span aria-hidden="true">📅</span> {{ t().calendar.button }}</button>
                  }
                </div>
              }
            }
          }

          @if (status() === 'error') {
            <button type="button" class="vf-retry" (click)="load()">{{ t().retry }}</button>
          }
          <p class="vf-privacy">{{ t().privacy }}</p>
        }
      </main>
      <footer class="vf-foot">expenses.com.py · {{ t().footer }}</footer>
    </div>
  `,
  styles: [`
    .vf-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1.25rem 16px; background: var(--ex-bg, #f4f9fc); }
    .vf-lang { position: absolute; top: 1rem; right: 1rem; }
    .vf-card { width: 100%; max-width: 460px; background: #fff; border-radius: 20px; padding: 1.5rem; box-shadow: 0 8px 30px rgba(19,133,182,0.12); }
    .vf-head { display: flex; align-items: center; justify-content: center; gap: 0.6rem; margin-bottom: 1.25rem; }
    .vf-logo { width: 32px; height: 32px; }
    .vf-brand { font-weight: 800; letter-spacing: 0.08em; color: var(--brand-blue, #1385b6); font-size: 0.9rem; }
    .vf-loading { text-align: center; color: #637b88; margin: 1.5rem 0; }

    .vf-badge { display: flex; gap: 0.85rem; align-items: flex-start; padding: 1rem; border-radius: 14px; border: 1px solid transparent; }
    .vf-badge h1 { margin: 0 0 0.25rem; font-size: 1.1rem; line-height: 1.25; }
    .vf-badge p { margin: 0; font-size: 0.88rem; line-height: 1.45; }
    .vf-icon { font-size: 1.6rem; line-height: 1; }
    .vf-badge.is-ok { background: #e8f8ef; border-color: #b6e6c9; color: #14532d; }
    .vf-badge.is-warn { background: #fff7e0; border-color: #f2dc95; color: #6b4a00; }
    .vf-badge.is-bad { background: #fdeaea; border-color: #f2b8b8; color: #7a1717; }

    .vf-data { margin: 1.25rem 0 0; display: grid; gap: 0.7rem; }
    .vf-data div { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #e6eef4; padding-bottom: 0.55rem; }
    .vf-data dt { color: #637b88; font-size: 0.85rem; }
    .vf-data dd { margin: 0; font-weight: 600; text-align: right; color: #16324a; overflow-wrap: anywhere; }
    .vf-total { font-size: 1.05rem; }
    .vf-note { margin: 1rem 0 0; font-size: 0.85rem; color: #16324a; background: #f4f9fc; border-radius: 10px; padding: 0.65rem 0.8rem; }
    .vf-actions-title { margin: 1.4rem 0 0.6rem; font-size: 0.95rem; color: #16324a; }
    .vf-actions { display: grid; gap: 0.6rem; }
    .vf-btn { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.8rem 1rem; border-radius: 12px; border: 1px solid #cfe0ea; background: #fff; color: #16324a; font: inherit; font-weight: 600; text-align: left; text-decoration: none; cursor: pointer; }
    .vf-btn:hover, .vf-btn:focus-visible { background: #eef6fb; outline: none; border-color: var(--brand-blue, #1385b6); }
    .vf-btn.is-primary { background: var(--brand-blue, #1385b6); border-color: var(--brand-blue, #1385b6); color: #fff; }
    .vf-btn.is-primary:hover { opacity: 0.92; background: var(--brand-blue, #1385b6); }
    .vf-panel { background: #f4f9fc; border-radius: 12px; padding: 0.8rem 1rem; font-size: 0.88rem; color: #16324a; }
    .vf-panel p { margin: 0.35rem 0; line-height: 1.45; }
    .vf-link { color: var(--brand-blue, #1385b6); font-weight: 700; }
    .vf-admin { color: #637b88; }
    .vf-bank { margin: 0; display: grid; gap: 0.4rem; }
    .vf-bank div { display: flex; justify-content: space-between; gap: 0.8rem; }
    .vf-bank dt { color: #637b88; }
    .vf-bank dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
    .vf-copy { margin-left: 0.4rem; padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid #cfe0ea; background: #fff; color: var(--brand-blue, #1385b6); font: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer; }
    .vf-privacy { margin: 1rem 0 0; font-size: 0.75rem; color: #637b88; text-align: center; }
    .vf-retry { display: block; margin: 1rem auto 0; padding: 0.6rem 1.2rem; border: none; border-radius: 10px; background: var(--brand-blue, #1385b6); color: #fff; font-weight: 700; cursor: pointer; }
    .vf-foot { font-size: 0.75rem; color: #637b88; }

    @media (prefers-color-scheme: dark) {
      .vf-page { background: #0f1c26; }
      .vf-card { background: #162634; box-shadow: none; }
      .vf-data dd { color: #e6eef4; }
      .vf-data div { border-color: #26394a; }
      .vf-note { background: #1c3042; color: #e6eef4; }
      .vf-actions-title { color: #e6eef4; }
      .vf-btn { background: #1c3042; border-color: #2c4459; color: #e6eef4; }
      .vf-btn:hover, .vf-btn:focus-visible { background: #24394d; }
      .vf-btn.is-primary { background: var(--brand-blue, #1385b6); color: #fff; }
      .vf-panel { background: #1c3042; color: #e6eef4; }
      .vf-copy { background: #162634; border-color: #2c4459; }
      .vf-badge.is-ok { background: #123524; border-color: #1f6a43; color: #bff0d3; }
      .vf-badge.is-warn { background: #3a2e0c; border-color: #7a6020; color: #f6e1a0; }
      .vf-badge.is-bad { background: #3b1717; border-color: #7a2b2b; color: #f6c3c3; }
    }
  `]
})
export class VerifyPageComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly lang = inject(LangService);

  readonly t = computed(() => VERIFY_TX[this.lang.lang()]);
  readonly loading = signal(true);
  readonly result = signal<VerifyResult | null>(null);
  readonly failed = signal(false);
  readonly accountOpen = signal(false);
  readonly transferOpen = signal(false);
  readonly copied = signal('');

  readonly status = computed<VerifyStatus>(() => (this.failed() ? 'error' : (this.result()?.status ?? 'notfound')));
  readonly tone = computed(() => {
    switch (this.status()) {
      case 'valid': return 'ok';
      case 'draft': case 'error': return 'warn';
      default: return 'bad';
    }
  });
  readonly icon = computed(() => (this.tone() === 'ok' ? '✔' : this.tone() === 'warn' ? '⚠' : '✖'));

  constructor() {
    const seo = inject(SeoService);
    seo.markNoindex();
    effect(() => {
      this.lang.lang();
      this.lang.applyHtmlLang();
      seo.set({ title: this.t().seoTitle, description: this.t().privacy, path: '/v', noindex: true, lang: this.lang.lang() });
    });
    this.load();
  }

  load(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.loading.set(true);
    this.failed.set(false);
    this.http.get<VerifyResult>(`${API_BASE_URL}/public/verify/${encodeURIComponent(token)}`).subscribe({
      next: (r) => { this.result.set(r); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }

  // Copia el dato al portapapeles y lo marca como "Copiado" unos segundos.
  copy(text: string): void {
    const done = () => {
      this.copied.set(text);
      setTimeout(() => { if (this.copied() === text) this.copied.set(''); }, 2500);
    };
    try {
      void navigator.clipboard.writeText(text).then(done, () => undefined);
    } catch {
      // sin portapapeles (navegador viejo o sin permiso): no se hace nada
    }
  }

  // Recordatorio de calendario (.ics) de todo el día en la fecha de vencimiento, con aviso a las 9:00 del día anterior.
  // Se arma en el navegador: no sale ningún dato de esta página.
  downloadCalendar(r: VerifyResult): void {
    if (!r.dueDate) return;
    const day = r.dueDate.replace(/-/g, '');
    const next = new Date(`${r.dueDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const end = next.toISOString().slice(0, 10).replace(/-/g, '');
    const title = this.t().calendar.title.replace('{period}', r.periodName ?? '').replace('{building}', r.buildingName ?? '');
    const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Expenses//Vencimiento//ES', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${day}-${Math.random().toString(36).slice(2)}@expenses.com.py`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${esc(title)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'
    ];
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vencimiento-${r.dueDate}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  dateText(iso?: string | null): string {
    if (!iso) return '';
    const locale = LANGS.find((l) => l.code === this.lang.lang())?.locale ?? 'es-PY';
    // El servidor manda UTC sin sufijo "Z": se interpreta como UTC.
    const date = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : iso + 'Z');
    return isNaN(date.getTime()) ? '' : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  }
}

import { inject, Injectable, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import { AppNotification } from '../api/models';
import { NotificationsApiService, resolveNotificationRoute } from '../api/notifications-api.service';
import { AuthService } from '../auth/auth.service';
import { notificationVisual } from './notification-visuals';

const POLL_MS = 30_000;
// Hasta cuántos avisos se muestran uno por uno; si llegan más de golpe se resume en uno solo.
const MAX_INDIVIDUAL = 3;
const TOAST_MS = 8000;
// Ventana en la que una push no repite un aviso que la consulta ya mostró.
const DEDUPE_MS = 60_000;

// Clave del <p-toast> de avisos (ver app.layout.ts): separa estos avisos de los toasts de éxito/error de las pantallas.
export const NOTIFICATION_TOAST_KEY = 'notif';

// Lo que viaja en `data` del mensaje y usa la plantilla del toast para dibujarlo y abrirlo.
export interface NotificationToastData {
  icon: string;
  color: string;
  onTap: () => void;
}

// Datos de la push recibida con la pestaña abierta: sirven de respaldo si la consulta no trae la notificación.
export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

// Muestra un aviso en pantalla (toast arriba a la derecha) cuando llega una notificación nueva, sin tener que entrar a
// Notificaciones para enterarse.
//
// No depende de la push: no todos conceden el permiso del navegador. Se consulta la bandeja cada 30 segundos y se avisa de
// lo nuevo; la push, cuando llega con la pestaña abierta, solo adelanta esa consulta (refresh) para que el aviso salga al
// instante. También es la única fuente del contador de la campana (unreadCount).
@Injectable({ providedIn: 'root' })
export class NotificationAlertService {
  private readonly api = inject(NotificationsApiService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  readonly unreadCount = signal(0);

  private timer?: Subscription;
  private userId: string | null = null;
  private seen = new Set<string>();
  private baselineDone = false;
  private busy = false;
  private rerun: { push?: PushPayload } | null = null;
  private recent = new Map<string, number>();

  /** Arranca la consulta periódica. Es seguro llamarlo varias veces. */
  start(): void {
    if (!this.timer) {
      this.timer = interval(POLL_MS).subscribe(() => void this.refresh());
    }
    void this.refresh();
  }

  /** Detiene la consulta (al salir del panel) y deja el estado limpio para la próxima sesión. */
  stop(): void {
    this.timer?.unsubscribe();
    this.timer = undefined;
    this.reset(null);
  }

  /** Consulta ya (por ejemplo al llegar una push con la pestaña abierta, o al leer una notificación). */
  async refresh(push?: PushPayload): Promise<void> {
    const user = this.auth.currentUser();
    if (!user || !this.auth.isAuthenticated()) {
      this.reset(null);
      return;
    }
    if (user.userId !== this.userId) {
      this.reset(user.userId);
    }

    if (this.busy) {
      this.rerun = { push: push ?? this.rerun?.push };
      return;
    }
    this.busy = true;

    try {
      const items = await firstValueFrom(this.api.getAll());
      this.present(this.takeFresh(items), push);
    } catch {
      // Sin red o con el servidor caído: se reintenta en la próxima vuelta. Si llegó una push, igual se avisa.
      if (push) this.present([], push);
    } finally {
      this.busy = false;
      const next = this.rerun;
      this.rerun = null;
      if (next) void this.refresh(next.push);
    }
  }

  /** Marca como leídas las notificaciones de una entidad (al abrirla desde la notificación del sistema). */
  markEntityRead(entityType?: string | null, entityId?: string | null): void {
    if (!entityType || !entityId) return;
    this.api.getAll().subscribe({
      next: items => {
        const pending = items.filter(i => !i.isRead && i.entityType === entityType && i.entityId === entityId);
        pending.forEach(i => this.api.markRead(i.id).subscribe());
        if (pending.length) this.unreadCount.update(c => Math.max(0, c - pending.length));
      },
      error: () => { /* silencioso: queda como no leída y se marca desde la lista */ }
    });
  }

  private reset(userId: string | null): void {
    this.userId = userId;
    this.seen.clear();
    this.baselineDone = false;
    this.unreadCount.set(0);
  }

  // Devuelve las no leídas que todavía no se avisaron, de la más vieja a la más nueva.
  private takeFresh(items: AppNotification[]): AppNotification[] {
    const unread = items.filter(i => !i.isRead);
    this.unreadCount.set(unread.length);

    let fresh: AppNotification[];
    if (!this.baselineDone) {
      // Primera consulta de esta sesión: solo se avisa lo que llegó después de la última vez que se avisó (por ejemplo,
      // mientras el panel estaba cerrado). Sin marca previa (primer uso) no se avisa nada: no se inunda al entrar.
      const cursor = this.readCursor();
      fresh = cursor === null ? [] : unread.filter(i => this.time(i) > cursor);
      this.baselineDone = true;
    } else {
      fresh = unread.filter(i => !this.seen.has(i.id));
    }

    items.forEach(i => this.seen.add(i.id));
    const newest = items.reduce((max, i) => Math.max(max, this.time(i)), 0);
    if (newest > 0) this.saveCursor(newest);

    return fresh.sort((a, b) => this.time(a) - this.time(b));
  }

  private present(fresh: AppNotification[], push?: PushPayload): void {
    if (fresh.length > MAX_INDIVIDUAL) {
      const last = fresh[fresh.length - 1];
      fresh.forEach(n => this.markAlerted(this.keyOf(n.entityType, n.entityId, n.title, n.body)));
      this.show(`Tienes ${fresh.length} notificaciones nuevas`, last.title, { icon: 'pi-bell', color: '#6366f1', onTap: () => this.openList() });
      return;
    }

    if (fresh.length === 0 && push) {
      // La push llegó pero la consulta no trajo la notificación: se muestra con los datos de la propia push, salvo que esa
      // misma notificación ya se haya avisado hace un momento (la consulta se adelantó a la push).
      if (this.wasRecentlyAlerted(this.keyOf(push.data['entityType'], push.data['entityId'], push.title, push.body))) return;
      const visual = notificationVisual(push.data['type']);
      const route = resolveNotificationRoute(
        { entityType: push.data['entityType'], entityId: push.data['entityId'] },
        this.auth.currentUser()?.role
      );
      this.show(push.title || 'Nueva notificación', push.body, {
        ...visual,
        onTap: () => (route ? this.navigate(route.path) : this.openList())
      });
      return;
    }

    for (const n of fresh) {
      this.markAlerted(this.keyOf(n.entityType, n.entityId, n.title, n.body));
      this.show(n.title, n.body, { ...notificationVisual(n.type), onTap: () => this.open(n) });
    }
  }

  private show(summary: string, detail: string, data: NotificationToastData): void {
    this.zone.run(() => {
      this.messages.add({ key: NOTIFICATION_TOAST_KEY, severity: 'info', summary, detail, life: TOAST_MS, data });
    });
  }

  private open(n: AppNotification): void {
    this.api.markRead(n.id).subscribe({ error: () => { /* queda como no leída */ } });
    this.unreadCount.update(c => Math.max(0, c - 1));

    const route = resolveNotificationRoute(n, this.auth.currentUser()?.role);
    if (route) this.navigate(route.path);
    else this.openList();
  }

  private openList(): void {
    this.navigate(['/notificaciones']);
  }

  private navigate(path: string[]): void {
    this.zone.run(() => void this.router.navigate(path));
  }

  private keyOf(entityType?: string | null, entityId?: string | null, title?: string, body?: string): string {
    return entityType && entityId ? `${entityType}|${entityId}` : `${title ?? ''}|${body ?? ''}`;
  }

  private markAlerted(key: string): void {
    const now = Date.now();
    this.recent.set(key, now);
    for (const [k, t] of this.recent) if (now - t > DEDUPE_MS) this.recent.delete(k);
  }

  private wasRecentlyAlerted(key: string): boolean {
    const t = this.recent.get(key);
    return t !== undefined && Date.now() - t < DEDUPE_MS;
  }

  private time(n: AppNotification): number {
    const t = Date.parse(n.createdAtUtc);
    return Number.isNaN(t) ? 0 : t;
  }

  private cursorKey(): string {
    return `condopy-web-notif-cursor:${this.userId}`;
  }

  private readCursor(): number | null {
    try {
      const raw = localStorage.getItem(this.cursorKey());
      const value = raw ? Number(raw) : NaN;
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  private saveCursor(value: number): void {
    try {
      const current = this.readCursor();
      if (current === null || value > current) localStorage.setItem(this.cursorKey(), String(value));
    } catch { /* sin almacenamiento: se pierde solo el aviso de lo llegado con el panel cerrado */ }
  }
}

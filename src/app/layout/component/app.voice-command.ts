import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { BuildingsApiService } from '@/app/api/buildings-api.service';
import { ExpensePeriodsApiService } from '@/app/api/expense-periods-api.service';
import { MorosityApiService } from '@/app/api/morosity-api.service';
import { VoiceCommandsApiService } from '@/app/api/voice-commands-api.service';
import { extractApiErrorMessage } from '@/app/api/api-error.util';
import { Building, MorosityUnit, VoiceCommandInterpretation } from '@/app/api/models';
import { formatMoney } from '@/app/core/locale/locale.state';

const BUILDING_KEY = 'expenses_voice_building';

/**
 * Botón de micrófono de la barra superior: interpreta comandos dictados o escritos
 * (crear período vacío, crear período igual al anterior, listar morosos por antigüedad).
 * Las acciones que escriben siempre piden confirmación antes de ejecutarse.
 */
@Component({
    selector: 'app-voice-command',
    standalone: true,
    imports: [CommonModule, FormsModule, Button],
    template: `
        <button type="button" class="layout-topbar-action" (click)="toggle()" title="Comandos de voz">
            <i class="pi pi-microphone"></i>
        </button>

        @if (open()) {
            <div class="voice-panel" (click)="$event.stopPropagation()">
                <div class="voice-head">
                    <strong>Comandos de voz</strong>
                    <button type="button" class="voice-close" (click)="open.set(false)" title="Cerrar" aria-label="Cerrar">
                        <i class="pi pi-times"></i>
                    </button>
                </div>

                <label class="voice-label" for="voice-building">Edificio</label>
                <select id="voice-building" class="voice-input" [ngModel]="buildingId()" (ngModelChange)="onBuildingChange($event)">
                    <option value="">Todos (solo para morosos)</option>
                    @for (b of buildings(); track b.id) {
                        <option [value]="b.id">{{ b.name }}</option>
                    }
                </select>

                <div class="voice-row">
                    <input
                        class="voice-input"
                        type="text"
                        [(ngModel)]="text"
                        (keydown.enter)="interpret()"
                        placeholder="Ej.: morosos con 3 meses de atraso" />
                    <p-button label="Enviar" (onClick)="interpret()" [disabled]="busy()" />
                </div>

                @if (speechSupported) {
                    <p-button
                        icon="pi pi-microphone"
                        [label]="listening() ? 'Escuchando…' : 'Dictar'"
                        [outlined]="!listening()"
                        styleClass="w-full"
                        (onClick)="listen()"
                        [disabled]="listening() || busy()" />
                } @else {
                    <p class="voice-note">Tu navegador no permite dictar: escribí el comando (usá Chrome o Edge para dictar).</p>
                }

                <ul class="voice-help">
                    <li>«crear período vacío»</li>
                    <li>«crear período igual al anterior»</li>
                    <li>«morosos con 3 meses de atraso»</li>
                </ul>

                @if (error()) {
                    <div class="voice-box voice-error">{{ error() }}</div>
                }
                @if (info()) {
                    <div class="voice-box">{{ info() }}</div>
                }
                @if (success()) {
                    <div class="voice-box voice-ok">{{ success() }}</div>
                }

                @if (pending(); as p) {
                    <div class="voice-box">
                        <p style="margin:0 0 .75rem">{{ p.summary }}</p>
                        <div class="voice-row">
                            <p-button label="Confirmar" (onClick)="confirm()" [disabled]="saving()" />
                            <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancel()" [disabled]="saving()" />
                        </div>
                    </div>
                }

                @if (delinquents(); as rows) {
                    <div class="voice-box">
                        <strong>{{ summary() }}</strong>
                        <div class="voice-sub">{{ rows.length }} unidades · total {{ money(total()) }}</div>
                        @if (rows.length === 0) {
                            <p style="margin:.5rem 0 0">No hay morosos con ese atraso.</p>
                        } @else {
                            <div style="overflow:auto">
                                <table class="voice-table">
                                    <thead>
                                        <tr>
                                            <th>Unidad</th>
                                            @if (!buildingId()) { <th>Edificio</th> }
                                            <th>Propietario</th>
                                            <th>Vencido desde</th>
                                            <th>Atraso</th>
                                            <th>Períodos</th>
                                            <th>Deuda</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @for (r of rows; track r.unitId) {
                                            <tr>
                                                <td>{{ r.unitCode }}</td>
                                                @if (!buildingId()) { <td>{{ r.buildingName }}</td> }
                                                <td>{{ contactName(r) }}<br /><small>{{ contactPhone(r) }}</small></td>
                                                <td>{{ formatDate(r.oldestDueDate) }}</td>
                                                <td>{{ r.daysOverdue }} días</td>
                                                <td>{{ r.overduePeriods }}</td>
                                                <td>{{ money(r.totalBalance) }}</td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        }
                    </div>
                }
            </div>
        }
    `,
    styles: [`
        .voice-panel {
            position: fixed; top: 4.5rem; right: 1rem; width: min(30rem, calc(100vw - 2rem));
            max-height: 75vh; overflow: auto; z-index: 1000; padding: 1rem;
            background: var(--surface-card); color: var(--text-color);
            border: 1px solid var(--surface-border); border-radius: 0.75rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
            display: flex; flex-direction: column; gap: 0.6rem;
        }
        .voice-head { display: flex; justify-content: space-between; align-items: center; }
        .voice-close { background: none; border: 0; cursor: pointer; color: inherit; }
        .voice-label { font-size: 0.8rem; opacity: 0.8; }
        .voice-row { display: flex; gap: 0.5rem; align-items: center; }
        .voice-input {
            flex: 1; width: 100%; padding: 0.5rem 0.6rem; border-radius: 0.5rem;
            border: 1px solid var(--surface-border); background: var(--surface-ground); color: inherit;
        }
        .voice-note, .voice-help { font-size: 0.8rem; opacity: 0.8; margin: 0; }
        .voice-help { padding-left: 1.1rem; }
        .voice-box { padding: 0.6rem 0.75rem; border-radius: 0.5rem; border: 1px solid var(--surface-border); background: var(--surface-ground); }
        .voice-error { border-color: #ef4444; color: #ef4444; }
        .voice-ok { border-color: #22c55e; }
        .voice-sub { font-size: 0.8rem; opacity: 0.8; }
        .voice-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.5rem; }
        .voice-table th, .voice-table td { text-align: left; padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--surface-border); white-space: nowrap; }
    `]
})
export class AppVoiceCommand {
    private readonly buildingsApi = inject(BuildingsApiService);
    private readonly periodsApi = inject(ExpensePeriodsApiService);
    private readonly morosityApi = inject(MorosityApiService);
    private readonly voiceApi = inject(VoiceCommandsApiService);
    private readonly cdr = inject(ChangeDetectorRef);

    readonly open = signal(false);
    readonly buildings = signal<Building[]>([]);
    readonly buildingId = signal('');
    readonly busy = signal(false);
    readonly saving = signal(false);
    readonly listening = signal(false);
    readonly error = signal('');
    readonly info = signal('');
    readonly success = signal('');
    readonly pending = signal<VoiceCommandInterpretation | null>(null);
    readonly delinquents = signal<MorosityUnit[] | null>(null);
    readonly summary = signal('');
    readonly total = signal(0);

    text = '';

    private buildingsLoaded = false;
    private readonly SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    readonly speechSupported = !!this.SR;

    money(value: number): string { return formatMoney(value); }

    contactName(r: MorosityUnit): string { return r.ownerName || r.responsibleName; }
    contactPhone(r: MorosityUnit): string { return r.ownerName ? r.ownerPhone : r.responsiblePhone; }

    formatDate(value: string): string {
        const [y, m, d] = value.split('-');
        return `${d}/${m}/${y}`;
    }

    toggle(): void {
        const next = !this.open();
        this.open.set(next);
        if (next && !this.buildingsLoaded) {
            this.buildingsLoaded = true;
            this.buildingsApi.getAll().subscribe({
                next: list => {
                    this.buildings.set(list);
                    let saved = '';
                    try { saved = localStorage.getItem(BUILDING_KEY) ?? ''; } catch { /* sin almacenamiento */ }
                    if (saved && list.some(b => b.id === saved)) this.buildingId.set(saved);
                    else if (list.length === 1) this.buildingId.set(list[0].id);
                },
                error: () => { this.buildingsLoaded = false; }
            });
        }
    }

    onBuildingChange(value: string): void {
        this.buildingId.set(value);
        try { localStorage.setItem(BUILDING_KEY, value); } catch { /* sin almacenamiento */ }
    }

    // Dictado con el reconocimiento de voz del navegador (Chrome/Edge).
    listen(): void {
        if (!this.SR) return;
        const rec = new this.SR();
        rec.lang = 'es-PY';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (e: any) => {
            this.text = e.results[0][0].transcript;
            this.interpret();
            this.cdr.detectChanges();
        };
        rec.onerror = () => {
            this.error.set('No pude escuchar. Revisá el permiso del micrófono o escribí el comando.');
            this.cdr.detectChanges();
        };
        rec.onend = () => { this.listening.set(false); this.cdr.detectChanges(); };
        this.listening.set(true);
        rec.start();
    }

    private resetState(): void {
        this.error.set('');
        this.info.set('');
        this.success.set('');
        this.pending.set(null);
        this.delinquents.set(null);
    }

    interpret(): void {
        const command = this.text.trim();
        if (!command) return;
        this.resetState();
        this.busy.set(true);
        const buildingId = this.buildingId() || undefined;
        this.voiceApi.interpret(command, buildingId).subscribe({
            next: result => {
                if (result.message) {
                    this.info.set(result.message);
                    this.busy.set(false);
                    return;
                }
                if (result.intent === 'ListDelinquents') {
                    this.morosityApi.getUnits(buildingId, result.dueOnOrBefore).subscribe({
                        next: rows => {
                            this.summary.set(result.summary);
                            this.total.set(rows.reduce((acc, r) => acc + r.totalBalance, 0));
                            this.delinquents.set(rows);
                            this.busy.set(false);
                        },
                        error: err => {
                            this.error.set(extractApiErrorMessage(err, 'No se pudo procesar el comando.'));
                            this.busy.set(false);
                        }
                    });
                    return;
                }
                if (result.requiresConfirmation) {
                    this.pending.set(result);
                }
                this.busy.set(false);
            },
            error: err => {
                this.error.set(extractApiErrorMessage(err, 'No se pudo procesar el comando.'));
                this.busy.set(false);
            }
        });
    }

    cancel(): void { this.pending.set(null); }

    // Solo se ejecuta tras el clic en «Confirmar».
    confirm(): void {
        const p = this.pending();
        if (!p || this.saving()) return;
        this.saving.set(true);
        const done = (message: string) => {
            this.pending.set(null);
            this.success.set(message);
            this.saving.set(false);
        };
        const fail = (err: unknown) => {
            this.error.set(extractApiErrorMessage(err, 'No se pudo crear el período.'));
            this.saving.set(false);
        };
        if (p.intent === 'ClonePreviousPeriod') {
            this.periodsApi.clone(p.sourcePeriodId!).subscribe({
                next: r => done(`Período ${r.period.name} creado con ${r.copiedExpenses} gastos y ${r.copiedIncomes} ingresos copiados.`),
                error: fail
            });
        } else {
            this.periodsApi.create(p.proposedPeriod!).subscribe({
                next: period => done(`Período ${period.name} creado sin gastos.`),
                error: fail
            });
        }
    }
}

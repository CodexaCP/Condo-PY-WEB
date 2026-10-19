import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AccountingApiService } from '../../api/accounting-api.service';
import {
  AccountingEntries, AccountingPlanOption, AccountingRoleAccount, AccountingRoles, Journal, JournalDifferences, JournalPreview
} from '../../api/building-config.models';
import { FinanceBuildingAccess } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, exportErrorMessage, exportFileName, FinanceErrorKind, GsPipe } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';
import { FinanceJournalLedgerComponent } from './finance-journal-ledger.component';
import { FinanceTrialBalanceComponent } from './finance-trial-balance.component';
import { FinanceStatementsComponent } from './finance-statements.component';
import { FinanceFiscalClosingComponent } from './finance-fiscal-closing.component';
import { bookFileName, saveBlob } from './journal-download';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

type Tab = 'journal' | 'ledger' | 'balance' | 'statements' | 'closing' | 'entries' | 'roles';

const JOURNAL_PAGE_SIZE = 50;

interface OptionGroup {
  name: string;
  items: AccountingPlanOption[];
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = { Cash: 'Caja', Bank: 'Banco', ReserveFund: 'Fondo de reserva' };

// Fecha local en formato yyyy-MM-dd (lo que usan los campos de fecha y el backend).
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// yyyy-MM-dd -> dd/MM/yyyy
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Asientos contables para el contador: un asiento de partida doble por cada movimiento del libro (criterio de caja), con la cuenta del plan
// de cada cuenta financiera, el IVA crédito de las compras y el rubro. Los «sugeridos» se arman al consultar y no cambian saldos; el Libro
// diario guarda los ya asentados, con su número correlativo por ejercicio, y no se pueden modificar (un error se corrige con un contraasiento).
// Si falta la cuenta del plan de algún renglón, el asiento queda incompleto y no se asienta; las cuentas se asignan en «Cuentas del plan».
@Component({
  standalone: true,
  selector: 'app-finance-accounting-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterLink, Button, Card, Message, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent,
    FinanceJournalLedgerComponent, FinanceTrialBalanceComponent, FinanceStatementsComponent, FinanceFiscalClosingComponent
  ],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Asientos contables</h1>
            <p>Partida doble a partir del libro, para el contador: lo asentado tiene número y no se modifica.</p>
          </div>
        </div>
        <div class="controls">
          <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
          <p-button *ngIf="tab === 'entries'" type="button" label="Exportar a Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true"
                    [loading]="exporting" [disabled]="!entries" (onClick)="download()"></p-button>
        </div>
      </div>

      <app-finance-state [loading]="loading && !roles && !entries" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="buildingId && !noBuilding && !errorKind">
        <nav class="tabs" role="tablist">
          <button type="button" role="tab" [class.active]="tab === 'journal'" (click)="setTab('journal')">Libro diario</button>
          <button type="button" role="tab" [class.active]="tab === 'ledger'" (click)="setTab('ledger')">Libro mayor</button>
          <button type="button" role="tab" [class.active]="tab === 'balance'" (click)="setTab('balance')">Sumas y saldos</button>
          <button type="button" role="tab" [class.active]="tab === 'statements'" (click)="setTab('statements')">Balance general</button>
          <button type="button" role="tab" [class.active]="tab === 'closing'" (click)="setTab('closing')">Cierre del ejercicio</button>
          <button type="button" role="tab" [class.active]="tab === 'entries'" (click)="setTab('entries')">Asientos sugeridos</button>
          <button type="button" role="tab" [class.active]="tab === 'roles'" (click)="setTab('roles')">
            Cuentas del plan <span class="dot" *ngIf="roles && !roles.isComplete" title="Faltan cuentas por asignar"></span>
          </button>
        </nav>

        <!-- ══ LIBRO DIARIO (asentados) ══ -->
        <ng-container *ngIf="tab === 'journal'">
          <p-message *ngIf="journalError" severity="error" [text]="journalError"></p-message>
          <p class="app-state" *ngIf="loadingJournal && !journal">Cargando...</p>

          <ng-container *ngIf="journal as j">
            <div class="posted-banner" [class.none]="!j.postedThrough">
              <strong *ngIf="j.postedThrough">Asentado hasta el {{ j.postedThrough | date: 'dd/MM/yyyy' }}</strong>
              <strong *ngIf="!j.postedThrough">Todavía no se asentó nada</strong>
              <span class="muted small">Lo asentado tiene número correlativo por ejercicio y no se puede editar ni borrar: un error se corrige con un contraasiento.</span>
            </div>

            <!-- Imprimir el Libro Diario -->
            <div class="post-box" *ngIf="j.postedThrough">
              <h3>Imprimir el Libro Diario del ejercicio {{ j.fiscalYear }}</h3>
              <p class="muted small">
                Hojas sueltas con folio correlativo, con el encabezado del titular y las sumas de cada hoja. La rúbrica de las hojas en el Registro Público de Comercio es un
                trámite externo: acá solo se imprimen. Los datos del titular, el contador y la rúbrica se cargan en el Centro de configuración → Libros contables.
              </p>
              <div class="filters">
                <label class="field"><span>Primer folio</span><input type="number" min="1" step="1" [(ngModel)]="startFolio" /></label>
                <p-button type="button" label="Libro Diario (PDF)" icon="pi pi-file-pdf" [loading]="printing === 'pdf'" [disabled]="!!printing || !startFolio || startFolio < 1" (onClick)="downloadBook('pdf')"></p-button>
                <p-button type="button" label="Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true" [loading]="printing === 'excel'" [disabled]="!!printing || !startFolio || startFolio < 1" (onClick)="downloadBook('excel')"></p-button>
              </div>
            </div>

            <!-- Diferencias contra lo asentado -->
            <div class="notice" *ngIf="differences && differences.items.length">
              <strong>{{ differences.items.length }} asientos cambiaron desde que se asentaron.</strong>
              Lo asentado no se modifica: al asentar se corrigen con un contraasiento y, si el movimiento sigue existiendo, un asiento nuevo.
              <span *ngIf="differences.incompleteCount > 0">Falta la cuenta del plan de {{ differences.pending.join(', ') }}: hasta asignarla no se puede corregir.</span>
              <div class="table-wrap">
                <table class="t">
                  <thead><tr><th>Qué pasó</th><th>Operación</th><th>Detalle</th><th>Asiento</th><th class="num">Antes</th><th class="num">Ahora</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let d of differences.items">
                      <td>{{ d.cause }}<div class="muted small" *ngIf="d.reason">Motivo: {{ d.reason }}</div></td>
                      <td class="nowrap">{{ d.operationDate | date: 'dd/MM/yyyy' }}</td>
                      <td>{{ d.description }}<span *ngIf="d.thirdParty"> · {{ d.thirdParty }}</span></td>
                      <td class="nowrap">{{ d.entryLabel || '—' }}</td>
                      <td class="num">{{ d.amountBefore !== null ? (d.amountBefore | gs) : '—' }}</td>
                      <td class="num">{{ d.amountAfter !== null ? (d.amountAfter | gs) : '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Asentar -->
            <div class="post-box" *ngIf="j.canPost">
              <h3>Asentar período</h3>
              <div class="filters">
                <label class="field"><span>Asentar hasta (inclusive)</span><input type="date" [(ngModel)]="postThrough" (ngModelChange)="clearPreview()" [max]="today" /></label>
                <p-button type="button" label="Ver qué se asentaría" icon="pi pi-search" severity="secondary" [outlined]="true"
                          [loading]="previewing" [disabled]="!postThrough" (onClick)="previewPost()"></p-button>
              </div>
              <p-message *ngIf="postError" severity="error" [text]="postError"></p-message>
              <ng-container *ngIf="preview as p">
                <div class="notice info" *ngIf="p.entryCount === 0 && p.correctionEntryCount === 0">
                  No hay movimientos del {{ p.from | date: 'dd/MM/yyyy' }} al {{ p.through | date: 'dd/MM/yyyy' }}. Podés igual dejarlo asentado hasta esa fecha.
                </div>
                <div class="notice info" *ngIf="p.correctionEntryCount > 0 && p.incompleteCount === 0 && !p.draftPeriods.length">
                  Además se corregirán <strong>{{ p.differences.length }} asientos que cambiaron</strong>: se crean {{ p.correctionEntryCount }} asientos
                  (contraasiento y, si el movimiento sigue existiendo, asiento nuevo) con fecha {{ p.through | date: 'dd/MM/yyyy' }}. Los originales no se tocan.
                  <span *ngIf="p.entryCount === 0">Numeración: <strong>{{ p.firstLabel }}</strong> a <strong>{{ p.lastLabel }}</strong>.</span>
                </div>
                <div class="notice info" *ngIf="p.entryCount > 0 && p.incompleteCount === 0 && !p.draftPeriods.length">
                  Se asentarán <strong>{{ p.entryCount }} asientos</strong> del {{ p.from | date: 'dd/MM/yyyy' }} al {{ p.through | date: 'dd/MM/yyyy' }}
                  (<strong>{{ p.firstLabel }}</strong> a <strong>{{ p.lastLabel }}</strong>), por {{ p.totalDebit | gs }}.
                </div>
                <div class="notice" *ngIf="p.draftPeriods.length">
                  <strong>No se puede asentar todavía:</strong> hay gastos o ingresos en períodos en borrador ({{ p.draftPeriods.join(', ') }}).
                  Mientras un período está en borrador se puede editar, así que se asienta recién cuando se publica. Publicalo o elegí una fecha anterior a sus movimientos.
                </div>
                <div class="notice" *ngIf="p.incompleteCount > 0">
                  <strong>{{ p.incompleteCount }} asientos están incompletos</strong> y por eso no se puede asentar: falta la cuenta del plan de {{ p.pending.join(', ') }}.
                  <button type="button" class="link" *ngIf="needsRoles(p.pending)" (click)="setTab('roles')">Asignar las cuentas financieras</button>
                  <a class="link" *ngIf="needsChart(p.pending)" routerLink="/finance/settings" [queryParams]="{ buildingId: buildingId }">Ir al plan de cuentas</a>
                  <div class="small muted" *ngIf="needsChart(p.pending)">Un «(sin rubro)» significa que el plan no tiene una cuenta de esa categoría: en el plan de cuentas asigná la función «Cuenta por defecto…» a una cuenta (solo el SuperAdmin edita el plan).</div>
                </div>
                <div class="actions" *ngIf="p.incompleteCount === 0 && !p.draftPeriods.length">
                  <button type="button" class="btn" [disabled]="posting" (click)="confirmPost()">
                    {{ posting ? 'Asentando...' : (p.entryCount + p.correctionEntryCount > 0 ? 'Asentar ' + (p.entryCount + p.correctionEntryCount) + ' asientos' : 'Asentar hasta esa fecha') }}
                  </button>
                </div>
              </ng-container>
            </div>

            <!-- Filtros -->
            <div class="filters">
              <label class="field" *ngIf="j.fiscalYears.length">
                <span>Ejercicio</span>
                <select [ngModel]="j.fiscalYear" (ngModelChange)="onJournalYear($event)">
                  <option *ngFor="let y of j.fiscalYears" [ngValue]="y">{{ y }}</option>
                </select>
              </label>
              <label class="field"><span>N° de asiento</span><input type="number" min="1" step="1" [(ngModel)]="jNumber" (change)="reloadJournal()" placeholder="Todos" /></label>
              <label class="field"><span>Desde</span><input type="date" [(ngModel)]="jFrom" (ngModelChange)="reloadJournal()" /></label>
              <label class="field"><span>Hasta</span><input type="date" [(ngModel)]="jTo" (ngModelChange)="reloadJournal()" /></label>
            </div>

            <div class="kpis" *ngIf="j.totalCount > 0">
              <div class="kpi"><span>Asientos</span><strong>{{ j.totalCount }}</strong></div>
              <div class="kpi"><span>Ejercicio</span><strong>{{ j.fiscalYear }}</strong></div>
              <div class="kpi"><span>Total debe</span><strong>{{ j.totalDebit | gs }}</strong></div>
              <div class="kpi"><span>Total haber</span><strong>{{ j.totalCredit | gs }}</strong></div>
            </div>

            <p class="muted" *ngIf="!j.entries.length">
              {{ j.postedThrough ? 'No hay asientos con ese filtro.' : 'Cuando asientes un período, sus asientos aparecen acá con su número.' }}
            </p>

            <article class="entry posted" *ngFor="let en of j.entries">
              <header>
                <div>
                  <strong class="entry-no">N° {{ en.label }}</strong>
                  <span class="entry-date">{{ en.date | date: 'dd/MM/yyyy' }}</span>
                  <p-tag *ngIf="en.kind === 'Reversal'" [value]="'Contraasiento del N° ' + (en.reversesLabel || '')" severity="warn" styleClass="tag-sm"></p-tag>
                  <p-tag *ngIf="en.reversedByLabel" [value]="'Anulado por el N° ' + en.reversedByLabel" severity="danger" styleClass="tag-sm"></p-tag>
                  <p-tag *ngIf="en.kind === 'Opening'" value="Apertura" severity="info" styleClass="tag-sm"></p-tag>
                  <p-tag *ngIf="en.kind === 'Closing'" value="Cierre del ejercicio" severity="secondary" styleClass="tag-sm"></p-tag>
                  <span class="muted small" *ngIf="en.operationDate !== en.date"> · operación del {{ en.operationDate | date: 'dd/MM/yyyy' }}</span>
                  <div class="muted small">{{ en.description }}<span *ngIf="en.thirdParty"> · {{ en.thirdParty }}</span><span *ngIf="en.reference"> · {{ en.reference }}</span></div>
                </div>
              </header>
              <table class="t">
                <thead><tr><th>Cuenta</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>
                  <tr *ngFor="let l of en.lines">
                    <td [class.indent]="l.credit > 0 && l.debit === 0">
                      <strong *ngIf="l.code">{{ l.code }}</strong> {{ l.name }}
                      <span class="muted small" *ngIf="l.externalCode">· contador {{ l.externalCode }}</span>
                    </td>
                    <td class="num">{{ l.debit ? (l.debit | gs) : '' }}</td>
                    <td class="num">{{ l.credit ? (l.credit | gs) : '' }}</td>
                  </tr>
                </tbody>
              </table>
            </article>

            <div class="pager" *ngIf="j.totalCount > j.pageSize">
              <button type="button" class="btn secondary sm" [disabled]="j.page <= 1" (click)="journalPage(j.page - 1)">← Anterior</button>
              <span class="muted small">Página {{ j.page }} de {{ pageCount(j) }}</span>
              <button type="button" class="btn secondary sm" [disabled]="j.page >= pageCount(j)" (click)="journalPage(j.page + 1)">Siguiente →</button>
            </div>
          </ng-container>
        </ng-container>

        <!-- ══ LIBRO MAYOR ══ -->
        <ng-container *ngIf="tab === 'ledger'">
          <div class="filters" *ngIf="journal?.fiscalYears?.length">
            <label class="field">
              <span>Ejercicio</span>
              <select [ngModel]="jYear" (ngModelChange)="onJournalYear($event)">
                <option *ngFor="let y of journal!.fiscalYears" [ngValue]="y">{{ y }}</option>
              </select>
            </label>
          </div>
          <app-finance-journal-ledger [buildingId]="buildingId" [buildingName]="buildingName" [fiscalYear]="jYear" [refreshKey]="refreshKey"></app-finance-journal-ledger>
        </ng-container>

        <!-- ══ SUMAS Y SALDOS ══ -->
        <ng-container *ngIf="tab === 'balance'">
          <div class="filters" *ngIf="journal?.fiscalYears?.length">
            <label class="field">
              <span>Ejercicio</span>
              <select [ngModel]="jYear" (ngModelChange)="onJournalYear($event)">
                <option *ngFor="let y of journal!.fiscalYears" [ngValue]="y">{{ y }}</option>
              </select>
            </label>
          </div>
          <app-finance-trial-balance [buildingId]="buildingId" [buildingName]="buildingName" [fiscalYear]="jYear" [refreshKey]="refreshKey"></app-finance-trial-balance>
        </ng-container>

        <!-- ══ BALANCE GENERAL Y ESTADO DE RESULTADOS ══ -->
        <ng-container *ngIf="tab === 'statements'">
          <div class="filters" *ngIf="journal?.fiscalYears?.length">
            <label class="field">
              <span>Ejercicio</span>
              <select [ngModel]="jYear" (ngModelChange)="onJournalYear($event)">
                <option *ngFor="let y of journal!.fiscalYears" [ngValue]="y">{{ y }}</option>
              </select>
            </label>
          </div>
          <app-finance-statements [buildingId]="buildingId" [buildingName]="buildingName" [fiscalYear]="jYear" [refreshKey]="refreshKey"></app-finance-statements>
        </ng-container>

        <!-- ══ CIERRE DEL EJERCICIO ══ -->
        <ng-container *ngIf="tab === 'closing'">
          <div class="filters" *ngIf="journal?.fiscalYears?.length">
            <label class="field">
              <span>Ejercicio</span>
              <select [ngModel]="jYear" (ngModelChange)="onJournalYear($event)">
                <option *ngFor="let y of journal!.fiscalYears" [ngValue]="y">{{ y }}</option>
              </select>
            </label>
          </div>
          <app-finance-fiscal-closing [buildingId]="buildingId" [fiscalYear]="jYear" [refreshKey]="refreshKey" (changed)="onClosingChanged()"></app-finance-fiscal-closing>
        </ng-container>

        <!-- ══ ASIENTOS SUGERIDOS ══ -->
        <ng-container *ngIf="tab === 'entries'">
          <div class="filters">
            <label class="field"><span>Desde</span><input type="date" [(ngModel)]="from" (ngModelChange)="reloadEntries()" /></label>
            <label class="field"><span>Hasta</span><input type="date" [(ngModel)]="to" (ngModelChange)="reloadEntries()" /></label>
          </div>
          <p-message *ngIf="entriesError" severity="error" [text]="entriesError"></p-message>
          <p class="app-state" *ngIf="loadingEntries">Cargando...</p>

          <ng-container *ngIf="entries as e">
            <div class="kpis">
              <div class="kpi"><span>Asientos</span><strong>{{ e.entryCount }}</strong></div>
              <div class="kpi" [class.bad]="e.incompleteCount > 0"><span>Incompletos</span><strong>{{ e.incompleteCount }}</strong></div>
              <div class="kpi"><span>Total debe</span><strong>{{ e.totalDebit | gs }}</strong></div>
              <div class="kpi"><span>Total haber</span><strong>{{ e.totalCredit | gs }}</strong></div>
            </div>

            <div class="notice" *ngIf="e.incompleteCount > 0">
              <strong>{{ e.incompleteCount }} asientos están incompletos</strong> porque falta la cuenta del plan de: {{ e.pending.join(', ') }}.
              <button type="button" class="link" *ngIf="needsRoles(e.pending)" (click)="setTab('roles')">Asignar las cuentas financieras</button>
              <a class="link" *ngIf="needsChart(e.pending)" routerLink="/finance/settings" [queryParams]="{ buildingId: buildingId }">Ir al plan de cuentas</a>
              <div class="small muted" *ngIf="needsChart(e.pending)">Un «(sin rubro)» significa que el plan no tiene una cuenta de esa categoría: en el plan de cuentas asigná la función «Cuenta por defecto…» a una cuenta (solo el SuperAdmin edita el plan).</div>
            </div>

            <p class="muted" *ngIf="!e.entries.length">No hay movimientos en el rango, así que no hay asientos.</p>

            <article class="entry" *ngFor="let en of e.entries" [class.incomplete]="!en.isComplete">
              <header>
                <div>
                  <strong>Sugerido {{ en.number }} · {{ en.date | date: 'dd/MM/yyyy' }}</strong>
                  <p-tag *ngIf="!en.isComplete" value="Incompleto" severity="warn" styleClass="tag-sm"></p-tag>
                  <p-tag *ngIf="en.sourceType === 'OpeningBalance'" value="Apertura" severity="info" styleClass="tag-sm"></p-tag>
                  <p-tag *ngIf="en.sourceType === 'Transfer'" value="Transferencia" severity="secondary" styleClass="tag-sm"></p-tag>
                  <p-tag *ngIf="e.postedThrough && en.date <= e.postedThrough" value="Ya asentado" severity="success" styleClass="tag-sm"></p-tag>
                  <div class="muted small">{{ en.description }}<span *ngIf="en.thirdParty"> · {{ en.thirdParty }}</span><span *ngIf="en.reference"> · {{ en.reference }}</span></div>
                </div>
              </header>
              <table class="t">
                <thead><tr><th>Cuenta</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                <tbody>
                  <tr *ngFor="let l of en.lines" [class.missing]="l.missing">
                    <td [class.indent]="l.credit > 0 && l.debit === 0">
                      <strong *ngIf="l.code">{{ l.code }}</strong> {{ l.name }}
                      <span class="muted small" *ngIf="l.externalCode">· contador {{ l.externalCode }}</span>
                    </td>
                    <td class="num">{{ l.debit ? (l.debit | gs) : '' }}</td>
                    <td class="num">{{ l.credit ? (l.credit | gs) : '' }}</td>
                  </tr>
                </tbody>
              </table>
            </article>

            <h3 *ngIf="e.totals.length">Sumas por cuenta</h3>
            <div class="table-wrap" *ngIf="e.totals.length">
              <table class="t">
                <thead><tr><th>Cuenta</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead>
                <tbody>
                  <tr *ngFor="let t of e.totals" [class.missing]="t.missing">
                    <td><strong *ngIf="t.code">{{ t.code }}</strong> {{ t.name }}<span class="muted small" *ngIf="t.missing"> (sin cuenta del plan)</span></td>
                    <td class="num">{{ t.debit | gs }}</td>
                    <td class="num">{{ t.credit | gs }}</td>
                    <td class="num">{{ t.debit - t.credit | gs }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="muted small">El «Sugerido n» es solo el orden en esta lista y cambia con el filtro: el número real del asiento lo da el Libro diario al asentar.</p>
            <p class="muted small">Criterio de caja: un asiento por cada cobro, gasto, ingreso o nota de crédito del proveedor del libro. No incluye apertura, transferencias entre cuentas propias ni retenciones. El paquete del contador (Excel del ejercicio) trae estas mismas hojas.</p>
          </ng-container>
        </ng-container>

        <!-- ══ CUENTAS DEL PLAN ══ -->
        <ng-container *ngIf="tab === 'roles'">
          <p-message *ngIf="rolesError" severity="error" [text]="rolesError"></p-message>
          <p class="app-state" *ngIf="loadingRoles">Cargando...</p>

          <ng-container *ngIf="roles as r">
            <p class="muted small">
              Cada cuenta financiera del edificio y el IVA crédito necesitan su cuenta del plan (de activo o de fondos) para armar los asientos.
              <span *ngIf="!r.canEdit"> Solo el SuperAdmin y el Administrador de empresa pueden asignarlas.</span>
            </p>
            <div class="notice info" *ngIf="r.isComplete">Todas las cuentas tienen su cuenta del plan.</div>

            <div class="table-wrap">
              <table class="t">
                <thead><tr><th>Cuenta financiera</th><th>Tipo</th><th>Cuenta del plan</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let a of r.accounts" [class.inactive]="!a.isActive" [class.changed]="selection[a.financialAccountId] !== original[a.financialAccountId]">
                    <td><strong>{{ a.name }}</strong> <span class="muted small" *ngIf="!a.isActive">(inactiva)</span></td>
                    <td>{{ typeLabel(a) }}</td>
                    <td>
                      <select class="cell-select" [(ngModel)]="selection[a.financialAccountId]" [disabled]="!r.canEdit">
                        <option [ngValue]="''">Sin asignar</option>
                        <optgroup *ngFor="let g of groups" [label]="g.name">
                          <option *ngFor="let o of g.items" [ngValue]="o.id">{{ o.code }} · {{ o.name }}{{ o.isActive ? '' : ' (inactiva)' }}</option>
                        </optgroup>
                      </select>
                    </td>
                    <td class="num">
                      <button type="button" class="link" *ngIf="r.canEdit && !selection[a.financialAccountId] && a.suggestedCategoryId" (click)="selection[a.financialAccountId] = a.suggestedCategoryId!">
                        Usar {{ optionLabel(a.suggestedCategoryId) }}
                      </button>
                    </td>
                  </tr>
                  <tr [class.changed]="vatSelection !== vatOriginal">
                    <td><strong>IVA crédito fiscal</strong></td>
                    <td>Compras</td>
                    <td>
                      <select class="cell-select" [(ngModel)]="vatSelection" [disabled]="!r.canEdit">
                        <option [ngValue]="''">Sin asignar</option>
                        <optgroup *ngFor="let g of vatGroups" [label]="g.name">
                          <option *ngFor="let o of g.items" [ngValue]="o.id">{{ o.code }} · {{ o.name }}{{ o.isActive ? '' : ' (inactiva)' }}</option>
                        </optgroup>
                      </select>
                    </td>
                    <td class="num">
                      <button type="button" class="link" *ngIf="r.canEdit && !vatSelection && r.suggestedVatCreditCategoryId" (click)="vatSelection = r.suggestedVatCreditCategoryId!">
                        Usar {{ optionLabel(r.suggestedVatCreditCategoryId) }}
                      </button>
                    </td>
                  </tr>
                  <tr [class.changed]="equitySelection !== equityOriginal">
                    <td><strong>Contrapartida de la apertura</strong><div class="muted small">De dónde salieron los saldos iniciales de las cuentas financieras.</div></td>
                    <td>Apertura</td>
                    <td>
                      <select class="cell-select" [(ngModel)]="equitySelection" [disabled]="!r.canEdit">
                        <option [ngValue]="''">Por defecto: {{ optionLabel(r.defaultOpeningEquityCategoryId) || 'ninguna en el plan' }}</option>
                        <optgroup *ngFor="let g of fundGroups" [label]="g.name">
                          <option *ngFor="let o of g.items" [ngValue]="o.id">{{ o.code }} · {{ o.name }}{{ o.isActive ? '' : ' (inactiva)' }}</option>
                        </optgroup>
                      </select>
                    </td>
                    <td></td>
                  </tr>
                  <tr [class.changed]="resultSelection !== resultOriginal">
                    <td><strong>Resultado del ejercicio</strong><div class="muted small">Donde se saldan los ingresos y gastos al cerrar el ejercicio.</div></td>
                    <td>Cierre</td>
                    <td>
                      <select class="cell-select" [(ngModel)]="resultSelection" [disabled]="!r.canEdit">
                        <option [ngValue]="''">Por defecto: {{ optionLabel(r.defaultPeriodResultCategoryId) || 'ninguna en el plan' }}</option>
                        <optgroup *ngFor="let g of fundGroups" [label]="g.name">
                          <option *ngFor="let o of g.items" [ngValue]="o.id">{{ o.code }} · {{ o.name }}{{ o.isActive ? '' : ' (inactiva)' }}</option>
                        </optgroup>
                      </select>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="actions" *ngIf="r.canEdit">
              <button type="button" class="btn" [disabled]="saving || !changedCount" (click)="saveRoles()">
                {{ saving ? 'Guardando...' : (changedCount ? 'Guardar ' + changedCount + ' cambios' : 'Sin cambios') }}
              </button>
              <button type="button" class="btn secondary" [disabled]="saving || !suggestionCount" (click)="applySuggestions()">Usar todas las sugeridas ({{ suggestionCount }})</button>
            </div>
            <p class="muted small">Las sugeridas salen del nombre y el tipo de cada cuenta; no se aplican solas. Se admiten cuentas del plan inactivas (por ejemplo, el IVA crédito fiscal viene sin activar). Cada cambio queda en el historial del Centro de configuración.</p>
          </ng-container>
        </ng-container>
      </ng-container>
    </p-card>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .controls { display: flex; gap: 0.9rem; align-items: flex-end; flex-wrap: wrap; }
    .tabs { display: flex; gap: 0.25rem; border-bottom: 2px solid rgba(19,133,182,0.1); margin: 0.6rem 0 1rem; }
    .tabs button { background: none; border: none; padding: 0.6rem 1.1rem; cursor: pointer; font: inherit; font-size: 0.92rem; font-weight: 600; color: var(--brand-muted); border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tabs button.active { color: #1385B6; border-bottom-color: #1385B6; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e0a23b; margin-left: 0.3rem; }
    .filters { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.8rem; align-items: flex-end; }
    .posted-banner { display: grid; gap: 0.2rem; padding: 0.8rem 1.1rem; margin: 0.4rem 0 1rem; border-radius: 12px; border: 1px solid #6AC64A; background: rgba(106,198,74,0.1); }
    .posted-banner.none { border-color: #e0a23b; background: rgba(224,162,59,0.08); }
    .posted-banner strong { font-size: 1.05rem; color: var(--brand-ink); }
    .post-box { padding: 0.2rem 1.1rem 0.9rem; margin: 0 0 1rem; border: 1px solid var(--brand-border); border-radius: 12px; }
    .entry.posted { border-left: 4px solid #1385B6; }
    .entry-no { font-size: 1.1rem; color: #1385B6; }
    .entry-date { margin-left: 0.7rem; font-weight: 600; color: var(--brand-ink); }
    .pager { display: flex; gap: 1rem; align-items: center; justify-content: center; margin: 1rem 0; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin: 0.8rem 0; }
    .kpi { display: grid; gap: 0.25rem; padding: 0.9rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.2rem; color: var(--brand-ink); }
    .kpi.bad { border-color: #e0a23b; background: rgba(224,162,59,0.07); }
    .entry { border: 1px solid var(--brand-border); border-radius: 12px; padding: 0.7rem 1rem 0.4rem; margin-bottom: 0.7rem; }
    .entry.incomplete { border-color: #e0a23b; }
    .entry header { margin-bottom: 0.3rem; }
    .entry table.t td, .entry table.t th { padding: 0.3rem 0.5rem; }
    td.indent { padding-left: 2rem !important; }
    tr.missing td { color: #c9473b; }
    tr.inactive td { opacity: 0.7; }
    tr.changed td { background: rgba(224,162,59,0.1); }
    .cell-select { padding: 0.3rem 0.5rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 8px; font: inherit; font-size: 0.9rem; background: var(--surface-ground, #f8fafc); color: var(--brand-ink); min-width: 22rem; max-width: 100%; }
    .link { background: none; border: none; color: #1385B6; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 0; }
    :host ::ng-deep .tag-sm .p-tag, :host ::ng-deep .tag-sm.p-tag { font-size: 0.68rem; padding: 0.1rem 0.45rem; margin-left: 0.5rem; }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } .cell-select { min-width: 12rem; } }
  `]
})
export class FinanceAccountingPageComponent {
  private readonly api = inject(AccountingApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  buildingName = '';
  tab: Tab = 'journal';
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';
  loading = false;

  // Asientos
  entries: AccountingEntries | null = null;
  from = '';
  to = '';
  loadingEntries = false;
  entriesError = '';
  exporting = false;

  // Libro diario (asentados)
  readonly today = isoDate(new Date());
  journal: Journal | null = null;
  differences: JournalDifferences | null = null;
  loadingJournal = false;
  journalError = '';
  jYear: number | null = null;
  jNumber: number | null = null;
  jFrom = '';
  jTo = '';
  jPage = 1;
  // Impresión del Libro Diario: primer folio (por defecto el siguiente a los folios usados de la rúbrica) y archivo que se está generando.
  startFolio: number | null = null;
  printing: '' | 'pdf' | 'excel' = '';
  // Cambia al asentar: los libros derivados (Mayor y sumas y saldos) vuelven a leer.
  refreshKey = 0;
  postThrough = '';
  preview: JournalPreview | null = null;
  previewing = false;
  posting = false;
  postError = '';

  // Cuentas del plan
  roles: AccountingRoles | null = null;
  groups: OptionGroup[] = [];
  vatGroups: OptionGroup[] = [];
  selection: Record<string, string> = {};
  original: Record<string, string> = {};
  vatSelection = '';
  vatOriginal = '';
  fundGroups: OptionGroup[] = [];
  equitySelection = '';
  equityOriginal = '';
  resultSelection = '';
  resultOriginal = '';
  loadingRoles = false;
  rolesError = '';
  saving = false;

  get changedCount(): number {
    const accounts = this.roles?.accounts.filter(a => this.selection[a.financialAccountId] !== this.original[a.financialAccountId]).length ?? 0;
    return accounts + (this.vatSelection !== this.vatOriginal ? 1 : 0)
      + (this.equitySelection !== this.equityOriginal ? 1 : 0) + (this.resultSelection !== this.resultOriginal ? 1 : 0);
  }

  // Cuentas sin asignar que tienen una sugerida.
  get suggestionCount(): number {
    const accounts = this.roles?.accounts.filter(a => !this.selection[a.financialAccountId] && a.suggestedCategoryId).length ?? 0;
    return accounts + (!this.vatSelection && this.roles?.suggestedVatCreditCategoryId ? 1 : 0);
  }

  typeLabel(a: AccountingRoleAccount): string { return ACCOUNT_TYPE_LABELS[a.type] ?? a.type; }

  optionLabel(id: string | null): string {
    const o = this.roles?.options.find(x => x.id === id);
    return o ? `${o.code} ${o.name}` : '';
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.cdr.markForCheck();
  }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.buildingName = building.buildingName;
    this.from = this.to = '';
    this.entries = null;
    this.roles = null;
    this.errorKind = '';
    this.journal = null;
    this.differences = null;
    this.startFolio = null;
    this.jYear = this.jNumber = null;
    this.jFrom = this.jTo = this.postThrough = '';
    this.jPage = 1;
    this.preview = null;
    this.postError = '';
    this.loadJournal();
    this.loadEntries();
    this.loadRoles();
  }

  // ── Libro diario ──

  reloadJournal(): void {
    this.jPage = 1;
    this.loadJournal();
  }

  onJournalYear(year: number): void {
    this.jYear = year;
    this.reloadJournal();
  }

  journalPage(page: number): void {
    this.jPage = page;
    this.loadJournal();
  }

  // Lo pendiente puede ser una cuenta financiera o el IVA (se asignan en «Cuentas del plan») o un rubro (se resuelve en el plan de cuentas).
  needsChart(pending: string[]): boolean { return pending.some(p => p.startsWith('Rubro:')); }
  needsRoles(pending: string[]): boolean { return pending.some(p => !p.startsWith('Rubro:')); }

  // Se cerró o reabrió un ejercicio: el Libro diario (nuevos asientos) y los libros derivados vuelven a leer.
  onClosingChanged(): void {
    this.refreshKey++;
    this.loadJournal();
  }

  pageCount(j: Journal): number { return Math.max(1, Math.ceil(j.totalCount / j.pageSize)); }

  clearPreview(): void {
    this.preview = null;
    this.postError = '';
  }

  previewPost(): void {
    if (!this.postThrough || this.previewing) return;

    this.previewing = true;
    this.postError = '';
    this.api.previewJournal(this.buildingId, this.postThrough).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: preview => {
        this.preview = preview;
        this.previewing = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.preview = null;
        this.previewing = false;
        this.postError = extractApiErrorMessage(err, 'No se pudo calcular qué se asentaría.');
        this.cdr.markForCheck();
      }
    });
  }

  confirmPost(): void {
    const p = this.preview;
    if (!p || this.posting || p.incompleteCount > 0 || p.draftPeriods.length > 0) return;

    const total = p.entryCount + p.correctionEntryCount;
    const fixes = p.correctionEntryCount > 0 ? ` Incluye ${p.correctionEntryCount} asientos de corrección (contraasientos y asientos nuevos).` : '';
    const text = total > 0
      ? `Se asentarán ${total} asientos (${p.firstLabel} a ${p.lastLabel}) hasta el ${shortDate(p.through)}.${fixes} Lo asentado no se puede modificar. ¿Continuar?`
      : `Se dejará asentado hasta el ${shortDate(p.through)} sin movimientos. ¿Continuar?`;
    if (!confirm(text)) return;

    this.posting = true;
    this.postError = '';
    this.api.postJournal(this.buildingId, p.through).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.posting = false;
        this.preview = null;
        this.postThrough = '';
        this.jYear = null;
        this.jPage = 1;
        this.refreshKey++;
        this.msg.add({
          severity: 'success', life: 5000,
          summary: result.postedCount > 0 ? `Se asentaron ${result.postedCount} asientos` : 'Período asentado',
          detail: result.postedCount > 0 ? `${result.firstLabel} a ${result.lastLabel}` : undefined
        });
        this.loadJournal();
        // Los sugeridos marcan hasta qué día ya están asentados.
        this.loadEntries();
        this.cdr.markForCheck();
      },
      error: err => {
        this.posting = false;
        this.postError = extractApiErrorMessage(err, 'No se pudo asentar.');
        this.cdr.markForCheck();
      }
    });
  }

  onError(err: unknown): void { this.setBlockingError(err); }

  reloadEntries(): void { this.loadEntries(); }

  applySuggestions(): void {
    for (const a of this.roles?.accounts ?? []) {
      if (!this.selection[a.financialAccountId] && a.suggestedCategoryId) this.selection[a.financialAccountId] = a.suggestedCategoryId;
    }

    if (!this.vatSelection && this.roles?.suggestedVatCreditCategoryId) this.vatSelection = this.roles.suggestedVatCreditCategoryId;
    this.cdr.markForCheck();
  }

  saveRoles(): void {
    if (!this.roles) return;

    const accounts = this.roles.accounts
      .filter(a => this.selection[a.financialAccountId] !== this.original[a.financialAccountId])
      .map(a => ({ financialAccountId: a.financialAccountId, ledgerCategoryId: this.selection[a.financialAccountId] || null }));
    const vatChanged = this.vatSelection !== this.vatOriginal;
    const equityChanged = this.equitySelection !== this.equityOriginal;
    const resultChanged = this.resultSelection !== this.resultOriginal;

    this.saving = true;
    this.api.updateRoles(this.buildingId, {
      accounts, setVatCredit: vatChanged, vatCreditCategoryId: vatChanged ? this.vatSelection || null : null,
      setOpeningEquity: equityChanged, openingEquityCategoryId: equityChanged ? this.equitySelection || null : null,
      setPeriodResult: resultChanged, periodResultCategoryId: resultChanged ? this.resultSelection || null : null
    })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: roles => {
          this.setRoles(roles);
          this.saving = false;
          this.msg.add({ severity: 'success', summary: 'Cuentas del plan guardadas', life: 3500 });
          // Los asientos dependen de estas cuentas: se vuelven a armar.
          this.loadEntries();
          this.cdr.markForCheck();
        },
        error: err => {
          this.saving = false;
          this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudieron guardar las cuentas del plan.'), life: 7000 });
          this.cdr.markForCheck();
        }
      });
  }

  // Libro Diario del ejercicio con folios: PDF para imprimir y rubricar, o Excel.
  downloadBook(format: 'pdf' | 'excel'): void {
    if (this.printing || !this.journal || !this.startFolio || this.startFolio < 1) return;

    this.printing = format;
    const year = this.journal.fiscalYear;
    this.api.downloadBook(this.buildingId, format, year, Math.floor(this.startFolio)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        saveBlob(blob, bookFileName('libro-diario', this.buildingName, year, format === 'pdf' ? 'pdf' : 'xlsx'));
        this.printing = '';
        this.msg.add({ severity: 'success', summary: format === 'pdf' ? 'Libro Diario generado' : 'Excel generado', life: 4000 });
        this.cdr.markForCheck();
      },
      error: async err => {
        const detail = await exportErrorMessage(err, 'No se pudo generar el Libro Diario.');
        this.printing = '';
        this.msg.add({ severity: 'error', summary: 'Error', detail, life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  download(): void {
    if (this.exporting || !this.entries) return;

    this.exporting = true;
    const fileName = exportFileName('asientos', this.buildingName, `${this.entries.from.split('-').join('')}-${this.entries.to.split('-').join('')}`);
    this.api.downloadEntries(this.buildingId, this.entries.from, this.entries.to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
        this.msg.add({ severity: 'success', summary: 'Excel generado', detail: fileName, life: 4000 });
        this.cdr.markForCheck();
      },
      error: async err => {
        const detail = await exportErrorMessage(err, 'No se pudo generar el Excel.');
        this.exporting = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail, life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  // Asientos asentados que cambiaron. Con diferencias y nada nuevo que asentar, la fecha sugerida es el propio «asentado hasta»
  // (alcanza para asentar solo las correcciones).
  private loadDifferences(): void {
    this.api.getJournalDifferences(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: differences => {
        this.differences = differences;
        if (!this.postThrough && differences.items.length > 0 && differences.postedThrough) this.postThrough = differences.postedThrough;
        this.cdr.markForCheck();
      },
      error: () => {
        this.differences = null;
        this.cdr.markForCheck();
      }
    });
  }

  private loadJournal(): void {
    this.loadingJournal = true;
    this.journalError = '';
    this.api.getJournal(this.buildingId, {
      fiscalYear: this.jYear ?? undefined, from: this.jFrom || undefined, to: this.jTo || undefined,
      number: this.jNumber || undefined, page: this.jPage, pageSize: JOURNAL_PAGE_SIZE
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: journal => {
        this.journal = journal;
        this.jYear = journal.fiscalYear;
        // Primer folio para imprimir: el siguiente a los folios usados de la rúbrica (se puede cambiar a mano).
        if (this.startFolio === null) this.startFolio = journal.suggestedStartFolio;
        // Fecha sugerida para asentar: ayer, si todavía no está asentada.
        if (!this.postThrough) {
          const yesterday = isoDate(new Date(Date.now() - 86_400_000));
          this.postThrough = journal.postedThrough && yesterday <= journal.postedThrough ? '' : yesterday;
        }

        this.loadingJournal = false;
        this.loadDifferences();
        this.cdr.markForCheck();
      },
      error: err => {
        const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el Libro diario.');
        this.journal = null;
        this.loadingJournal = false;
        if (kind === 'other') {
          this.journalError = message;
        } else {
          this.errorKind = kind;
          this.errorMessage = message;
        }
        this.cdr.markForCheck();
      }
    });
  }

  private loadEntries(): void {
    this.loadingEntries = true;
    this.entriesError = '';
    this.api.getEntries(this.buildingId, this.from || undefined, this.to || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: entries => {
        this.entries = entries;
        // El backend resuelve las fechas por defecto (el mes en curso): se muestran en los filtros.
        this.from = entries.from;
        this.to = entries.to;
        this.loadingEntries = false;
        this.cdr.markForCheck();
      },
      error: err => {
        const { kind, message } = classifyFinanceError(err, 'No se pudieron armar los asientos.');
        this.entries = null;
        this.loadingEntries = false;
        if (kind === 'other') {
          this.entriesError = message;
        } else {
          this.errorKind = kind;
          this.errorMessage = message;
        }
        this.cdr.markForCheck();
      }
    });
  }

  private loadRoles(): void {
    this.loadingRoles = true;
    this.rolesError = '';
    this.api.getRoles(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: roles => {
        this.setRoles(roles);
        this.loadingRoles = false;
        this.cdr.markForCheck();
      },
      error: err => {
        const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar las cuentas del plan.');
        this.roles = null;
        this.loadingRoles = false;
        if (kind === 'other') this.rolesError = message;
        this.cdr.markForCheck();
      }
    });
  }

  private setRoles(roles: AccountingRoles): void {
    this.roles = roles;
    this.selection = {};
    this.original = {};
    for (const a of roles.accounts) {
      this.selection[a.financialAccountId] = a.ledgerCategoryId ?? '';
      this.original[a.financialAccountId] = a.ledgerCategoryId ?? '';
    }

    this.vatSelection = roles.vatCreditCategoryId ?? '';
    this.vatOriginal = roles.vatCreditCategoryId ?? '';
    this.equitySelection = roles.openingEquityCategoryId ?? '';
    this.equityOriginal = roles.openingEquityCategoryId ?? '';
    this.resultSelection = roles.periodResultCategoryId ?? '';
    this.resultOriginal = roles.periodResultCategoryId ?? '';
    // La contrapartida de la apertura y el resultado son cuentas finales de fondos o patrimonio.
    this.fundGroups = this.group(roles.options.filter(o => o.type === 'Fund'));
    this.groups = this.group(roles.options);
    // El IVA crédito es una cuenta de activo (no de fondos).
    this.vatGroups = this.group(roles.options.filter(o => o.type === 'Asset'));
  }

  private group(options: AccountingPlanOption[]): OptionGroup[] {
    const map = new Map<string, AccountingPlanOption[]>();
    for (const o of options) {
      const key = o.groupName || 'Otras cuentas';
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }

    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }

  private setBlockingError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudieron cargar los asientos.');
    this.entries = null;
    this.roles = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}

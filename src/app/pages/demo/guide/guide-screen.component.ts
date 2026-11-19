import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import { LOGIN_TX } from '../../auth/login.i18n';
import { GuideCard, GuideTx } from './guide.i18n';
import { GuideField, GuideUiState } from './guide.script';

// «Web simulada» dentro del monitor: lienzo fijo de 960×540 px con datos ficticios, sin llamadas al servidor.
@Component({
  standalone: true,
  selector: 'app-guide-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="web">
      @if (ui().screen === 'off') {
        <div class="off"></div>
      } @else {
        <div class="bar">
          <i class="dot" style="background:#ff5f57"></i><i class="dot" style="background:#febc2e"></i><i class="dot" style="background:#28c840"></i>
          <div class="addr" data-guide="url" [class.hl]="highlight() === 'url'">
            <i class="pi pi-lock"></i><span>{{ fields().url }}</span>@if (typing() === 'url') { <span class="caret"></span> }
          </div>
        </div>
        <div class="body">
          @switch (ui().screen) {
            @case ('browser') {
              <div class="blank">
                <img src="/brand/expenses-icon.svg" width="96" alt="" />
                <p>expenses.com.py</p>
              </div>
            }
            @case ('login') {
              <div class="login">
                <div class="side">
                  <img src="/brand/expenses-icon-white.svg" width="64" alt="" />
                  <b>Expenses</b>
                  <span>{{ tx().web.slogan }}</span>
                </div>
                <div class="form">
                  <h2>{{ login().formTitle }}</h2>
                  <p class="sub">{{ login().formSub }}</p>
                  <label>{{ login().userLabel }}</label>
                  <div class="fld" data-guide="user" [class.hl]="highlight() === 'user'" [class.focus]="typing() === 'user'">
                    @if (fields().user) { <span>{{ fields().user }}</span> } @else { <span class="ph">{{ login().userPlaceholder }}</span> }
                    @if (typing() === 'user') { <span class="caret"></span> }
                  </div>
                  <label>{{ login().passLabel }}</label>
                  <div class="fld" data-guide="pass" [class.hl]="highlight() === 'pass'" [class.focus]="typing() === 'pass'">
                    @if (fields().pass) { <span>{{ fields().pass }}</span> } @else { <span class="ph">{{ login().passPlaceholder }}</span> }
                    @if (typing() === 'pass') { <span class="caret"></span> }
                  </div>
                  <div class="btn-login" data-guide="login-btn" [class.hl]="highlight() === 'login-btn'">{{ login().submit }}</div>
                </div>
              </div>
            }
            @default {
              <div class="shell">
                <div class="top">
                  <div class="brand"><img src="/brand/expenses-icon.svg" width="30" alt="" /><b>Expenses</b></div>
                  <div class="right">
                    <span class="bellw"><i class="pi pi-bell" [attr.aria-label]="tx().web.bell"></i>@if (ui().alert) { <span class="nb">1</span> }</span>
                    <div class="chip"><span class="av">AD</span>{{ tx().web.user }}</div>
                  </div>
                </div>
                <div class="main">
                  <div class="menu">
                    <div class="mt">{{ tx().web.menuMain }}</div>
                    <div class="mi" [class.act]="ui().screen === 'panel'"><i class="pi pi-chart-pie"></i>{{ tx().web.summary }}</div>
                    <div class="mi" data-guide="menu-pagos" [class.hl]="highlight() === 'menu-pagos'" [class.act]="ui().screen === 'payments' || ui().screen === 'payment'"><i class="pi pi-wallet"></i>{{ tx().web.payments }}</div>
                    <div class="mt">{{ tx().web.menuManage }}</div>
                    <div class="mi"><i class="pi pi-home"></i><span class="grow">{{ tx().web.property }}</span><i class="pi pi-chevron-down"></i></div>
                    <div class="mi" data-guide="menu-cobros" [class.hl]="highlight() === 'menu-cobros'">
                      <i class="pi pi-calendar"></i><span class="grow">{{ tx().web.collections }}</span><i class="pi" [class.pi-chevron-up]="ui().menuOpen" [class.pi-chevron-down]="!ui().menuOpen"></i>
                    </div>
                    @if (ui().menuOpen) {
                      <div class="sub-items">
                        <div class="mi" [class.act]="ui().screen === 'ledger'"><i class="pi pi-list"></i>{{ tx().web.ledger }}</div>
                        <div class="mi" data-guide="menu-periodos" [class.hl]="highlight() === 'menu-periodos'" [class.act]="isPeriodsScreen()"><i class="pi pi-calendar"></i>{{ tx().web.periods }}</div>
                        <div class="mi"><i class="pi pi-file-pdf"></i>{{ tx().web.statements }}</div>
                        <div class="mi"><i class="pi pi-exclamation-triangle"></i>{{ tx().web.morosity }}</div>
                      </div>
                    }
                    <div class="mi"><i class="pi pi-chart-bar"></i>{{ tx().web.reports }}</div>
                  </div>
                  <div class="content">
                    @if (ui().screen === 'panel') {
                      <h1>{{ tx().web.summary }}</h1>
                      <div class="kpis">
                        <div class="kpi"><small>{{ tx().web.kpiUnits }}</small><b>24</b></div>
                        <div class="kpi"><small>{{ tx().web.kpiUpToDate }}</small><b style="color:#2f7a1b">19</b></div>
                        <div class="kpi"><small>{{ tx().web.kpiDebt }}</small><b style="color:#cf4b3f">5</b></div>
                      </div>
                      <div class="kpi chart">
                        <small>{{ tx().web.chartTitle }}</small>
                        <div class="bars">
                          @for (h of bars; track $index) { <i [style.height.%]="h"></i> }
                        </div>
                      </div>
                    } @else if (ui().screen === 'ledger') {
                      <div class="panel">
                        <div class="phead"><div><h1>{{ tx().web.ledgerTitle }}</h1><p class="sub">{{ tx().web.ledgerSub }}</p></div></div>
                        <div class="ghead">
                          <i class="pi pi-chevron-down"></i>
                          <span class="gt"><strong>{{ tx().web.cloneName }}</strong><small>{{ tx().values.building }}</small></span>
                          <span class="gc">{{ tx().web.expensesCount(tx().web.rows.length) }}</span>
                          <strong>{{ ui().edited ? tx().web.totalEdited : tx().web.totalBase }}</strong>
                        </div>
                        <div class="lrow lhead"><span>{{ tx().web.colDesc }}</span><span>{{ tx().web.colDist }}</span><span class="r">{{ tx().web.colAmount }}</span><span class="r">{{ tx().web.colActions }}</span></div>
                        @for (r of tx().web.rows; track r.id) {
                          <div class="lrow" [attr.data-guide]="r.id === 'power' ? 'row-power' : null" [class.hl]="r.id === 'power' && highlight() === 'row-power'">
                            <div>
                              <strong>{{ r.desc }}</strong> <small class="tag">{{ r.supplier }}</small>
                              @if (r.id === 'power' && ui().attached) { <small class="tag file"><i class="pi pi-file-pdf"></i> {{ tx().values.invoiceFile }}</small> }
                            </div>
                            <span>{{ tx().web.distAll }}</span>
                            <span class="r"><strong [class.chg]="r.id === 'power' && ui().edited">{{ r.id === 'power' && ui().edited ? tx().web.amountNew : r.amount }}</strong></span>
                            <span class="r lacts">
                              @if (r.id === 'power' && ui().attached) { <i class="pi pi-file-pdf blue"></i> }
                              @else { <i class="pi pi-paperclip" [attr.data-guide]="r.id === 'power' ? 'btn-attach-power' : null" [class.hl]="r.id === 'power' && highlight() === 'btn-attach-power'"></i> }
                              <i class="pi pi-pencil" [attr.data-guide]="r.id === 'power' ? 'btn-edit-power' : null" [class.hl]="r.id === 'power' && highlight() === 'btn-edit-power'"></i>
                            </span>
                          </div>
                        }
                        @if (ui().editOpen) {
                          <div class="editbar">
                            <div class="et"><i class="pi pi-pencil"></i> <strong>{{ tx().web.editTitle }}</strong></div>
                            <label>{{ tx().web.fAmount }}</label>
                            <div class="fld" data-guide="f-amount" [class.hl]="highlight() === 'f-amount'" [class.focus]="typing() === 'amount'">
                              <span>Gs. {{ fields().amount || tx().values.amountOld }}</span>@if (typing() === 'amount') { <span class="caret"></span> }
                            </div>
                            <span class="b1" data-guide="btn-save" [class.hl]="highlight() === 'btn-save'"><i class="pi pi-check"></i>{{ tx().web.save }}</span>
                          </div>
                        }
                      </div>
                    } @else if (ui().screen === 'payments') {
                      @let pay = tx().web.pay;
                      <div class="panel">
                        <h1>{{ pay.listTitle }}</h1>
                        <p class="sub">{{ pay.listSub }}</p>
                        <div class="mtabs">
                          <span class="mtab on"><i class="pi pi-mobile"></i> {{ pay.tabApp }} <em>{{ pay.tabAppBadge }}</em></span>
                          <span class="mtab"><i class="pi pi-desktop"></i> {{ pay.tabSystem }}</span>
                        </div>
                        <div class="fchips">
                          <span class="fc">{{ pay.fAll }} 1</span>
                          <span class="fc on">{{ pay.fPending }} 1</span>
                          <span class="fc">{{ pay.fReview }}</span>
                          <span class="fc">{{ pay.fApproved }}</span>
                          <span class="fc">{{ pay.fRejected }}</span>
                        </div>
                        <div class="ghead">
                          <i class="pi pi-building"></i>
                          <span class="gt"><strong>{{ tx().values.building }}</strong></span>
                          <span class="gcount">1</span>
                          <em class="gbadge">{{ pay.tabAppBadge }}</em>
                        </div>
                        <div class="lrow lhead pl"><span>{{ pay.colRef }}</span><span>{{ pay.colOwner }}</span><span>{{ pay.colDate }}</span><span class="r">{{ pay.colAmount }}</span><span>{{ pay.colState }}</span><span>{{ pay.colSent }}</span></div>
                        <div class="lrow pl" data-guide="row-pay" [class.hl]="highlight() === 'row-pay'">
                          <b class="lnk">{{ pay.ref }}</b>
                          <span>{{ pay.owner }}</span>
                          <span>{{ pay.date }}</span>
                          <span class="r">{{ pay.declared }}</span>
                          <span><span class="st draft">{{ pay.stPending }}</span></span>
                          <span>{{ pay.sent }}</span>
                        </div>
                      </div>
                    } @else if (ui().screen === 'payment') {
                      @let pay = tx().web.pay;
                      <div class="panel pd">
                        <div class="pdh">
                          <h1>{{ pay.detailTitle }}</h1>
                          <span class="mono">{{ pay.ref }}</span>
                          @if (ui().pay === 'pending') { <span class="st draft pst">{{ pay.stPending }}</span> }
                          @else if (ui().pay === 'review') { <span class="st info pst">{{ pay.stReview }}</span> }
                          @else { <span class="st published pst">{{ pay.stApproved }}</span> }
                        </div>
                        @if (ui().pay !== 'approved') {
                          <div class="pdgrid">
                            <div class="pcol">
                              <div class="card">
                                <strong>{{ pay.secData }}</strong>
                                <div class="kv"><span>{{ pay.lOwner }}</span><b>{{ pay.owner }}</b></div>
                                <div class="kv"><span>{{ pay.lRef }}</span><b>{{ pay.ref }}</b></div>
                                <div class="kv"><span>{{ pay.lDate }}</span><b>{{ pay.date }}</b></div>
                                <div class="kv"><span>{{ pay.lDeclared }}</span><b>{{ pay.declared }}</b></div>
                                <div class="kv"><span>{{ pay.lSent }}</span><b>{{ pay.sent }}</b></div>
                                @if (ui().pay === 'review') {
                                  <div class="kv"><span>{{ pay.lReviewed }}</span><b class="chg">{{ tx().values.payAmount }}</b></div>
                                }
                              </div>
                              <div class="card">
                                <strong>{{ pay.secUnits }}</strong>
                                <div class="urow"><span>{{ pay.unit }}</span><span>{{ tx().values.building }}</span><b>{{ pay.declared }}</b></div>
                              </div>
                            </div>
                            <div class="card" data-guide="proof" [class.hl]="highlight() === 'proof'">
                              <strong>{{ pay.secProof }}</strong>
                              <div class="receipt">
                                <span class="rok"><i class="pi pi-check"></i></span>
                                <b>{{ pay.proofTitle }}</b>
                                <i class="rbar"></i>
                                <span class="rl">{{ pay.proofLine1 }}</span>
                                <i class="rbar s"></i>
                                <span class="rl">{{ pay.proofLine2 }}</span>
                                <i class="rbar"></i>
                                <span class="rl big">{{ pay.proofLine3 }}</span>
                              </div>
                            </div>
                          </div>
                          <div class="act-sec">
                            @if (ui().pay === 'pending') {
                              <strong>{{ pay.secReview }}</strong>
                              <small>{{ pay.reviewHint }}</small>
                              <div class="arow">
                                <label>{{ pay.lProofAmount }}</label>
                                <div class="fld" data-guide="f-payamount" [class.hl]="highlight() === 'f-payamount'" [class.focus]="typing() === 'payAmount'">
                                  @if (fields().payAmount) { <span>{{ fields().payAmount }}</span> } @else { <span class="ph">0,00</span> }
                                  @if (typing() === 'payAmount') { <span class="caret"></span> }
                                </div>
                                <span class="b1" data-guide="btn-review" [class.hl]="highlight() === 'btn-review'"><i class="pi pi-search"></i>{{ pay.btnReview }}</span>
                              </div>
                            } @else {
                              <strong>{{ pay.secResolve }}</strong>
                              <small>{{ pay.resolveHint }} <b>{{ tx().values.payAmount }}</b></small>
                              <div class="arow">
                                <span class="b1 ok" data-guide="btn-approve" [class.hl]="highlight() === 'btn-approve'"><i class="pi pi-check"></i>{{ pay.btnApprove }}</span>
                                <span class="b2 bad"><i class="pi pi-times"></i>{{ pay.btnReject }}</span>
                              </div>
                            }
                          </div>
                        } @else {
                          <div class="sumline">{{ pay.owner }} · {{ pay.ref }} · {{ pay.declared }} <span class="st published">{{ pay.stApproved }}</span></div>
                          <div class="act-sec">
                            <strong>{{ pay.secBilling }}</strong>
                            <small>{{ pay.billingHint }}</small>
                            <div class="isum"><strong>{{ pay.invCount }}</strong> · {{ pay.invTotal }}</div>
                            <div class="lrow lhead inv"><span>{{ pay.invColInvoice }}</span><span>{{ pay.invColUnit }}</span><span>{{ pay.invColPeriod }}</span><span>{{ pay.invColState }}</span><span class="r">{{ pay.invColAmount }}</span><span></span><span></span></div>
                            <div class="lrow inv">
                              <b>{{ ui().issued ? pay.invNumber : pay.draft }}</b>
                              <span><i class="pi pi-building"></i> {{ pay.unit }}</span>
                              <span>11/2026</span>
                              <span>@if (ui().issued) { <span class="st published">{{ pay.issued }}</span> } @else { <span class="st draft">{{ pay.draft }}</span> }</span>
                              <span class="r">{{ pay.declared }}</span>
                              <i class="pi pi-file-pdf pdf"></i>
                              <span class="b2" data-guide="btn-inv-open" [class.hl]="highlight() === 'btn-inv-open'">{{ ui().issued ? pay.btnOptions : pay.btnEmitOpen }} <i class="pi pi-chevron-down"></i></span>
                            </div>
                            @if (ui().invOpen && !ui().issued) {
                              <div class="emitbar">
                                <div class="fld" data-guide="f-series" [class.hl]="highlight() === 'f-series'">
                                  @if (ui().series) { <span>{{ pay.series }}</span> } @else { <span class="ph">{{ pay.selSeries }}</span> }
                                  <i class="pi pi-chevron-down end"></i>
                                </div>
                                <span class="b1" data-guide="btn-emit" [class.hl]="highlight() === 'btn-emit'" [style.opacity]="ui().series ? 1 : 0.5"><i class="pi pi-send"></i>{{ pay.btnEmitInvoice }}</span>
                              </div>
                            }
                            @if (ui().issued) {
                              <div class="emitbar"><span class="b2 bad"><i class="pi pi-times"></i>{{ pay.btnVoid }}</span></div>
                            }
                          </div>
                        }
                        @if (ui().note !== 'none') {
                          <div class="toast">
                            <i class="pi pi-check-circle"></i>
                            <span>
                              @if (ui().note === 'approved') { <b>{{ pay.toastApprovedTitle }}</b> {{ pay.toastApprovedText }} }
                              @else { <b>{{ pay.toastIssuedTitle }}</b> {{ pay.toastIssuedText }} }
                            </span>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="panel">
                        <div class="phead">
                          <div>
                            <h1>{{ tx().web.periodsTitle }}</h1>
                            <p class="sub">{{ tx().web.periodsSub }}</p>
                          </div>
                          <div class="btns">
                            <span class="b2"><i class="pi pi-th-large"></i>{{ tx().web.createAll }}</span>
                            <span class="b1" data-guide="btn-nuevo" [class.hl]="highlight() === 'btn-nuevo'">
                              @if (ui().formOpen) { <i class="pi pi-times"></i>{{ tx().web.closeForm }} } @else { <i class="pi pi-plus"></i>{{ tx().web.newPeriod }} }
                            </span>
                          </div>
                        </div>
                        @if (ui().formOpen) {
                          <div class="formbox">
                            <div class="fhead">
                              <span class="ficon"><i class="pi pi-calendar-plus"></i></span>
                              <div><strong>{{ tx().web.formTitle }}</strong><br /><small>{{ tx().web.formSub }}</small></div>
                            </div>
                            <div class="grid g1">
                              <div>
                                <label>{{ tx().web.fBuilding }}</label>
                                <div class="fld" data-guide="f-building" [class.hl]="highlight() === 'f-building'" [class.focus]="typing() === 'building'">
                                  @if (fields().building) { <span>{{ fields().building }}</span> } @else { <span class="ph">{{ tx().web.selectBuilding }}</span> }
                                  @if (typing() === 'building') { <span class="caret"></span> }
                                  <i class="pi pi-chevron-down end"></i>
                                </div>
                              </div>
                            </div>
                            <div class="grid g3">
                              <div>
                                <label>{{ tx().web.fYear }}</label>
                                <div class="fld" data-guide="f-year" [class.hl]="highlight() === 'f-year'" [class.focus]="typing() === 'year'"><span>{{ fields().year }}</span>@if (typing() === 'year') { <span class="caret"></span> }</div>
                              </div>
                              <div>
                                <label>{{ tx().web.fMonth }}</label>
                                <div class="fld" data-guide="f-month" [class.hl]="highlight() === 'f-month'" [class.focus]="typing() === 'month'"><span>{{ fields().month }}</span>@if (typing() === 'month') { <span class="caret"></span> }</div>
                              </div>
                              <div>
                                <label>{{ tx().web.fName }}</label>
                                <div class="fld" data-guide="f-name" [class.hl]="highlight() === 'f-name'" [class.focus]="typing() === 'name'"><span>{{ fields().name }}</span>@if (typing() === 'name') { <span class="caret"></span> }</div>
                              </div>
                            </div>
                            <div class="grid g4">
                              <div>
                                <label>{{ tx().web.fStart }}</label>
                                <div class="fld" data-guide="f-start" [class.hl]="highlight() === 'f-start'" [class.focus]="typing() === 'start'">
                                  @if (fields().start) { <span>{{ fields().start }}</span> } @else { <span class="ph">{{ tx().web.datePh }}</span> }
                                  @if (typing() === 'start') { <span class="caret"></span> }
                                </div>
                              </div>
                              <div>
                                <label>{{ tx().web.fEnd }}</label>
                                <div class="fld" data-guide="f-end" [class.hl]="highlight() === 'f-end'" [class.focus]="typing() === 'end'">
                                  @if (fields().end) { <span>{{ fields().end }}</span> } @else { <span class="ph">{{ tx().web.datePh }}</span> }
                                  @if (typing() === 'end') { <span class="caret"></span> }
                                </div>
                              </div>
                              <div>
                                <label>{{ tx().web.fDue }}</label>
                                <div class="fld" data-guide="f-due" [class.hl]="highlight() === 'f-due'" [class.focus]="typing() === 'due'">
                                  @if (fields().due) { <span>{{ fields().due }}</span> } @else { <span class="ph">{{ tx().web.datePh }}</span> }
                                  @if (typing() === 'due') { <span class="caret"></span> }
                                </div>
                              </div>
                              <div>
                                <label>{{ tx().web.fLateFee }} <small>{{ tx().web.optional }}</small></label>
                                <div class="fld" data-guide="f-latefee" [class.hl]="highlight() === 'f-latefee'"><span class="ph">{{ tx().web.datePh }}</span></div>
                              </div>
                            </div>
                            <div class="grid g1">
                              <div>
                                <label>{{ tx().web.fNotes }}</label>
                                <div class="fld"><span class="ph">{{ tx().web.notesPh }}</span></div>
                              </div>
                            </div>
                            <div class="actions">
                              <span class="b1" data-guide="btn-crear" [class.hl]="highlight() === 'btn-crear'"><i class="pi pi-check"></i>{{ tx().web.createBtn }}</span>
                            </div>
                          </div>
                        }
                        <div class="cards">
                          @if (ui().cloned) {
                            <div class="pc new">
                              <div class="prow"><b>{{ tx().web.cloneName }}</b><span class="st draft">{{ statusLabel('draft') }}</span></div>
                              <div class="pline"><i class="pi pi-building"></i> {{ tx().values.building }}</div>
                              <div class="pdates">{{ tx().web.cloneDates }}</div>
                              <div class="pdates">{{ tx().web.dueLabel }} {{ tx().web.cloneDue }}</div>
                              <div class="pacts">
                                <i class="pi pi-calculator"></i>
                                <i class="pi pi-list" data-guide="btn-ledger" [class.hl]="highlight() === 'btn-ledger'"></i>
                                <i class="pi pi-copy"></i>
                                <i class="pi pi-pencil"></i>
                              </div>
                            </div>
                          }
                          @if (ui().created) {
                            <div class="pc new">
                              <div class="prow"><b>{{ fields().name }}</b><span class="st draft">{{ statusLabel('draft') }}</span></div>
                              <div class="pline"><i class="pi pi-building"></i> {{ fields().building }}</div>
                              <div class="pdates">{{ fields().start }} – {{ fields().end }}</div>
                              <div class="pdates">{{ tx().web.dueLabel }} {{ fields().due }}</div>
                            </div>
                          }
                          @for (c of tx().web.cards; track c.name; let i = $index) {
                            <div class="pc" [attr.data-guide]="i === 0 ? 'card-nov' : null" [class.hl]="i === 0 && highlight() === 'card-nov'">
                              <div class="prow"><b>{{ c.name }}</b><span class="st" [class]="c.status">{{ statusLabel(c.status) }}</span></div>
                              <div class="pline"><i class="pi pi-building"></i> {{ tx().values.building }}</div>
                              <div class="pdates">{{ c.dates }}</div>
                              <div class="pacts">
                                <i class="pi pi-calculator"></i>
                                <i class="pi pi-list"></i>
                                <i class="pi pi-copy" [attr.data-guide]="i === 0 ? 'btn-clone' : null" [class.hl]="i === 0 && highlight() === 'btn-clone'"></i>
                                <i class="pi pi-pencil"></i>
                              </div>
                            </div>
                          }
                        </div>
                        @if (ui().screen === 'done') {
                          <div class="toast"><i class="pi pi-check-circle"></i><span><b>{{ tx().web.toastTitle }}</b> {{ tx().web.toastText }}</span></div>
                        }
                        @if (ui().toast) {
                          <div class="toast"><i class="pi pi-check-circle"></i><span><b>{{ tx().web.toastTitle }}</b> {{ tx().web.cloneToast }}</span></div>
                        }
                      </div>
                    }
                    @if (ui().benefits) {
                      <div class="benefits">
                        <div class="bt"><i class="pi pi-star-fill"></i> {{ tx().web.benefitsTitle }}</div>
                        @for (b of tx().web.benefits; track $index) { <div class="bi"><i class="pi pi-check-circle"></i><span>{{ b }}</span></div> }
                      </div>
                    }
                  </div>
                </div>
                @if (ui().alert) {
                  <div class="atoast" data-guide="alert-toast" [class.hl]="highlight() === 'alert-toast'">
                    <span class="aic"><i class="pi pi-inbox"></i></span>
                    <span class="atx"><b>{{ tx().web.pay.alertTitle }}</b><span>{{ tx().web.pay.alertBody }}</span></span>
                  </div>
                }
              </div>
            }
          }
        </div>
      }
      @if (ui().confirm) {
        <div class="dim"></div>
        <div class="confirm">
          <b class="chost">{{ tx().web.confirmHost }}</b>
          <p>{{ tx().web.confirmText }}</p>
          <div class="cbtns">
            <span class="b2">{{ tx().web.cancel }}</span>
            <span class="b1" data-guide="btn-confirm" [class.hl]="highlight() === 'btn-confirm'">{{ tx().web.accept }}</span>
          </div>
        </div>
      }
      @if (cursor().visible) {
        <div class="cursor" [style.left.px]="cursor().x" [style.top.px]="cursor().y">
          @if (cursor().clicking) { <span class="ripple"></span> }
          <svg width="20" height="28" viewBox="0 0 20 28"><path d="M1 1 L1 22 L6.5 16.5 L10.5 26 L14 24.5 L10 15.5 L18 15.5 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .web { position: relative; width: 960px; height: 540px; overflow: hidden; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 13px; color: #16324a; background: #fff; }
      .hl { box-shadow: 0 0 0 3px rgba(26, 183, 175, 0.6); animation: hlPulse 1s ease-in-out infinite; border-radius: 8px; }
      @keyframes hlPulse { 0%, 100% { box-shadow: 0 0 0 3px rgba(26, 183, 175, 0.6); } 50% { box-shadow: 0 0 0 6px rgba(26, 183, 175, 0.25); } }
      .off { position: absolute; inset: 0; background: linear-gradient(135deg, #0d1117, #1b2430); }
      .bar { position: relative; height: 36px; background: #e9eef2; border-bottom: 1px solid #d5dee6; display: flex; align-items: center; gap: 6px; padding-left: 12px; box-sizing: border-box; }
      .dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
      .addr { position: absolute; left: 96px; top: 6px; width: 520px; height: 24px; border-radius: 12px; background: #fff; display: flex; align-items: center; gap: 6px; padding: 0 10px; box-sizing: border-box; }
      .addr .pi { font-size: 10px; color: #5f7b88; }
      .caret { display: inline-block; width: 1px; height: 14px; background: #16324a; animation: caret 0.8s steps(1) infinite; }
      @keyframes caret { 50% { opacity: 0; } }
      .body { height: 504px; position: relative; }
      .blank { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .blank p { color: #5f7b88; margin: 10px 0 0; font-size: 15px; }
      .login { display: flex; height: 100%; }
      .side { width: 440px; background: linear-gradient(150deg, #0f4c81, #1385b6 55%, #1ab7af); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #fff; }
      .side b { font-size: 30px; }
      .side span { font-size: 15px; opacity: 0.85; }
      .form { flex: 1; padding: 56px 60px; box-sizing: border-box; }
      .form h2 { margin: 0; font-size: 24px; font-weight: 800; }
      .sub { color: #5f7b88; margin: 4px 0 14px; font-size: 12px; }
      label { display: block; font-size: 11px; font-weight: 700; margin: 10px 0 4px; }
      label small { font-weight: 400; color: #5f7b88; }
      .fld { height: 30px; border: 1.5px solid rgba(20, 54, 61, 0.18); border-radius: 8px; padding: 0 8px; display: flex; align-items: center; box-sizing: border-box; background: #fff; font-size: 12px; }
      .form .fld { height: 38px; }
      .fld.focus { border-color: #1385b6; }
      .fld .end { margin-left: auto; font-size: 10px; color: #5f7b88; }
      .ph { color: #9fb2bf; }
      .btn-login { margin-top: 18px; height: 40px; border-radius: 8px; background: #1385b6; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .shell { height: 100%; display: flex; flex-direction: column; }
      .top { height: 48px; background: #fff; border-bottom: 1px solid rgba(19, 133, 182, 0.12); display: flex; align-items: center; justify-content: space-between; padding: 0 14px; box-sizing: border-box; flex-shrink: 0; }
      .brand { display: flex; align-items: center; gap: 8px; font-size: 15px; }
      .right { display: flex; align-items: center; gap: 14px; }
      .chip { display: flex; align-items: center; gap: 8px; font-weight: 600; }
      .av { width: 28px; height: 28px; border-radius: 50%; background: #1ab7af; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .main { flex: 1; display: flex; min-height: 0; }
      .menu { width: 210px; background: #fff; border-right: 1px solid #e6eef4; padding: 12px 10px; box-sizing: border-box; }
      .mt { font-size: 10px; font-weight: 800; color: #5f7b88; letter-spacing: 0.08em; margin: 8px 0 4px; }
      .mi { height: 30px; display: flex; gap: 8px; align-items: center; padding: 0 8px; border-radius: 8px; font-size: 12px; }
      .mi .grow { flex: 1; }
      .mi.act { background: rgba(19, 133, 182, 0.1); color: #1385b6; font-weight: 700; }
      .sub-items { padding-left: 14px; }
      .content { flex: 1; background: #f4f8fb; padding: 16px; position: relative; overflow: hidden; }
      h1 { margin: 0; font-size: 20px; font-weight: 800; }
      .kpis { display: flex; gap: 12px; margin: 14px 0; }
      .kpi { background: #fff; border-radius: 14px; padding: 12px; box-shadow: 0 6px 20px rgba(17, 54, 74, 0.06); flex: 1; }
      .kpi small { display: block; color: #5f7b88; font-size: 11px; }
      .kpi b { font-size: 26px; font-weight: 800; }
      .chart { flex: none; }
      .bars { display: flex; align-items: flex-end; gap: 18px; height: 150px; margin-top: 10px; }
      .bars i { display: block; width: 36px; background: linear-gradient(#1ab7af, #6ac64a); border-radius: 6px 6px 0 0; }
      .panel { background: #fff; border-radius: 16px; padding: 16px; position: relative; }
      .phead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .phead .sub { margin: 4px 0 0; }
      .btns { display: flex; gap: 8px; }
      .b1, .b2 { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; font-weight: 700; font-size: 12px; white-space: nowrap; }
      .b1 { background: #1385b6; color: #fff; }
      .b2 { background: #eef3f7; color: #16324a; }
      .formbox { border: 1px solid #dbe6ef; border-radius: 12px; padding: 12px; background: #fbfdff; margin: 12px 0; }
      .fhead { display: flex; align-items: center; gap: 10px; }
      .ficon { width: 30px; height: 30px; border-radius: 50%; background: rgba(19, 133, 182, 0.1); color: #1385b6; display: flex; align-items: center; justify-content: center; }
      .fhead small { color: #5f7b88; }
      .grid { display: grid; gap: 10px; }
      .g1 { grid-template-columns: 1fr; }
      .g3 { grid-template-columns: repeat(3, 1fr); }
      .g4 { grid-template-columns: repeat(4, 1fr); }
      .formbox label { margin: 8px 0 3px; }
      .actions { display: flex; justify-content: flex-end; margin-top: 10px; }
      .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
      .pc { background: #fff; border: 1px solid #dbe6ef; border-radius: 12px; padding: 10px; }
      .pc.new { animation: cardIn 0.6s ease-out; box-shadow: 0 0 0 3px rgba(26, 183, 175, 0.5); }
      @keyframes cardIn { from { opacity: 0; transform: translateY(-8px) scale(0.96); } to { opacity: 1; transform: none; } }
      .prow { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
      .st { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
      .st.draft { background: rgba(245, 158, 11, 0.15); color: #a96300; }
      .st.published { background: rgba(106, 198, 74, 0.15); color: #2f7a1b; }
      .st.closed { background: #eef3f7; color: #5f7b88; }
      .pline { margin-top: 6px; font-size: 11px; }
      .pdates { color: #5f7b88; font-size: 11px; margin-top: 2px; }
      .bellw { position: relative; display: inline-flex; }
      .nb { position: absolute; top: -6px; right: -8px; width: 15px; height: 15px; border-radius: 50%; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .atoast { position: absolute; top: 58px; right: 14px; width: 320px; z-index: 4; display: flex; gap: 10px; background: #fff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 12px 32px rgba(17, 54, 74, 0.28); border-left: 4px solid #f59e0b; animation: toastIn 0.4s ease-out; font-size: 12px; box-sizing: border-box; }
      .atoast b { font-size: 13px; display: block; }
      .atoast .atx { display: flex; flex-direction: column; gap: 2px; }
      .aic { flex: none; width: 38px; height: 38px; border-radius: 50%; background: #f59e0b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 17px; }
      .mtabs { display: flex; gap: 6px; margin: 4px 0 8px; }
      .mtab { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #5f7b88; background: #f1f5f8; }
      .mtab.on { background: rgba(19, 133, 182, 0.1); color: #1385b6; }
      .mtab em, .gbadge { font-style: normal; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(245, 158, 11, 0.18); color: #a96300; }
      .fchips { display: flex; gap: 6px; margin-bottom: 4px; }
      .fc { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #eef3f7; color: #5f7b88; }
      .fc.on { background: #1385b6; color: #fff; }
      .gcount { width: 20px; height: 20px; border-radius: 50%; background: #1385b6; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .lrow.pl { grid-template-columns: 1.1fr 1.3fr 0.9fr 1fr 0.9fr 1.2fr; }
      .lnk { color: #1385b6; }
      .st.info { background: rgba(19, 133, 182, 0.12); color: #0f6e96; }
      .pd { padding: 12px 14px; max-height: 100%; box-sizing: border-box; overflow: hidden; }
      .pdh { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .pdh h1 { font-size: 18px; }
      .mono { font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: #5f7b88; }
      .pst { margin-left: auto; }
      .pdgrid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
      .pcol { display: flex; flex-direction: column; gap: 8px; }
      .card { border: 1px solid #dbe6ef; border-radius: 12px; padding: 8px 12px; background: #fbfdff; font-size: 11px; }
      .card > strong { display: block; font-size: 12px; margin-bottom: 4px; }
      .kv { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; font-size: 11px; }
      .kv span { color: #5f7b88; }
      .urow { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 8px; font-size: 11px; padding: 2px 0; }
      .receipt { height: 170px; background: #fff; border: 1px solid #dbe6ef; border-radius: 6px; padding: 8px 12px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 4px; overflow: hidden; }
      .rok { width: 26px; height: 26px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; }
      .rbar { display: block; width: 70%; height: 5px; border-radius: 3px; background: #e4ecf2; }
      .rbar.s { width: 50%; }
      .rl { font-size: 11px; color: #3b4a5c; text-align: center; }
      .rl.big { font-size: 16px; font-weight: 800; color: #16324a; }
      .act-sec { border: 1px solid #dbe6ef; border-radius: 12px; padding: 10px 12px; background: #fbfdff; margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
      .act-sec small { color: #5f7b88; font-size: 11px; }
      .arow { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
      .arow label { margin: 0; }
      .arow .fld { width: 180px; }
      .b1.ok { background: #22a55a; }
      .b2.bad { background: rgba(239, 68, 68, 0.12); color: #c0392b; }
      .sumline { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; }
      .isum { font-size: 12px; }
      .lrow.inv { grid-template-columns: 1.3fr 1fr 0.7fr 0.8fr 0.9fr 30px 110px; height: 36px; }
      .lrow.inv.lhead { height: 24px; }
      .pdf { color: #cf4b3f; }
      .emitbar { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
      .emitbar .fld { width: 320px; }
      .toast { position: absolute; top: 12px; right: 12px; background: #fff; border-left: 4px solid #22c55e; box-shadow: 0 8px 24px rgba(17, 54, 74, 0.2); padding: 10px 14px; border-radius: 6px; display: flex; align-items: center; gap: 8px; animation: toastIn 0.4s ease-out; }
      .toast .pi { color: #22c55e; font-size: 18px; }
      @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: none; } }
      .pacts { display: flex; gap: 6px; margin-top: 8px; }
      .pacts i { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; color: #5f7b88; background: #f1f5f8; }
      .ghead { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 8px 10px; background: #f4f8fb; border-radius: 10px; }
      .ghead .gt { flex: 1; display: flex; flex-direction: column; }
      .ghead small, .tag { color: #5f7b88; font-size: 11px; }
      .lrow { display: grid; grid-template-columns: 1.7fr 1fr 0.9fr 0.7fr; gap: 10px; align-items: center; height: 40px; padding: 0 10px; border-bottom: 1px solid #eef3f7; font-size: 12px; }
      .lhead { height: 26px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #5f7b88; }
      .lrow .r { text-align: right; }
      .lacts { display: flex; gap: 8px; justify-content: flex-end; }
      .lacts i { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #f1f5f8; color: #5f7b88; font-size: 12px; }
      .lacts .blue { color: #1385b6; background: rgba(19, 133, 182, 0.1); }
      .tag { margin-left: 6px; }
      .tag.file { color: #1385b6; font-weight: 700; }
      .chg { color: #a96300; background: rgba(245, 158, 11, 0.15); padding: 1px 6px; border-radius: 6px; }
      .editbar { position: absolute; left: 16px; right: 16px; bottom: 14px; z-index: 3; background: #fff; border: 1px solid #dbe6ef; border-radius: 12px; box-shadow: 0 10px 30px rgba(17, 54, 74, 0.18); padding: 10px 12px; display: flex; align-items: center; gap: 12px; }
      .editbar label { margin: 0; }
      .editbar .fld { width: 180px; }
      .editbar .et { flex: 1; }
      .benefits { position: absolute; left: 50px; right: 50px; top: 64px; z-index: 3; background: #fff; border-radius: 16px; box-shadow: 0 18px 44px rgba(17, 54, 74, 0.25); padding: 16px 18px; border-top: 4px solid #1ab7af; animation: toastIn 0.4s ease-out; }
      .bt { font-size: 16px; font-weight: 800; margin-bottom: 8px; }
      .bt .pi { color: #f59e0b; }
      .bi { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; font-size: 13px; line-height: 1.4; }
      .bi .pi { color: #22c55e; margin-top: 2px; }
      .dim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.28); z-index: 4; }
      .confirm { position: absolute; left: 250px; top: 110px; width: 460px; background: #fff; border-radius: 10px; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35); padding: 16px 18px; z-index: 4; box-sizing: border-box; }
      .chost { font-size: 13px; }
      .confirm p { font-size: 13px; margin: 10px 0 14px; }
      .cbtns { display: flex; gap: 8px; justify-content: flex-end; }
      .cursor { position: absolute; z-index: 5; transition: left 0.65s cubic-bezier(0.4, 0, 0.2, 1), top 0.65s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; }
      .cursor svg { display: block; }
      .ripple { position: absolute; left: -13px; top: -13px; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #1ab7af; box-sizing: border-box; animation: ripple 0.35s ease-out; }
      @keyframes ripple { from { transform: scale(0.3); opacity: 1; } to { transform: scale(1.2); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) {
        .cursor { transition: none; }
        .web *, .web *::before { animation: none !important; }
      }
    `
  ]
})
export class GuideScreenComponent {
  readonly ui = input.required<GuideUiState>();
  readonly fields = input.required<Record<GuideField, string>>();
  readonly typing = input<GuideField | null>(null);
  readonly highlight = input<string | null>(null);
  readonly cursor = input<{ x: number; y: number; visible: boolean; clicking: boolean }>({ x: 480, y: 300, visible: false, clicking: false });
  readonly tx = input.required<GuideTx>();
  readonly login = input.required<(typeof LOGIN_TX)['es']>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly bars = [55, 70, 62, 80, 74, 88];
  readonly isPeriodsScreen = computed(() => ['periods', 'form', 'done'].includes(this.ui().screen));

  // Etiqueta del estado de un periodo en el idioma activo.
  statusLabel(s: GuideCard['status']): string {
    const w = this.tx().web;
    return s === 'draft' ? w.statusDraft : s === 'published' ? w.statusPublished : w.statusClosed;
  }

  // Centro del elemento [data-guide=id] en coordenadas del lienzo 960×540, o null si no está en pantalla.
  pointOf(id: string): { x: number; y: number } | null {
    const root = this.host.nativeElement.querySelector('.web') as HTMLElement | null;
    const el = root?.querySelector(`[data-guide="${id}"]`) as HTMLElement | null;
    if (!root || !el) return null;
    const r = root.getBoundingClientRect();
    const k = r.width / 960;
    const e = el.getBoundingClientRect();
    const isField = id.startsWith('f-') || id === 'user' || id === 'pass' || id === 'url';
    const x = isField ? (e.left + 18 - r.left) / k : (e.left + e.width / 2 - r.left) / k;
    return { x, y: (e.top + e.height / 2 - r.top) / k };
  }
}

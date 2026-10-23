// Estilos comunes de las pantallas de la demostración.
export const DEMO_PAGE_STYLES = `
  :host { display: block; color: var(--ex-ink, #16324a); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  h1 { margin: 0.4rem 0 0.2rem; font-size: 1.45rem; font-weight: 800; }
  .sub { margin: 0 0 1rem; color: var(--ex-muted, #5f7b88); font-size: 0.92rem; }
  a { text-decoration: none; color: #1385b6; }
  .card { background: #fff; border: 1px solid var(--ex-line, #dbe6ef); border-radius: 0.9rem; padding: 1rem 1.1rem; }
  .card h2 { margin: 0 0 0.7rem; font-size: 1rem; font-weight: 800; }
  .grid2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1rem; align-items: start; }
  @media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }
  .tbl-wrap { overflow-x: auto; }
  table.tb { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .tb th { text-align: left; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ex-muted, #5f7b88); padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--ex-line, #dbe6ef); white-space: nowrap; }
  .tb td { padding: 0.6rem; border-bottom: 1px solid #eef3f7; vertical-align: middle; }
  .tb tr:last-child td { border-bottom: 0; }
  .tb .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tb tbody tr.click { cursor: pointer; }
  .tb tbody tr.click:hover { background: #f4f9fc; }
  .badge { display: inline-block; padding: 0.12rem 0.55rem; border-radius: 999px; font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
  .badge.ok { background: #e8f7ee; color: #1f7a45; }
  .badge.bad { background: #fdeceb; color: #c0392f; }
  .badge.sim { background: #fff4d9; color: #8a6100; }
  .badge.info { background: #e7f1f9; color: #1385b6; }
  .btn { display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; font: inherit; font-size: 0.86rem; font-weight: 700; padding: 0.55rem 1rem; border-radius: 0.6rem; border: 1px solid transparent; background: #1ab7af; color: #fff; }
  .btn:hover { background: #14a29b; }
  .btn.line { background: #fff; color: #1385b6; border-color: #1385b6; }
  .btn.line:hover { background: rgba(19, 133, 182, 0.08); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .muted { color: var(--ex-muted, #5f7b88); }
  .pos { color: #1f7a45; }
  .neg { color: #c0392f; }
  .row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  input, select { font: inherit; font-size: 0.9rem; padding: 0.5rem 0.7rem; border-radius: 0.55rem; border: 1px solid var(--ex-line, #dbe6ef); background: #fff; color: var(--ex-ink, #16324a); min-width: 0; }
  input:focus, select:focus { outline: 2px solid rgba(26, 183, 175, 0.4); border-color: #1ab7af; }
  label.fld { display: grid; gap: 0.3rem; font-size: 0.8rem; font-weight: 700; }
`;

// Estilos comunes de las pantallas de la demostración (mismo lenguaje visual que el panel real).
export const DEMO_PAGE_STYLES = `
  :host { display: block; }
  h1 { margin: 0; font-size: 2rem; font-weight: 800; }
  .sub { color: var(--brand-muted); margin: 0.35rem 0 1rem; }
  a { text-decoration: none; color: #1385b6; }
  .card { background: var(--p-content-background, #fff); border-radius: 22px; padding: 1.4rem 1.5rem; border: 1px solid rgba(19, 133, 182, 0.09); box-shadow: 0 8px 30px rgba(17, 54, 74, 0.07); min-width: 0; }
  .card h2 { margin: 0 0 0.7rem; font-size: 1.05rem; font-weight: 800; }
  .grid2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1rem; align-items: start; }
  @media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }
  .tbl-wrap { overflow-x: auto; }
  table.tb { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .tb th { text-align: left; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--brand-muted); padding: 0.5rem 0.6rem; border-bottom: 1px solid rgba(20, 54, 61, 0.08); white-space: nowrap; }
  .tb td { padding: 0.6rem; border-bottom: 1px solid rgba(20, 54, 61, 0.08); vertical-align: middle; }
  .tb tr:last-child td { border-bottom: 0; }
  .tb .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tb tbody tr:hover { background: rgba(19, 133, 182, 0.05); }
  .tb tbody tr.click { cursor: pointer; }
  .badge { display: inline-block; padding: 0.12rem 0.55rem; border-radius: 999px; font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
  .badge.ok { background: rgba(106, 198, 74, 0.15); color: #2f7a1b; }
  .badge.bad { background: rgba(229, 103, 93, 0.15); color: #cf4b3f; }
  .badge.sim { background: rgba(245, 158, 11, 0.15); color: #a96300; }
  .badge.info { background: rgba(19, 133, 182, 0.1); color: #0f6e96; }
  .btn { display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; font: inherit; font-size: 0.86rem; font-weight: 700; padding: 0.55rem 1rem; border-radius: 0.6rem; border: 1px solid #1385b6; background: #1385b6; color: #fff; }
  .btn:hover { background: #0f6e96; border-color: #0f6e96; }
  .btn.line { background: transparent; color: #1385b6; border-color: #1385b6; }
  .btn.line:hover { background: rgba(19, 133, 182, 0.08); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .muted { color: var(--brand-muted); }
  .pos { color: #2f7a1b; }
  .neg { color: #cf4b3f; }
  .toolbar-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  input, select { font: inherit; font-size: 0.9rem; padding: 0.45rem 0.65rem; border-radius: 10px; border: 1.5px solid rgba(20, 54, 61, 0.18); background: #fff; color: var(--brand-ink); min-width: 0; outline: none; }
  input:focus, select:focus { border-color: var(--brand-blue); }
  label.fld { display: grid; gap: 0.3rem; font-size: 0.8rem; font-weight: 700; }
`;

// Estilos comunes a las secciones del Centro de configuración (formularios, tablas y avisos).
export const CONFIG_SECTION_STYLES = `
  h2 { margin: 0 0 0.3rem; font-size: 1.2rem; color: var(--brand-ink); }
  h3 { margin: 1.4rem 0 0.6rem; font-size: 1.02rem; color: var(--brand-ink); }
  .muted { color: var(--brand-muted); }
  .small { font-size: 0.85rem; margin: 0 0 0.8rem; }
  .form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem 1.2rem; margin: 1rem 0; max-width: 46rem; }
  .field { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); align-content: start; }
  .field.wide { grid-column: 1 / -1; }
  .field input, .field select, .field textarea {
    padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
    font: inherit; font-size: 0.92rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
  }
  .field input:disabled, .field select:disabled { opacity: 0.6; cursor: not-allowed; }
  .field .hint { font-weight: 400; font-size: 0.78rem; }
  .check { display: flex; gap: 0.5rem; align-items: center; font-size: 0.92rem; color: var(--brand-ink); font-weight: 500; }
  .checks { display: grid; gap: 0.4rem; }
  .actions { display: flex; gap: 0.6rem; margin-top: 0.8rem; flex-wrap: wrap; }
  .btn { padding: 0.5rem 1.1rem; border-radius: 10px; border: none; background: var(--brand-gradient); color: #fff; font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn.secondary { background: transparent; border: 1px solid rgba(19,133,182,0.4); color: #1385B6; }
  .btn.danger { background: #c9473b; }
  .btn.sm { padding: 0.3rem 0.75rem; font-size: 0.82rem; }
  .notice { margin: 0.8rem 0; padding: 0.7rem 0.9rem; border-radius: 12px; font-size: 0.88rem; border: 1px solid #e0a23b; background: rgba(224,162,59,0.08); color: var(--brand-ink); }
  .notice.info { border-color: rgba(19,133,182,0.35); background: rgba(19,133,182,0.06); }
  .table-wrap { overflow-x: auto; border: 1px solid var(--brand-border); border-radius: 12px; }
  table.t { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  table.t th { text-align: left; padding: 0.5rem 0.7rem; color: var(--brand-muted); font-weight: 700; border-bottom: 1px solid var(--brand-border); white-space: nowrap; }
  table.t td { padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--brand-border); vertical-align: middle; }
  table.t .num { text-align: right; white-space: nowrap; }
  table.t .nowrap { white-space: nowrap; }
  .pos { color: #2f8f46; }
  .neg { color: #c9473b; }
  @media (max-width: 700px) { .form { grid-template-columns: 1fr; } }
`;

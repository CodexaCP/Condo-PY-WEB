// Estilos comunes de la barra de filtros de los listados (búsqueda, selectores, atajos y contadores).
export const LIST_FILTERS_STYLES = `
  .filters-bar { display: flex; align-items: flex-end; gap: 0.85rem; flex-wrap: wrap; padding: 0.8rem 1rem; background: rgba(20,54,61,0.04); border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 0.9rem; }
  .field-block { display: flex; flex-direction: column; gap: 0.3rem; min-width: 150px; }
  .field-block > span { font-size: 0.72rem; font-weight: 700; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .field-block select, .field-block input { border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; padding: 0.45rem 0.65rem; font-size: 0.9rem; color: var(--brand-ink); background: #fff; outline: none; width: 100%; }
  .field-block select:focus, .field-block input:focus { border-color: var(--brand-blue); }
  .search-field { flex: 1 1 280px; min-width: 240px; }
  .search-box { position: relative; display: flex; align-items: center; }
  .search-box .pi-search { position: absolute; left: 0.75rem; color: var(--brand-muted); font-size: 0.85rem; pointer-events: none; }
  .search-box input { padding-left: 2.1rem; padding-right: 2rem; }
  .search-box .search-clear { position: absolute; right: 0.4rem; border: none; background: none; cursor: pointer; color: var(--brand-muted); padding: 0.25rem; }

  .chip-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.9rem; }
  .chip-label { font-size: 0.72rem; font-weight: 700; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-right: 0.2rem; }
  .chip-btn { border: 1px solid rgba(19,133,182,0.25); background: #fff; color: var(--brand-ink); border-radius: 999px; padding: 0.28rem 0.8rem; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
  .chip-btn strong { color: var(--brand-blue); margin-left: 0.25rem; }
  .chip-btn:hover { background: rgba(19,133,182,0.07); }
  .chip-btn.active { background: var(--brand-blue); border-color: var(--brand-blue); color: #fff; }
  .chip-btn.active strong { color: #fff; }

  .list-summary { color: var(--brand-muted); font-size: 0.85rem; margin: 0 0 0.6rem; }
  .app-list.is-loading { opacity: 0.55; transition: opacity .15s; }

  @media (max-width: 720px) {
    .filters-bar { flex-direction: column; align-items: stretch; }
  }
`;

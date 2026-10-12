// Recuerda los filtros de un listado mientras dure la pestaña: al editar una unidad o un usuario y volver, se queda donde estaba.
export function loadListState<T extends object>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(`list-state:${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveListState(key: string, value: object): void {
  try {
    sessionStorage.setItem(`list-state:${key}`, JSON.stringify(value));
  } catch {
    // sin almacenamiento (ventana privada o bloqueado): el listado funciona igual, solo no recuerda
  }
}

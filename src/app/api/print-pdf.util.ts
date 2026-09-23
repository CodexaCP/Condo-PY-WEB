// Imprime un PDF disparando el dialogo nativo de impresion del navegador (el mismo que Ctrl+P),
// sin abrir ni descargar el archivo para el usuario. Se descarga el PDF como blob y se carga en un
// iframe oculto: hace falta el blob (mismo origen) para poder enganchar el evento "load" del iframe
// de forma confiable antes de llamar a print() (con la URL del backend, de otro origen, el load no
// dispara siempre y el print puede terminar en blanco).
export async function printPdfFromUrl(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo obtener el PDF para imprimir.');
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  const cleanup = () => {
    URL.revokeObjectURL(blobUrl);
    iframe.remove();
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.focus();
    win.print();
    // Algunos navegadores no disparan "afterprint" al imprimir un iframe oculto,
    // por eso se deja ademas un margen prudente antes de liberar el blob.
    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60_000);
  };

  iframe.src = blobUrl;
  document.body.appendChild(iframe);
}

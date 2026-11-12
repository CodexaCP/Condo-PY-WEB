// pdf.js pesa ~400 kB: se carga bajo demanda, solo cuando el usuario sube un PDF.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  pdfjsPromise ??= import('pdfjs-dist').then((lib) => {
    // El worker de pdf.js se copia a la raiz del build (ver angular.json -> assets) porque el builder de
    // Angular (esbuild) no soporta el patron `new URL(..., import.meta.url)` para resolver paquetes de npm.
    lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    return lib;
  });
  return pdfjsPromise;
}

// El backend solo puede incrustar como fondo del PDF de prueba archivos de imagen (jpg/png/webp/gif),
// no un PDF dentro de otro PDF. Si la plantilla que sube el usuario es un PDF (comun cuando lo manda
// la imprenta asi), se convierte la primera pagina a PNG en el navegador antes de subirla.
export async function pdfFirstPageToPngFile(file: File, targetDpi = 150): Promise<File> {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  // En pdf.js 6 destroy() vive en la tarea de carga, no en el documento.
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: targetDpi / 72 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar el lienzo para convertir el PDF.');

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen a partir del PDF.');

    const pngName = `${file.name.replace(/\.pdf$/i, '')}.png`;
    return new File([blob], pngName, { type: 'image/png' });
  } finally {
    await loadingTask.destroy();
  }
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

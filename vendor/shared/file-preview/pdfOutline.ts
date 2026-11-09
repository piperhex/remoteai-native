import type { PDFDocumentProxy } from 'pdfjs-dist';

export type PdfOutline = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>;
export interface PdfOutlineItem {
  title: string; page?: number; position?: number; expanded: boolean; children: PdfOutlineItem[];
}

/** PDF destinations may be named, zero-based page indexes, or indirect page references. */
export async function pdfDestinationPage(document: PDFDocumentProxy, value: unknown): Promise<number | undefined> {
  const destination: unknown = typeof value === 'string' ? await document.getDestination(value) : value;
  if (!Array.isArray(destination) || !destination.length) return;
  const reference: unknown = destination[0];
  let index: number;
  if (typeof reference === 'number' && Number.isInteger(reference)) index = reference;
  else {
    if (!reference || typeof reference !== 'object' || !('num' in reference) || !('gen' in reference)
      || !Number.isInteger(reference.num) || !Number.isInteger(reference.gen)) return;
    index = await document.getPageIndex({ num: reference.num as number, gen: reference.gen as number });
  }
  if (index >= 0 && index < document.numPages) return index + 1;
}

export async function pdfOutlineDestination(document: PDFDocumentProxy, value: unknown) {
  const destination: unknown = typeof value === 'string' ? await document.getDestination(value) : value;
  const page = await pdfDestinationPage(document, destination);
  if (!page || !Array.isArray(destination)) return;
  const mode: unknown = destination[1];
  if (!mode || typeof mode !== 'object' || !('name' in mode)) return { page };
  const coordinates: Record<string, number> = { XYZ: 3, FitH: 2, FitBH: 2, FitR: 5 };
  const coordinate = typeof mode.name === 'string' ? coordinates[mode.name] : undefined;
  const top: unknown = coordinate === undefined ? undefined : destination[coordinate];
  if (typeof top !== 'number' || !Number.isFinite(top)) return { page };
  const target = await document.getPage(page);
  const viewport = target.getViewport({ scale: 1 });
  const [, y] = viewport.convertToViewportPoint(0, top);
  return { page, position: Math.max(0, Math.min(1, y / viewport.height)) };
}

export async function readPdfOutline(document: PDFDocumentProxy, entries: PdfOutline): Promise<PdfOutlineItem[]> {
  return Promise.all(entries.map(async entry => {
    // External document links are never opened by the internal page navigator.
    const target = entry.dest ? await pdfOutlineDestination(document, entry.dest).catch(() => undefined) : undefined;
    return { title: entry.title, ...target, expanded: (entry.count ?? 0) >= 0,
      children: await readPdfOutline(document, entry.items) };
  }));
}

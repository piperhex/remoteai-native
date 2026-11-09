import { useEffect, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { PdfAssetReader, PdfCMapReader } from './pdfAssets';
import type { PdfPageSize } from './pdfLayout';

GlobalWorkerOptions.workerSrc = workerUrl;
const PAGE_METADATA_BATCH = 16;

export function usePdfDocument(file: Blob) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let closed = false;
    let task: ReturnType<typeof getDocument> | undefined;
    setDocument(undefined); setError(false);
    void file.arrayBuffer().then(bytes => {
      if (closed) return;
      task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true,
        useWorkerFetch: false, CMapReaderFactory: PdfCMapReader,
        StandardFontDataFactory: PdfAssetReader, WasmFactory: PdfAssetReader });
      task.onPassword = () => { if (!closed) setError(true); };
      return task.promise.then(value => { if (!closed) setDocument(value); });
    }).catch(() => { if (!closed) setError(true); });
    return () => { closed = true; void task?.destroy().catch(() => console.warn('PDF cleanup failed')); };
  }, [file]);
  return { document, error };
}

/** Read geometry without painting pages, so mixed page sizes keep accurate scroll positions. */
export function usePdfPageSizes(document: PDFDocumentProxy) {
  const [sizes, setSizes] = useState<PdfPageSize[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let closed = false;
    const read = async (number: number) => {
      const page = await document.getPage(number);
      const { width, height } = page.getViewport({ scale: 1 });
      return { width, height };
    };
    const load = async () => {
      const first = await read(1);
      if (closed) return;
      const pages = Array.from({ length: document.numPages }, () => first);
      setSizes(pages.slice());
      for (let start = 1; start < pages.length && !closed; start += PAGE_METADATA_BATCH) {
        const batch = await Promise.allSettled(pages.slice(start, start + PAGE_METADATA_BATCH)
          .map((_, offset) => read(start + offset + 1)));
        if (closed) return;
        let changed = false;
        batch.forEach((result, offset) => {
          // Keep the estimated geometry on failure; the visible page renderer reports the error.
          if (result.status !== 'fulfilled') return;
          pages[start + offset] = result.value;
          changed ||= result.value.width !== first.width || result.value.height !== first.height;
        });
        if (changed) setSizes(pages.slice());
      }
    };
    void load().catch(() => { if (!closed) setError(true); });
    return () => { closed = true; };
  }, [document]);
  return { sizes, error };
}

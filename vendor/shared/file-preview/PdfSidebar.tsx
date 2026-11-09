import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Images, ListTree } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { PdfPage } from './PdfPage';
import { readPdfOutline, type PdfOutlineItem } from './pdfOutline';
import type { PdfPageSize } from './pdfLayout';

const THUMBNAIL_WIDTH = 112;

function PdfThumbnail({ document, size, page, name, current, navigate, root }: {
  document: PDFDocumentProxy; size: PdfPageSize; page: number; name: string; current: boolean;
  navigate: (page: number) => void; root: HTMLDivElement | null;
}) {
  const host = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!host.current || !root) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting),
      { root, rootMargin: '200px 0px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [root]);
  return <button ref={host} type="button" className="file-pdf-thumbnail" data-thumbnail-page={page}
    aria-label={t('client.filePreview.pdfPage', { page })} aria-current={current ? 'page' : undefined}
    onClick={() => navigate(page)}>
    <PdfPage document={document} page={page} width={THUMBNAIL_WIDTH}
      height={THUMBNAIL_WIDTH * size.height / size.width} name={name} active={active} thumbnail />
    <span>{page}</span>
  </button>;
}

function PdfThumbnails({ document, sizes, name, page, navigate, visible }: {
  document: PDFDocumentProxy; sizes: readonly PdfPageSize[]; name: string;
  page: number; navigate: (page: number) => void; visible: boolean;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!host || !visible) return;
    const align = () => {
      const item = host.querySelector<HTMLElement>(`[data-thumbnail-page="${page}"]`);
      if (!item || !host.clientHeight) return;
      const top = item.offsetTop;
      const bottom = top + item.offsetHeight;
      if (top < host.scrollTop) host.scrollTop = top;
      else if (bottom > host.scrollTop + host.clientHeight) host.scrollTop = bottom - host.clientHeight;
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(host);
    return () => observer.disconnect();
  }, [host, page, visible, sizes]);
  return <div ref={setHost} className="file-pdf-thumbnails">
    {sizes.map((size, index) => <PdfThumbnail key={index} document={document} size={size}
      page={index + 1} name={name} current={page === index + 1} navigate={navigate} root={host} />)}
  </div>;
}

function OutlineEntry({ entry, current, navigate }: {
  entry: PdfOutlineItem; current: number; navigate: (page: number, position?: number) => void;
}) {
  const link = <button type="button" disabled={!entry.page}
    aria-current={entry.page === current ? 'location' : undefined}
    onClick={() => { if (entry.page) navigate(entry.page, entry.position); }} dir="auto">{entry.title}</button>;
  return <li>{entry.children.length ? <details open={entry.expanded}>
    <summary>{link}</summary><ol>{entry.children.map((child, index) =>
      <OutlineEntry key={index} entry={child} current={current} navigate={navigate} />)}</ol>
  </details> : link}</li>;
}

function PdfOutline({ document, page, navigate }: {
  document: PDFDocumentProxy; page: number; navigate: (page: number, position?: number) => void;
}) {
  const [outline, setOutline] = useState<PdfOutlineItem[]>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let closed = false;
    void document.getOutline().then(entries => readPdfOutline(document, entries ?? []))
      .then(entries => { if (!closed) setOutline(entries); })
      .catch(() => { if (!closed) setError(true); });
    return () => { closed = true; };
  }, [document]);
  let feedback = '';
  if (error) feedback = 'client.filePreview.pdfOutlineUnavailable';
  else if (!outline) feedback = 'client.projectBrowser.loading';
  else if (!outline.length) feedback = 'client.filePreview.pdfNoOutline';
  return <div className="file-pdf-outline">{feedback ? <p role="status">{t(feedback)}</p>
    : <ol>{outline?.map((entry, index) => <OutlineEntry key={index} entry={entry}
      current={page} navigate={navigate} />)}</ol>}</div>;
}

export function PdfSidebar({ document, sizes, name, page, navigate, id, hidden }: {
  document: PDFDocumentProxy; sizes: readonly PdfPageSize[]; name: string; page: number;
  navigate: (page: number, position?: number) => void; id: string; hidden: boolean;
}) {
  const [mode, setMode] = useState<'pages' | 'outline'>('pages');
  return <aside id={id} className="file-pdf-sidebar" hidden={hidden}
    aria-label={t('client.filePreview.pdfNavigation')}>
    <div className="file-pdf-sidebar-modes" role="group" aria-label={t('client.filePreview.pdfNavigation')}>
      <button type="button" aria-pressed={mode === 'pages'} onClick={() => setMode('pages')}
        aria-label={t('client.filePreview.pdfThumbnails')} title={t('client.filePreview.pdfThumbnails')}>
        <Images size={16} aria-hidden="true" /></button>
      <button type="button" aria-pressed={mode === 'outline'} onClick={() => setMode('outline')}
        aria-label={t('client.filePreview.pdfOutline')} title={t('client.filePreview.pdfOutline')}>
        <ListTree size={16} aria-hidden="true" /></button>
    </div>
    {mode === 'pages' ? <PdfThumbnails document={document} sizes={sizes} name={name} page={page}
      navigate={navigate} visible={!hidden} />
      : <PdfOutline document={document} page={page} navigate={navigate} />}
  </aside>;
}

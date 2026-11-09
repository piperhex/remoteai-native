import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, PanelLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { MAX_PDF_ZOOM, MIN_PDF_ZOOM } from './usePdfZoom';

export function PdfToolbar({ page, count, jump, zoom, changeZoom, resetZoom, navigation, toggleNavigation, sidebarId }: {
  page: number; count: number; jump: (page: number) => void; zoom: number;
  changeZoom: (direction: number) => void; resetZoom: () => void;
  navigation: boolean; toggleNavigation: () => void; sidebarId: string;
}) {
  const [input, setInput] = useState(String(page));
  const dirty = useRef(false);
  useEffect(() => { setInput(String(page)); dirty.current = false; }, [page]);
  const submit = () => {
    if (!dirty.current) return;
    dirty.current = false;
    const value = Number(input);
    if (Number.isInteger(value) && value >= 1 && value <= count) jump(value);
    else setInput(String(page));
  };
  return <div className="file-pdf-toolbar">
    <button type="button" aria-label={t('client.filePreview.pdfNavigation')} aria-expanded={navigation}
      aria-controls={sidebarId} onClick={toggleNavigation}><PanelLeft size={16} /></button>
    <div className="file-pdf-page-controls">
      <button type="button" aria-label={t('client.mobile.previousPage')} disabled={page <= 1}
        onClick={() => jump(page - 1)}><ChevronLeft size={16} /></button>
      <form onSubmit={event => { event.preventDefault(); submit(); }}>
        <input type="text" inputMode="numeric" pattern="[0-9]*" value={input}
          aria-label={t('client.filePreview.pdfPageNumber')}
          onChange={event => { dirty.current = true; setInput(event.target.value); }} onBlur={submit}
          onKeyDown={event => {
            if (event.key === 'Escape') { dirty.current = false; setInput(String(page)); }
          }} />
        <span aria-hidden="true">/ {count}</span>
      </form>
      <span role="status" className="file-pdf-page-status">{page} / {count}</span>
      <button type="button" aria-label={t('client.mobile.nextPage')} disabled={page >= count}
        onClick={() => jump(page + 1)}><ChevronRight size={16} /></button>
    </div>
    <div className="file-pdf-zoom-controls">
      <button type="button" aria-label={t('client.filePreview.pdfZoomOut')} disabled={zoom <= MIN_PDF_ZOOM}
        onClick={() => changeZoom(-1)}><ZoomOut size={16} /></button>
      <button type="button" onClick={resetZoom}>{t('client.workspaceActions.fitToWindow')}</button>
      <span className="file-pdf-zoom-value">{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label={t('client.filePreview.pdfZoomIn')} disabled={zoom >= MAX_PDF_ZOOM}
        onClick={() => changeZoom(1)}><ZoomIn size={16} /></button>
    </div>
  </div>;
}

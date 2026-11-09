import { useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { displayText as t } from '../localization/messages';
import { PdfPage } from './PdfPage';
import { PdfSidebar } from './PdfSidebar';
import { PdfToolbar } from './PdfToolbar';
import { pdfPageLayout } from './pdfLayout';
import { usePdfDocument, usePdfPageSizes } from './usePdfDocument';
import { usePdfElementWidth, usePdfViewport } from './usePdfViewport';
import { usePdfZoom } from './usePdfZoom';
import { usePdfTheme } from './usePdfTheme';
import { getInterfaceLanguage, subscribeInterfaceLanguage } from '../localization/interfaceLanguage';
import './pdfPreview.css';

const SIDEBAR_BREAKPOINT = 640;

function PdfReader({ document, name }: { document: PDFDocumentProxy; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const sidebarId = useId();
  const style = usePdfTheme();
  const width = usePdfElementWidth(host);
  const availableWidth = usePdfElementWidth(scroll);
  const [sidebar, setSidebar] = useState<boolean>();
  const navigation = sidebar ?? width >= SIDEBAR_BREAKPOINT;
  const { sizes, error } = usePdfPageSizes(document);
  const zoom = usePdfZoom(scroll);
  const pages = useMemo(() => pdfPageLayout(sizes, availableWidth, zoom.zoom), [sizes, availableWidth, zoom.zoom]);
  const viewport = usePdfViewport(scroll, pages);
  const navigate = (page: number, position?: number) => {
    viewport.jump(page, position);
    if (width < SIDEBAR_BREAKPOINT) setSidebar(false);
  };
  const feedback = error ? 'client.filePreview.pdfUnavailable' : 'client.projectBrowser.loading';
  return <div ref={host} className="file-pdf-preview" style={style}>
    <PdfToolbar page={viewport.page} count={document.numPages} jump={viewport.jump} {...zoom}
      navigation={navigation} toggleNavigation={() => setSidebar(!navigation)} sidebarId={sidebarId} />
    <div className="file-pdf-reader">
      <PdfSidebar document={document} sizes={sizes} name={name} id={sidebarId}
        page={viewport.page} navigate={navigate} hidden={!navigation} />
      <div className="file-pdf-pages" ref={scroll} tabIndex={0} role="region" aria-label={name}
        data-current-page={viewport.page}>
        {sizes.length && !error ? <div className="file-pdf-page-list">
          {pages.map((page, index) => <PdfPage key={index} document={document} page={index + 1} name={name}
            width={page.width} height={page.height} active={index >= viewport.first && index <= viewport.last} />)}
        </div> : <p role="status" className="file-preview-feedback">{t(feedback)}</p>}
      </div>
    </div>
  </div>;
}

export default function PdfPreview({ file, name }: { file: Blob; name: string }) {
  useSyncExternalStore(subscribeInterfaceLanguage, getInterfaceLanguage, getInterfaceLanguage);
  const { document, error } = usePdfDocument(file);
  if (error || !document) return <p role="status" className="file-preview-feedback">
    {t(error ? 'client.filePreview.pdfUnavailable' : 'client.projectBrowser.loading')}</p>;
  return <PdfReader document={document} name={name} />;
}

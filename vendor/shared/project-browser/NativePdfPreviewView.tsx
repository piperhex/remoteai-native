import PdfPreview from '../file-preview/PdfPreview';
import { usePreviewFile } from '../file-preview/usePreviewFile';
import type { PreviewLoader } from '../file-preview/kinds';
import { displayText as t } from '../localization/messages';
import type { ProjectPreviewProps } from './preview';

export function NativePdfPreview({ load, ...props }: ProjectPreviewProps & { load: PreviewLoader }) {
  const result = usePreviewFile({ load, document: props.document, connected: props.connected, enabled: props.active });
  if (!result.file || result.error) return <p role="status" className="file-preview-feedback">
    {t(result.error || 'client.projectBrowser.loading')}</p>;
  return <PdfPreview file={result.file} name={props.document.path.split(/[\\/]/).at(-1) ?? ''} />;
}

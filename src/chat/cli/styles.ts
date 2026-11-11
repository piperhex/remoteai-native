import { createThemedStyles } from '../../theme/styles';
import { textMetrics } from '../../theme/text';
import { palette } from '../styles';

export const useCliStyles = createThemedStyles(color => ({
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 6 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, flexShrink: 1 },
  label: { ...textMetrics(13, 20), color: color(palette.muted, 'muted'), flexShrink: 1 },
  body: { ...textMetrics(14, 22), color: color(palette.ink, 'ink'), flexShrink: 1 },
  title: { ...textMetrics(15, 22), color: color(palette.ink, 'ink'), fontWeight: '600', flexShrink: 1 },
  hint: { ...textMetrics(12, 18), color: color(palette.muted, 'muted'), maxWidth: 400 },
  error: { ...textMetrics(13, 20), color: color(palette.danger, 'danger'), maxWidth: 400 },
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 600, alignSelf: 'center' },
  option: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10 },
  selected: { backgroundColor: color(palette.pale, 'accentSoft') },
  field: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  card: { padding: 16, gap: 10, borderWidth: 1, borderRadius: 12,
    borderColor: color(palette.border, 'border'), backgroundColor: color('#fff', 'surface') },
  approvals: { maxHeight: 280 },
  setup: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  input: { ...textMetrics(14, 22), color: color(palette.ink, 'ink'), minHeight: 44,
    borderWidth: 1, borderColor: color(palette.border, 'border'), borderRadius: 8, padding: 10 },
}));

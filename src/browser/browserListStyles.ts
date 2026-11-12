import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';

export const useBrowserListStyles = createThemedStyles(color => ({
  list: { paddingBottom: 16 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: color('#e7ece8', 'border') },
  details: { flex: 1, minWidth: 0 },
  title: { ...textMetrics(14, 22), color: color('#17211b', 'ink'), flexShrink: 1 },
  address: { ...textMetrics(13, 20), color: color('#0b8065', 'accent') },
  secondary: { ...textMetrics(12, 18), color: color('#718078', 'muted') },
  empty: { ...textMetrics(14, 22), color: color('#718078', 'muted'), paddingVertical: 20 },
  error: { ...textMetrics(12, 18), color: color('#c74e47', 'danger'), maxWidth: 400, paddingBottom: 16 },
}));

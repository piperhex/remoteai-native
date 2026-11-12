import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';

export const useBookmarkStyles = createThemedStyles(color => ({
  search: { ...textMetrics(14, 22), minHeight: 44, padding: 10, borderRadius: 12, borderWidth: 1,
    borderColor: color('#dfe5df', 'border'), color: color('#17211b', 'ink'), marginBottom: 8 },
  add: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  list: { paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1,
    borderBottomColor: color('#e7ece8', 'border') },
  details: { flex: 1, minWidth: 0 },
  label: { ...textMetrics(14, 22), color: color('#17211b', 'ink'), flexShrink: 1 },
  url: { ...textMetrics(12, 18), color: color('#718078', 'muted') },
  status: { ...textMetrics(12, 18), maxWidth: 400, color: color('#718078', 'muted'), marginTop: 8 },
}));

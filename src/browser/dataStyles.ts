import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
export const useDataStyles = createThemedStyles(color => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 14,
    marginVertical: 3, backgroundColor: color('#f1f5f2', 'surface') },
  details: { flex: 1, minWidth: 0 },
  title: { ...textMetrics(15, 23), color: color('#17211b', 'ink'), flexShrink: 1 },
  secondary: { ...textMetrics(13, 20), color: color('#718078', 'muted'), flexShrink: 1 },
  day: { ...textMetrics(14, 22), color: color('#718078', 'muted'), marginTop: 18, marginBottom: 4 },
  input: { ...textMetrics(14, 22), color: color('#17211b', 'ink'), borderWidth: 1,
    borderColor: color('#dfe5df', 'border'), borderRadius: 12, minHeight: 46, padding: 10, marginVertical: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 8 },
  link: { ...textMetrics(14, 22), color: color('#0b8065', 'accent') },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  error: { ...textMetrics(13, 20), color: color('#c74e47', 'danger'), maxWidth: 400, marginVertical: 8 },
  status: { ...textMetrics(12, 18), color: color('#718078', 'muted'), marginVertical: 10, maxWidth: 400 },
  disabled: { opacity: 0.45 },
}));

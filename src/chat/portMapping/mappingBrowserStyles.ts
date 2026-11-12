import { createThemedStyles } from '../../theme/styles';
import { textMetrics } from '../../theme/text';

export const useMappingBrowserStyles = createThemedStyles(color => ({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: color('#dfe5df', 'border') },
  icon: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  pressed: { backgroundColor: color('#e7f5f4', 'accentSoft') },
  disabled: { opacity: 0.35 },
  address: { ...textMetrics(13, 20), flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 10, borderRadius: 12,
    color: color('#17211b', 'ink'), backgroundColor: color('#ffffff', 'surface'),
    borderWidth: 1, borderColor: color('#dfe5df', 'border') },
  message: { ...textMetrics(12, 18), color: color('#718078', 'muted'),
    maxWidth: 400, paddingHorizontal: 16, marginVertical: 6 },
  error: { color: color('#c74e47', 'danger') },
}));

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
  menu: { position: 'absolute', right: 8, minWidth: 160, maxWidth: 400, borderRadius: 14,
    padding: 6, backgroundColor: color('#ffffff', 'surface'), borderWidth: 1,
    borderColor: color('#dfe5df', 'border'), elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12 },
  menuItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  menuText: { ...textMetrics(13, 20), color: color('#17211b', 'ink'), flexShrink: 1 },
}));

import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { primaryNavigationPage } from '../../vendor/shared/navigation/discovery';
import { DownloadCountIcon } from '../downloads/DownloadCountIcon';
import { t, useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { createThemedStyles } from '../theme/styles';
import { LoungeUnread } from '../lounge/LoungeMessage';

export type BottomNavigationPage = 'chat' | 'browser' | 'accounts' | 'discover' | 'settings';

export interface BottomNavigationProps {
  activePage: string;
  owner?: string;
  loungeUnread?: number;
  onChange: (page: BottomNavigationPage) => void;
}

export function BottomNavigation({ activePage, owner, loungeUnread = 0, onChange }: BottomNavigationProps) {
  const resolveThemeColor = useThemeColor();
  const styles = useStyles();
  useLanguage();
  const settingsActive = ['admin', 'about', 'settings'].includes(activePage);
  const discoveryActive = activePage !== 'browser' && primaryNavigationPage(activePage) === 'discover';
  // Keep the home-indicator area inside the navigation background.
  return <SafeAreaView edges={['bottom']} style={styles.bottomNavigation} accessibilityRole="tablist">
    <Pressable accessibilityRole="tab" accessibilityLabel={t('client.app.chat')}
      accessibilityState={{ selected: activePage === 'chat' }}
      onPress={() => onChange('chat')} style={styles.navItem}>
      <Ionicons name="chatbubble-outline" size={23}
        color={activePage === 'chat' ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
    </Pressable>
    <Pressable accessibilityRole="tab" accessibilityLabel={t('client.configLabels.browser')}
      accessibilityState={{ selected: activePage === 'browser' }}
      onPress={() => onChange('browser')} style={styles.navItem}>
      <Ionicons name="globe-outline" size={23} color={activePage === 'browser'
        ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
    </Pressable>
    <Pressable accessibilityRole="tab" accessibilityLabel={t('client.app.accounts')}
      accessibilityState={{ selected: activePage === 'accounts' }}
      onPress={() => onChange('accounts')} style={styles.navItem}>
      <Ionicons name={activePage === 'accounts' ? 'people' : 'people-outline'}
        size={23} color={activePage === 'accounts'
          ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
    </Pressable>
    <Pressable accessibilityRole="tab" accessibilityLabel={t('client.discovery.title')}
      accessibilityState={{ selected: discoveryActive }}
      onPress={() => onChange('discover')} style={styles.navItem}>
      <LoungeUnread count={loungeUnread}><DownloadCountIcon owner={loungeUnread ? undefined : owner}>
        <Ionicons name={discoveryActive ? 'compass' : 'compass-outline'} size={23}
          color={discoveryActive ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
      </DownloadCountIcon></LoungeUnread>
    </Pressable>
    <Pressable accessibilityRole="tab" accessibilityLabel={t('client.app.settings')}
      accessibilityState={{ selected: settingsActive }}
      onPress={() => onChange('settings')} style={styles.navItem}>
      <Ionicons name="settings" size={23}
        color={settingsActive ? resolveThemeColor('#00c98b', 'accent') : resolveThemeColor('#858991', 'muted')} />
    </Pressable>
  </SafeAreaView>;
}

const useStyles = createThemedStyles(color => ({
  bottomNavigation: {
    flexDirection: 'row', backgroundColor: color('#fff', 'surface'),
    borderTopWidth: 1, borderTopColor: color('#dce8df', 'border'),
    shadowColor: '#314c3d', shadowOpacity: 0.08, shadowRadius: 8, elevation: 10,
  },
  navItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
}));

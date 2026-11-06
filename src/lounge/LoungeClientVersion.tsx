import { Text } from 'react-native';
import { clientVersionLabel } from '../../vendor/shared/lounge/clientVersion';
import type { LoungeAccount } from '../../vendor/shared/lounge/types';
import { textMetrics } from '../theme/text';
import { t } from '../i18n';
import { createLoungeStyles } from './theme';

const useStyles = createLoungeStyles(color => ({
  version: { ...textMetrics(12, 18), color: color('#687c89', 'muted'), flexShrink: 1 },
  profile: { marginTop: 8, marginBottom: 10 },
}));

export function LoungeClientVersion({ user, profile = false }: { user: LoungeAccount; profile?: boolean }) {
  const styles = useStyles();
  const label = clientVersionLabel(user);
  if (!label) return null;
  return <Text style={[styles.version, profile && styles.profile]}>
    {profile ? `${t('client.settings.version')} ${label}` : label}
  </Text>;
}

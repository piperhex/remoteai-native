import { Fragment } from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { clientVersionItems, clientVersionLabel } from '../../vendor/shared/lounge/clientVersion';
import type { LoungeAccount } from '../../vendor/shared/lounge/types';
import { textMetrics } from '../theme/text';
import { t } from '../i18n';
import { createLoungeStyles, useLoungeColor, ONLINE_COLOR } from './theme';

const useStyles = createLoungeStyles(color => ({
  version: { ...textMetrics(12, 18), color: color('#687c89', 'muted'), flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, maxWidth: '100%' },
  item: { flexDirection: 'row', alignItems: 'center', columnGap: 4, flexShrink: 1, maxWidth: '100%' },
  profile: { marginTop: 8, marginBottom: 10 },
}));

interface Props { user: LoungeAccount; profile?: boolean; online?: boolean }

export function LoungeClientVersion({ user, profile = false, online = false }: Props) {
  const styles = useStyles();
  const color = useLoungeColor();
  const clients = clientVersionItems(user);
  const label = clientVersionLabel(user);
  if (!label) return null;
  return <View style={[styles.row, profile && styles.profile]} accessible
    accessibilityHint={online ? t('client.lounge.userOnline') : undefined}
    accessibilityLabel={profile ? `${t('client.settings.version')} ${label}` : label}>
    {profile && <Text style={styles.version}>{t('client.settings.version')}</Text>}
    {clients.map((client, index) => <Fragment key={`${client.platform ?? ''}:${client.version}`}>
      {index > 0 && <Text style={styles.version}> · </Text>}
      <View style={styles.item}>
        {client.platform && <Feather name={client.platform === 'desktop' ? 'monitor' : 'smartphone'}
          size={14} color={online ? ONLINE_COLOR : color('#687c89', 'muted')} accessible={false} />}
        <Text style={styles.version}>v{client.version}</Text>
      </View>
    </Fragment>)}
  </View>;
}

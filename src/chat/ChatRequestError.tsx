import { Pressable, Text, View } from 'react-native';
import { isModelCapacityError } from '../../vendor/shared/conversation/requestError';
import { visibleTurnRequestErrors, type TurnRequestError } from '../../vendor/shared/conversation/turnRequestErrors';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { ChatCapacityErrorNotice } from './ChatCapacityErrorNotice';
import { ChatRetryButton } from './ChatRetryButton';
import type { Turn } from './types';

/** Keep each failure at its message boundary, independently of the turn summary. */
export function ChatRequestError({ turn, record, onOpen }: {
  turn: Turn; record: TurnRequestError; onOpen: () => void;
}) {
  const styles = useStyles();
  useLanguage();
  const retry = !record.willRetry && record.id === visibleTurnRequestErrors(turn).at(-1)?.id;
  if (isModelCapacityError(record.error)) return <ChatCapacityErrorNotice turnId={turn.id} retry={retry} />;
  return <View style={styles.error}>
    <Text accessibilityRole="alert" style={styles.notice}>
      {t(record.willRetry ? 'client.chat.connectionInterruptedCodexIsRetrying'
        : 'client.chat.thisReplyStoppedBecauseOfAProblem')}
    </Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.viewErrorDetails')}
        onPress={onOpen}>
        <Text style={[styles.notice, styles.link]}>{t('client.chat.viewErrorDetails')}</Text>
      </Pressable>
      {retry && <ChatRetryButton turnId={turn.id} />}
    </View>
  </View>;
}

const useStyles = createThemedStyles(color => ({
  error: { maxWidth: 400, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  notice: { maxWidth: '100%', flexShrink: 1, ...textMetrics(12, 20), color: color('#c96c3d', 'warning') },
  link: { textDecorationLine: 'underline' },
}));

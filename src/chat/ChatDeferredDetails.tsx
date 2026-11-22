import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { useProcessDetails, useToolDetails, type ProcessDetailsLoader, type ToolDetailsLoader }
  from '../../vendor/shared/chat/useDeferredDetails';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import type { Item } from './types';
import { palette } from './styles';

export const NativeDetailContext = createContext<{
  toolDetails: ToolDetailsLoader; processDetails?: ProcessDetailsLoader;
} | null>(null);

function DetailStatus({ error, retry }: { error: boolean; retry: () => void }) {
  const styles = useDetailStyles();
  useLanguage();
  return error ? <Pressable accessibilityRole="button" onPress={retry}>
    <Text style={styles.subtitle}>{t('client.chat.couldNotLoadSelectToRetry')}</Text>
  </Pressable> : <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{t('client.mobile.loading')}</Text>;
}

const useDetailStyles = createThemedStyles(color => ({
  subtitle: { ...textMetrics(13, 20), color: color(palette.muted, 'muted') },
}));

const unavailable = async () => { throw new Error('Detail service unavailable'); };

export function NativeToolDetails({ item, children }: { item: Item; children: (value: Item) => ReactNode }) {
  const context = useContext(NativeDetailContext);
  const { loaded, error, retry } = useToolDetails(item, context?.toolDetails ?? unavailable, true);
  return <>{(error || !loaded) && <DetailStatus error={error} retry={retry} />}{loaded && children(loaded)}</>;
}

export function NativeProcessDetails({ items, children }: { items: Item[]; children: (values: Item[]) => ReactNode }) {
  const context = useContext(NativeDetailContext);
  const { loaded, error, retry } = useProcessDetails(items, context?.processDetails ?? unavailable, true);
  return loaded && !error ? children(loaded) : <DetailStatus error={error} retry={retry} />;
}

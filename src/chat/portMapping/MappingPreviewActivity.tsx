import { useEffect, useRef } from 'react';
import { PixelRatio, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { t } from '../../i18n';
import { useThemeColor } from '../../theme/store';

const START_FRACTION = 0.05;
const ADVANCE_MS = 140;
const FADE_MS = 180;

export function MappingPreviewActivity({ progress }: { progress: number | null }) {
  const color = useThemeColor();
  const fill = useSharedValue(0);
  const opacity = useSharedValue(0);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (progress !== null) {
      if (previous.current === null || progress < previous.current) fill.value = 0;
      fill.value = withTiming(Math.max(START_FRACTION, progress), { duration: ADVANCE_MS });
      opacity.value = 1;
    } else if (previous.current !== null) {
      fill.value = withTiming(1, { duration: ADVANCE_MS });
      opacity.value = withDelay(ADVANCE_MS, withTiming(0, { duration: FADE_MS }));
    }
    previous.current = progress;
  }, [fill, opacity, progress]);
  const animation = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scaleX: fill.value }] }));
  return <Animated.View pointerEvents="none" accessible={progress !== null} accessibilityRole="progressbar"
    accessibilityLabel={t('client.portForwarding.loadingWebsite')} accessibilityElementsHidden={progress === null}
    importantForAccessibility={progress === null ? 'no-hide-descendants' : 'yes'}
    style={[styles.line, { backgroundColor: color('#0b8065', 'accent') }, animation]} />;
}

const styles = StyleSheet.create({
  line: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 / PixelRatio.get(), transformOrigin: 'left' },
});

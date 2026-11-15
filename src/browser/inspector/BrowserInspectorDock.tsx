import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, requireNativeComponent, Text, View, useWindowDimensions,
  type ViewProps } from 'react-native';
import { marketText } from '../../../vendor/shared/provider-market/i18n';
import { t, useLanguage } from '../../i18n';
import { textMetrics } from '../../theme/text';
import { useThemeColor } from '../../theme/store';
import { browserInspectorAvailable, type useBrowserInspector } from './useBrowserInspector';

const Surface = browserInspectorAvailable
  ? requireNativeComponent<ViewProps & { onFailure: () => void; interactive: boolean }>('BrowserInspectorSurface') : View;
const MIN_SHARE = 0.2;
const MAX_SHARE = 0.8;
const INITIAL_SHARE = 0.5;
const ACCESSIBILITY_STEP = 0.1;
type Dock = 'right' | 'bottom';

export function BrowserInspectorDock({ inspector, children, obscured }: {
  inspector: ReturnType<typeof useBrowserInspector>; children: ReactNode; obscured: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const [dock, setDock] = useState<Dock>(() => width > height ? 'right' : 'bottom');
  const [share, setShare] = useState(INITIAL_SHARE);
  const ratio = useRef(share); ratio.current = share;
  const layout = useRef({ width: 1, height: 1 });
  const color = useThemeColor();
  const text = marketText(useLanguage());
  const horizontal = dock === 'right';
  const resize = useMemo(() => {
    let start = INITIAL_SHARE;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start = ratio.current; },
      onPanResponderMove: (_event, gesture) => {
        const size = horizontal ? layout.current.width : layout.current.height;
        const movement = horizontal ? gesture.dx : gesture.dy;
        setShare(Math.max(MIN_SHARE, Math.min(MAX_SHARE, start - movement / Math.max(1, size))));
      },
    });
  }, [horizontal]);
  const options: { dock: Dock; icon: 'dock-right' | 'dock-bottom'; label: string }[] = [
    { dock: 'right', icon: 'dock-right', label: text('market.inspectorRight') },
    { dock: 'bottom', icon: 'dock-bottom', label: text('market.inspectorBottom') },
  ];
  return <View style={{ flex: 1, flexDirection: horizontal ? 'row' : 'column' }}
    onLayout={event => { layout.current = event.nativeEvent.layout; }}>
    <View style={{ flex: inspector.open ? 1 - share : 1, minWidth: 0, minHeight: 0 }}>{children}</View>
    {inspector.open && <>
      <View {...resize.panHandlers} accessible accessibilityRole="adjustable"
        accessibilityLabel={text('market.inspectorResize')}
        accessibilityValue={{ min: 20, max: 80, now: Math.round(share * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => setShare(value => Math.max(MIN_SHARE, Math.min(MAX_SHARE,
          value + (event.nativeEvent.actionName === 'increment' ? ACCESSIBILITY_STEP : -ACCESSIBILITY_STEP))))}
        style={{ backgroundColor: color('#dce5df', 'border'), width: horizontal ? 12 : undefined,
          height: horizontal ? undefined : 12, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: color('#718078', 'muted'), borderRadius: 2,
          width: horizontal ? 3 : 32, height: horizontal ? 32 : 3 }} />
      </View>
      <View style={{ flex: share, minWidth: 0, minHeight: 0, backgroundColor: color('#ffffff', 'surface') }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={{ ...textMetrics(13, 20), flexGrow: 1, flexShrink: 1,
            color: color('#17211b', 'ink'), fontWeight: '600' }}>{text('market.inspectorTitle')}</Text>
          <View style={{ flexDirection: 'row' }}>
            {options.map(option => <Pressable key={option.dock} accessibilityRole="button"
              accessibilityLabel={option.label} accessibilityState={{ selected: dock === option.dock }}
              onPress={() => setDock(option.dock)} style={{ padding: 10 }}>
              <MaterialCommunityIcons name={option.icon} size={18}
                color={dock === option.dock ? color('#0b8065', 'accent') : color('#718078', 'muted')} />
            </Pressable>)}
            <Pressable accessibilityRole="button" accessibilityLabel={text('market.close')}
              onPress={inspector.close} style={{ padding: 10 }}>
              <Ionicons name="close" size={18} color={color('#17211b', 'ink')} />
            </Pressable>
          </View>
        </View>
        {inspector.failed && <Text accessibilityRole="alert"
          style={{ ...textMetrics(14, 22), padding: 12, color: color('#c64343', 'danger') }}>
          {t('client.runtimeErrors.theConnectionIsTemporarilyUnavailableTryAgain')}</Text>}
        {!inspector.failed && <Surface ref={inspector.host} style={{ flex: 1 }}
          onLayout={inspector.attach} onFailure={inspector.fail} interactive={!obscured} />}
      </View>
    </>}
  </View>;
}

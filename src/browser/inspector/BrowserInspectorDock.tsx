import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, requireNativeComponent, Text, View, useWindowDimensions,
  type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { marketText } from '../../../vendor/shared/provider-market/i18n';
import { t, useLanguage } from '../../i18n';
import { textMetrics } from '../../theme/text';
import { useThemeColor } from '../../theme/store';
import { browserInspectorAvailable, type useBrowserInspector } from './useBrowserInspector';

type InspectorSurfaceProps = ViewProps & { onReady: () => void; onFailure: () => void; interactive: boolean };
const Surface = browserInspectorAvailable
  ? requireNativeComponent<InspectorSurfaceProps>('BrowserInspectorSurface') : View;
const MIN_SHARE = 0.2;
const MAX_SHARE = 0.8;
const INITIAL_SHARE = 0.5;
const ACCESSIBILITY_STEP = 0.1;
const DIVIDER_SIZE = 12;
const MIN_CONTENT_WIDTH = 196;
type Dock = 'right' | 'bottom';

export function BrowserInspectorDock({ inspector, children, obscured, fullscreen }: {
  inspector: ReturnType<typeof useBrowserInspector>; children: ReactNode; obscured: boolean; fullscreen: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const [dock, setDock] = useState<Dock>(() => width > height ? 'right' : 'bottom');
  const [share, setShare] = useState(INITIAL_SHARE);
  const layout = useRef({ width: 1, height: 1 });
  const color = useThemeColor();
  const text = marketText(useLanguage());
  const horizontal = dock === 'right';
  const maxShare = horizontal
    ? Math.max(MIN_SHARE, Math.min(MAX_SHARE, 1 - MIN_CONTENT_WIDTH / Math.max(1, width - DIVIDER_SIZE)))
    : MAX_SHARE;
  const dockShare = Math.min(share, maxShare);
  const ratio = useRef(dockShare); ratio.current = dockShare;
  const resize = useMemo(() => {
    let start = INITIAL_SHARE;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start = ratio.current; },
      onPanResponderMove: (_event, gesture) => {
        const size = (horizontal ? layout.current.width : layout.current.height) - DIVIDER_SIZE;
        const movement = horizontal ? gesture.dx : gesture.dy;
        setShare(Math.max(MIN_SHARE, Math.min(maxShare, start - movement / Math.max(1, size))));
      },
    });
  }, [horizontal, maxShare]);
  const options: { dock: Dock; icon: 'dock-right' | 'dock-bottom'; label: string }[] = [
    { dock: 'right', icon: 'dock-right', label: text('market.inspectorRight') },
    { dock: 'bottom', icon: 'dock-bottom', label: text('market.inspectorBottom') },
  ];
  return <View style={{ flex: 1, flexDirection: horizontal ? 'row' : 'column' }}
    onLayout={event => { layout.current = event.nativeEvent.layout; }}>
    <View style={{ flex: inspector.open ? 1 - dockShare : 1, minWidth: 0, minHeight: 0 }}>{children}</View>
    {inspector.open && <>
      <View {...resize.panHandlers} accessible={!obscured} accessibilityRole="adjustable"
        pointerEvents={obscured ? 'none' : 'auto'}
        accessibilityLabel={text('market.inspectorResize')}
        accessibilityValue={{ min: Math.round(MIN_SHARE * 100), max: Math.round(maxShare * 100),
          now: Math.round(dockShare * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => setShare(Math.max(MIN_SHARE, Math.min(maxShare,
          dockShare + (event.nativeEvent.actionName === 'increment' ? ACCESSIBILITY_STEP : -ACCESSIBILITY_STEP))))}
        style={{ backgroundColor: color('#dce5df', 'border'), width: horizontal ? DIVIDER_SIZE : undefined,
          height: horizontal ? undefined : DIVIDER_SIZE, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: color('#718078', 'muted'), borderRadius: 2,
          width: horizontal ? 3 : 32, height: horizontal ? 32 : 3 }} />
      </View>
      <SafeAreaView edges={horizontal && !fullscreen ? ['top', 'right'] : ['left', 'right']}
        accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}
        pointerEvents={obscured ? 'none' : 'auto'}
        style={{ flex: dockShare, minWidth: 0, minHeight: 0, backgroundColor: color('#ffffff', 'surface') }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={{ ...textMetrics(13, 20), flexGrow: 1, flexShrink: 1, minWidth: '40%',
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
          onReady={inspector.attach} onFailure={inspector.fail} interactive={!obscured} />}
      </SafeAreaView>
    </>}
  </View>;
}

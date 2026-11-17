import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ImageNavigation as Navigation } from '../../vendor/shared/chat/ImageGallery';
import { t } from '../i18n';

/** Keep paging controls outside the image's pinch, pan and tap-to-close surface. */
export function ImageNavigation({ navigation }: { navigation: Navigation }) {
  return <SafeAreaView pointerEvents="box-none" edges={['left', 'right']} style={styles.overlay}>
    <View pointerEvents="box-none" style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.projectBrowser.previous')}
        accessibilityState={{ disabled: !navigation.previous }} disabled={!navigation.previous}
        onPress={navigation.previous} style={[styles.button, !navigation.previous && styles.disabled]}>
        <MaterialCommunityIcons name="chevron-left" size={28} color="#eee" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.projectBrowser.next')}
        accessibilityState={{ disabled: !navigation.next }} disabled={!navigation.next}
        onPress={navigation.next} style={[styles.button, !navigation.next && styles.disabled]}>
        <MaterialCommunityIcons name="chevron-right" size={28} color="#eee" />
      </Pressable>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  button: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#282b2a',
    alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
});

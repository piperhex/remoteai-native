import { Image, Keyboard, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LOUNGE_IMAGE_EDITOR_LIMITS, useLoungeImageEditor,
  type LoungeImageAttachmentsProps } from '../../vendor/shared/lounge/useLoungeImageEditor';
import { ChatPhotoEditor } from '../chat/ChatPhotoEditor';
import { MAX_IMAGES } from '../../vendor/shared/lounge/types';
import { t } from '../i18n';
import { textMetrics } from '../theme/text';
import { createLoungeStyles, useLoungeColor } from './theme';

export function LoungeImageAttachments(props: LoungeImageAttachmentsProps & { onAdd: () => void }) {
  const { images, setImages, disabled } = props;
  const editor = useLoungeImageEditor(props);
  const styles = useAttachmentStyles();
  const color = useLoungeColor();
  return <>
    {!!images.length && <View style={styles.row}>
      {images.map((uri, index) => <View key={index} style={styles.card}>
        <Image source={{ uri }} style={styles.image} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.annotateImage', { value1: index + 1 })}
          disabled={disabled} style={[styles.edit, disabled && styles.disabled]}
          onPress={() => { Keyboard.dismiss(); editor.open(index); }}>
          <Text style={styles.label}>{t('client.chat.annotate')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.removeImage', { value1: index + 1 })}
          disabled={disabled} style={[styles.remove, disabled && styles.disabled]} hitSlop={3}
          onPress={() => setImages(current => current.filter((_, at) => at !== index))}>
          <Ionicons name="close" size={16} color="#fff" /></Pressable>
      </View>)}
      {images.length < MAX_IMAGES && <Pressable accessibilityRole="button"
        accessibilityLabel={t('client.chat.addMoreImages')} disabled={disabled}
        style={[styles.add, disabled && styles.disabled]} onPress={props.onAdd}>
        <Ionicons name="add" size={24} color={color('#13231c', 'ink')} /></Pressable>}
    </View>}
    {editor.editing && <ChatPhotoEditor photo={{ dataUrl: editor.editing.original }} mode="direct"
      outputLimits={{ ...LOUNGE_IMAGE_EDITOR_LIMITS, targetBytes: props.maxBytes ?? LOUNGE_IMAGE_EDITOR_LIMITS.targetBytes }}
      save={editor.save} close={editor.close} />}
  </>;
}

const tile = 64;
const radius = 10;
const overhang = 4;
const useAttachmentStyles = createLoungeStyles(color => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 - overhang, alignItems: 'flex-end', paddingVertical: 6 },
  card: { width: tile + overhang, height: tile + overhang, justifyContent: 'flex-end' },
  image: { width: tile, height: tile, borderRadius: radius },
  edit: { position: 'absolute', bottom: 0, left: 0, width: tile, minHeight: 36,
    alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  label: { ...textMetrics(12, 19), color: '#fff', textAlign: 'center' },
  remove: { position: 'absolute', right: 0, top: 0, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#13231c' },
  add: { width: tile, height: tile, borderRadius: radius, borderWidth: 1, alignItems: 'center',
    justifyContent: 'center', borderColor: color('#dce8df', 'border'), backgroundColor: color('#fff', 'surface') },
  disabled: { opacity: 0.45 },
}));

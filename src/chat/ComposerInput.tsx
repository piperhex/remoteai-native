import { forwardRef } from 'react';
import { requireNativeComponent, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewProps } from 'react-native';
import { useThemeColor } from '../theme/store';
import { useStyles } from './styles';

type Props = Omit<TextInputProps, 'style'> & { compact: boolean; displayValue?: string; onSendShortcut?: () => void };

const ComposerShortcutView = requireNativeComponent<ViewProps & Pick<Props, 'onSendShortcut'>>('ComposerShortcut');

export const ComposerInput = forwardRef<TextInput, Props>(function ComposerInput(
  { compact, placeholder, displayValue, onSendShortcut, ...props }, ref,
) {
  const color = useThemeColor();
  const chatStyles = useStyles();
  const hintColor = color('#999999', 'muted');
  const showHint = !(displayValue ?? props.value) && !!placeholder;
  return <ComposerShortcutView style={compact && styles.compactSpacing} onSendShortcut={onSendShortcut}>
    <TextInput {...props} ref={ref} style={[chatStyles.input, compact && styles.compactInput]}
      placeholder={showHint ? undefined : placeholder} placeholderTextColor={hintColor}
      accessibilityHint={showHint ? placeholder : props.accessibilityHint} underlineColorAndroid="transparent" />
    {/* Multiline TextInput cannot ellipsize its placeholder on Android. */}
    {showHint && <View pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.placeholder}>
      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.hint, { color: hintColor }]}>{placeholder}</Text>
    </View>}
  </ComposerShortcutView>;
});

const styles = StyleSheet.create({
  compactInput: { height: 44, minHeight: 44, maxHeight: 44, textAlignVertical: 'center' },
  compactSpacing: { marginLeft: 40, marginRight: 88 },
  placeholder: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', paddingHorizontal: 8 },
  hint: { fontSize: 16, lineHeight: 23 },
});

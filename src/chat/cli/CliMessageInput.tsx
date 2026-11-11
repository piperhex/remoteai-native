import { useEffect, useRef, type ComponentProps } from 'react';
import type { TextInput } from 'react-native';
import { ComposerInput } from '../ComposerInput';

export function CliMessageInput({ value = '', onChangeText, ...props }: ComponentProps<typeof ComposerInput>) {
  const input = useRef<TextInput>(null);
  const initialText = useRef(value);
  const nativeText = useRef(value);
  useEffect(() => {
    if (value === nativeText.current) return;
    nativeText.current = value;
    input.current?.setNativeProps({ text: value });
  }, [value]);
  // The external store renders synchronously, before TextInput records its latest native event count.
  // Keep typing native-owned; only programmatic changes (restore, insert, clear) write back to the field.
  return <ComposerInput {...props} ref={input} defaultValue={initialText.current} displayValue={value}
    onChangeText={text => { nativeText.current = text; onChangeText?.(text); }} />;
}

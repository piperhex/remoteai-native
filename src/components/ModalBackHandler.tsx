import type { ModalProps } from 'react-native';

/** Android 13+ needs a window-scoped gesture callback; other platforms use Modal's callback. */
export function ModalBackHandler(_props: Pick<ModalProps, 'onRequestClose'>) {
  return null;
}

import { requireNativeComponent, type ModalProps, type ViewProps } from 'react-native';

const NativeBackHandler = requireNativeComponent<ViewProps & Pick<ModalProps, 'onRequestClose'>
  & { enabled: boolean }>('ModalBackHandler');

export function ModalBackHandler({ onRequestClose }: Pick<ModalProps, 'onRequestClose'>) {
  return <NativeBackHandler enabled={Boolean(onRequestClose)} onRequestClose={onRequestClose}
    pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', width: 0, height: 0 }} />;
}

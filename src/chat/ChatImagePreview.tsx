import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import { ImageViewer } from './ImageViewer';
import { useImageGallery } from '../../vendor/shared/chat/ImageGallery';
import { useChatImage, type ImagePreviewOptions } from '../../vendor/shared/remote-chat/client/useChatImage';
import type { Turn } from '../../vendor/shared/conversation/types';
import { conversationImages, type GalleryImage } from '../../vendor/shared/chat/imageGallerySources';
import type { ImageNavigation } from '../../vendor/shared/chat/ImageGallery';
import { t } from '../i18n';

interface ImagePreview {
  source: string; thumbnail: string; description: string; options: ImagePreviewOptions | null;
}
const ImagePreviewContext = createContext<((image: ImagePreview) => void) | null>(null);
const EMPTY_TURNS: readonly Turn[] = [];

/** Keep the modal outside virtualized messages so rotation cannot unmount the active image. */
export function ChatImagePreviewProvider({ children, active = true, turns = EMPTY_TURNS }: {
  children: ReactNode; active?: boolean; turns?: readonly Turn[];
}) {
  const [image, setImage] = useState<ImagePreview | null>(null);
  const images = useMemo(() => conversationImages(turns), [turns]);
  const open = useCallback((preview: ImagePreview) => { Keyboard.dismiss(); setImage(preview); }, []);
  return <ImagePreviewContext.Provider value={open}>
    {children}
    {active && image && <ChatImageGallery key={image.source} preview={image} images={images}
      close={() => setImage(null)} />}
  </ImagePreviewContext.Provider>;
}

function ChatImageGallery({ preview, images, close }: {
  preview: ImagePreview; images: readonly GalleryImage[]; close: () => void;
}) {
  const { current, navigation } = useImageGallery(preview, images);
  return <SelectedImage key={current.source} preview={preview} current={current} navigation={navigation} close={close} />;
}

function SelectedImage({ preview, current, navigation, close }: {
  preview: ImagePreview; current: GalleryImage; navigation: ImageNavigation; close: () => void;
}) {
  const initial = current.source === preview.source;
  const image = useChatImage(current.source, preview.options, initial ? preview.thumbnail : undefined);
  const description = initial ? preview.description : current.description || t('client.chat.image');
  return <ImageViewer thumbnail={image.url} description={description} load={image.original}
    save={image.save} navigation={navigation} close={close} />;
}

export function useChatImagePreview() {
  const open = useContext(ImagePreviewContext);
  if (!open) throw new Error('Chat images require ChatImagePreviewProvider');
  return open;
}

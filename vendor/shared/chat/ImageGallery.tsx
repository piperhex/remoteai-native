import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Turn } from '../conversation/types';
import { conversationImages, type GalleryImage } from './imageGallerySources';

export interface ImageNavigation { previous?: () => void; next?: () => void }

// Keep the loading stage valid before the selected thumbnail/original has arrived.
export const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const ImageGalleryContext = createContext<readonly GalleryImage[]>([]);

export function ConversationImageGallery({ turns, children }: { turns: readonly Turn[]; children: ReactNode }) {
  const images = useMemo(() => conversationImages(turns), [turns]);
  return <ImageGalleryContext.Provider value={images}>{children}</ImageGalleryContext.Provider>;
}

export function useImageGallery(initial: GalleryImage, images?: readonly GalleryImage[]) {
  const context = useContext(ImageGalleryContext);
  const [selected, setSelected] = useState(initial.source);
  const entries = images ?? context;
  const collection = entries.some(image => image.source === initial.source) ? entries : [initial, ...entries];
  const index = Math.max(0, collection.findIndex(image => image.source === selected));
  const current = collection[index];
  const navigation: ImageNavigation = {
    previous: index > 0 ? () => setSelected(collection[index - 1].source) : undefined,
    next: index < collection.length - 1 ? () => setSelected(collection[index + 1].source) : undefined,
  };
  return { current, navigation };
}

import { useState, type SetStateAction } from 'react';
import type { LoungeDraft } from './types';

export interface ComposerDraftState { draft: LoungeDraft; change: (draft: SetStateAction<LoungeDraft>) => void }

/** Keep asynchronous image preparation and sends scoped to the composer that started them. */
export function useComposerDraft(external?: ComposerDraftState) {
  const [local, setLocal] = useState<LoungeDraft>({ text: '', images: [] });
  const draft = external?.draft ?? local;
  const change = (update: (current: LoungeDraft) => LoungeDraft) => {
    if (external) external.change(update);
    else setLocal(update);
  };
  const setText = (value: SetStateAction<string>) => change(current => ({ ...current,
    text: typeof value === 'function' ? value(current.text) : value }));
  const setImages = (value: SetStateAction<string[]>) => change(current => ({ ...current,
    images: typeof value === 'function' ? value(current.images) : value }));
  const clearSent = (sent: LoungeDraft) => {
    // The input stays editable during delivery; retain anything changed after Send was pressed.
    change(current => ({ ...current, text: current.text === sent.text ? '' : current.text,
      images: current.images === sent.images ? [] : current.images,
      reply: current.reply === sent.reply ? undefined : current.reply }));
  };
  return { text: draft.text, images: draft.images, setText, setImages, clearSent };
}

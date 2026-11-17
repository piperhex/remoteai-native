import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, RootContent } from 'mdast';
import type { Item, Turn } from '../conversation/types';
import { itemImageSources, isInlineImage, localImageSource } from './imageSources';
import { toolResultPresentation } from './toolResult';

export interface GalleryImage { source: string; description?: string }

const parser = unified().use(remarkParse);
const cache = new WeakMap<Item, GalleryImage[]>();
const supported = (source: string) => Boolean(isInlineImage(source) || localImageSource(source)
  || /^https?:\/\//i.test(source));

function markdownImages(text: string): GalleryImage[] {
  if (!text.includes('[')) return [];
  const tree = parser.parse(text) as Root;
  const definitions = new Map(tree.children.filter(node => node.type === 'definition')
    .map(node => [node.identifier.toUpperCase(), node.url]));
  const images: GalleryImage[] = [];
  const visit = (node: Root | RootContent) => {
    const url = 'url' in node ? node.url : 'identifier' in node
      ? definitions.get(node.identifier.toUpperCase()) : undefined;
    const image = node.type === 'image' || node.type === 'imageReference';
    const imageLink = (node.type === 'link' || node.type === 'linkReference') && url && localImageSource(url);
    if (url && (image || imageLink) && supported(url)) {
      images.push({ source: url, description: 'alt' in node ? node.alt ?? undefined : undefined });
    }
    if ('children' in node) node.children.forEach(child => visit(child as RootContent));
  };
  visit(tree);
  return images;
}

function outputImages(value: unknown): GalleryImage[] {
  if (typeof value === 'string') return markdownImages(value);
  if (!value || typeof value !== 'object') return [];
  const part = value as Record<string, unknown>;
  if (part.type === 'image' && typeof part.data === 'string' && typeof part.mimeType === 'string') {
    return [{ source: `data:${part.mimeType};base64,${part.data}` }];
  }
  if (part.type === 'inputImage' && typeof part.imageUrl === 'string' && supported(part.imageUrl)) {
    return [{ source: part.imageUrl }];
  }
  return typeof part.text === 'string' ? markdownImages(part.text) : [];
}

function itemImages(item: Item, completed = false): GalleryImage[] {
  const previous = cache.get(item);
  if (previous) return previous;
  const images = itemImageSources(item).filter(supported).map(source => ({ source }));
  const text = item.text ?? (item.content ?? []).map(part => typeof part === 'string' ? part : part.text ?? '')
    .join('\n');
  const result = toolResultPresentation(item);
  const outputs = [...(result.content ?? (result.hasStructured ? [] : [item.result])),
    ...(result.hasStructured ? [] : [item.output])];
  const collected = [...images, ...markdownImages(text), ...outputs.flatMap(outputImages),
    ...(item.processOutputs ?? []).flatMap(output => itemImages(output, completed))];
  // Immutable completed items are reused while a streamed item continues to grow.
  if (completed || item.status === 'completed') cache.set(item, collected);
  return collected;
}

/** Collect references without loading pixels, including images outside the rendered history window. */
export function conversationImages(turns: readonly Turn[]): GalleryImage[] {
  const sources = new Map<string, GalleryImage>();
  const images = turns.flatMap(turn => turn.items.flatMap(item => itemImages(item, turn.status === 'completed')));
  for (const image of images) {
    if (!sources.has(image.source)) sources.set(image.source, image);
  }
  return [...sources.values()];
}

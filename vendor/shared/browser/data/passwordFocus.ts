import { loginOrigin } from './model';
import type { SavedLogin } from './vault';

export interface PasswordFocus {
  origin: string; id: string; username: string;
  bounds: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
}

export function isPasswordFocus(value: unknown): value is PasswordFocus {
  if (!value || typeof value !== 'object') return false;
  const focus = value as PasswordFocus, bounds = focus.bounds, viewport = focus.viewport;
  return typeof focus.origin === 'string' && loginOrigin(focus.origin) === focus.origin
    && typeof focus.id === 'string' && /^[\w-]{1,80}$/.test(focus.id)
    && typeof focus.username === 'string' && focus.username.length <= 512
    && !!bounds && !!viewport && [bounds.x, bounds.y, bounds.width, bounds.height, viewport.width, viewport.height]
      .every(number => Number.isFinite(number) && Math.abs(number) <= 100000)
    && bounds.width > 0 && bounds.height > 0 && viewport.width > 0 && viewport.height > 0;
}

export function matchingPasswords(entries: SavedLogin[], focus: PasswordFocus): SavedLogin[] {
  return entries.filter(entry => entry.origin === focus.origin)
    .sort((a, b) => Number(b.username === focus.username) - Number(a.username === focus.username) || b.at - a.at);
}

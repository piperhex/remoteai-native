import type { Login } from './model';
import type { PasswordFocus } from './passwordFocus';

export interface PasswordPageOptions {
  action: 'install' | 'take' | 'takeFocus' | 'fill'; login?: Login; focusId?: string; native?: boolean; desktop?: boolean;
}
interface PageState {
  installed: boolean; pending: Login | null; pendingFocus?: PasswordFocus | null;
  focus?: { id: string; input: HTMLInputElement };
}
export const loginPage = () => window as Window & { __remoteaiLogin?: PageState;
  chrome?: { webview?: { postMessage: (value: unknown) => void } };
  ReactNativeWebView?: { postMessage: (value: string) => void } };
export const formInputs = (form: HTMLFormElement) => Array.from(form.querySelectorAll<HTMLInputElement>('input'))
  .filter(input => !input.disabled && input.type !== 'hidden' && input.getClientRects().length > 0);
export const usernameInput = (fields: HTMLInputElement[]) => fields.find(input => input.autocomplete === 'username')
  ?? fields.find(input => input.type === 'email') ?? fields.find(input => ['text', 'tel'].includes(input.type));
export const passwordInput = (fields: HTMLInputElement[]) => fields.find(input => input.type === 'password'
  && input.autocomplete !== 'new-password');
export function safeLoginForm(form: HTMLFormElement) {
  try { return new URL(form.action || location.href, location.href).origin === location.origin; }
  catch { return false; }
}
export function postLoginMessage(options: PasswordPageOptions, message: { type: string } & Record<string, unknown>) {
  const page = loginPage(), serialized = JSON.stringify(message);
  if (options.native && page.ReactNativeWebView) { page.ReactNativeWebView.postMessage(serialized); return true; }
  if (options.desktop && page.chrome?.webview) { page.chrome.webview.postMessage(serialized); return true; }
  return false;
}

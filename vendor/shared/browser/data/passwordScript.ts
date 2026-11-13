import { passwordPageSource } from './passwordPageSource';
import type { Login } from './model';

/** Hermes does not retain function source, so use the generated source string on every platform. */
export function passwordScript(options: { action: 'install' | 'take' | 'fill'; login?: Login; native?: boolean }) {
  return `(()=>{${passwordPageSource};return RemoteAIBrowserPassword.passwordPage(${JSON.stringify(options)});})()`;
}

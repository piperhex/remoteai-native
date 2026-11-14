import { passwordPageSource } from './passwordPageSource';
import type { PasswordPageOptions } from './passwordPageFields';

/** Hermes does not retain function source, so use the generated source string on every platform. */
export function passwordScript(options: PasswordPageOptions) {
  return `(()=>{${passwordPageSource};return RemoteAIBrowserPassword.passwordPage(${JSON.stringify(options)});})()`;
}

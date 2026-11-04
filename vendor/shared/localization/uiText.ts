import { getInterfaceLanguage, setInterfaceLanguage } from "./interfaceLanguage";
import { localeForLanguage, type Language } from "./language";
import { translateMessage, type MessageKey, type TranslationValues } from "./messages";

export const setGuiLanguage = setInterfaceLanguage;
export const guiLanguage = getInterfaceLanguage;
export const guiLocale = () => localeForLanguage(guiLanguage());
export { displayText } from './messages';
export { remoteErrorText as displayError } from './errors';

/** Only call for application copy; never translate conversation content or user data. */
export function uiText(key: MessageKey, values: TranslationValues = {}, language: Language = guiLanguage()): string {
  return translateMessage(language, key, values);
}

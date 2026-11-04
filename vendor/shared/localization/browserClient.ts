import { getLanguage } from './browserLanguage';
import { applications, languageOptions } from '@remoteai/i18n';
import { translateMessage, type MessageKey, type TranslationValues } from "./messages";

export { getLanguage, getLocale, setLanguage, useLanguage } from './browserLanguage';
export const LANGUAGE_OPTIONS = languageOptions(applications.web);
export { languageLabel } from '@remoteai/i18n';
export type { Language } from './browserLanguage';
import { displayText as renderText } from './messages';
import { formatRemoteError } from './errors';
export const displayText = (value: string, values?: TranslationValues) => renderText(value, values, getLanguage());
export const displayError = (error: unknown) => formatRemoteError(getLanguage(), error);
export const t = (key: MessageKey, values?: TranslationValues): string => translateMessage(getLanguage(), key, values);

import { localeForLanguage as getLocale } from '@remoteai/i18n';
import type { Language } from '../localization/language';
import { formatContextTokens } from "./values.js";

export function formatCompactTokenCount(value: number, language: Language) {
  return formatContextTokens(value, getLocale(language));
}

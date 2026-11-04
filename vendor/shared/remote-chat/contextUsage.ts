import { displayText } from '../localization/messages';
import { contextUsage } from '../conversation/contextUsage';
import { formatCompactTokenCount } from '../context-usage/format';
import type { ThreadTokenUsage } from './client/types';

import type { Language } from "../localization/language";

export function contextUsageLabel(usage?: ThreadTokenUsage, language: Language = 'zh') {
  const t = (text: string, values?: Record<string, string | number>) => displayText(text, values, language);
  const context = contextUsage(usage);
  if (!context) return t("client.shared.noContextUsageYet");
  const used = formatCompactTokenCount(context.used, language);
  if (context.capacity === null) return t("client.shared.contextUsedTokensCapacityUnknown", { used });
  const capacity = formatCompactTokenCount(context.capacity, language);
  return t("client.shared.contextTokensUsed", { used, capacity, percent: context.percent ?? 0 });
}

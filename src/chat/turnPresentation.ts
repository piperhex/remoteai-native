export * from '../../vendor/shared/chat/turnPresentation';
import { conversationEntries as sharedEntries } from '../../vendor/shared/chat/turnPresentation';
import { nativeSummaryEntries } from './nativeSummaryEntries';

export const conversationEntries = (...args: Parameters<typeof sharedEntries>) =>
  nativeSummaryEntries(sharedEntries(...args));

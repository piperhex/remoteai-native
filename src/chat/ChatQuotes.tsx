import { displayError } from '../i18n/index';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useScopedDraft } from '../../vendor/shared/chat/useScopedDraft';
import { Toast } from '../components/AppToast';

import { appendQuote, clearSubmittedQuotes, quoteKey, type ChatQuote } from './replyQuotes';

interface QuotesContext {
  active: boolean;
  enabled: boolean;
  quotes: ChatQuote[];
  add: (quote: ChatQuote) => boolean;
  remove: (key: string) => void;
  clearSubmitted: (quotes: ChatQuote[]) => void;
}

const Context = createContext<QuotesContext | null>(null);
export const QuoteSourceContext = createContext<{
  messageId: string; role: ChatQuote['role']; onQuote?: () => void;
} | null>(null);

/** Scope quotes without remounting the composer during the first send of a new conversation. */
export function ChatQuotesProvider({ children, active, enabled, scope }: {
  children: ReactNode; active: boolean; enabled: boolean; scope: string | null;
}) {
  const [quotes, setQuotes] = useScopedDraft<ChatQuote[]>(scope, () => []);
  const current = useRef(quotes);
  current.current = quotes;
  const add = (quote: ChatQuote) => {
    if (!enabled) return false;
    const result = appendQuote(current.current, quote);
    if (result.error) { Toast.fail(displayError(result.error)); return false; }
    current.current = result.quotes;
    setQuotes(result.quotes);
    return true;
  };
  const value: QuotesContext = { active, enabled, quotes, add,
    remove: key => setQuotes(value => value.filter(quote => quoteKey(quote) !== key)),
    clearSubmitted: submitted => setQuotes(value => clearSubmittedQuotes(value, submitted)),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useChatQuotes() { return useContext(Context); }

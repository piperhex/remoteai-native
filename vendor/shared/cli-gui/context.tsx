import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { CliController } from './controller';
import type { CliState } from './controller';
import type { CliTransport } from './types';

const CliContext = createContext<{ controller: CliController; state: CliState } | null>(null);
export const useCliGui = () => useContext(CliContext);

export function CliGuiProvider({ transport, children, enabled = true, createMessageId }: {
  transport: CliTransport; children: ReactNode; enabled?: boolean; createMessageId?: () => string;
}) {
  const controller = useMemo(() => new CliController(transport, createMessageId), [transport, createMessageId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => enabled ? controller.start() : undefined, [controller, enabled]);
  return <CliContext.Provider value={{ controller, state }}>{children}</CliContext.Provider>;
}

import { PROCESSING_LABELS, type PendingRequest } from '../../conversation/processing';
import { uiText } from "../../localization/uiText";
import { formatTurnDuration, SECOND_MS } from '../../conversation/turnTiming';
import type { ChatState, Turn } from './types';
import { useProcessingSeconds } from './useProcessingSeconds';

export interface ChatProcessingProps {
  turn?: Turn;
  active: boolean;
  processing?: ChatState['processing'];
  pendingRequest?: PendingRequest;
}

export function useProcessingStatus({ turn, active, processing, pendingRequest }: ChatProcessingProps) {
  const current = turn && processing?.turnId === turn.id ? processing : undefined;
  const pending = turn ? undefined : pendingRequest;
  const { phaseSeconds, totalSeconds } = useProcessingSeconds(turn, active, current?.startedAtMs, pending?.startedAtMs);
  const phase = pending ? 'sending' : current?.phase ?? 'request';
  const total = formatTurnDuration(totalSeconds * SECOND_MS, { compactHours: true });
  const totalLabel = uiText("client.shared.total", { duration: total });
  const phaseLabel = `${PROCESSING_LABELS[phase]} · ${formatTurnDuration(phaseSeconds * SECOND_MS)}`;
  return { phase, label: `${phaseLabel} ${totalLabel}` };
}

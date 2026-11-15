export interface InspectorRequest {
  tag: number; hostTag: number; id: string; error: string; language: string; theme: string;
  surfaceColor: string; contentColor: string;
}
export interface InspectorBridge {
  supported: boolean;
  open(request: InspectorRequest): Promise<void>;
  close(id: string): void;
  hideKeyboard(id: string): void;
}

/** Retiring a pending request must not revive its surface or close a newer tab's inspector. */
export function inspectorSession(bridge: InspectorBridge, id: string) {
  let stopped = false;
  return {
    async open(request: Omit<InspectorRequest, 'id'>): Promise<void> {
      await bridge.open({ ...request, id });
      if (stopped) bridge.close(id);
    },
    stop() { stopped = true; bridge.close(id); },
    hideKeyboard() { if (!stopped) bridge.hideKeyboard(id); },
  };
}

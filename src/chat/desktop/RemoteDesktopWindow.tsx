import { createContext, useCallback, useContext, useId, useLayoutEffect, useState,
  type ComponentProps, type ReactNode } from 'react';
import { RemoteDesktop } from './RemoteDesktop';

type WindowProps = ComponentProps<typeof RemoteDesktop>;
const WindowContext = createContext<((id: string, props?: WindowProps) => void) | null>(null);

// A native modal under a display:none chat pane can open with an empty Android window.
export function RemoteDesktopWindowHost({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<Record<string, WindowProps>>({});
  const update = useCallback((id: string, props?: WindowProps) => {
    setWindows(current => {
      const next = { ...current };
      if (props) next[id] = props;
      else delete next[id];
      return next;
    });
  }, []);
  return <WindowContext.Provider value={update}>
    {children}
    {Object.entries(windows).map(([id, props]) => <RemoteDesktop key={id} {...props} />)}
  </WindowContext.Provider>;
}

export function RemoteDesktopWindow(props: WindowProps) {
  const update = useContext(WindowContext);
  const id = useId();
  useLayoutEffect(() => { update?.(id, props); }, [update, id, props]);
  useLayoutEffect(() => () => update?.(id), [update, id]);
  return update ? null : <RemoteDesktop {...props} />;
}

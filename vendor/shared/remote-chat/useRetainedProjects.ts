import { useState } from 'react';

/** Dismissing a tool only hides it; its project state lives until an explicit close. */
export function useRetainedProjects() {
  const [projects, setProjects] = useState<string[]>([]);
  const [visible, setVisible] = useState<string>();
  const open = (cwd: string) => {
    setProjects(current => current.includes(cwd) ? current : [...current, cwd]);
    setVisible(cwd);
  };
  const close = (cwd: string) => {
    setProjects(current => current.filter(project => project !== cwd));
    setVisible(current => current === cwd ? undefined : current);
  };
  return { projects, visible, open, close, hide: () => setVisible(undefined) };
}

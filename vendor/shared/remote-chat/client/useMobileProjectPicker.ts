import { useEffect, useMemo, useRef, useState } from 'react';
import { entryNameError } from '../../project-browser/entryActions';
import { pathParts } from '../../project-explorer/model';
import type { ProjectDirectoriesResponse, ProjectDirectory, ProjectPickerProps } from '../projectDirectories';
import { useProjectDirectories } from './useProjectDirectories';

function recentDirectories(projects: ProjectPickerProps['projects']): ProjectDirectory[] {
  const unique = new Map<string, ProjectDirectory>();
  for (const project of projects ?? []) {
    if (project.cwd && !unique.has(project.cwd)) {
      unique.set(project.cwd, { name: project.label, path: project.cwd, directory: true });
    }
  }
  return [...unique.values()];
}

/** Shared phone navigation keeps Native and mobile Web on the same host paths. */
export function useMobileProjectPicker(props: ProjectPickerProps) {
  const listing = useProjectDirectories(props);
  const [shortcuts, setShortcuts] = useState<ProjectDirectoriesResponse['shortcuts']>({});
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locations, setLocations] = useState(false);
  const [recent, setRecent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setShortcuts({});
    if (!props.cwd) return;
    let cancelled = false;
    void props.load('').then(value => { if (!cancelled) setShortcuts(value.shortcuts ?? {}); })
      .catch(() => { /* Browsing still works when this host cannot resolve shortcuts. */ });
    return () => { cancelled = true; };
  }, [props.load, props.cwd]);
  useEffect(() => {
    if (listing.result?.shortcuts) setShortcuts(listing.result.shortcuts);
  }, [listing.result]);
  const navigate = (path: string) => {
    if (pending.current) return;
    setQuery(''); setRecent(false); setLocations(false); setCreating(false); setActionError('');
    listing.browse(path);
  };
  const entries = useMemo(() => {
    const candidates: ProjectDirectory[] = recent
      ? recentDirectories(props.projects)
      : (listing.result?.entries ?? []).filter(entry => entry.directory !== false);
    const search = query.trim().toLocaleLowerCase();
    return candidates.filter(entry => entry.name.toLocaleLowerCase().includes(search));
  }, [listing.result, props.projects, recent, query]);
  const parts = listing.directory ? pathParts(listing.directory) : [];
  const parent = listing.result?.parent ?? parts.at(-2)?.path ?? '';
  const canChoose = !listing.loading && !busy && !recent && !!listing.result?.directory;
  const invalidName = entryNameError(name.trim());
  const createFolder = async () => {
    if (pending.current || !props.mutate || !canChoose || invalidName) return;
    pending.current = true; setBusy(true); setActionError('');
    try {
      const entry = await props.mutate({ cwd: parts[0].path, path: listing.directory,
        action: 'createFolder', name: name.trim() });
      if (mounted.current) { setCreating(false); listing.browse(entry.path); }
    } catch {
      if (mounted.current) setActionError('client.projectExplorer.actionError');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { ...listing, shortcuts, entries, parts, parent, navigate, query, setQuery, searching, setSearching,
    locations, setLocations, recent, canChoose, creating, name, setName, busy, invalidName, actionError, createFolder,
    canCreate: canChoose && !!props.mutate,
    openCreate: () => { if (canChoose && props.mutate) { setCreating(true); setName(''); setActionError(''); } },
    cancelCreate: () => { if (!pending.current) { setCreating(false); setActionError(''); } },
    toggleRecent: () => { if (!pending.current) { setRecent(value => !value); setQuery(''); setLocations(false); } },
  };
}

export type MobileProjectPickerState = ReturnType<typeof useMobileProjectPicker>;

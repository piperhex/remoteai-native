import { useEffect, useState } from 'react';
import type { SshProfile, SshProfileStore } from '../terminal/sshProfiles';
import { sshProfileError } from '../terminal/sshProfileResponse';

export type ComposerSshProfiles = Pick<SshProfileStore, 'list'>;

export function useSshCandidates(options: {
  active: boolean; connected: boolean; profiles?: ComposerSshProfiles;
}) {
  const { active, connected, profiles } = options;
  const [result, setResult] = useState({ items: [] as SshProfile[], loading: false, error: '' });
  useEffect(() => {
    if (!active || !connected || !profiles) return;
    let current = true;
    setResult({ items: [], loading: true, error: '' });
    void profiles.list().then(items => {
      if (current) setResult({ items, loading: false, error: '' });
    }).catch(error => {
      if (current) setResult({ items: [], loading: false, error: sshProfileError(error, 'client.ssh.loadFailed') });
    });
    return () => { current = false; };
  }, [active, connected, profiles]);
  return result;
}

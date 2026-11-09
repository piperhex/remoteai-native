import type { AttachmentReference } from './attachmentTypes';
import { parseSshProfile, sshLabel, type SshProfile } from '../terminal/sshProfiles';

export const SSH_REFERENCE_PREFIX = 'ssh-profile://';
export const SSH_REFERENCE_PATTERN = /^ssh-profile:\/\/[A-Za-z0-9_-]{1,128}$/u;

export function sshReference(profile: SshProfile): AttachmentReference {
  const name = (profile.name.trim() || sshLabel(profile)).replace(/[\x00-\x1f\x7f]/gu, ' ');
  return { kind: 'ssh', name, path: `${SSH_REFERENCE_PREFIX}${profile.id}` };
}

/** Only connection metadata enters the composer; credentials stay in the connection service. */
export function sshCandidates(profiles: SshProfile[], query: string) {
  const search = query.trim().toLocaleLowerCase();
  return profiles.flatMap(value => parseSshProfile(value) ?? []).filter(profile =>
    `${profile.name} ${sshLabel(profile)}`.toLocaleLowerCase().includes(search));
}

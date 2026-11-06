import type { LoungeContact } from './contacts';
import type { LoungeSnapshot } from './types';
import { clientVersionItems } from './clientVersion';

/** Cached versions cannot establish presence; legacy clients keep the ordinary status fallback. */
export function hasOnlineClientDevices(contact: LoungeContact | undefined, status: LoungeSnapshot['status']) {
  return status === 'connected' && contact?.online === true
    && clientVersionItems(contact.user).some(client => client.platform !== undefined);
}

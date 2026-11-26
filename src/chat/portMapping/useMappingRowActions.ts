import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import type { MessageKey } from '@remoteai/i18n';
import type { ForwardingEntry } from '../../../vendor/shared/port-mapping/service';
import { localMappingAddress } from '../../../vendor/shared/port-mapping/target';

export function useMappingRowActions(entry: ForwardingEntry) {
  const [notice, setNotice] = useState<MessageKey>();
  const [menu, setMenu] = useState(false);
  const running = entry.status === 'running';
  const busy = entry.status === 'starting' || entry.status === 'stopping';
  const enabled = entry.enabled ?? (running || busy);
  const address = localMappingAddress(entry);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(address);
      setNotice('client.portForwarding.localAddressCopied');
    } catch { setNotice('client.chat.couldNotCopyTryAgain'); }
  };
  return { notice, menu, setMenu, running, busy, enabled, address, copy, canOpen: running && entry.protocol !== 'udp' };
}

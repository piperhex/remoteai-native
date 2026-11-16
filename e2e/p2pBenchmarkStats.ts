import { NativeModules } from 'react-native';

interface RtcModule {
  peerConnectionInit(configuration: object, id: number): boolean;
  peerConnectionGetStats(id: number): Promise<string>;
}
interface RtcStat {
  id: string; type: string; selectedCandidatePairId?: string; localCandidateId?: string; remoteCandidateId?: string;
  label?: string; state?: string; bytesReceived?: number; bytesSent?: number; messagesReceived?: number;
  currentRoundTripTime?: number; address?: string; ip?: string; port?: number; protocol?: string; candidateType?: string;
}

/** Observe native peer creation and sample its public stats API without replacing the transport. */
export function observeBenchmarkPeers() {
  const module = NativeModules.WebRTCModule as RtcModule;
  const initialize = module.peerConnectionInit;
  const peers = new Set<number>();
  module.peerConnectionInit = (configuration, id) => {
    const result = initialize(configuration, id);
    if (result) peers.add(id);
    return result;
  };
  return {
    close: () => { module.peerConnectionInit = initialize; },
    snapshot: async () => {
      const result = [];
      for (const id of peers) {
        const values = new Map(JSON.parse(await module.peerConnectionGetStats(id)) as [string, RtcStat][]);
        const transport = [...values.values()].find(value => value.type === 'transport');
        const pair = transport?.selectedCandidatePairId ? values.get(transport.selectedCandidatePairId) : undefined;
        const candidate = (key?: string) => {
          const value = key ? values.get(key) : undefined;
          return value && { address: value.address ?? value.ip, port: value.port,
            protocol: value.protocol, candidateType: value.candidateType };
        };
        result.push({ id, channels: [...values.values()].filter(value => value.type === 'data-channel')
          .map(value => ({ label: value.label, bytesReceived: value.bytesReceived,
            bytesSent: value.bytesSent, messagesReceived: value.messagesReceived })),
          pair: pair && { rtt: pair.currentRoundTripTime, bytesReceived: pair.bytesReceived,
            local: candidate(pair.localCandidateId), remote: candidate(pair.remoteCandidateId) } });
      }
      return result;
    },
  };
}

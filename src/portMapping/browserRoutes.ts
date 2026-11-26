import { NativeModules } from 'react-native';
import { BrowserRoutes, type BrowserRoute } from '../../vendor/shared/port-mapping/browserRoutes';
import { protocolTunnel } from '../../vendor/shared/port-mapping/protocolTunnel';
import { UdpMappingTunnel } from '../../vendor/shared/port-mapping/udpTunnel';
import type { TunnelFactory } from '../../vendor/shared/port-mapping/types';
import { NativeMappingTunnel } from '../chat/portMapping/tunnel';
import { listenUdp } from '../chat/portMapping/udpListener';

async function configure(routes: BrowserRoute[]) {
  if (!NativeModules.BrowserMappingRoutes?.supported) return;
  const reply = JSON.parse(await NativeModules.ChatConnectivity.call(JSON.stringify({
    operation: 'browser-mappings', routes,
  }))) as { data?: number | null; error?: string };
  if (reply.error || reply.data === undefined) throw new Error('Browser mapping unavailable');
  await NativeModules.BrowserMappingRoutes.configure(reply.data ?? 0, routes);
}

const browserRoutes = new BrowserRoutes(configure);

export const createBrowserMappingTunnel: TunnelFactory = (connection, options) => {
  const tunnel = protocolTunnel(options.protocol, {
    tcp: () => new NativeMappingTunnel(connection, options),
    udp: () => new UdpMappingTunnel(connection, options, listenUdp),
  });
  return options.protocol === 'udp' ? tunnel : browserRoutes.attach(tunnel, options.localPort);
};

import type { SkillsResponse } from '../conversation/types';
import type { ComposerPlugin, PluginsResponse } from '../conversation/attachmentTypes';

export interface RemoteComposerCatalog extends SkillsResponse {
  plugins?: ComposerPlugin[];
  pluginsError?: string;
}

/** Send only installed, enabled plugins and bounded menu metadata to the phone. */
export function remotePlugins(response: PluginsResponse): ComposerPlugin[] {
  return [...new Map(response.marketplaces.flatMap((marketplace) => marketplace.plugins)
    .filter((plugin) => plugin.installed && plugin.enabled).map((plugin) => [plugin.id, {
      id: plugin.id, name: plugin.name, installed: true, enabled: true,
      interface: { displayName: plugin.interface?.displayName,
        shortDescription: plugin.interface?.shortDescription },
    }])).values()];
}

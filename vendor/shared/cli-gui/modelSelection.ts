import { modelSelectionError, resolveModelSelection, type ModelSelection } from '../conversation/modelSelection';
import type { Model } from '../conversation/types';
import type { CliModel } from './types';

/** Adapt the active CLI catalog to the shared picker without consulting the Codex catalog. */
export function cliPickerModels(models: CliModel[]): Model[] {
  return models.map(model => ({ id: model.id, model: model.id, displayName: model.label,
    isDefault: Boolean(model.isDefault), defaultReasoningEffort: model.defaultEffort ?? '',
    supportedReasoningEfforts: (model.efforts ?? []).map(effort => ({
      reasoningEffort: effort.id, description: effort.label,
    })),
  }));
}

/** `none` is the picker sentinel; omit it on the wire when the model has no reasoning parameter. */
export function cliRequestEffort(model: CliModel, effort?: string): string | undefined {
  const models = cliPickerModels([model]);
  const selection: ModelSelection = { model: model.id, effort: effort ?? '' };
  if (modelSelectionError(models, selection)) throw new Error('client.cliGui.invalidRequest');
  return model.efforts?.length ? resolveModelSelection(models, selection).effort : undefined;
}

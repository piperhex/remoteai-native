import { EFFORT_LABELS } from '../remote-chat/composer';
import type { SettingsFieldState } from '../remote-chat/settingsMenu';
import { resolveModelSelection } from '../conversation/modelSelection';
import { cliPickerModels } from './modelSelection';
import { cliModeLabel } from './modeLabels';
import type { CliState } from './controller';

const COMPACT_MODE_LABELS: Record<string, string> = {
  plan: 'client.mobile.plan', acceptEdits: 'client.chat.edit.051836', autoEdit: 'client.chat.edit.051836',
  auto_edit: 'client.chat.edit.051836', auto: 'client.mobile.auto',
  bypassPermissions: 'client.shared.fullAccess', yolo: 'client.shared.fullAccess',
};

/** Share presentation while preserving each CLI's model, effort and permission identifiers. */
export function cliSettingsFields(state: CliState, connected: boolean): SettingsFieldState[] {
  if (state.engine === 'codex') return [];
  const { engine, catalog, selected } = state;
  const disabled = !connected || state.busy || selected?.status === 'running' || Boolean(selected?.archived);
  const model = catalog?.models.find(entry => entry.id === state.model);
  return [
    { field: 'model', label: 'client.shared.model', value: state.model, disabled,
      options: (catalog?.models ?? []).map(entry => ({ value: entry.id, label: entry.label })) },
    { field: 'effort', label: 'client.shared.reasoningEffort', value: state.effort, disabled,
      options: (model?.efforts ?? []).map(entry => ({ value: entry.id,
        label: EFFORT_LABELS[entry.id] ?? entry.label })) },
    { field: 'access', label: 'client.cliGui.mode', value: state.mode, disabled: disabled || Boolean(selected),
      options: (catalog?.modes ?? []).map(entry => ({ value: entry.id, label: cliModeLabel(engine, entry),
        shortLabel: entry.id === 'default' && engine === 'claude' ? 'client.shared.askForApproval'
          : COMPACT_MODE_LABELS[entry.id] })) },
  ];
}

export function cliSettingsPatch(state: CliState, field: SettingsFieldState['field'], value: string) {
  if (field === 'model') return resolveModelSelection(cliPickerModels(state.catalog?.models ?? []),
    { model: value, effort: '' });
  if (field === 'effort') return { effort: value };
  if (field === 'access') return { mode: value };
  return {};
}

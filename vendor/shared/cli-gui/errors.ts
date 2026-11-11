import { uiText } from '../localization/uiText';

const errors = {
  'client.cliGui.accountUnavailable': true, 'client.cliGui.unsupportedContent': true,
  'client.cliGui.installFailed': true, 'client.cliGui.setupNeeded': true,
  'client.cliGui.connectionFailed': true, 'client.cliGui.invalidRequest': true,
  'client.cliGui.busy': true, 'client.cliGui.unavailable': true,
  'client.cliGui.historyFailed': true, 'client.cliGui.approvalExpired': true,
  'client.cliGui.requestFailed': true, 'client.cliGui.nodeRequired': true,
  'client.chat.modelUnavailableForAccount': true, 'client.chat.effortUnavailableForAccount': true,
};

export function cliErrorText(code: string) {
  return uiText(Object.hasOwn(errors, code) ? code as keyof typeof errors : 'client.cliGui.requestFailed');
}

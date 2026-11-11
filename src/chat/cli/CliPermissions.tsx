import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { CliPermission, CliRequest, CliSession } from '../../../vendor/shared/cli-gui/types';
import { t, useLanguage } from '../../i18n';
import { useStyles } from '../styles';
import { useCliStyles } from './styles';

function Permission({ permission, busy, submit }: {
  permission: CliPermission; busy: boolean;
  submit: (action: string, answers?: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const styles = useCliStyles();
  const common = useStyles();
  const complete = permission.questions?.every(question => answers[question.question]?.trim()) ?? true;
  const answer = (question: string, value: string) => setAnswers(previous => ({ ...previous, [question]: value }));
  return <View style={styles.card} accessibilityLabel={t('client.cliGui.approval')}>
    <Text style={styles.title}>{t('client.chat.yourApprovalIsNeeded')}</Text>
    <Text selectable style={styles.body}>{permission.title}</Text>
    {!!permission.description && <Text selectable style={styles.hint}>{permission.description}</Text>}
    {permission.questions?.map(question => <View key={question.question} style={styles.field}>
      <Text style={styles.body}>{question.question}</Text>
      {question.options.map(option => {
        const values = (answers[question.question] ?? '').split(', ').filter(Boolean);
        const checked = question.multiple ? values.includes(option) : answers[question.question] === option;
        return <Pressable key={option} accessibilityRole={question.multiple ? 'checkbox' : 'radio'}
          accessibilityState={{ checked, disabled: busy }} disabled={busy}
          style={[styles.option, checked && styles.selected]} onPress={() => answer(question.question,
            question.multiple ? (checked ? values.filter(value => value !== option) : [...values, option]).join(', ')
              : option)}><Text style={styles.body}>{option}</Text></Pressable>;
      })}
      <TextInput accessibilityLabel={question.question} style={styles.input} editable={!busy}
        value={answers[question.question] ?? ''} onChangeText={value => answer(question.question, value)} />
    </View>)}
    <View style={styles.row}>{permission.actions.map(action => {
      const disabled = busy || (action.behavior === 'allow' && !complete);
      return <Pressable key={action.id} accessibilityRole="button" disabled={disabled}
        style={[common.button, action.behavior === 'allow' && common.primary, disabled && common.disabled]}
        onPress={() => submit(action.id, permission.questions?.length ? answers : undefined)}>
        <Text style={[styles.body, action.behavior === 'allow' && common.primaryText]}>
          {action.label || t(action.behavior === 'allow' ? 'client.cliGui.allow' : 'client.cliGui.deny')}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

export function CliPermissions({ session, busy, respond }: {
  session: CliSession; busy: boolean; respond: (request: CliRequest) => Promise<void>;
}) {
  const styles = useCliStyles();
  useLanguage();
  return <ScrollView style={styles.approvals} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {session.permissions.map(permission => <Permission key={`${session.id}:${permission.id}`}
      permission={permission} busy={busy} submit={(actionId, answers) => { void respond({
        engine: session.engine, action: 'approve', id: session.id, permissionId: permission.id, actionId, answers,
      }); }} />)}
  </ScrollView>;
}

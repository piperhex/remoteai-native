import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ChatGit } from '../src/chat/git/ChatGit';
import { ChatOverlay } from '../src/chat/ChatOverlay';
import { textMetrics } from '../src/theme/text';
import { createGitRepositoriesFixture } from '../vendor/shared/remote-chat/testing/gitRepositoriesFixture';
import { setInterfaceLanguage } from '../vendor/shared/localization/interfaceLanguage';

setInterfaceLanguage('zh');

function App() {
  const [fonts] = useFonts(Ionicons.font);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState('');
  const [submissions, setSubmissions] = useState('');
  const client = useMemo(() => createGitRepositoriesFixture('/projects/demo', {
    onRequest: (operation, cwd) => {
      if (['diff', 'files'].includes(operation)) setRequest(`${operation}:${cwd}`);
    },
    onSubmission: values => setSubmissions(values.map(value => `${value.operation}:${value.cwd}`).join('|')),
  }), []);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}><ChatOverlay>
    <Pressable accessibilityRole="button" accessibilityLabel="Git" onPress={() => setOpen(true)}>
      <Text style={{ ...textMetrics(18, 28), padding: 20 }}>Git</Text>
    </Pressable>
    <Text testID="git-request" style={textMetrics(12, 18)}>{request}</Text>
    <Text testID="git-submissions" style={textMetrics(12, 18)}>{submissions}</Text>
    {fonts && <ChatGit client={client} cwd="/projects/demo" active={open} connected onClose={() => setOpen(false)} />}
  </ChatOverlay></SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(App);

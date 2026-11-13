import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { activateSession, beginLogin } from '../src/api/sessionStore';
import { setLanguage } from '../src/i18n/preference';
import { setThemeMode } from '../src/theme/preference';
import App from '../App';

const fetchLocal = global.fetch;
global.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('http://127.0.0.1:18427/')) return Promise.reject(new Error('Fixture is offline'));
  return fetchLocal(input, init);
};

async function prepare() {
  const response = await fetch('http://127.0.0.1:18427/fixture/config');
  const config = await response.json() as { theme: 'light' | 'dark' };
  await Promise.all([setLanguage('zh'), setThemeMode(config.theme), activateSession({
    baseUrl: 'http://127.0.0.1:18427', email: 'discovery@example.test',
    accessToken: 'fixture-access', refreshToken: 'fixture-refresh',
    profile: { id: 'discovery', email: 'discovery@example.test', role: 'user' },
  }, beginLogin())]);
}

// Exercise production routing and every real Discover page without accessing a user's account.
function DiscoveryBackFixture() {
  const [ready, setReady] = useState(false);
  const [fonts] = useFonts(Ionicons.font);
  useEffect(() => {
    void prepare().then(() => setReady(true));
  }, []);
  return ready && fonts ? <App /> : null;
}

registerRootComponent(DiscoveryBackFixture);

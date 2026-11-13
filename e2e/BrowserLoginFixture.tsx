import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNativeBrowserRecords } from '../src/browser/useBrowserRecords';
import { BrowserPasswords, NativePasswordCapture } from '../src/browser/BrowserPasswords';
import { textMetrics } from '../src/theme/text';

const url = 'https://browser-fixture.test/';
const source = { baseUrl: url, html: `<!doctype html><html><meta name="viewport" content="width=device-width">
  <style>body{font:18px sans-serif;padding:16px}input,button{display:block;padding:12px;margin:12px}</style>
  <form onsubmit="event.preventDefault()"><input aria-label="Username" autocomplete="username" value="native-fixture-user">
  <input aria-label="Password" type="password" autocomplete="current-password" value="native-fixture-secret">
  <button>Sign in</button></form><button onclick="document.querySelector('form').reset();
    document.querySelectorAll('input').forEach(i=>i.value='')">Reset form</button><output></output>
  <script>document.addEventListener('input',()=>{const i=document.querySelectorAll('input');
  document.querySelector('output').textContent=i[0].value==='native-fixture-user'&&i[1].value==='native-fixture-secret'
  ?'Filled correctly':'';});</script></html>` };
export function BrowserLoginFixture({ close }: { close: () => void }) {
  const view = useRef<WebView>(null), records = useNativeBrowserRecords(view, true), [manager, setManager] = useState(false);
  return <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 16 }}>
      <Pressable accessibilityRole="button" onPress={close}><Text style={textMetrics(16, 24)}>Close test</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setManager(true)}>
        <Text style={textMetrics(16, 24)}>Passwords</Text></Pressable>
    </View>
    <WebView ref={view} source={source} style={{ flex: 1 }} injectedJavaScript={records.script}
      onNavigationStateChange={records.navigate} onMessage={records.receive} />
    {records.candidate && <NativePasswordCapture login={records.candidate} close={records.closeCapture} />}
    {manager && <BrowserPasswords currentUrl={url} fill={records.fill} close={() => setManager(false)} />}
  </SafeAreaView>;
}

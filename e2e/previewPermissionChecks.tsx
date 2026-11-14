import { registerRootComponent } from 'expo';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MappingPreview } from '../src/chat/portMapping/MappingPreview';
import { loadTheme } from '../src/theme/preference';

function App() {
  const [tab, setTab] = useState(0);
  useEffect(() => { void loadTheme(); }, []);
  // Replace the current tab to exercise WebView destruction without restarting the app or its OS grants.
  return <SafeAreaProvider><MappingPreview key={tab} port={1497} close={() => {}}
    newTab={() => setTab(value => value + 1)} /></SafeAreaProvider>;
}
registerRootComponent(App);

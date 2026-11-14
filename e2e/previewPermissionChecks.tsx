import { registerRootComponent } from 'expo';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MappingPreview } from '../src/chat/portMapping/MappingPreview';
import { loadTheme } from '../src/theme/preference';

function App() {
  useEffect(() => { void loadTheme(); }, []);
  return <SafeAreaProvider><MappingPreview port={1497} close={() => {}} /></SafeAreaProvider>;
}
registerRootComponent(App);

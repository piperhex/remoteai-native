import { useContext } from 'react';
import { Linking } from 'react-native';
import { NativeBrowserContext } from '../browser/context';

export function useChatWebsite() {
  const browser = useContext(NativeBrowserContext);
  return (url: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    if (browser?.openTab) browser.openTab(url);
    else void Linking.openURL(url).catch(() => undefined);
  };
}

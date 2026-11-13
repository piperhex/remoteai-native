import { useNativeBrowser } from '../browser/context';
import { BottomNavigation, type BottomNavigationProps } from './BottomNavigation';

type Props = Omit<BottomNavigationProps, 'onChange'> & {
  onChange: (page: 'chat' | 'accounts' | 'discover' | 'settings') => void;
};

/** Keep application navigation outside the retained browser surfaces. */
export function BrowserBottomNavigation({ activePage, onChange, ...props }: Props) {
  const browser = useNativeBrowser();
  if (!browser.visible && ['token-summary', 'downloads', 'lounge'].includes(activePage)) return null;
  return <BottomNavigation {...props} activePage={browser.visible ? 'browser' : activePage} onChange={page => {
    if (page === 'browser') browser.open();
    else { browser.close(); onChange(page); }
  }} />;
}

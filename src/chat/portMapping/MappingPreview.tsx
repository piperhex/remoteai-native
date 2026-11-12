import { Platform, Text, View } from 'react-native';
import { Modal } from '../../components/Modal';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { t, useLanguage } from '../../i18n';
import { useStyles } from '../styles';
import { MappingBrowserToolbar } from './MappingBrowserToolbar';
import { useMappingBrowserStyles } from './mappingBrowserStyles';
import { PREVIEW_NETWORK_SCRIPT } from './previewNetworkActivity';
import { useMappingBrowser } from './useMappingBrowser';

export function MappingPreview({ port, close }: { port: number; close: () => void }) {
  const styles = useStyles();
  const browserStyles = useMappingBrowserStyles();
  const browser = useMappingBrowser(port);
  const { activity } = browser;
  useLanguage();
  return <Modal visible animationType="slide" onRequestClose={close}
    supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
    <SafeAreaProvider><SafeAreaView style={styles.page}>
      <MappingBrowserToolbar browser={browser} close={close} />
      {Platform.OS === 'ios' && <Text style={browserStyles.message}>
        {t("client.portForwarding.switchingAppsMayInterruptTheMappingPreviewHereForA")}</Text>}
      {!!browser.error && <Text accessibilityRole="alert" style={[browserStyles.message, browserStyles.error]}>
        {browser.error}</Text>}
      <WebView ref={browser.webview} source={browser.source} style={styles.fill} incognito
        originWhitelist={['http://*', 'https://*']} allowFileAccess={false}
        allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
        // Android enforces this through patch-webview-permissions.cjs, including after redirects.
        geolocationEnabled={false} mediaCapturePermissionGrantType="deny"
        injectedJavaScriptBeforeContentLoaded={PREVIEW_NETWORK_SCRIPT}
        injectedJavaScript={PREVIEW_NETWORK_SCRIPT}
        onMessage={activity.onMessage} onLoadStart={activity.onLoadStart} onLoadEnd={activity.onLoadEnd}
        onShouldStartLoadWithRequest={request => /^https?:\/\//i.test(request.url)}
        onNavigationStateChange={browser.onNavigationStateChange}
        renderError={() => <View style={styles.empty}>
          <Text style={browserStyles.message}>
            {t("client.portForwarding.couldNotLoadTheWebsiteCheckThatTheServiceIs")}</Text></View>}
        onError={browser.onError} />
    </SafeAreaView></SafeAreaProvider>
  </Modal>;
}

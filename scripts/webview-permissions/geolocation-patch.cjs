const packagePath = 'main/java/com/reactnativecommunity/webview/';
const client = packagePath + 'RNCWebChromeClient.java';
const entry = 'public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {';
const granted = 'PackageManager.PERMISSION_GRANTED';
const context = 'ContextCompat.checkSelfPermission(mWebView.getThemedReactContext(), Manifest.permission.';

module.exports = [
  [packagePath + 'RNCWebView.java',
    'public final RemoteAiMediaCapture remoteAiMediaCapture = new RemoteAiMediaCapture(this);',
    'public final RemoteAiMediaCapture remoteAiMediaCapture = new RemoteAiMediaCapture(this);\n'
    + '    public boolean remoteAiAllowGeolocation = false;'],
  [packagePath + 'RNCWebViewManagerImpl.kt', 'view.settings.setGeolocationEnabled(value)',
    'view.remoteAiAllowGeolocation = value\n        view.settings.setGeolocationEnabled(value)'],
  [client, entry, entry + '\n'
    + '        if (!mWebView.remoteAiAllowGeolocation) { callback.invoke(origin, false, false); return; }\n'
    + '        mWebView.remoteAiMediaCapture.requestGeolocation(origin, callback,\n'
    + '            approved -> remoteAiRequestGeolocation(origin, approved));\n    }\n\n'
    + '    @Override\n    public void onGeolocationPermissionsHidePrompt() {\n'
    + '        mWebView.remoteAiMediaCapture.cancelGeolocation();\n    }\n\n'
    + '    private boolean remoteAiHasLocationPermission() {\n'
    + `        return ${context}ACCESS_COARSE_LOCATION) == ${granted}\n`
    + `            || ${context}ACCESS_FINE_LOCATION) == ${granted};\n    }\n\n`
    + '    private void remoteAiRequestGeolocation(String origin, GeolocationPermissions.Callback callback) {'],
  [client, 'if (ContextCompat.checkSelfPermission(this.mWebView.getThemedReactContext(), Manifest.permission.ACCESS_FINE_LOCATION)\n'
    + '                != PackageManager.PERMISSION_GRANTED) {', 'if (!remoteAiHasLocationPermission()) {'],
  [client, 'requestPermissions(Collections.singletonList(Manifest.permission.ACCESS_FINE_LOCATION));',
    'requestPermissions(java.util.Arrays.asList(Manifest.permission.ACCESS_COARSE_LOCATION,\n'
    + '                Manifest.permission.ACCESS_FINE_LOCATION));'],
  [client, 'if (permission.equals(Manifest.permission.ACCESS_FINE_LOCATION)\n',
    'if ((permission.equals(Manifest.permission.ACCESS_FINE_LOCATION)\n'
    + '                    || permission.equals(Manifest.permission.ACCESS_COARSE_LOCATION))\n'],
  [client, 'if (granted) {\n                    geolocationPermissionCallback.invoke',
    'if (remoteAiHasLocationPermission()) {\n                    geolocationPermissionCallback.invoke'],
];

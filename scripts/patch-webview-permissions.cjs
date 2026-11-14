const fs = require('node:fs');
const path = require('node:path');

function replaceOnce(source, before, after) {
  if (source.includes(after)) return source;
  if (source.split(before).length !== 2) throw new Error('Review the Android WebView permission patch.');
  return source.replace(before, after);
}

const packagePath = 'com/reactnativecommunity/webview/';
const setter = '@ReactProp(name = "mediaCapturePermissionGrantType")\n'
    + '    public void setMediaCapturePermissionGrantType(RNCWebViewWrapper view, @Nullable String value) {\n'
    + '        view.getWebView().remoteAiDenyMediaCapture = "deny".equals(value);\n'
    + '        view.getWebView().remoteAiPromptMediaCapture = "prompt".equals(value);\n    }';
const oldSetter = setter.replace('        view.getWebView().remoteAiPromptMediaCapture = "prompt".equals(value);\n', '');
const oldGuard = 'public void onPermissionRequest(final PermissionRequest request) {\n'
    + '        if (mWebView.remoteAiDenyMediaCapture) {\n'
    + '            request.deny();\n            return;\n        }';
const changes = [
    ['main/java/' + packagePath + 'RNCWebView.java', 'protected boolean messagingEnabled = false;',
      'protected boolean messagingEnabled = false;\n    public boolean remoteAiDenyMediaCapture = false;\n'
        + '    public boolean remoteAiPromptMediaCapture = false;\n'
        + '    public final RemoteAiMediaCapture remoteAiMediaCapture = new RemoteAiMediaCapture(this);'],
    ['main/java/' + packagePath + 'RNCWebChromeClient.java',
      'public void onPermissionRequest(final PermissionRequest request) {',
      oldGuard + '\n        if (mWebView.remoteAiPromptMediaCapture) {\n'
        + '            mWebView.remoteAiMediaCapture.request(request, this::remoteAiRequestMediaCapture);\n'
        + '            return;\n        }\n        remoteAiRequestMediaCapture(request);\n    }\n\n'
        + '    @Override\n    public void onPermissionRequestCanceled(PermissionRequest request) {\n'
        + '        mWebView.remoteAiMediaCapture.canceledByPage(request);\n    }\n\n'
        + '    private void remoteAiRequestMediaCapture(final PermissionRequest request) {'],
    ['newarch/' + packagePath + 'RNCWebViewManager.java',
      'public void setMediaCapturePermissionGrantType(RNCWebViewWrapper view, @Nullable String value) {}', setter],
    ['oldarch/' + packagePath + 'RNCWebViewManager.java', '@ReactProp(name = "incognito")',
      setter + '\n\n    @ReactProp(name = "incognito")'],
    ['main/java/' + packagePath + 'RNCWebViewClient.java',
      'super.onPageStarted(webView, url, favicon);',
      'super.onPageStarted(webView, url, favicon);\n      ((RNCWebView) webView).remoteAiMediaCapture.cancel();'],
    ['main/java/' + packagePath + 'RNCWebView.java', 'public void destroy() {',
      'public void destroy() {\n        remoteAiMediaCapture.cancel();'],
    ['main/java/' + packagePath + 'RNCWebView.java', 'public void onHostPause() {',
      'protected void onVisibilityChanged(View changedView, int visibility) {\n'
        + '        super.onVisibilityChanged(changedView, visibility);\n'
        + '        if (visibility != View.VISIBLE && remoteAiMediaCapture != null) remoteAiMediaCapture.cancel();\n'
        + '    }\n\n    @Override\n    public void onHostPause() {'],
  ];

// Keep the decision on the WebView, so redirects and replacement WebChromeClients cannot reset it.
function patchWebViewPermissions(directory) {
  const updates = new Map();
  for (const [name, before, after] of changes) {
    const file = path.join(directory, name);
    const original = updates.get(file) ?? fs.readFileSync(file, 'utf8');
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    let normalized = original.replace(/\r\n/g, '\n');
    // Upgrade installations carrying the previous deny-only patch as well as pristine packages.
    if (!normalized.includes(after)) {
      if (name.includes('RNCWebViewManager')) {
        normalized = normalized.replace(oldSetter, name.startsWith('oldarch/') ? '' : before);
      } else if (before === 'protected boolean messagingEnabled = false;') {
        normalized = normalized.replace(before + '\n    public boolean remoteAiDenyMediaCapture = false;', before);
      } else if (name.includes('RNCWebChromeClient')) normalized = normalized.replace(oldGuard, before);
    }
    updates.set(file, replaceOnce(normalized, before, after).replace(/\n/g, newline));
  }
  for (const [file, source] of updates) fs.writeFileSync(file, source);
  fs.copyFileSync(path.join(__dirname, 'webview-permissions/RemoteAiMediaCapture.java'),
    path.join(directory, 'main/java/' + packagePath + 'RemoteAiMediaCapture.java'));
}

function applyWebViewPermissionsPatch() {
  const manifest = require.resolve('react-native-webview/package.json', { paths: [path.resolve(__dirname, '..')] });
  if (JSON.parse(fs.readFileSync(manifest, 'utf8')).version !== '13.13.5') {
    throw new Error('Review Android media permissions before upgrading react-native-webview.');
  }
  patchWebViewPermissions(path.join(path.dirname(manifest), 'android/src'));
}

if (require.main === module) applyWebViewPermissionsPatch();
module.exports = { applyWebViewPermissionsPatch, patchWebViewPermissions };

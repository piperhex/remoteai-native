const fs = require('node:fs');
const path = require('node:path');

const packagePath = 'com/reactnativecommunity/webview/';
const manager = packagePath + 'RNCWebViewManager.java';
const setter = `public void setHasOnFileDownload(RNCWebViewWrapper view, boolean value) {
        view.getWebView().remoteAiManagedDownloads = value;
    }`;
const eventFields = ['downloadName', 'contentDisposition', 'mimeType', 'userAgent'];

function patch(root, name, original, replacement) {
  const file = path.join(root, name);
  const source = fs.readFileSync(file, 'utf8');
  const normalized = source.replace(/\r\n/g, '\n');
  if (normalized.includes(replacement)) return;
  if (normalized.split(original).length !== 2) throw new Error(`Review WebView download integration in ${name}.`);
  const result = normalized.replace(original, replacement);
  fs.writeFileSync(file, source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result);
}

function applyWebViewDownloadPatch() {
  const manifest = require.resolve('react-native-webview/package.json');
  if (JSON.parse(fs.readFileSync(manifest, 'utf8')).version !== '13.13.5') {
    throw new Error('Review the Remote AI download listener before upgrading react-native-webview.');
  }
  const root = path.dirname(manifest);
  const java = 'android/src/main/java/' + packagePath;
  const downloadListener = 'webView.setIgnoreErrFailedForThisURL(url)';
  patch(root, java + 'RNCWebViewManagerImpl.kt', downloadListener, downloadListener + `
            if (webView.remoteAiManagedDownloads) {
                webView.remoteAiDownload(url, URLUtil.guessFileName(url, contentDisposition, mimetype),
                    contentDisposition.orEmpty(), mimetype.orEmpty(), userAgent.orEmpty())
                return@DownloadListener
            }`);
  const viewSetting = 'protected boolean sendContentSizeChangeEvents = false;';
  patch(root, java + 'RNCWebView.java', viewSetting, viewSetting + `
    public boolean remoteAiManagedDownloads = false;

    public void remoteAiDownload(String url, String name, String disposition, String mimeType, String userAgent) {
        WritableMap payload = Arguments.createMap();
        payload.putString("downloadUrl", url);
        payload.putString("downloadName", name);
        payload.putString("contentDisposition", disposition);
        payload.putString("mimeType", mimeType);
        payload.putString("userAgent", userAgent);
        dispatchEvent(this, new com.reactnativecommunity.webview.events.RemoteAiFileDownloadEvent(
            UIManagerHelper.getSurfaceId(this), RNCWebViewWrapper.getReactTagFromWebView(this), payload));
    }`);
  patch(root, 'android/src/newarch/' + manager,
    'public void setHasOnFileDownload(RNCWebViewWrapper view, boolean value) {}', setter);
  const scrollProp = '@ReactProp(name = "hasOnScroll")';
  patch(root, 'android/src/oldarch/' + manager, scrollProp,
    '@ReactProp(name = "hasOnFileDownload")\n    ' + setter + '\n\n    ' + scrollProp);
  const messageEvent = 'export.put(TopMessageEvent.EVENT_NAME, MapBuilder.of("registrationName", "onMessage"));';
  for (const architecture of ['newarch', 'oldarch']) {
    patch(root, `android/src/${architecture}/` + manager, messageEvent, messageEvent
      + '\n        export.put("topFileDownload", MapBuilder.of("registrationName", "onFileDownload"));');
  }
  const event = 'type WebViewDownloadEvent = Readonly<{\n  downloadUrl: string;';
  patch(root, 'src/RNCWebViewNativeComponent.ts', event, event + eventFields.map(field => `\n  ${field}: string;`).join(''));
  const androidProp = 'hasOnScroll={!!otherProps.onScroll}';
  patch(root, 'src/WebView.android.tsx', androidProp, androidProp
    + '\n        hasOnFileDownload={!!otherProps.onFileDownload}');
  const disposition = 'BOOL isAttachment = disposition != nil && [disposition hasPrefix:@"attachment"];';
  patch(root, 'apple/RNCWebViewImpl.m', disposition,
    'BOOL isAttachment = disposition != nil && [disposition.lowercaseString hasPrefix:@"attachment"];');
  const downloadUrl = '@"downloadUrl": (response.URL).absoluteString,';
  patch(root, 'apple/RNCWebViewImpl.m', downloadUrl, downloadUrl + `
          @"downloadName": response.suggestedFilename ?: @"",
          @"contentDisposition": disposition ?: @"",
          @"mimeType": response.MIMEType ?: @"",
          @"userAgent": webView.customUserAgent ?: @"",`);
  const emitter = '.downloadUrl = std::string([[dictionary valueForKey:@"downloadUrl"] UTF8String])';
  patch(root, 'apple/RNCWebView.mm', emitter, emitter + eventFields.map(field =>
    `,\n                        .${field} = std::string([[dictionary valueForKey:@"${field}"] UTF8String])`).join(''));
  fs.copyFileSync(path.join(__dirname, 'webview-downloads/RemoteAiFileDownloadEvent.kt'),
    path.join(root, java + 'events/RemoteAiFileDownloadEvent.kt'));
}

if (require.main === module) applyWebViewDownloadPatch();
module.exports = { applyWebViewDownloadPatch };

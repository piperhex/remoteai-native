const fs = require('node:fs');
const path = require('node:path');

const manifest = require.resolve('react-native-webview/package.json');
if (require(manifest).version !== '13.13.5') throw new Error('Review mapped TLS handling for this WebView version.');
const root = path.dirname(manifest);
const java = 'com/reactnativecommunity/webview/';
function patch(file, before, after) {
  const target = path.join(root, file);
  const source = fs.readFileSync(target, 'utf8');
  const normalized = source.replace(/\r\n/g, '\n');
  if (normalized.includes(after)) return;
  if (normalized.split(before).length !== 2) throw new Error(`Review mapped TLS integration in ${file}.`);
  const result = normalized.replace(before, () => after);
  fs.writeFileSync(target, source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result);
}
function insert(file, anchor, text) { patch(file, anchor, text + '\n' + anchor); }
const component = 'src/RNCWebViewNativeComponent.ts';
patch('android/build.gradle', 'implementation "androidx.webkit:webkit:${safeExtGet(\'webkitVersion\')}"',
  'implementation "androidx.webkit:webkit:1.12.1"');
insert(component, '  applicationNameForUserAgent?: string;', '  mappingCertificatePolicy?: string;');
for (const arch of ['oldarch', 'newarch']) {
  const manager = 'android/src/' + arch + '/' + java + 'RNCWebViewManager.java';
  const override = arch === 'newarch' ? '    @Override\n' : '';
  insert(manager, override + '    @ReactProp(name = "applicationNameForUserAgent")',
    override + '    @ReactProp(name = "mappingCertificatePolicy")\n'
      + '    public void setMappingCertificatePolicy(RNCWebViewWrapper view, @Nullable String value) {\n'
      + '        view.getWebView().mappingCertificate = MappingCertificate.configure(view.getWebView(), value);\n    }\n');
}
const main = 'android/src/main/java/' + java;
fs.copyFileSync(path.join(__dirname, 'webview-certificates/MappingCertificate.java'),
  path.join(root, main, 'MappingCertificate.java'));
insert(main + 'RNCWebView.java', '    protected boolean sendContentSizeChangeEvents', '    MappingCertificate mappingCertificate;');
insert(main + 'RNCWebViewClient.java', '        String topWindowUrl = webView.getUrl();',
  '        RNCWebView mapped = (RNCWebView) webView;\n'
    + '        if (mapped.mappingCertificate != null && mapped.mappingCertificate.handle(mapped, handler, error, this)) return;');
const impl = 'apple/RNCWebViewImpl.m';
fs.copyFileSync(path.join(__dirname, 'webview-certificates/MappingCertificate.inc'),
  path.join(root, 'apple/RemoteAiMappingCertificate.inc'));
insert('apple/RNCWebViewImpl.h', '@property (nonatomic, copy) NSString * _Nullable userAgent;',
  '@property (nonatomic, copy) NSString * _Nullable mappingCertificatePolicy;');
insert('apple/RNCWebViewManager.mm', 'RCT_EXPORT_VIEW_PROPERTY(applicationNameForUserAgent, NSString)',
  'RCT_EXPORT_VIEW_PROPERTY(mappingCertificatePolicy, NSString)');
insert('apple/RNCWebView.mm', '    REMAP_WEBVIEW_STRING_PROP(applicationNameForUserAgent)',
  '    REMAP_WEBVIEW_STRING_PROP(mappingCertificatePolicy)');
insert(impl, '#import "objc/runtime.h"', '#import <CommonCrypto/CommonDigest.h>');
insert(impl, '  if(self.useSharedProcessPool) {',
  '  WKWebsiteDataStore *mappedStore = [self mappingWebsiteDataStore];\n'
  + '  if (mappedStore) wkWebViewConfig.websiteDataStore = mappedStore;');
const ivars = '@implementation RNCWebViewImpl\n{';
patch(impl, ivars, ivars + '\n  NSURL *_mappingMainURL;\n  NSString *_mappingFailedPin;');
insert(impl, '- (void)                    webView:(WKWebView *)webView\n  didReceiveAuthenticationChallenge:',
  '#include "RemoteAiMappingCertificate.inc"');
insert(impl, '  NSString* host = nil;', '  if ([self handleMappingTrust:challenge completion:completionHandler]) return;');
insert(impl, '    BOOL hasTargetFrame = navigationAction.targetFrame != nil;',
  '    if (navigationAction.targetFrame.mainFrame) { _mappingMainURL = request.URL; _mappingFailedPin = nil; }');
const errorEvent = '    _onLoadingError(event);\n  }\n}\n\n- (void)evaluateJS';
insert(impl, errorEvent, '    NSURL *failed = error.userInfo[NSURLErrorFailingURLErrorKey];\n'
  + '    if (_mappingFailedPin && [failed isEqual:_mappingMainURL] && [error.domain isEqual:NSURLErrorDomain]\n'
  + '        && error.code <= NSURLErrorServerCertificateHasBadDate && error.code >= NSURLErrorServerCertificateNotYetValid) {\n'
  + '      event[@"code"] = @(-27841); event[@"url"] = failed.absoluteString;\n'
  + '      event[@"description"] = _mappingFailedPin; _mappingFailedPin = nil;\n    }');

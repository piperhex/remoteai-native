const { withAndroidManifest, withDangerousMod, withMainActivity, withMainApplication } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const PACKAGE_LINE = 'packages.add(com.codexswitch.browser.BrowserGesturesPackage())';
const BACK_HANDLER_LINE = 'com.codexswitch.browser.ActivityBackHandler.install(this)';

module.exports = function withBrowserGestures(config) {
  config = withAndroidManifest(config, result => {
    const application = result.modResults.manifest.application?.[0];
    if (application) application.$['android:enableOnBackInvokedCallback'] = 'true';
    return result;
  });
  config = withMainApplication(config, result => {
    const source = result.modResults.contents;
    if (!source.includes(PACKAGE_LINE)) {
      if (!source.includes('return packages')) throw new Error('Cannot register browser gestures.');
      result.modResults.contents = source.replace('return packages', PACKAGE_LINE + '\n            return packages');
    }
    return result;
  });
  config = withMainActivity(config, result => {
    const source = result.modResults.contents;
    if (!source.includes(BACK_HANDLER_LINE)) {
      const created = /super\.onCreate\([^\n]*\)/;
      if (!created.test(source)) throw new Error('Cannot register activity Back handling.');
      result.modResults.contents = source.replace(created, match => `${match}\n    ${BACK_HANDLER_LINE}`);
    }
    return result;
  });
  return withDangerousMod(config, ['android', async result => {
    const target = path.join(result.modRequest.platformProjectRoot, 'app/src/main/java/com/codexswitch/browser');
    await fs.mkdir(target, { recursive: true });
    for (const name of ['BrowserGesturesModule.kt', 'BrowserGesturesPackage.kt', 'ActivityBackHandler.kt']) {
      await fs.copyFile(path.join(__dirname, 'browserGestures', name), path.join(target, name));
    }
    return result;
  }]);
};

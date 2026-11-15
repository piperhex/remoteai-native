const { withAndroidManifest, withDangerousMod, withMainApplication } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const { copyInspectorAssets } = require('../scripts/prepare-browser-inspector.cjs');
const registration = 'packages.add(com.codexswitch.inspector.BrowserInspectorPackage())';

module.exports = function withBrowserInspector(config) {
  config = withMainApplication(config, result => {
    if (!result.modResults.contents.includes(registration)) {
      if (!result.modResults.contents.includes('return packages')) throw new Error('Cannot register browser inspector');
      result.modResults.contents = result.modResults.contents.replace('return packages', registration + '\nreturn packages');
    }
    const processSetup = 'if (com.codexswitch.inspector.InspectorProcess.prepareProcess()) return';
    if (!result.modResults.contents.includes(processSetup)) {
      if (!result.modResults.contents.includes('super.onCreate()')) throw new Error('Cannot initialize inspector process');
      result.modResults.contents = result.modResults.contents.replace('super.onCreate()', `super.onCreate()\n    ${processSetup}`);
    }
    const configGuard = 'if (com.codexswitch.inspector.InspectorProcess.isInspectorProcess()) return';
    if (!result.modResults.contents.includes(configGuard)) {
      result.modResults.contents = result.modResults.contents.replace('super.onConfigurationChanged(newConfig)',
        `super.onConfigurationChanged(newConfig)\n    ${configGuard}`);
    }
    return result;
  });
  config = withAndroidManifest(config, result => {
    const application = result.modResults.manifest.application[0];
    application.service ??= [];
    const name = 'com.codexswitch.inspector.BrowserInspectorService';
    if (!application.service.some(item => item.$['android:name'] === name)) {
      application.service.push({ $: { 'android:name': name, 'android:exported': 'false',
        'android:process': ':browser_inspector' } });
    }
    return result;
  });
  return withDangerousMod(config, ['android', async result => {
    const root = result.modRequest.platformProjectRoot;
    const target = path.join(root, 'app/src/main/java/com/codexswitch/inspector');
    await fs.mkdir(target, { recursive: true });
    for (const file of await fs.readdir(path.join(__dirname, 'browserInspector'))) {
      if (file.endsWith('.kt')) await fs.copyFile(path.join(__dirname, 'browserInspector', file), path.join(target, file));
    }
    await copyInspectorAssets(path.join(root, 'app/src/main/assets/browser-inspector'));
    return result;
  }]);
};

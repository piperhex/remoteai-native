const { withAndroidManifest, withDangerousMod, withMainApplication } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const PACKAGE_LINE = 'packages.add(com.codexswitch.downloads.DownloadPackage())';
const CONFIGURE_WEBRTC = 'com.codexswitch.downloads.DownloadWebRtc.configure()';

function configureApplication(source) {
  const anchor = 'val packages = PackageList(this).packages';
  if (source.split(anchor).length !== 2) throw new Error('Cannot configure download WebRTC transport.');
  if (source.includes(CONFIGURE_WEBRTC)) return source;
  return source.replace(anchor, `${CONFIGURE_WEBRTC}\n            ${anchor}`);
}

module.exports = function withDownloads(config) {
  require('../scripts/patch-webrtc-bulk.cjs').applyBulkPatch();
  config = withAndroidManifest(config, result => {
    const application = result.modResults.manifest.application[0];
    const name = 'com.codexswitch.downloads.DownloadShareProvider';
    application.provider ??= [];
    if (!application.provider.some(provider => provider.$['android:name'] === name)) {
      application.provider.push({ $: { 'android:name': name,
        'android:authorities': '${applicationId}.download-share',
        'android:exported': 'false', 'android:grantUriPermissions': 'true' } });
    }
    return result;
  });
  config = withMainApplication(config, (result) => {
    const source = configureApplication(result.modResults.contents);
    result.modResults.contents = source;
    if (!source.includes(PACKAGE_LINE)) {
      if (!source.includes('return packages')) throw new Error('Cannot register download manager.');
      result.modResults.contents = source.replace('return packages', PACKAGE_LINE + '\n            return packages');
    }
    return result;
  });
  return withDangerousMod(config, ['android', async (result) => {
    const target = path.join(result.modRequest.platformProjectRoot, 'app/src/main/java/com/codexswitch/downloads');
    await fs.mkdir(target, { recursive: true });
    for (const name of await fs.readdir(path.join(__dirname, 'downloads'))) {
      if (name.endsWith('.kt')) await fs.copyFile(path.join(__dirname, 'downloads', name), path.join(target, name));
    }
    return result;
  }]);
};
module.exports.configureApplication = configureApplication;

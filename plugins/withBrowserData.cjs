const { withAppBuildGradle, withDangerousMod, withMainApplication, withXcodeProject, IOSConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const registration = 'packages.add(com.codexswitch.browserdata.BrowserDataPackage())';

module.exports = function withBrowserData(config) {
  config = withAppBuildGradle(config, result => {
    const dependency = 'implementation "androidx.webkit:webkit:1.12.1"';
    if (!result.modResults.contents.includes(dependency)) result.modResults.contents +=
      '\ndependencies { ' + dependency + ' }\n';
    return result;
  });
  config = withMainApplication(config, result => {
    const source = result.modResults.contents;
    if (!source.includes(registration)) {
      if (!source.includes('return packages')) throw new Error('Cannot register browser data');
      result.modResults.contents = source.replace('return packages', registration + '\n            return packages');
    }
    return result;
  });
  config = withDangerousMod(config, ['android', async result => {
    const target = path.join(result.modRequest.platformProjectRoot, 'app/src/main/java/com/codexswitch/browserdata');
    await fs.mkdir(target, { recursive: true });
    for (const file of ['BrowserDataModule.kt', 'BrowserDataPackage.kt', 'BrowserMappingRoutes.kt']) {
      await fs.copyFile(path.join(__dirname, 'browserData', file), path.join(target, file));
    }
    return result;
  }]);
  return withXcodeProject(config, async result => {
    const name = result.modRequest.projectName;
    for (const file of ['BrowserData.m', 'BrowserMappingRoutes.m']) {
      const target = path.join(result.modRequest.platformProjectRoot, name, file);
      await fs.copyFile(path.join(__dirname, 'browserData', file), target);
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: `${name}/${file}`,
        groupName: name, project: result.modResults });
    }
    return result;
  });
};

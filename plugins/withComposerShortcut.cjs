const { withDangerousMod, withMainApplication, withXcodeProject, IOSConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const registration = 'packages.add(com.codexswitch.composer.ComposerShortcutPackage())';
const sources = path.join(__dirname, 'composerShortcut');

module.exports = function withComposerShortcut(config) {
  config = withMainApplication(config, result => {
    const source = result.modResults.contents;
    if (!source.includes(registration)) {
      if (!source.includes('return packages')) throw new Error('Cannot register composer shortcuts.');
      result.modResults.contents = source.replace('return packages', `${registration}\n            return packages`);
    }
    return result;
  });
  config = withDangerousMod(config, ['android', async result => {
    const target = path.join(result.modRequest.platformProjectRoot, 'app/src/main/java/com/codexswitch/composer');
    const file = 'ComposerShortcutPackage.kt';
    await fs.mkdir(target, { recursive: true });
    await fs.copyFile(path.join(sources, file), path.join(target, file));
    return result;
  }]);
  return withXcodeProject(config, async result => {
    const name = result.modRequest.projectName;
    const file = 'ComposerShortcut.m';
    await fs.copyFile(path.join(sources, file), path.join(result.modRequest.platformProjectRoot, name, file));
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: `${name}/${file}`,
      groupName: name, project: result.modResults });
    return result;
  });
};

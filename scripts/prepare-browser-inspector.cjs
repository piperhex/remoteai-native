const fs = require('node:fs/promises');
const path = require('node:path');

/** Use the complete Chromium inspector shipped by React Native, not the RN-specific rn_fusebox entry point. */
async function copyInspectorAssets(target) {
  const root = path.dirname(require.resolve('@react-native/debugger-frontend/package.json'));
  const source = path.join(root, 'dist/third-party/front_end');
  await fs.access(path.join(source, 'devtools_app.html'));
  await fs.mkdir(target, { recursive: true });
  await fs.cp(source, target, { recursive: true });
  await fs.copyFile(path.join(root, 'dist/third-party/LICENSE'), path.join(target, 'LICENSE'));
  await fs.copyFile(path.join(root, 'BUILD_INFO'), path.join(target, 'BUILD_INFO'));
  const entry = path.join(target, 'devtools_app.html');
  const html = await fs.readFile(entry, 'utf8');
  await fs.writeFile(entry, html.replace('<meta charset="utf-8">',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'));
  // The upstream shell reserves this script for its embedder. Keep preferences local to this session's origin.
  await fs.mkdir(path.join(target, 'embedder-static'), { recursive: true });
  await fs.writeFile(path.join(target, 'embedder-static/embedderScript.js'), `
    const preferences = new URLSearchParams(location.search);
    for (const name of ['language', 'uiTheme']) {
      const value = preferences.get(name);
      if (!value) continue;
      const setting = name === 'uiTheme' ? 'ui-theme' : name;
      localStorage.setItem(setting, JSON.stringify(name === 'uiTheme' && value !== 'dark' ? 'default' : value));
    }
    // The RN distribution gates Chromium's unchanged Network panel behind this embedder preference.
    const experiments = JSON.parse(localStorage.getItem('experiments') || '{}');
    experiments['enable-network-panel'] = true;
    localStorage.setItem('experiments', JSON.stringify(experiments));
    // Desktop sidebar defaults can consume the entire height of a phone's docked panel.
    // Seed upstream layout preferences; every pane remains available and resizable in DevTools.
    const sidebarHeight = Math.max(100, Math.min(180, innerHeight * 0.45));
    const layouts = {
      'elements-panel-split-view-state': { horizontal: { size: sidebarHeight } },
      'sources-panel-split-view-state': { horizontal: { size: sidebarHeight } },
      'sources-panel-navigator-split-view-state': {
        vertical: { size: 180, showMode: innerWidth < 600 ? 'OnlyMain' : 'Both' },
      },
    };
    for (const [name, value] of Object.entries(layouts)) {
      if (!localStorage.getItem(name)) localStorage.setItem(name, JSON.stringify(value));
    }
  `);
}

module.exports = { copyInspectorAssets };

const path = require('node:path');

// WebView documents use the browser snapshot's React, including dependencies hoisted
// beside React Native. Mixing its React 19 elements with React DOM 18 blanks the page.
const browserRoot = path.resolve(__dirname, '../vendor');
const webviewReactAliases = Object.fromEntries(['react', 'react-dom'].map(name => [
  name, path.dirname(require.resolve(`${name}/package.json`, { paths: [browserRoot] })),
]));

module.exports = { webviewReactAliases };

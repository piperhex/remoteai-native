# Built-in browser DevTools on Android

On Android 11 and later, open a website in the built-in browser and choose **Developer tools**
from its settings. The complete Chromium DevTools frontend appears beside the website in the
same browser screen. Its toolbar switches between right and bottom docking, closes the panel,
and exposes an adjustable divider for touch and accessibility controls. Portrait screens start
with bottom docking; landscape screens start with right docking.

Elements, Console, Network and Sources connect to the actual live WebView. Source breakpoints,
paused variables, stepping and resume use Chrome DevTools Protocol. The original page, inputs
and browser history remain mounted when the tools open, move, resize or close. Switching to another
app tab hides DevTools and preserves the session for your return. Back in the browser closes DevTools
first. Switching browser tabs or backgrounding the app ends the debugging session.

## Platform integration

Android WebViews in one app process share a renderer. Embedding a second ordinary WebView would
freeze DevTools whenever the inspected page hits a JavaScript breakpoint. A non-exported bound
service renders the frontend in a separate process and WebView data directory. Android's
`SurfaceControlViewHost` embeds that interactive surface directly in the current browser activity.
There is no separate DevTools activity or window. This public embedding API requires Android 11.

The frontend is pinned to `@react-native/debugger-frontend` and bundled at Expo prebuild time,
including its upstream license and build information. It uses the full `devtools_app.html` entry
point, not the React Native debugger. Upstream layout preferences are seeded for short mobile
panels; every pane remains available. Chinese and English are included upstream; other app
languages use English inside DevTools while the surrounding app controls retain their language.

A short-lived server binds only to `127.0.0.1`, requires a random session capability, validates
Host and Origin, and bridges only the selected target in this application's authenticated Unix
debug socket. A random page marker distinguishes retained tabs with identical URLs. Debugging
is enabled for the session and disabled on cleanup in production builds. No remote PC, public
debug port or downloaded frontend is needed.

Android 10 and earlier and iOS do not expose this entry. iOS's WebKit inspection transport is not
implemented by this Android integration. Mobile Web keeps the host browser's inspection model;
a webpage cannot obtain its host browser's CDP connection and embed these native surfaces.

## Verification

Run `npm run check`, `npm test`, `npm run check:i18n`, `npm run export:android` and
`npm run export:ios` from this repository. The device test uses a dedicated, non-debuggable
fixture package and clears only that package's data:

```powershell
node scripts/expo.cjs prebuild --platform android --no-install
Push-Location android
.\gradlew.bat :app:assembleDebug -I ../scripts/chat-browser-fixture.init.gradle -PreactNativeArchitectures=x86_64
Pop-Location
adb -s $env:ANDROID_SERIAL install -r android/app/build-chat-browser/outputs/apk/debug/app-debug.apk
$env:INSPECTOR_LANDSCAPE = '1'
node scripts/test-browser-inspector-android.mjs
$env:INSPECTOR_THEME = 'dark'
$env:INSPECTOR_FONT_SCALE = '1.3'
node scripts/test-browser-inspector-android.mjs
```

Use the physical device's ABI instead of `x86_64` when building for a phone. The test checks the
real DOM, evaluation, network requests, source breakpoint binding, paused scope, stepping,
resume, docking, touch resizing, native touch and keyboard input, keyboard dismissal, overlapping
menus, retained inputs, reopening, background cleanup and loopback access restrictions. With
`INSPECTOR_LANDSCAPE=1`, it also rotates while paused and checks right docking. Screenshots are
written to `.codex-tmp/browser-inspector/`.
Inspect physical Android screenshots at system font scales 1.0 and 1.3 before release; emulator
results do not replace that verification.

Verified on 2026-11-16 with an Android API 35 x86_64 emulator and WebView 124.0.6367.219:
the complete interaction test passed in light mode at font scale 1.0 and dark mode at 1.3,
including portrait and landscape screenshots. Type checking, all 1510 tests, i18n checks,
the fixture APK build, and both platform exports passed. The parent mobile Web regression
suite also passed in light/default and dark/enlarged configurations. No physical Android
device was attached; physical font, touch and navigation verification remains outstanding.

The full application Release APK also passed `npm run build:apk`: all four Android ABIs
contain the required native libraries. APK signature verification and checks for the bundled
application, DevTools entry point, Sources, Network and upstream license passed.

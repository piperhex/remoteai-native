const assert = require('node:assert/strict');

async function exerciseLocation(checks) {
  const { request, tap, result, captureRetained, screenshot, button } = checks;
  let id = await request('location', 'location-site-prompt');
  await tap('android:id/button2');
  await result(id, 'LocationError1');
  id = await request('location', 'location-before-system-prompt');
  await tap('android:id/button1');
  await button(':id/permission_allow_foreground_only_button');
  screenshot('location-system-prompt');
  await tap(':id/permission_deny_button');
  await result(id, 'LocationError1');
  id = await request('location', 'location-retry-system-denial');
  await tap('android:id/button1');
  await tap(':id/permission_allow_foreground_only_button');
  await result(id, 'granted');
  await captureRetained('location', 'location-repeat-no-prompt');
  // Location consent must not authorize a different capability.
  id = await request('audio', 'audio-after-location-prompt');
  await tap('android:id/button2');
  await result(id, 'NotAllowedError');
  await captureRetained('location');
}

async function exerciseLocationNavigation(checks) {
  const { navigate, captureRetained, device, activity, pause, request, tap, result,
    waitFor, getReady, results } = checks;
  await navigate('http://127.0.0.1:1497/reloaded');
  await captureRetained('location', 'location-same-origin-no-prompt');
  await navigate('http://127.0.0.1:1497/reloaded');
  await captureRetained('location');
  device('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  device('shell', 'am', 'start', '-W', '-n', activity);
  await pause(500);
  await captureRetained('location', 'location-foreground-no-prompt');
  await navigate('http://localhost:1497/new-origin');
  const canceled = await request('location', 'location-navigation-pending');
  await navigate('http://127.0.0.1:1497/returned');
  let id = await request('location', 'location-returned-site-prompt');
  await tap('android:id/button1');
  await result(id, 'granted');
  assert.notEqual(results.find(item => item.id === canceled)?.result, 'granted');
  const ready = getReady();
  await tap('新标签页');
  await waitFor(() => getReady() > ready, 'replacement location tab');
  id = await request('location', 'location-reopened-tab-prompt');
  await tap('android:id/button1');
  await result(id, 'granted');
  await captureRetained('location', 'location-reopened-repeat-no-prompt');
}

async function exerciseDarkLocation({ request, tap, result, captureRetained }) {
  const id = await request('location', 'location-dark-enlarged-prompt');
  await tap('android:id/button1');
  await result(id, 'granted');
  await captureRetained('location', 'location-dark-approximate-no-prompt');
}

module.exports = { exerciseLocation, exerciseLocationNavigation, exerciseDarkLocation };

// Test-only page: inspect track metadata and stop immediately; never save or transmit media.
const permissionTestPage = `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:16px system-ui;padding:16px;background:#f7faf7;color:#183e2b}pre{white-space:pre-wrap}</style>
<h2>Audio/video permission test</h2><pre id="status">Waiting for a capture request</pre><script>
async function capture(command) {
  let result;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: command.kind !== 'video', video: command.kind !== 'audio' });
    const tracks = stream.getTracks();
    result = { result: 'granted', tracks: tracks.map(track => track.kind),
      live: tracks.every(track => track.readyState === 'live') };
    tracks.forEach(track => track.stop());
  } catch (error) { result = { result: error.name }; }
  Object.assign(result, { id: command.id, origin: location.origin });
  document.getElementById('status').textContent = JSON.stringify(result, null, 2);
  await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
}
let polling = false;
fetch('/ready', { method: 'POST' });
setInterval(async () => {
  if (polling) return;
  polling = true;
  try {
    const command = await (await fetch('/command')).json();
    if (command?.kind === 'navigate') location.href = 'http://localhost:1497/redirected';
    else if (command) void capture(command);
  } finally { polling = false; }
}, 200);
</script></html>`;
module.exports = { permissionTestPage };

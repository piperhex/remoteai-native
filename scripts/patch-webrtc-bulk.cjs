const fs = require('node:fs');
const path = require('node:path');
const anchor = '    public void onMessage(DataChannel.Buffer buffer) {';
const previous = `${anchor}
        if (buffer.binary && "remote-ai-file-v1".equals(mDataChannel.label())) {
            try {
                Class<?> router = Class.forName("com.codexswitch.downloads.DownloadBulkRouter");
                router.getMethod("receive", java.nio.ByteBuffer.class).invoke(null, buffer.data);
            } catch (ReflectiveOperationException error) {
                mDataChannel.close();
            }
            return;
        }`;
const replacement = `${anchor}
        if (buffer.binary && nativeBulkChannel) {
            try {
                if (nativeBulkReceiver == null) {
                    mDataChannel.close();
                    return;
                }
                nativeBulkReceiver.invoke(null, buffer.data);
            } catch (ReflectiveOperationException error) {
                mDataChannel.close();
            }
            return;
        }`;
const fieldsAnchor = '    private final WebRTCModule webRTCModule;';
const fields = `${fieldsAnchor}
    private final boolean nativeBulkChannel;
    @Nullable private final java.lang.reflect.Method nativeBulkReceiver;

    @Nullable
    private static java.lang.reflect.Method resolveNativeBulkReceiver() {
        try {
            return Class.forName("com.codexswitch.downloads.DownloadBulkRouter")
                    .getMethod("receive", java.nio.ByteBuffer.class);
        } catch (ReflectiveOperationException error) {
            return null;
        }
    }`;
const constructorAnchor = '        mDataChannel = dataChannel;';
const constructor = `${constructorAnchor}
        // Cache the immutable label to avoid a JNI call and reflection lookup per binary record.
        nativeBulkChannel = "remote-ai-file-v1".equals(dataChannel.label());
        nativeBulkReceiver = nativeBulkChannel ? resolveNativeBulkReceiver() : null;`;

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Review WebRTC binary downloads before upgrading.');
  if (source.includes(after)) return source;
  return source.replace(before, after);
}

function patch(source) {
  let normalized = source.replace(/\r\n/g, '\n');
  normalized = replaceOnce(normalized, fieldsAnchor, fields);
  normalized = replaceOnce(normalized, constructorAnchor, constructor);
  normalized = replaceOnce(normalized, normalized.includes(previous) ? previous : anchor, replacement);
  return source.includes('\r\n') ? normalized.replace(/\n/g, '\r\n') : normalized;
}
function applyBulkPatch() {
  const manifest = require.resolve('react-native-webrtc/package.json', { paths: [path.resolve(__dirname, '..')] });
  if (JSON.parse(fs.readFileSync(manifest, 'utf8')).version !== '124.0.8') {
    throw new Error('Review WebRTC binary downloads before upgrading.');
  }
  const file = path.join(path.dirname(manifest), 'android/src/main/java/com/oney/WebRTCModule/DataChannelWrapper.java');
  const source = fs.readFileSync(file, 'utf8'); const result = patch(source);
  if (source !== result) fs.writeFileSync(file, result);
}
if (require.main === module) applyBulkPatch();
module.exports = { patch, applyBulkPatch };

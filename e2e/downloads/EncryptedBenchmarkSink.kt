package com.codexswitch.downloads

import android.os.Process
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.TimeUnit

/** Network diagnostic using the production cipher, block verification and durable storage. */
internal class EncryptedBenchmarkSink(
  private val storage: DownloadStorage,
  private val reply: (JSONObject) -> Unit,
  private val failed: (Throwable) -> Unit,
) : AutoCloseable {
  private val queue = ArrayBlockingQueue<ByteArray>(256)
  private val blocks = BulkDownloadStorage(storage)
  private var task: DownloadTask? = null
  private var manifest: BulkManifest? = null
  private var cipher: BulkRecordCipher? = null
  private val committed = mutableSetOf<Int>()
  private val plain = ByteArray(BULK_BLOCK_BYTES)
  private var block = 0
  private var offset = 0
  private var started = 0L
  private var run = 0
  @Volatile private var running = true
  private val worker = Thread({
    Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
    try { while (running) consume(queue.take()) }
    catch (error: InterruptedException) { if (running) failed(error) }
    catch (error: Throwable) { failed(error) }
  }, "encrypted-channel-benchmark").apply { start() }

  fun begin(value: JSONObject) {
    check(task == null && queue.isEmpty())
    val info = BulkManifest(value.getJSONObject("manifest"))
    manifest = info
    val transfer = UUID.fromString(value.getString("transfer"))
    val next = DownloadTask.create(JSONObject().put("owner", "local-benchmark").put("deviceId", "local")
      .put("scope", "computer").put("path", "encrypted-channel.bin"))
    next.data.put("id", transfer.toString()).put("size", value.getJSONObject("manifest").getLong("size"))
    next.data.put("mimeType", "application/octet-stream"); next.status = "downloading"
    blocks.storePage(next, value.getJSONObject("page").toString()); blocks.restore(next, info)
    task = next
    cipher = BulkRecordCipher(value.getString("key"), transfer, UUID.fromString(value.getString("epoch")))
    committed.clear(); block = 0; offset = 0; started = 0; run = value.getInt("run")
    reply(JSONObject().put("ready", run))
  }

  fun receive(bytes: ByteArray) {
    check(queue.offer(bytes, 5, TimeUnit.SECONDS)) { "Bounded receiver queue stalled" }
  }

  private fun consume(bytes: ByteArray) {
    if (started == 0L) started = System.nanoTime()
    val current = requireNotNull(task)
    val info = requireNotNull(manifest)
    val fragment = requireNotNull(cipher).decrypt(bytes)
    check(fragment.block == block && fragment.offset == offset)
    fragment.bytes.copyInto(plain, offset); offset += fragment.bytes.size
    if (offset != plain.size) return
    check(hex(sha256(plain)) == blocks.hash(current, info, block))
    blocks.write(current, block, plain, committed)
    if (current.received % CHECKPOINT_BYTES == 0L) storage.save(listOf(current))
    block += 1; offset = 0
    if (current.received != current.data.getLong("size")) return
    val ms = (System.nanoTime() - started) / 1_000_000.0
    blocks.verifyComplete(current) {}
    val result = JSONObject().put("run", run).put("bytes", current.received).put("ms", ms)
      .put("MiBps", current.received / 1048576.0 / (ms / 1000)).put("verified", true)
    cipher?.close(); cipher = null; blocks.delete(current); storage.delete(current); task = null
    reply(result)
  }

  override fun close() {
    running = false; worker.interrupt(); worker.join()
    cipher?.close(); task?.let { blocks.delete(it); storage.delete(it) }; task = null
  }
}

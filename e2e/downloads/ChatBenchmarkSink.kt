package com.codexswitch.downloads

import com.codexswitch.crypto.PacketCipher
import org.json.JSONObject
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors

/** Actual Android packet crypto/UTF-8, with bounded ordered receive work and exact plaintext checks. */
internal class ChatBenchmarkSink(
  private val result: (JSONObject) -> Unit,
  private val failed: (Throwable) -> Unit,
) {
  private val worker = Executors.newSingleThreadExecutor()
  private val queue = ArrayBlockingQueue<String>(64)
  @Volatile private var closed = false
  private var cipher: PacketCipher? = null
  private var template = ""
  private var run = 0
  private var records = 0
  @Volatile private var received = 0
  private var started = 0L
  private var plainBytes = 0L
  private var cryptoNs = 0L

  fun begin(config: JSONObject) {
    check(received == 0 && queue.isEmpty())
    cipher?.destroy()
    cipher = PacketCipher(PacketCipher.fromHex(config.getString("key")), config.getString("context").toByteArray())
    template = config.getString("template"); run = config.getInt("run"); records = config.getInt("records")
    check(template.length <= 19000 && records in 1..20000)
    started = 0; plainBytes = 0; cryptoNs = 0
    result(JSONObject().put("ready", run))
  }

  init {
    worker.execute {
      try {
        while (!closed) {
          val payload = queue.take()
          val start = System.nanoTime()
          if (received == 0) started = start
          val current = requireNotNull(cipher)
          val plain = if (payload.substring(8, 16) == "00000001") current.decryptWithDecompression(payload)
            else current.decrypt(payload)
          cryptoNs += System.nanoTime() - start
          check(plain == "$run:$received:$template") { "Chat plaintext mismatch" }
          plainBytes += plain.toByteArray().size
          received++
          if (received == records) {
            val ms = (System.nanoTime() - started) / 1_000_000.0
            val sample = JSONObject().put("run", run).put("bytes", plainBytes).put("ms", ms)
              .put("MiBps", plainBytes / 1048576.0 / (ms / 1000)).put("decryptMs", cryptoNs / 1_000_000.0)
              .put("verified", true)
            received = 0
            result(sample)
          }
        }
      } catch (error: Throwable) { if (!closed) failed(error) }
    }
  }
  fun receive(payload: String) { check(!closed); queue.put(payload) }
  fun close() { closed = true; worker.shutdownNow(); cipher?.destroy(); queue.clear() }
}

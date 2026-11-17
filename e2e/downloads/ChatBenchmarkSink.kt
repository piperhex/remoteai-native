package com.codexswitch.downloads

import com.codexswitch.crypto.PacketCipher
import android.os.Debug
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors

/** Actual Android packet crypto/UTF-8, with bounded ordered receive work and exact plaintext checks. */
internal class ChatBenchmarkSink(
  private val result: (JSONObject) -> Unit,
  private val failed: (Throwable) -> Unit,
  private var legacy: Boolean = false,
  private val options: ChatBenchmarkOptions = ChatBenchmarkOptions(),
) {
  private val worker = Executors.newSingleThreadExecutor()
  private data class QueuedPacket(val text: String, val wireDecodeNs: Long)
  private val queue = ArrayBlockingQueue<QueuedPacket>(64)
  @Volatile private var closed = false
  private var cipher: PacketCipher? = null
  private var legacyCipher: LegacyPacketCipher? = null
  private var template = ""
  private var run = 0
  private var records = 0
  private var expectedProbes = 0
  private var probes = 0
  @Volatile private var received = 0
  private var started = 0L
  private var plainBytes = 0L
  private var cryptoNs = 0L
  private var cryptoCpuNs = 0L
  private var validationNs = 0L
  private var queueIdleNs = 0L
  private var wireDecodeNs = 0L
  private var maxQueued = 0
  private var cpuSamples = JSONArray()
  private var hint: PacketBenchmarkHint? = null

  fun begin(config: JSONObject) {
    check(received == 0 && queue.isEmpty())
    if (options.compare) legacy = config.getInt("run") % 2 == 0
    hint?.close()
    hint = if (legacy) null else options.hintContext?.let { PacketBenchmarkHint(it) }
    cipher?.destroy(); legacyCipher?.destroy()
    cipher = null; legacyCipher = null
    val key = PacketCipher.fromHex(config.getString("key"))
    val context = config.getString("context").toByteArray()
    if (legacy) legacyCipher = LegacyPacketCipher(key, context) else cipher = PacketCipher(key, context)
    template = config.getString("template"); run = config.getInt("run"); records = config.getInt("records")
    check(template.length <= 19000 && records in 1..20000)
    expectedProbes = config.optInt("probes"); probes = 0
    check(expectedProbes in 0..records)
    started = 0; plainBytes = 0; cryptoNs = 0; cryptoCpuNs = 0; validationNs = 0; cpuSamples = JSONArray()
    queueIdleNs = 0; wireDecodeNs = 0; maxQueued = 0
    result(JSONObject().put("ready", run))
  }

  init {
    worker.execute {
      try {
        while (!closed) {
          val waiting = System.nanoTime()
          val packet = queue.take()
          val start = System.nanoTime()
          if (received > 0) queueIdleNs += start - waiting
          wireDecodeNs += packet.wireDecodeNs
          maxQueued = maxOf(maxQueued, queue.size)
          if (received == 0) started = start
          val cpuStart = Debug.threadCpuTimeNanos()
          val plain = decrypt(packet.text)
          cryptoCpuNs += Debug.threadCpuTimeNanos() - cpuStart
          cryptoNs += System.nanoTime() - start
          if (receiveProbe(plain)) continue
          val validationStart = System.nanoTime()
          check(plain == "$run:$received:$template") { "Chat plaintext mismatch" }
          plainBytes += plain.toByteArray().size
          validationNs += System.nanoTime() - validationStart
          hint?.report(System.nanoTime() - start)
          received++
          if (received == 1 || received == records / 2 || received == records) cpuSamples.put(cpuSample())
          if (received == records) {
            check(probes == expectedProbes)
            val ms = (System.nanoTime() - started) / 1_000_000.0
            val sample = JSONObject().put("run", run).put("bytes", plainBytes).put("ms", ms)
              .put("legacy", legacy)
              .put("performanceHint", hint?.active == true)
              .put("MiBps", plainBytes / 1048576.0 / (ms / 1000)).put("decryptMs", cryptoNs / 1_000_000.0)
              .put("decryptCpuMs", cryptoCpuNs / 1_000_000.0).put("validationMs", validationNs / 1_000_000.0)
              .put("queueIdleMs", queueIdleNs / 1_000_000.0).put("wireDecodeMs", wireDecodeNs / 1_000_000.0)
              .put("maxQueued", maxQueued)
              .put("probesVerified", probes)
              .put("cpuSamples", cpuSamples)
              .put("verified", true)
            received = 0
            result(sample)
          }
        }
      } catch (error: Throwable) { if (!closed) failed(error) }
    }
  }
  private fun receiveProbe(plain: String): Boolean {
    if (!plain.startsWith("$run:probe:")) return false
    check(probes < expectedProbes && plain == "$run:probe:$probes")
    result(JSONObject().put("run", run).put("probe", probes))
    probes++
    return true
  }
  private fun cpuSample(): JSONObject {
    val result = JSONObject().put("record", received)
      .put("nice", android.os.Process.getThreadPriority(android.os.Process.myTid()))
    // This is diagnostic-only sampling. Some Android builds restrict CPU frequency files.
    runCatching {
      val fields = File("/proc/thread-self/stat").readText().substringAfterLast(')').trim().split(' ')
      val core = fields[36].toInt()
      result.put("core", core)
      result.put("kHz", File("/sys/devices/system/cpu/cpu$core/cpufreq/scaling_cur_freq").readText().trim().toLong())
    }
    return result
  }
  private fun decrypt(payload: String): String {
    val compressed = payload.substring(8, 16) == "00000001"
    if (legacy) {
      val current = requireNotNull(legacyCipher)
      return if (compressed) current.decryptWithDecompression(payload) else current.decrypt(payload)
    }
    val current = requireNotNull(cipher)
    return if (compressed) current.decryptWithDecompression(payload) else current.decrypt(payload)
  }
  fun receive(payload: String, decodeNs: Long) { check(!closed); queue.put(QueuedPacket(payload, decodeNs)) }
  fun close() {
    closed = true; worker.shutdownNow(); cipher?.destroy(); legacyCipher?.destroy(); hint?.close(); queue.clear()
  }
}

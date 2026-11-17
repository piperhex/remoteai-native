@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package com.codexswitch.downloads

import android.test.InstrumentationTestCase
import android.test.InstrumentationTestRunner
import android.content.Intent
import android.app.Activity
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.*
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Raw-channel or production file-pipeline diagnostic, without the account/authentication handshake. */
class DataChannelThroughputBenchmark : InstrumentationTestCase(), DataChannel.Observer {
  private val finished = CountDownLatch(1)
  private val samples = JSONArray()
  private var channel: DataChannel? = null
  @Volatile private var failure: Throwable? = null
  private var run = 0
  private var sequence = 0
  private var started = 0L
  private var records = 0
  private var recordBytes = 0
  private var runs = 0
  private var encrypted: EncryptedBenchmarkSink? = null
  private var chat: ChatBenchmarkSink? = null

  fun testTransportWithoutApplicationCryptoOrStorage() {
    if (!(instrumentation as InstrumentationTestRunner).arguments
        .getString("class").orEmpty().contains(javaClass.name)) return
    val config = JSONObject(control("config"))
    records = config.getInt("records"); recordBytes = config.getInt("recordBytes"); runs = config.getInt("runs")
    if (config.optBoolean("chat")) chat = ChatBenchmarkSink({ result ->
      if (result.has("MiBps")) samples.put(result)
      check(requireNotNull(channel).send(DataChannel.Buffer(ByteBuffer.wrap(result.toString().toByteArray()), false)))
    }, { error -> if (failure == null) failure = error; finished.countDown() },
      config.optBoolean("chatLegacy"), ChatBenchmarkOptions(config.optBoolean("chatCompare"),
        if (config.optBoolean("chatHint")) instrumentation.targetContext else null))
    if (config.optBoolean("encrypted")) encrypted = EncryptedBenchmarkSink(
      DownloadStorage(instrumentation.targetContext), { result ->
        if (result.has("MiBps")) samples.put(result)
        check(requireNotNull(channel).send(DataChannel.Buffer(ByteBuffer.wrap(result.toString().toByteArray()), false)))
      }, { error -> if (failure == null) failure = error; finished.countDown() })
    PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions
      .builder(instrumentation.targetContext).setFieldTrials(DownloadWebRtc.fieldTrials(null))
      .createInitializationOptions())
    val factory = PeerConnectionFactory.builder().createPeerConnectionFactory()
    val observer = ChannelBenchmarkPeer { value -> channel = value; value.registerObserver(this) }
    val configuration = PeerConnection.RTCConfiguration(emptyList())
    val peer = requireNotNull(factory.createPeerConnection(configuration, observer))
    var foreground: Activity? = null
    if (encrypted != null) {
      channel = peer.createDataChannel("remote-ai-file-v1", DataChannel.Init().apply { negotiated = true; id = 42 })
      channel!!.registerObserver(this)
    }
    try {
      if (config.optBoolean("chatForeground")) {
        foreground = openForeground()
      }
      negotiate(peer, observer)
      check(finished.await(180, TimeUnit.SECONDS)) { "Data channel benchmark timed out" }
      failure?.let { throw it }
      check(samples.length() == runs && sequence == 0)
      control("report", JSONObject().put("samples", samples).put("verified", true).toString())
    } finally {
      encrypted?.close()
      chat?.close()
      channel?.unregisterObserver(); channel?.dispose(); peer.dispose(); factory.dispose()
      foreground?.let { activity -> instrumentation.runOnMainSync { activity.finish() } }
    }
  }

  private fun openForeground(): Activity {
    val intent = Intent().setClassName(instrumentation.targetContext,
      "com.codexswitch.downloads.PacketBenchmarkActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val activity = instrumentation.startActivitySync(intent)
    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
    var focused = false
    while (!focused && System.nanoTime() < deadline) {
      instrumentation.runOnMainSync { focused = activity.hasWindowFocus() }
      if (!focused) Thread.sleep(10)
    }
    if (!focused) {
      instrumentation.runOnMainSync { activity.finish() }
      error("Benchmark window did not gain focus")
    }
    return activity
  }

  private fun negotiate(peer: PeerConnection, observer: ChannelBenchmarkPeer) {
    val offer = JSONObject(control("offer"))
    val remote = ChannelBenchmarkSdp()
    peer.setRemoteDescription(remote, SessionDescription(SessionDescription.Type.OFFER, offer.getString("sdp")))
    remote.await()
    val answer = ChannelBenchmarkSdp()
    peer.createAnswer(answer, MediaConstraints())
    val local = ChannelBenchmarkSdp()
    peer.setLocalDescription(local, requireNotNull(answer.await()))
    local.await()
    check(observer.gathered.await(30, TimeUnit.SECONDS)) { "ICE gathering timed out" }
    control("answer", JSONObject().put("type", "answer").put("sdp", peer.localDescription.description).toString())
  }

  override fun onBufferedAmountChange(previous: Long) {}
  override fun onStateChange() {}
  override fun onMessage(buffer: DataChannel.Buffer) {
    // Never unwind through JNI; report failures to the instrumentation thread.
    try {
      if (!buffer.binary) {
        val decoding = System.nanoTime()
        val text = Charsets.UTF_8.decode(buffer.data).toString()
        val decodeNs = System.nanoTime() - decoding
        if (text == "finish") finished.countDown()
        else if (chat != null) {
          if (text.startsWith("{")) chat!!.begin(JSONObject(text)) else chat!!.receive(text, decodeNs)
        }
        else requireNotNull(encrypted).begin(JSONObject(text))
      } else if (encrypted != null) {
        val bytes = ByteArray(buffer.data.remaining()); buffer.data.get(bytes); encrypted!!.receive(bytes)
      } else receive(buffer.data.order(ByteOrder.BIG_ENDIAN))
    } catch (error: Throwable) { if (failure == null) failure = error; finished.countDown() }
  }

  private fun receive(data: ByteBuffer) {
    val now = System.nanoTime()
    check(data.remaining() == recordBytes)
    check(data.int == 0x52425431 && data.int == run && data.int == sequence && data.int == records)
    check(data.get().toInt() == 37 && data.get(data.limit() - 1).toInt() == 37)
    if (sequence == 0) started = now
    sequence += 1
    if (sequence != records) return
    val ms = (now - started) / 1_000_000.0
    val result = JSONObject().put("run", run).put("bytes", records.toLong() * recordBytes)
      .put("ms", ms).put("MiBps", records.toDouble() * recordBytes / 1048576 / (ms / 1000))
    samples.put(result)
    check(requireNotNull(channel).send(DataChannel.Buffer(ByteBuffer.wrap(result.toString().toByteArray()), false)))
    run += 1; sequence = 0
  }

  private fun control(path: String, body: String? = null): String {
    val connection = URL("http://127.0.0.1:18786/$path").openConnection() as HttpURLConnection
    connection.connectTimeout = 10000; connection.readTimeout = 60000
    try {
      if (body != null) {
        connection.requestMethod = "POST"; connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write(body.toByteArray()) }
      }
      check(connection.responseCode == 200) { "Control request failed: $path ${connection.responseCode}" }
      return connection.inputStream.bufferedReader().use { it.readText() }
    } finally { connection.disconnect() }
  }
}

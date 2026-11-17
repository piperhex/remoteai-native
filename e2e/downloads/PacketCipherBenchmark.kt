@file:Suppress("DEPRECATION")

package com.codexswitch.downloads

import android.os.Build
import android.os.Bundle
import android.os.Debug
import android.os.PerformanceHintManager
import android.test.InstrumentationTestCase
import android.test.InstrumentationTestRunner
import com.codexswitch.crypto.PacketCipher
import org.json.JSONObject
import java.nio.ByteBuffer
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Local device-only diagnostics: no socket, RN bridge, rendering, storage or desktop sender. */
class PacketCipherBenchmark : InstrumentationTestCase() {
  private val key = ByteArray(32) { (it + 1).toByte() }
  private val context = "remote-ai-local-packet-benchmark".toByteArray()
  private val secret = SecretKeySpec(key, "ChaCha20")
  @Volatile private var consumed = 0
  @Volatile private var consumedBytes: ByteArray? = null
  @Volatile private var consumedText: String? = null

  // Retain the actual output, so escape analysis cannot replace decoding with a length computation.
  private fun consume(bytes: ByteArray): Int { consumedBytes = bytes; return bytes.size }
  private fun consume(text: String): Int { consumedText = text; return text.length }

  private data class Packet(val text: String, val plain: ByteArray, val nonce: ByteArray,
    val encrypted: ByteArray, val hex: String)

  private fun packet(size: Int, index: Int): Packet {
    val text = buildString(size) { repeat(size) { append((33 + (it * 31 + index) % 90).toChar()) } }
    val plain = text.toByteArray()
    val nonce = ByteBuffer.allocate(12).putInt(size).putLong(index.toLong()).array()
    val encoder = Cipher.getInstance(PacketCipher.TRANSFORMATION)
    encoder.init(Cipher.ENCRYPT_MODE, secret, IvParameterSpec(nonce)); encoder.updateAAD(context)
    val encrypted = encoder.doFinal(plain)
    return Packet(text, plain, nonce, encrypted, encodeHex(nonce + encrypted))
  }

  private fun encodeHex(bytes: ByteArray): String {
    val digits = "0123456789abcdef"
    val output = CharArray(bytes.size * 2)
    for (index in bytes.indices) {
      val byte = bytes[index].toInt() and 255
      output[index * 2] = digits[byte ushr 4]; output[index * 2 + 1] = digits[byte and 15]
    }
    return String(output)
  }

  private fun init(decoder: Cipher, packet: Packet, sharedKey: Boolean = true): Cipher {
    decoder.init(Cipher.DECRYPT_MODE, if (sharedKey) secret else SecretKeySpec(key, "ChaCha20"),
      IvParameterSpec(packet.nonce))
    decoder.updateAAD(context)
    return decoder
  }

  private fun emit(value: JSONObject) {
    instrumentation.sendStatus(2, Bundle().apply { putString("packetBenchmark", value.toString()) })
  }

  private fun gcCount() = Debug.getRuntimeStat("art.gc.gc-count")?.toLongOrNull() ?: 0L

  private data class Measurement(val size: Int, val round: Int, val count: Int)

  private fun sample(name: String, measurement: Measurement, action: (Int) -> Int) {
    val (size, round, count) = measurement
    val beforeGc = gcCount()
    val cpu = Debug.threadCpuTimeNanos()
    val start = System.nanoTime()
    var checksum = 0
    repeat(count) { checksum += action(it) }
    val elapsed = System.nanoTime() - start
    val cpuNs = Debug.threadCpuTimeNanos() - cpu
    consumed = checksum
    check(checksum != 0)
    emit(JSONObject().put("stage", name).put("size", size).put("round", round).put("count", count)
      .put("ms", elapsed / 1_000_000.0).put("cpuMs", cpuNs / 1_000_000.0)
      .put("MiBps", size.toDouble() * count / 1048576 / (elapsed / 1_000_000_000.0))
      .put("gc", gcCount() - beforeGc).put("checksum", checksum))
  }

  /** Initialize outside the measured interval to separate authentication/decryption from provider setup. */
  private fun aeadOnly(packets: List<Packet>, size: Int, round: Int, count: Int) {
    val decoder = Cipher.getInstance(PacketCipher.TRANSFORMATION)
    var elapsed = 0L
    var checksum = 0
    repeat(count) { index ->
      val packet = packets[index % packets.size]
      init(decoder, packet)
      val start = System.nanoTime()
      val plain = decoder.doFinal(packet.encrypted)
      elapsed += System.nanoTime() - start
      check(plain.contentEquals(packet.plain))
      checksum += plain.size
    }
    consumed = checksum
    emit(JSONObject().put("stage", "aead_only").put("size", size).put("round", round).put("count", count)
      .put("ms", elapsed / 1_000_000.0)
      .put("MiBps", size.toDouble() * count / 1048576 / (elapsed / 1_000_000_000.0)))
  }

  private fun measureSize(size: Int, count: Int) {
    val packets = List(64) { packet(size, it) }
    val current = PacketCipher(key.copyOf(), context.copyOf())
    val legacy = LegacyPacketCipher(key.copyOf(), context.copyOf())
    val decoder = Cipher.getInstance(PacketCipher.TRANSFORMATION)
    try {
      packets.forEach { check(current.decrypt(it.hex) == it.text && legacy.decrypt(it.hex) == it.text) }
      // Warm the complete codec and the reused-provider path before collecting independent rounds.
      repeat(512) { index ->
        val packet = packets[index % packets.size]
        check(current.decrypt(packet.hex) == packet.text)
        check(legacy.decrypt(packet.hex) == packet.text)
        check(init(decoder, packet).doFinal(packet.encrypted).contentEquals(packet.plain))
      }
      repeat(3) { round ->
        val measurement = Measurement(size, round, count)
        // Alternate A/B ordering to avoid always giving one implementation the warmer CPU/cache state.
        for (old in if (round % 2 == 0) listOf(true, false) else listOf(false, true)) {
          sample(if (old) "legacy_full_packet" else "full_packet", measurement) {
            val packet = packets[it % packets.size]
            consume(if (old) legacy.decrypt(packet.hex) else current.decrypt(packet.hex))
          }
        }
        sample("hex_decode", measurement) { consume(PacketCipher.fromHex(packets[it % packets.size].hex)) }
        sample("fresh_cipher_init", measurement) {
          init(Cipher.getInstance(PacketCipher.TRANSFORMATION), packets[it % packets.size], false).blockSize + 1
        }
        sample("reused_cipher_init", measurement) { init(decoder, packets[it % packets.size]).blockSize + 1 }
        aeadOnly(packets, size, round, count)
        sample("utf8_decode", measurement) { consume(String(packets[it % packets.size].plain, Charsets.UTF_8)) }
        sample("utf8_encode", measurement) { consume(packets[it % packets.size].text.toByteArray()) }
      }
    } finally { current.destroy(); legacy.destroy() }
  }

  fun testLocalPacketStages() {
    val args = (instrumentation as InstrumentationTestRunner).arguments
    if (!args.getString("class").orEmpty().contains(javaClass.name)) return
    val count = args.getString("iterations", "1024").toInt()
    require(count in 64..8192)
    val provider = Cipher.getInstance(PacketCipher.TRANSFORMATION).provider
    val hint = if (Build.VERSION.SDK_INT >= 31) runCatching {
      instrumentation.targetContext.getSystemService(PerformanceHintManager::class.java)
        ?.createHintSession(intArrayOf(android.os.Process.myTid()), 500_000)
    }.getOrNull() else null
    emit(JSONObject().put("device", Build.MODEL).put("sdk", Build.VERSION.SDK_INT)
      .put("performanceHints", hint != null)
      .put("provider", provider.name).put("providerVersion", provider.version.toString()))
    hint?.close()
    for (size in listOf(2400, 16000)) measureSize(size, count)
    check(consumed != 0)
  }
}

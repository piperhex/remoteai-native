@file:Suppress("DEPRECATION")

package com.codexswitch.downloads

import android.test.InstrumentationTestCase
import com.codexswitch.crypto.PacketCipher
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

class PacketCipherCompatibilityTest : InstrumentationTestCase() {
  private val key = ByteArray(32) { (it + 1).toByte() }
  private val context = "packet-compatibility".toByteArray()
  private fun codec() = PacketCipher(key.copyOf(), context.copyOf())
  private fun nonce(index: Int) = ByteBuffer.allocate(12).putInt(1).putInt(0).putInt(index).array()
  private fun rejected(action: () -> Unit) {
    try { action() } catch (_: Exception) { return }
    fail("accepted an invalid or closed packet")
  }

  fun testFixedWebVectorInBothDirections() {
    val vectorKey = PacketCipher.fromHex("a5e489a7d31e8ee806a116c6540a8fde8fec8009390c0141690bd31ad0bc5d44")
    val cipher = PacketCipher(vectorKey, "codex-switch-chat-v1:interop-test".toByteArray())
    val packet = "000000020000000000000001d432e2fd21c42b91ca1cc0fd5f02ce940de07ffd" +
      "0276651560066271dec31256fccb5424"
    try {
      assertEquals("Native chat: Unicode", cipher.decrypt(packet))
      assertEquals(packet, cipher.encrypt("Native chat: Unicode".toByteArray(), packet.take(24)))
    } finally { cipher.destroy() }
  }

  fun testAlternatingEncryptionAndDecryptionPreservesUnicodeNulAndPacketOrder() {
    val cipher = codec()
    try {
      repeat(200) { index ->
        val text = "\uFEFF中文 😀 a\u0000b / $index".repeat(index % 17 + 1)
        val input = text.toByteArray()
        val packet = cipher.encrypt(input, hex(nonce(index + 1)))
        assertTrue(input.all { it == 0.toByte() })
        assertEquals(text, cipher.decrypt(packet))
        assertTrue(PacketCipher.fromHex(cipher.decryptPacketHex(packet)).contentEquals(text.toByteArray()))
      }
    } finally { cipher.destroy() }
  }

  fun testHexDecoderPreservesStrictLowercaseLengthAndByteRangeValidation() {
    val bytes = ByteArray(256) { it.toByte() }
    assertTrue(bytes.contentEquals(PacketCipher.fromHex(hex(bytes))))
    assertEquals(0, PacketCipher.fromHex("").size)
    assertEquals(20_000, PacketCipher.fromHex("ff".repeat(20_000)).size)
    for (invalid in listOf("0", "AB", "g0", "0\u0080", "\uFF100", "00".repeat(20_001),
      "00".repeat(19_999) + "0g")) rejected { PacketCipher.fromHex(invalid) }
  }

  fun testAuthenticationFailureDoesNotPoisonTheNextValidPacket() {
    val cipher = codec()
    try {
      val packet = cipher.encrypt("authenticated".toByteArray(), hex(nonce(1)))
      val bytes = PacketCipher.fromHex(packet)
      for (offset in listOf(0, 11, 12, bytes.lastIndex)) {
        val corrupt = bytes.copyOf(); corrupt[offset] = (corrupt[offset].toInt() xor 1).toByte()
        rejected { cipher.decrypt(hex(corrupt)) }
        assertEquals("authenticated", cipher.decrypt(packet))
      }
      rejected { cipher.decrypt(packet.dropLast(2)) }
      assertEquals("authenticated", cipher.decrypt(packet))
      val wrongContext = PacketCipher(key.copyOf(), "wrong-context".toByteArray())
      try { rejected { wrongContext.decrypt(packet) } } finally { wrongContext.destroy() }
    } finally { cipher.destroy() }
  }

  fun testCompressionAndBinaryAadRemainCompatible() {
    val cipher = codec()
    try {
      val text = "\uFEFF中文 😀\u0000".repeat(1000)
      val packet = cipher.encryptWithCompression(text.toByteArray(), hex(nonce(1)))
      assertEquals("00000001", packet.substring(8, 16))
      assertEquals(text, cipher.decryptWithDecompression(packet))
      val aad = byteArrayOf(7, 8, 9)
      val plain = "binary frame".toByteArray()
      val independent = Cipher.getInstance(PacketCipher.TRANSFORMATION)
      independent.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "ChaCha20"), IvParameterSpec(nonce(2)))
      independent.updateAAD(context); independent.updateAAD(aad)
      val encrypted = independent.doFinal(plain)
      rejected { cipher.decryptBytes(encrypted, nonce(2), byteArrayOf(1)) }
      assertTrue(plain.contentEquals(cipher.decryptBytes(encrypted, nonce(2), aad)))
    } finally { cipher.destroy() }
  }

  fun testConcurrentOperationsAndDestructionKeepProviderStateIsolated() {
    val cipher = codec()
    val executor = Executors.newFixedThreadPool(2)
    try {
      val operations = (1..64).map { index -> executor.submit<String> {
        val text = "parallel $index"
        cipher.decrypt(cipher.encrypt(text.toByteArray(), hex(nonce(index))))
      } }
      operations.forEachIndexed { index, task -> assertEquals("parallel ${index + 1}", task.get(10, TimeUnit.SECONDS)) }
    } finally { executor.shutdownNow(); cipher.destroy() }
    cipher.destroy()
    val input = "secret".toByteArray()
    rejected { cipher.encrypt(input, hex(nonce(100))) }
    assertTrue(input.all { it == 0.toByte() })
    rejected { cipher.decrypt("00".repeat(28)) }
    rejected { cipher.decryptBytes(ByteArray(16), nonce(100), byteArrayOf()) }
  }
}

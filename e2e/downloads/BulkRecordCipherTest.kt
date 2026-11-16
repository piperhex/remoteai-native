@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package com.codexswitch.downloads

import android.test.InstrumentationTestCase
import com.codexswitch.crypto.PacketCipher
import java.nio.ByteBuffer
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Exercise the Android provider's reused decoder against independently initialized encryptors. */
class BulkRecordCipherTest : InstrumentationTestCase() {
  private val key = ByteArray(32) { it.toByte() }
  private val transfer = UUID.randomUUID()
  private val epoch = UUID.randomUUID()
  private val request = UUID.randomUUID()

  private fun record(sequence: Int, bytes: ByteArray): ByteArray {
    val header = ByteBuffer.allocate(72).putInt(0x52414231).put(1).put(1).putShort(72)
    for (id in listOf(transfer, epoch, request)) header.putLong(id.mostSignificantBits).putLong(id.leastSignificantBits)
    header.putInt(7).putInt(31).putInt(bytes.size).putInt(sequence)
    val cipher = Cipher.getInstance(PacketCipher.TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "ChaCha20"),
      IvParameterSpec(ByteBuffer.allocate(12).putLong(0).putInt(sequence).array()))
    cipher.updateAAD(header.array())
    return header.array() + cipher.doFinal(bytes)
  }

  private fun rejected(action: () -> Unit) {
    try { action() } catch (_: Exception) { return }
    fail("accepted invalid or closed record")
  }

  fun testDistinctNoncesReuseTheDecoderWithExactPayloadAndMetadata() {
    val decoder = BulkRecordCipher(hex(key), transfer, epoch)
    try {
      for ((index, length) in listOf(1, 37, 16384 - 88, 127).withIndex()) {
        val bytes = ByteArray(length) { (it % 251).toByte() }
        val fragment = decoder.decrypt(record(index + 1, bytes))
        assertEquals(request.toString(), fragment.requestId)
        assertEquals(7, fragment.block); assertEquals(31, fragment.offset)
        assertTrue(bytes.contentEquals(fragment.bytes))
      }
    } finally { decoder.close() }
  }

  fun testReplayOutOfOrderUnsignedSequenceAndClosedDecoderAreRejected() {
    val decoder = BulkRecordCipher(hex(key), transfer, epoch)
    val bytes = byteArrayOf(42)
    val packet = record(2, bytes)
    decoder.decrypt(packet)
    rejected { decoder.decrypt(packet) }
    rejected { decoder.decrypt(record(1, bytes)) }
    assertTrue(bytes.contentEquals(decoder.decrypt(record(Int.MIN_VALUE, bytes)).bytes))
    assertTrue(bytes.contentEquals(decoder.decrypt(record(-1, bytes)).bytes))
    rejected { decoder.decrypt(record(0, bytes)) }
    decoder.close(); decoder.close()
    rejected { decoder.decrypt(record(-1, bytes)) }
    val fresh = BulkRecordCipher(hex(key), transfer, epoch)
    fresh.close()
    rejected { fresh.decrypt(record(1, bytes)) }
  }

  fun testAuthenticationAndScopeFailuresDoNotPublishPlaintextOrAdvanceSequence() {
    val decoder = BulkRecordCipher(hex(key), transfer, epoch)
    val bytes = byteArrayOf(7, 8, 9)
    try {
      val valid = record(1, bytes)
      for (offset in listOf(8, 24, 40, 56, 60, 72, valid.lastIndex)) {
        val damaged = valid.copyOf()
        damaged[offset] = (damaged[offset].toInt() xor 1).toByte()
        rejected { decoder.decrypt(damaged) }
      }
      rejected { decoder.decrypt(valid.copyOf(valid.size - 1)) }
      assertTrue(bytes.contentEquals(decoder.decrypt(valid).bytes))
      assertTrue(bytes.contentEquals(decoder.decrypt(record(2, bytes)).bytes))
    } finally { decoder.close() }
  }
}

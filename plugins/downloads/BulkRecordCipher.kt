package com.codexswitch.downloads

import com.codexswitch.crypto.PacketCipher
import java.nio.ByteBuffer
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

internal data class BulkFragment(val requestId: String, val block: Int, val offset: Int, val bytes: ByteArray)

internal class BulkRecordCipher(key: String, private val transfer: UUID, private val epoch: UUID) {
  private val keyBytes = PacketCipher.fromHex(key).also { require(it.size == 32) }
  private var secret: SecretKeySpec? = SecretKeySpec(keyBytes, "ChaCha20")
  private var cipher: Cipher? = Cipher.getInstance(PacketCipher.TRANSFORMATION)
  private val nonce = ByteArray(12)
  private var sequence = 0L
  fun decrypt(record: ByteArray): BulkFragment {
    require(record.size in 89..16384)
    val buffer = ByteBuffer.wrap(record)
    require(buffer.int == 0x52414231 && buffer.get().toInt() == 1 && buffer.get().toInt() == 1)
    require(buffer.short.toInt() == 72)
    require(UUID(buffer.long, buffer.long) == transfer && UUID(buffer.long, buffer.long) == epoch)
    val request = UUID(buffer.long, buffer.long).toString()
    val block = buffer.int; val offset = buffer.int; val length = buffer.int
    val next = buffer.int.toLong() and 0xffffffffL
    require(next > sequence && block >= 0 && offset >= 0 && length > 0 && offset.toLong() + length <= BULK_BLOCK_BYTES)
    require(record.size == length + 88)
    ByteBuffer.wrap(nonce).putInt(8, next.toInt())
    // The engine serializes records. Reinitialize the authenticated cipher with each distinct nonce,
    // retaining its provider/key objects and reading ciphertext/AAD directly from the received record.
    val decoder = checkNotNull(cipher)
    decoder.init(Cipher.DECRYPT_MODE, checkNotNull(secret), IvParameterSpec(nonce))
    decoder.updateAAD(record, 0, 72)
    val plain = decoder.doFinal(record, 72, record.size - 72)
    sequence = next
    return BulkFragment(request, block, offset, plain)
  }
  fun close() { keyBytes.fill(0); nonce.fill(0); secret = null; cipher = null }
}

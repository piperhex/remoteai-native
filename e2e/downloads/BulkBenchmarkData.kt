package com.codexswitch.downloads

import com.codexswitch.crypto.PacketCipher
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Fixed, public benchmark data. Record generation is excluded from receiver timings. */
internal class BulkBenchmarkData {
  val blockCount = 128
  val size = blockCount.toLong() * BULK_BLOCK_BYTES
  val transfer = UUID.randomUUID()
  val epoch = UUID.randomUUID()
  val key = ByteArray(32) { it.toByte() }
  val plain = ByteArray(BULK_BLOCK_BYTES) { (it % 251).toByte() }
  val blockHash = hex(sha256(plain))
  val manifest: BulkManifest
  val records: List<ByteArray>

  init {
    val whole = MessageDigest.getInstance("SHA-256")
    repeat(blockCount) { whole.update(plain) }
    val fileHash = whole.digest()
    val identity = MessageDigest.getInstance("SHA-256")
    identity.update("remote-ai:file-manifest:v1:sha256\u0000".toByteArray())
    identity.update(ByteBuffer.allocate(16).putLong(size).putInt(BULK_BLOCK_BYTES).putInt(blockCount).array())
    repeat(blockCount) { identity.update(sha256(plain)) }
    identity.update(fileHash)
    manifest = BulkManifest(JSONObject().put("version", 1).put("algorithm", "sha256")
      .put("manifestId", hex(identity.digest())).put("fileHash", hex(fileHash))
      .put("size", size).put("blockSize", BULK_BLOCK_BYTES).put("blockCount", blockCount))
    records = encryptRecords()
  }

  private fun encryptRecords(): List<ByteArray> {
    val records = ArrayList<ByteArray>()
    val encoder = Cipher.getInstance(PacketCipher.TRANSFORMATION)
    val secret = SecretKeySpec(key, "ChaCha20")
    val request = UUID.randomUUID()
    var sequence = 0
    repeat(blockCount) { block ->
      var offset = 0
      while (offset < plain.size) {
        val length = minOf(16384 - 88, plain.size - offset)
        val header = ByteBuffer.allocate(72).putInt(0x52414231).put(1).put(1).putShort(72)
        for (id in listOf(transfer, epoch, request)) {
          header.putLong(id.mostSignificantBits).putLong(id.leastSignificantBits)
        }
        header.putInt(block).putInt(offset).putInt(length).putInt(++sequence)
        encoder.init(Cipher.ENCRYPT_MODE, secret,
          IvParameterSpec(ByteBuffer.allocate(12).putLong(0).putInt(sequence).array()))
        encoder.updateAAD(header.array())
        records.add(header.array() + encoder.doFinal(plain, offset, length))
        offset += length
      }
    }
    return records
  }

  fun decoder() = BulkRecordCipher(hex(key), transfer, epoch)

  fun prepare(storage: DownloadStorage, blocks: BulkDownloadStorage): DownloadTask {
    val task = DownloadTask.create(JSONObject().put("owner", "local-benchmark").put("deviceId", "local")
      .put("scope", "computer").put("path", "local-throughput.bin"))
    task.data.put("id", transfer.toString()).put("size", size).put("mimeType", "application/octet-stream")
    task.status = "downloading"
    val hashes = JSONArray()
    repeat(blockCount) { hashes.put(blockHash) }
    blocks.storePage(task, JSONObject().put("manifestId", manifest.id).put("page", 0)
      .put("totalPages", 1).put("hashes", hashes).toString())
    blocks.restore(task, manifest)
    return task
  }
}

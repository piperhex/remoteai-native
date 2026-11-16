@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package com.codexswitch.downloads

import android.os.Process
import android.test.InstrumentationTestCase
import android.test.InstrumentationTestRunner
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Manual, single-ended benchmark: run this class explicitly, without concurrent builds or transfers. */
class BulkThroughputBenchmark : InstrumentationTestCase() {
  fun testNativeReceiverStagesWithoutNetworkOrJavaScript() {
    if (!(instrumentation as InstrumentationTestRunner).arguments
        .getString("class").orEmpty().contains(javaClass.name)) return
    var failure: Throwable? = null
    val thread = Thread({
      Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
      try { benchmark() } catch (error: Throwable) { failure = error }
    }, "file-downloads-benchmark")
    thread.start(); thread.join()
    failure?.let { throw it }
  }

  private fun benchmark() {
    val data = BulkBenchmarkData()
    val results = JSONArray()
    for (mode in listOf("decrypt", "storage-checkpoint", "decrypt-hash-storage-checkpoint")) {
      // One warm-up per mode. Preparation, ciphertext generation and final hash checks are outside timings.
      sample(data, mode)
      repeat(3) { results.put(sample(data, mode).put("run", it + 1)) }
    }
    val report = JSONObject().put("samples", results).put("bytes", data.size)
      .put("records", data.records.size).put("threadPriority", Process.getThreadPriority(Process.myTid()))
      .put("maxHeapBytes", Runtime.getRuntime().maxMemory())
    File(instrumentation.targetContext.filesDir, "bulk-throughput.json").writeText(report.toString(2))
    println("NATIVE_STAGE_BENCHMARK $report")
  }

  private fun sample(data: BulkBenchmarkData, mode: String): JSONObject {
    val storage = DownloadStorage(instrumentation.targetContext)
    val blocks = BulkDownloadStorage(storage)
    val task = if (mode == "decrypt") null else data.prepare(storage, blocks)
    try {
      val started = System.nanoTime()
      when (mode) {
        "decrypt" -> decrypt(data)
        "storage-checkpoint" -> store(data, storage, blocks, requireNotNull(task))
        else -> decodeAndStore(data, storage, blocks, requireNotNull(task))
      }
      val ms = (System.nanoTime() - started) / 1_000_000.0
      if (task != null) blocks.verifyComplete(task) {}
      return JSONObject().put("stage", mode).put("ms", ms)
        .put("MiBps", data.size / 1048576.0 / (ms / 1000)).put("verified", true)
    } finally { if (task != null) { blocks.delete(task); storage.delete(task) } }
  }

  private fun decrypt(data: BulkBenchmarkData) {
    val decoder = data.decoder()
    var received = 0L
    try {
      for (record in data.records) {
        val fragment = decoder.decrypt(record)
        check(fragment.bytes.first() == data.plain[fragment.offset])
        check(fragment.bytes.last() == data.plain[fragment.offset + fragment.bytes.size - 1])
        received += fragment.bytes.size
      }
      check(received == data.size)
    } finally { decoder.close() }
  }

  private fun checkpoint(storage: DownloadStorage, task: DownloadTask) {
    if (task.received % CHECKPOINT_BYTES == 0L) storage.save(listOf(task))
  }

  private fun store(
    data: BulkBenchmarkData, storage: DownloadStorage, blocks: BulkDownloadStorage, task: DownloadTask,
  ) {
    val committed = mutableSetOf<Int>()
    repeat(data.blockCount) { block ->
      blocks.write(task, block, data.plain, committed)
      checkpoint(storage, task)
    }
  }

  private fun decodeAndStore(
    data: BulkBenchmarkData, storage: DownloadStorage, blocks: BulkDownloadStorage, task: DownloadTask,
  ) {
    val decoder = data.decoder()
    val committed = mutableSetOf<Int>()
    val buffer = ByteArray(BULK_BLOCK_BYTES)
    try {
      for (record in data.records) {
        val fragment = decoder.decrypt(record)
        fragment.bytes.copyInto(buffer, fragment.offset)
        if (fragment.offset + fragment.bytes.size != buffer.size) continue
        check(hex(sha256(buffer)) == blocks.hash(task, data.manifest, fragment.block))
        blocks.write(task, fragment.block, buffer, committed)
        checkpoint(storage, task)
      }
      check(task.received == data.size)
    } finally { decoder.close() }
  }
}

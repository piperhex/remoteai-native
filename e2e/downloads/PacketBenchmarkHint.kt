package com.codexswitch.downloads

import android.content.Context
import android.os.Build
import android.os.PerformanceHintManager
import android.os.Process

internal data class ChatBenchmarkOptions(val compare: Boolean = false, val hintContext: Context? = null)

/** Optional diagnostic: let Android schedule a sustained receiver within a per-packet work budget. */
internal class PacketBenchmarkHint(private val context: Context) {
  private var attempted = false
  private var session: PerformanceHintManager.Session? = null
  val active: Boolean get() = session != null

  @Synchronized fun report(duration: Long) {
    if (Build.VERSION.SDK_INT < 31) return
    // A missing or restricted hint service must not fail a transfer.
    runCatching {
      if (!attempted) {
        attempted = true
        session = context.getSystemService(PerformanceHintManager::class.java)
          ?.createHintSession(intArrayOf(Process.myTid()), 500_000)
      }
      session?.reportActualWorkDuration(duration.coerceAtLeast(1))
    }.onFailure { close() }
  }

  @Synchronized fun close() {
    attempted = true
    runCatching { session?.close() }
    session = null
  }
}

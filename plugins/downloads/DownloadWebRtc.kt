package com.codexswitch.downloads

import com.oney.WebRTCModule.WebRTCModuleOptions

/** Configure the bundled M124 transport before its PeerConnectionFactory is initialized. */
object DownloadWebRtc {
  private const val RECEIVE_BUFFER_TRIAL = "WebRTC-SetSocketReceiveBuffer"
  private const val RECEIVE_BUFFER_KIB = 1024

  internal fun fieldTrials(current: String?): String {
    val existing = current.orEmpty()
    if (existing.split('/').chunked(2).any { it.first() == RECEIVE_BUFFER_TRIAL }) return existing
    val prefix = if (existing.isEmpty() || existing.endsWith('/')) existing else "$existing/"
    return "$prefix$RECEIVE_BUFFER_TRIAL/Enabled-$RECEIVE_BUFFER_KIB/"
  }

  @JvmStatic
  fun configure() {
    val options = WebRTCModuleOptions.getInstance()
    // Wi-Fi bursts otherwise overflow the phone's small default UDP buffer and trigger SCTP recovery.
    // This bounded socket option needs no device-wide sysctl or enlarged application request window.
    options.fieldTrials = fieldTrials(options.fieldTrials)
  }
}

@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package com.codexswitch.downloads

import android.test.InstrumentationTestCase

class DownloadWebRtcTest : InstrumentationTestCase() {
  fun testBoundedReceiveBufferIsConfiguredOnceAndPreservesOtherTrials() {
    val setting = "WebRTC-SetSocketReceiveBuffer/Enabled-1024/"
    assertEquals(setting, DownloadWebRtc.fieldTrials(null))
    assertEquals(setting, DownloadWebRtc.fieldTrials(""))
    assertEquals(setting, DownloadWebRtc.fieldTrials(setting))
    assertEquals("OtherTrial/Enabled/$setting", DownloadWebRtc.fieldTrials("OtherTrial/Enabled/"))
    assertEquals("OtherTrial/Enabled/$setting", DownloadWebRtc.fieldTrials("OtherTrial/Enabled"))
  }

  fun testExplicitReceiveBufferPolicyIsNotDuplicatedOrOverridden() {
    val existing = "Before/Enabled/WebRTC-SetSocketReceiveBuffer/Enabled-512/After/Disabled/"
    assertEquals(existing, DownloadWebRtc.fieldTrials(existing))
    assertEquals("Other/WebRTC-SetSocketReceiveBuffer/WebRTC-SetSocketReceiveBuffer/Enabled-1024/",
      DownloadWebRtc.fieldTrials("Other/WebRTC-SetSocketReceiveBuffer/"))
  }
}

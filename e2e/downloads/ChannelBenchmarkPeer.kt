package com.codexswitch.downloads

import org.webrtc.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Blocking signaling helpers used only on the instrumentation thread. */
internal class ChannelBenchmarkSdp : SdpObserver {
  private val ready = CountDownLatch(1)
  private var description: SessionDescription? = null
  private var failure: String? = null
  override fun onCreateSuccess(value: SessionDescription) { description = value; ready.countDown() }
  override fun onSetSuccess() { ready.countDown() }
  override fun onCreateFailure(error: String) { failure = error; ready.countDown() }
  override fun onSetFailure(error: String) { failure = error; ready.countDown() }
  fun await(): SessionDescription? {
    check(ready.await(30, TimeUnit.SECONDS)) { "SDP operation timed out" }
    check(failure == null) { failure.orEmpty() }
    return description
  }
}

internal class ChannelBenchmarkPeer(private val receive: (DataChannel) -> Unit) : PeerConnection.Observer {
  val gathered = CountDownLatch(1)
  override fun onDataChannel(channel: DataChannel) = receive(channel)
  override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
    if (state == PeerConnection.IceGatheringState.COMPLETE) gathered.countDown()
  }
  override fun onSignalingChange(state: PeerConnection.SignalingState) {}
  override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {}
  override fun onIceConnectionReceivingChange(receiving: Boolean) {}
  override fun onIceCandidate(candidate: IceCandidate) {}
  override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) {}
  override fun onAddStream(stream: MediaStream) {}
  override fun onRemoveStream(stream: MediaStream) {}
  override fun onRenegotiationNeeded() {}
}

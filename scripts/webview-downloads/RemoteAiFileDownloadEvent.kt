package com.reactnativecommunity.webview.events

import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class RemoteAiFileDownloadEvent(surfaceId: Int, viewTag: Int, private val payload: WritableMap) :
    Event<RemoteAiFileDownloadEvent>(surfaceId, viewTag) {
    override fun getEventName() = "topFileDownload"
    override fun canCoalesce() = false
    override fun getEventData() = payload
}

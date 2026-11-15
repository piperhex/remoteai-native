package com.codexswitch.inspector

import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.view.SurfaceControlViewHost
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.widget.FrameLayout
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.annotations.ReactProp

internal class InspectorHostView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext), SurfaceHolder.Callback {
  private val surface = SurfaceView(context)
  private var remote: Messenger? = null
  private var options: Bundle? = null
  private var completion: ((Boolean) -> Unit)? = null
  private var bound = false
  private var created = false
  private var requested = false
  private val replies = Messenger(Handler(Looper.getMainLooper()) { message ->
    when (message.what) {
      InspectorProtocol.READY -> {
        message.data.classLoader = SurfaceControlViewHost.SurfacePackage::class.java.classLoader
        val parcel = message.data.getParcelable<SurfaceControlViewHost.SurfacePackage>("surface")
        if (bound && parcel != null) { surface.setChildSurfacePackage(parcel); complete(true) }
        else parcel?.release()
      }
      InspectorProtocol.FAILED -> fail()
    }
    true
  })
  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, binder: IBinder) {
      remote = Messenger(binder); attach()
    }
    override fun onServiceDisconnected(name: ComponentName) { remote = null; fail() }
    override fun onBindingDied(name: ComponentName) { fail(); close() }
  }

  init {
    // Android only routes input into an embedded hierarchy when it is above its host window surface.
    surface.setZOrderOnTop(true)
    surface.importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_YES
    addView(surface, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    surface.holder.addCallback(this)
  }

  fun setInteractive(interactive: Boolean) { surface.setZOrderOnTop(interactive) }

  fun hideKeyboard() {
    try { remote?.send(Message.obtain(null, InspectorProtocol.HIDE_KEYBOARD)) }
    catch (_: android.os.RemoteException) { fail() }
  }

  fun open(request: Bundle, done: (Boolean) -> Unit) {
    close(); options = request; completion = done
    bound = context.bindService(Intent(context, BrowserInspectorService::class.java), connection,
      android.content.Context.BIND_AUTO_CREATE)
    if (!bound) complete(false)
    postDelayed({ if (completion === done) complete(false) }, 10000)
  }

  private fun attach() {
    val endpoint = remote ?: return
    if (!created || requested || width == 0 || height == 0) return
    val token = surface.hostToken ?: return
    requested = true
    val request = Bundle(options).apply {
      putBinder("hostToken", token); putInt("width", width); putInt("height", height)
      putInt("displayId", display.displayId)
    }
    try { endpoint.send(Message.obtain(null, InspectorProtocol.OPEN).apply { data = request; replyTo = replies }) }
    catch (_: android.os.RemoteException) { fail() }
  }

  private fun complete(success: Boolean) {
    val done = completion; completion = null
    done?.invoke(success)
  }

  private fun fail() {
    val pending = completion != null
    complete(false)
    if (!pending && bound && isAttachedToWindow) {
      UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
        InspectorFailureEvent(UIManagerHelper.getSurfaceId(reactContext), id))
    }
  }

  override fun surfaceCreated(holder: SurfaceHolder) { created = true; attach() }
  override fun surfaceDestroyed(holder: SurfaceHolder) { created = false; close() }
  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
    attach()
    try { remote?.send(Message.obtain(null, InspectorProtocol.RESIZE, width, height)) }
    catch (_: android.os.RemoteException) { fail() }
  }

  fun close() {
    complete(false)
    try { remote?.send(Message.obtain(null, InspectorProtocol.CLOSE)) }
    catch (_: android.os.RemoteException) { /* The service has already stopped. */ }
    if (bound) context.unbindService(connection)
    bound = false; requested = false; remote = null; options = null
  }

  override fun onDetachedFromWindow() { close(); super.onDetachedFromWindow() }
}

internal class InspectorHostManager : SimpleViewManager<InspectorHostView>() {
  override fun getName() = "BrowserInspectorSurface"
  override fun createViewInstance(context: ThemedReactContext) = InspectorHostView(context)
  override fun onDropViewInstance(view: InspectorHostView) { view.close(); super.onDropViewInstance(view) }
  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    mapOf("topInspectorFailure" to mapOf("registrationName" to "onFailure"))
  @ReactProp(name = "interactive", defaultBoolean = true)
  fun setInteractive(view: InspectorHostView, interactive: Boolean) { view.setInteractive(interactive) }
}

private class InspectorFailureEvent(surfaceId: Int, viewTag: Int) : Event<InspectorFailureEvent>(surfaceId, viewTag) {
  override fun getEventName() = "topInspectorFailure"
  override fun getEventData() = Arguments.createMap()
}

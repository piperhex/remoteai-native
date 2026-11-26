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
import android.view.MotionEvent
import android.view.SurfaceControlViewHost
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.widget.FrameLayout
import org.json.JSONObject
import com.codexswitch.browser.EmbeddedMouseSurface
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.annotations.ReactProp

private const val INSPECTOR_READY = "topInspectorReady"
private const val INSPECTOR_FAILED = "topInspectorFailure"

internal class InspectorHostView(private val reactContext: ThemedReactContext) :
  FrameLayout(reactContext), SurfaceHolder.Callback, EmbeddedMouseSurface {
  private val surface = SurfaceView(context)
  private var remote: Messenger? = null
  private var options: Bundle? = null
  private var completion: ((Boolean) -> Unit)? = null
  private var bound = false
  private var created = false
  private var requested = false
  private var interactive = true
  private var mouseOverlay = false
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
    surface.setZOrderOnTop(true)
    // Below the overlay, this window receives the finger events formerly delivered by Android to the child surface.
    surface.setOnTouchListener { _, event ->
      if (!interactive || !mouseOverlay) return@setOnTouchListener false
      if (event.actionMasked == MotionEvent.ACTION_DOWN) focusRenderer()
      forward(InspectorProtocol.TOUCH, Bundle().apply { putParcelable("touch", event) })
    }
    surface.importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_YES
    addView(surface, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    surface.holder.addCallback(this)
  }

  fun setInteractive(value: Boolean) { interactive = value; surface.setZOrderOnTop(interactive && !mouseOverlay) }
  fun setMouseOverlay(value: Boolean) { mouseOverlay = value; surface.setZOrderOnTop(interactive && !mouseOverlay) }

  override fun sendMouse(event: JSONObject) {
    if ((!interactive || !mouseOverlay) && event.optString("kind") != "cancel") return
    if (event.optString("kind") == "button" && event.optBoolean("down")) focusRenderer()
    forward(InspectorProtocol.MOUSE, Bundle().apply { putString("mouse", event.toString()) })
  }

  private fun focusRenderer() {
    // Touching the overlay returns window focus to the activity even if SurfaceView still has view focus.
    surface.isFocusableInTouchMode = true
    if (surface.isFocused) surface.clearFocus()
    surface.requestFocus()
  }

  private fun forward(type: Int, payload: Bundle): Boolean {
    val endpoint = remote ?: return false
    return try {
      endpoint.send(Message.obtain(null, type).apply { data = payload })
      true
    } catch (_: android.os.RemoteException) { fail(); false }
  }

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
    if (!pending && bound && isAttachedToWindow) dispatchInspectorEvent(INSPECTOR_FAILED)
  }

  private fun dispatchInspectorEvent(name: String) {
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
      InspectorEvent(UIManagerHelper.getSurfaceId(reactContext), id, name))
  }

  override fun surfaceCreated(holder: SurfaceHolder) {
    created = true
    attach()
    // React layout can arrive before Fabric exposes this host to the inspector module.
    dispatchInspectorEvent(INSPECTOR_READY)
  }
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
    mapOf(INSPECTOR_READY to mapOf("registrationName" to "onReady"),
      INSPECTOR_FAILED to mapOf("registrationName" to "onFailure"))
  @ReactProp(name = "interactive", defaultBoolean = true)
  fun setInteractive(view: InspectorHostView, interactive: Boolean) { view.setInteractive(interactive) }
  @ReactProp(name = "mouseOverlay")
  fun setMouseOverlay(view: InspectorHostView, enabled: Boolean) { view.setMouseOverlay(enabled) }
}

private class InspectorEvent(surfaceId: Int, viewTag: Int, private val name: String) :
  Event<InspectorEvent>(surfaceId, viewTag) {
  override fun getEventName() = name
  override fun getEventData() = Arguments.createMap()
}

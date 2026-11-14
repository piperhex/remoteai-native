package com.codexswitch.browser

import android.app.Activity
import android.os.Build
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

/** Browser history owns Back only while a browser screen is visible. Never navigate on cancellation. */
class BrowserGesturesModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LifecycleEventListener {
  private var enabled = false
  private var registration: AutoCloseable? = null

  init { context.addLifecycleEventListener(this) }
  override fun getName() = "BrowserGestures"

  @ReactMethod
  fun setEnabled(value: Boolean) {
    UiThreadUtil.runOnUiThread {
      enabled = value
      update()
    }
  }

  @ReactMethod fun addListener(event: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  private fun emit(direction: String) {
    if (enabled && context.hasActiveReactInstance()) {
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("browserEdgeNavigation", direction)
    }
  }

  private fun update() {
    detach()
    if (!enabled || Build.VERSION.SDK_INT < 33) return
    val activity = currentActivity ?: return
    registration = Api33.register(activity, ::emit)
  }

  // Isolate platform classes so Android 7–12 can load the module without resolving newer API types.
  @RequiresApi(33)
  private object Api33 {
    fun register(activity: Activity, emit: (String) -> Unit): AutoCloseable {
      val target = activity.onBackInvokedDispatcher
      val handler = OnBackInvokedCallback { emit("back") }
      target.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_OVERLAY, handler)
      return AutoCloseable { target.unregisterOnBackInvokedCallback(handler) }
    }
  }

  private fun detach() {
    registration?.close()
    registration = null
  }

  override fun onHostResume() { update() }
  override fun onHostPause() { detach() }
  override fun onHostDestroy() { detach() }
  override fun invalidate() {
    context.removeLifecycleEventListener(this)
    UiThreadUtil.runOnUiThread { enabled = false; detach() }
    super.invalidate()
  }
}

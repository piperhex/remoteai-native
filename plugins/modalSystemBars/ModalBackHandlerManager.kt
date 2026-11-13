package com.codexswitch.systembars

import android.os.Build
import android.view.View
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event

/** Keep gesture dismissal controlled by React, just like RN's legacy Back-key callback. */
class ModalBackHandlerView(private val reactContext: ThemedReactContext) : View(reactContext) {
  private var registration: AutoCloseable? = null
  var backEnabled = false
    set(value) {
      field = value
      updateRegistration()
    }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    updateRegistration()
  }

  override fun onDetachedFromWindow() {
    unregister()
    super.onDetachedFromWindow()
  }

  private fun unregister() {
    registration?.close()
    registration = null
  }

  private fun updateRegistration() {
    unregister()
    if (!backEnabled || !isAttachedToWindow || Build.VERSION.SDK_INT < 33) return
    registration = Api33.register(this, ::requestClose)
  }

  private fun requestClose() {
    if (!backEnabled || !isAttachedToWindow) return
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
      ModalBackEvent(UIManagerHelper.getSurfaceId(reactContext), id))
  }

  // Keep newer platform types out of the view's fields so Android 7–12 can load it.
  @RequiresApi(33)
  private object Api33 {
    fun register(view: View, requestClose: () -> Unit): AutoCloseable? {
      // The attached view belongs to the Dialog window, not the underlying browser Activity.
      val dispatcher = view.findOnBackInvokedDispatcher() ?: return null
      val callback = OnBackInvokedCallback { requestClose() }
      dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)
      return AutoCloseable { dispatcher.unregisterOnBackInvokedCallback(callback) }
    }
  }
}

private class ModalBackEvent(surfaceId: Int, viewTag: Int) : Event<ModalBackEvent>(surfaceId, viewTag) {
  override fun getEventName() = "topRequestClose"
  override fun getEventData() = Arguments.createMap()
}

class ModalBackHandlerManager : SimpleViewManager<ModalBackHandlerView>() {
  override fun getName() = "ModalBackHandler"
  override fun createViewInstance(context: ThemedReactContext) = ModalBackHandlerView(context)
  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    mapOf("topRequestClose" to mapOf("registrationName" to "onRequestClose"))

  @ReactProp(name = "enabled")
  fun setEnabled(view: ModalBackHandlerView, enabled: Boolean) { view.backEnabled = enabled }
}

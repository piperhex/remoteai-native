package com.codexswitch.composer

import android.view.KeyEvent
import android.view.inputmethod.BaseInputConnection
import android.widget.EditText
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.events.Event
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

private const val SEND_SHORTCUT_EVENT = "topSendShortcut"

private class ComposerShortcutView(private val reactContext: ThemedReactContext) : ReactViewGroup(reactContext) {
  private var handledDownTime: Long? = null

  override fun dispatchKeyEventPreIme(event: KeyEvent): Boolean =
    handleShortcut(event) || super.dispatchKeyEventPreIme(event)

  override fun dispatchKeyEvent(event: KeyEvent): Boolean =
    handleShortcut(event) || super.dispatchKeyEvent(event)

  private fun handleShortcut(event: KeyEvent): Boolean {
    if (event.keyCode != KeyEvent.KEYCODE_ENTER && event.keyCode != KeyEvent.KEYCODE_NUMPAD_ENTER) return false
    if (handledDownTime == event.downTime) {
      if (event.action == KeyEvent.ACTION_UP) handledDownTime = null
      return true
    }
    if (event.action != KeyEvent.ACTION_DOWN || event.repeatCount != 0 || !event.hasModifiers(KeyEvent.META_CTRL_ON)) {
      return false
    }
    val input = findFocus() as? EditText ?: return false
    if (!input.onCheckIsTextEditor() || !input.isEnabled) return false
    if (BaseInputConnection.getComposingSpanStart(input.text) >= 0) return false
    handledDownTime = event.downTime
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
      SendShortcutEvent(UIManagerHelper.getSurfaceId(reactContext), id))
    return true
  }
}

private class SendShortcutEvent(surfaceId: Int, viewTag: Int) : Event<SendShortcutEvent>(surfaceId, viewTag) {
  override fun getEventName() = SEND_SHORTCUT_EVENT
  override fun canCoalesce() = false
  override fun getEventData() = Arguments.createMap()
}

private class ComposerShortcutManager : ReactViewManager() {
  override fun getName() = "ComposerShortcut"
  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = ComposerShortcutView(context)
  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    mapOf(SEND_SHORTCUT_EVENT to mapOf("registrationName" to "onSendShortcut"))
}

class ComposerShortcutPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(ComposerShortcutManager())
}

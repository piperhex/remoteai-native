package com.codexswitch.browser

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.IllegalViewOperationException
import com.facebook.react.uimanager.UIManagerHelper
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.WeakHashMap

/** Keep input inside the selected tab, including locally rendered home and preview controls. */
class BrowserMouseModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private data class Press(val view: WeakReference<View>, val buttons: MutableSet<String> = mutableSetOf())
  private val held = WeakHashMap<View, Press>()
  private val pageScript = context.assets.open("BrowserPageMouse.js").bufferedReader().use { it.readText() }
  override fun getName() = "BrowserMouse"

  @ReactMethod fun send(tag: Int, input: ReadableMap) {
    UiThreadUtil.runOnUiThread {
      val root = try {
        UIManagerHelper.getUIManagerForReactTag(context, tag)?.resolveView(tag)
      } catch (_: IllegalViewOperationException) {
        // A tab can disappear between a final release and its delivery to the UI thread.
        null
      } ?: return@runOnUiThread
      val origin = IntArray(2).also(root::getLocationOnScreen)
      val x = origin[0] + input.getDouble("x") * (root.width - 1)
      val y = origin[1] + input.getDouble("y") * (root.height - 1)
      val hit = hitView(root, x.toInt(), y.toInt())
      val kind = input.getString("kind")
      val press = held[root]
      val previous = press?.view?.get()
      val down = kind == "button" && input.getBoolean("down")
      if (kind == "cancel" && previous == null) return@runOnUiThread
      val target = previous ?: hit ?: return@runOnUiThread
      if (kind == "button") {
        val button = input.getString("button") ?: return@runOnUiThread
        if (down) held.getOrPut(root) { Press(WeakReference(target)) }.buttons.add(button)
        else if (press?.buttons?.remove(button) != true) return@runOnUiThread
      }
      if (kind == "cancel" || press?.buttons?.isEmpty() == true) held.remove(root)
      if (target is WebView) {
        val local = IntArray(2).also(target::getLocationOnScreen)
        if (kind == "wheel") {
          scrollWebView(target, x - local[0], y - local[1], input)
          return@runOnUiThread
        }
        val event = JSONObject(input.toHashMap())
          .put("x", (x - local[0]) / maxOf(1, target.width - 1))
          .put("y", (y - local[1]) / maxOf(1, target.height - 1))
        val init = "if(!window.__remoteAiPageMouse){$pageScript;window.__remoteAiPageMouse=BrowserPageMouse.send;}"
        target.evaluateJavascript("(()=>{$init;window.__remoteAiPageMouse($event)})();", null)
      } else if (kind == "wheel") {
        scroll(target, root, input)
      } else if (kind == "button" && !down && hit === target) {
        val action = if (input.getString("button") == "left") AccessibilityNodeInfo.ACTION_CLICK
          else AccessibilityNodeInfo.ACTION_LONG_CLICK
        ancestors(target, root).firstOrNull { it.performAccessibilityAction(action, null) }
      }
    }
  }

  private fun ancestors(target: View, root: View) =
    generateSequence(target) { it.parent as? View }.takeWhile { it !== root.parent }

  private fun scroll(target: View, root: View, input: ReadableMap) {
    val delta = input.getDouble("delta").toInt()
    val horizontal = input.hasKey("horizontal") && input.getBoolean("horizontal")
    val direction = (if (horizontal) delta else -delta).compareTo(0)
    ancestors(target, root)
      .firstOrNull { if (horizontal) it.canScrollHorizontally(direction) else it.canScrollVertically(direction) }
      ?.scrollBy(if (horizontal) delta else 0, if (horizontal) 0 else -delta)
  }

  private fun hitView(view: View, x: Int, y: Int): View? {
    if (!view.isShown || view.alpha == 0f || !Rect().also { view.getGlobalVisibleRect(it) }.contains(x, y)) return null
    if (view !is ViewGroup || view is WebView) return view
    for (index in view.childCount - 1 downTo 0) hitView(view.getChildAt(index), x, y)?.let { return it }
    return view
  }
}

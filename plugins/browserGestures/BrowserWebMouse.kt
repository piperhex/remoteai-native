package com.codexswitch.browser

import android.content.Context
import android.webkit.WebView
import android.webkit.ValueCallback
import org.json.JSONObject

/** A browser surface whose renderer lives outside the local view hierarchy. */
internal interface EmbeddedMouseSurface {
  fun sendMouse(event: JSONObject)
}

/** Page coordinates are normalized so the same input works in either browser renderer. */
internal class BrowserWebMouse(context: Context) {
  private val script = context.assets.open("BrowserPageMouse.js").bufferedReader().use { it.readText() }

  fun send(view: WebView, event: JSONObject, onEditorClick: (() -> Unit)? = null) {
    if (event.getString("kind") == "wheel") {
      val x = event.getDouble("x") * maxOf(1, view.width - 1)
      val y = event.getDouble("y") * maxOf(1, view.height - 1)
      scrollWebView(view, x, y, event)
      return
    }
    if (event.optString("kind") == "button" && event.optBoolean("down")) view.requestFocus()
    val checkEditor = onEditorClick != null && event.optString("kind") == "button" &&
      event.optString("button") == "left" && !event.optBoolean("down")
    val method = if (checkEditor) "sendEditorClick" else "send"
    val init = "if(!window.__remoteAiPageMouse){$script;window.__remoteAiPageMouse=BrowserPageMouse;}"
    val callback = if (checkEditor) ValueCallback<String> { if (it == "true") onEditorClick?.invoke() } else null
    view.evaluateJavascript("(()=>{$init;return window.__remoteAiPageMouse.$method($event)})();", callback)
  }
}

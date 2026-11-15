package com.codexswitch.inspector

import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors

/** The website remains here; DevTools must run in a different renderer to survive JavaScript pauses. */
class BrowserInspectorModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val worker = Executors.newSingleThreadExecutor()
  private var owner: String? = null
  private var host: InspectorHostView? = null
  @Volatile private var generation = 0
  private val debugBuild = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
  init {
    context.addLifecycleEventListener(this)
  }
  override fun getName() = "BrowserInspector"
  override fun getConstants(): Map<String, Any> = mapOf("supported" to (Build.VERSION.SDK_INT >= 30))

  @ReactMethod
  fun open(request: ReadableMap, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        check(Build.VERSION.SDK_INT >= 30)
        val id = requireNotNull(request.getString("id"))
        check(id.matches(Regex("[a-fA-F0-9-]{36}")))
        val tag = request.getInt("tag")
        val container = UIManagerHelper.getUIManagerForReactTag(context, tag)?.resolveView(tag)
        val view = container?.let { findWebView(it) }
        check(view != null && view.isShown && view.url?.matches(Regex("https?://.*")) == true)
        val hostTag = request.getInt("hostTag")
        val panel = UIManagerHelper.getUIManagerForReactTag(context, hostTag)?.resolveView(hostTag) as? InspectorHostView
        // Fabric can report layout just before attaching the new surface; the host waits for surfaceCreated.
        check(panel != null)
        val extras = options(request).apply { putString("id", id); putInt("processId", Process.myPid()) }
        stop(); owner = id; host = panel
        val current = generation
        val marker = "__remoteai_inspector_${UUID.randomUUID()}"
        WebView.setWebContentsDebuggingEnabled(true)
        val script = "Object.defineProperty(globalThis, ${JSONObject.quote(marker)}, {value:true,configurable:true})"
        view.evaluateJavascript(script) {
          discover(Discovery(view, marker, current, extras), promise)
        }
      } catch (error: Exception) {
        Log.w("BrowserInspector", "Unable to open inspector", error)
        stop(); promise.reject("inspector-unavailable", "Inspector unavailable")
      }
    }
  }

  private fun options(request: ReadableMap) = Bundle().apply {
    for (key in listOf("error", "language", "theme", "surfaceColor", "contentColor")) {
      val value = requireNotNull(request.getString(key))
      check(value.length in 1..400)
      putString(key, value)
    }
  }

  private data class Discovery(val view: WebView, val marker: String, val generation: Int, val extras: Bundle)

  private fun discover(request: Discovery, promise: Promise) {
    worker.execute {
      val result = runCatching { InspectorTarget.find(request.marker) { request.generation == generation } }
      UiThreadUtil.runOnUiThread {
        if (request.view.isAttachedToWindow) {
          request.view.evaluateJavascript("delete globalThis[${JSONObject.quote(request.marker)}]", null)
        }
        if (request.generation != generation) {
          promise.reject("inspector-canceled", "Inspector canceled"); return@runOnUiThread
        }
        try {
          request.extras.putString("target", result.getOrThrow())
          requireNotNull(host).open(request.extras) { success ->
            if (success && request.generation == generation) promise.resolve(null)
            else {
              if (request.generation == generation) stop()
              promise.reject("inspector-unavailable", "Inspector unavailable")
            }
          }
        } catch (error: Exception) {
          Log.w("BrowserInspector", "Unable to connect inspector", error)
          stop(); promise.reject("inspector-unavailable", "Inspector unavailable")
        }
      }
    }
  }

  @ReactMethod
  fun close(id: String) { UiThreadUtil.runOnUiThread { if (owner == id) stop() } }

  @ReactMethod
  fun hideKeyboard(id: String) { UiThreadUtil.runOnUiThread { if (owner == id) host?.hideKeyboard() } }

  private fun stop() {
    generation++; owner = null
    val previous = host; host = null
    previous?.close()
    // Chromium retires the Unix listener asynchronously; replacing a session must not toggle it off/on.
    val stopped = generation
    Handler(Looper.getMainLooper()).postDelayed({
      if (generation == stopped && owner == null) WebView.setWebContentsDebuggingEnabled(debugBuild)
    }, 250)
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view !is ViewGroup) return null
    for (index in 0 until view.childCount) findWebView(view.getChildAt(index))?.let { return it }
    return null
  }

  override fun onHostResume() = Unit
  override fun onHostPause() { stop() }
  override fun onHostDestroy() { stop() }
  override fun invalidate() {
    context.removeLifecycleEventListener(this)
    UiThreadUtil.runOnUiThread { stop() }
    worker.shutdownNow(); super.invalidate()
  }
}

package com.codexswitch.inspector

import android.app.Service
import android.content.Intent
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.util.Log
import android.view.ContextThemeWrapper
import android.view.SurfaceControlViewHost
import android.view.MotionEvent
import android.webkit.WebView
import org.json.JSONObject

/** Render remotely but embed in the original activity, so a paused website cannot freeze DevTools. */
class BrowserInspectorService : Service() {
  private var host: SurfaceControlViewHost? = null
  private var surface: InspectorSurface? = null
  private var server: InspectorServer? = null
  private var generation = 0
  private val endpoint = Messenger(Handler(Looper.getMainLooper()) { message ->
    when (message.what) {
      InspectorProtocol.OPEN -> open(message.data, message.replyTo)
      InspectorProtocol.RESIZE -> host?.relayout(message.arg1.coerceAtLeast(1), message.arg2.coerceAtLeast(1))
      InspectorProtocol.CLOSE -> close()
      InspectorProtocol.HIDE_KEYBOARD -> surface?.hideKeyboard()
      InspectorProtocol.MOUSE -> message.data.getString("mouse")?.let { surface?.sendMouse(JSONObject(it)) }
      InspectorProtocol.TOUCH -> message.data.getParcelable<MotionEvent>("touch")?.let { event ->
        try { surface?.root?.dispatchTouchEvent(event) } finally { event.recycle() }
      }
    }
    true
  })

  override fun onBind(intent: Intent): IBinder = endpoint.binder

  private fun open(options: Bundle, reply: Messenger) {
    close()
    val current = generation
    try {
      val target = requireNotNull(options.getString("target"))
      check(target.matches(Regex("/devtools/page/[A-Za-z0-9_-]+")))
      val processId = options.getInt("processId")
      check(processId > 0)
      val display = requireNotNull(getSystemService(DisplayManager::class.java).getDisplay(options.getInt("displayId")))
      val context = ContextThemeWrapper(createDisplayContext(display), android.R.style.Theme_Material_Light_NoActionBar)
      val token = requireNotNull(options.getBinder("hostToken"))
      val viewHost = SurfaceControlViewHost(context, display, token)
      host = viewHost
      surface = InspectorSurface(context, options)
      viewHost.setView(surface!!.root, options.getInt("width").coerceAtLeast(1), options.getInt("height").coerceAtLeast(1))
      WebView.setWebContentsDebuggingEnabled(true)
      val parcel = requireNotNull(viewHost.surfacePackage)
      try {
        reply.send(Message.obtain(null, InspectorProtocol.READY).apply {
          data = Bundle().apply { putParcelable("surface", parcel) }
        })
      } finally { parcel.release() }
      startServer(target, processId, current)
    } catch (error: Exception) {
      Log.w("BrowserInspector", "Unable to embed inspector", error)
      close()
      try { reply.send(Message.obtain(null, InspectorProtocol.FAILED)) }
      catch (_: android.os.RemoteException) { /* The browser has already gone away. */ }
    }
  }

  private fun startServer(target: String, processId: Int, current: Int) {
    Thread {
      val opened = runCatching { InspectorServer(assets, target, processId) }
      Handler(Looper.getMainLooper()).post {
        if (current != generation) { opened.getOrNull()?.close(); return@post }
        server = opened.getOrNull()
        val url = server?.url
        if (url == null) surface?.fail() else surface?.load(url)
      }
    }.start()
  }

  private fun close() {
    generation++
    surface?.hideKeyboard()
    host?.release(); host = null
    surface?.close(); surface = null
    server?.close(); server = null
    WebView.setWebContentsDebuggingEnabled(false)
  }

  override fun onUnbind(intent: Intent): Boolean { close(); return false }
  override fun onDestroy() { close(); super.onDestroy() }
}

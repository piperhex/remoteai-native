package com.codexswitch.inspector

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** A random marker distinguishes retained tabs even when their URLs and titles are identical. */
internal object InspectorTarget {
  fun find(marker: String, active: () -> Boolean): String {
    val client = OkHttpClient.Builder().socketFactory(DevToolsSocketFactory())
      .connectTimeout(5, TimeUnit.SECONDS).readTimeout(5, TimeUnit.SECONDS).build()
    try {
      val request = Request.Builder().url("http://localhost/json/list").build()
      val targets = client.newCall(request).execute().use { response ->
        check(response.isSuccessful)
        JSONArray(response.body?.string() ?: "[]")
      }
      val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
      for (index in 0 until minOf(targets.length(), 64)) {
        check(active() && System.nanoTime() < deadline)
        val target = targets.getJSONObject(index)
        val id = target.optString("id")
        if (target.optString("type") != "page" || !id.matches(Regex("[A-Za-z0-9_-]+"))) continue
        val path = "/devtools/page/$id"
        if (matches(client, path, marker)) return path
      }
      error("Inspector target unavailable")
    } finally {
      client.dispatcher.executorService.shutdown()
      client.connectionPool.evictAll()
    }
  }

  private fun matches(client: OkHttpClient, path: String, marker: String): Boolean {
    val done = CountDownLatch(1)
    val matched = AtomicBoolean(false)
    val request = Request.Builder().url("http://localhost$path").build()
    val socket = client.newWebSocket(request, object : WebSocketListener() {
      override fun onOpen(webSocket: WebSocket, response: Response) {
        val params = JSONObject().put("expression", "globalThis[${JSONObject.quote(marker)}] === true")
          .put("returnByValue", true).put("silent", true)
        webSocket.send(JSONObject().put("id", 1).put("method", "Runtime.evaluate").put("params", params).toString())
      }
      override fun onMessage(webSocket: WebSocket, text: String) {
        try {
          val message = JSONObject(text)
          if (message.optInt("id") != 1) return
          matched.set(message.optJSONObject("result")?.optJSONObject("result")?.optBoolean("value") == true)
          done.countDown()
        } catch (_: org.json.JSONException) { matched.set(false); done.countDown() }
      }
      override fun onFailure(webSocket: WebSocket, error: Throwable, response: Response?) { done.countDown() }
      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { done.countDown() }
    })
    try { done.await(2, TimeUnit.SECONDS); return matched.get() }
    finally { socket.cancel() }
  }
}

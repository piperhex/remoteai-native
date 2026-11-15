package com.codexswitch.inspector

import android.content.res.AssetManager
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Collections
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.Semaphore
import java.util.concurrent.atomic.AtomicBoolean

/** A short-lived, capability-protected loopback server for one explicitly selected WebView. */
internal class InspectorServer(private val assets: AssetManager, private val target: String,
  private val processId: Int) : Closeable {
  private val server = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
  private val token = UUID.randomUUID().toString()
  private val prefix = "/$token/"
  private val running = AtomicBoolean(true)
  private val workers = Executors.newCachedThreadPool()
  private val capacity = Semaphore(16)
  private val sockets = Collections.synchronizedSet(mutableSetOf<Closeable>())
  private val origin = "http://127.0.0.1:${server.localPort}"
  val url = "$origin${prefix}devtools_app.html?ws=127.0.0.1:${server.localPort}${prefix}cdp"

  init { workers.execute { accept() } }

  private fun accept() {
    while (running.get()) {
      val socket = try { server.accept() } catch (_: Exception) { break }
      if (!capacity.tryAcquire()) { socket.close(); continue }
      sockets.add(socket)
      try {
        workers.execute {
          try { socket.use { serve(it) } }
          catch (_: Exception) { /* Closed peers and canceled asset requests end their connection. */ }
          finally { sockets.remove(socket); capacity.release() }
        }
      } catch (_: RejectedExecutionException) {
        // The session can close between accepting a connection and assigning its worker.
        socket.close(); sockets.remove(socket); capacity.release()
      }
    }
  }

  private fun serve(socket: Socket) {
    socket.soTimeout = 5000
    val input = socket.getInputStream()
    val output = socket.getOutputStream()
    val header = readHeader(input)
    val lines = header.split("\r\n")
    val request = lines.first().split(' ')
    val path = request.getOrNull(1)?.substringBefore('?') ?: return
    val headers = lines.drop(1).mapNotNull { line ->
      val split = line.indexOf(':')
      if (split < 1) null else line.substring(0, split).lowercase() to line.substring(split + 1).trim()
    }.toMap()
    if (request.first() != "GET" || !path.startsWith(prefix) || headers["host"] != origin.removePrefix("http://") ||
      headers["origin"]?.let { it != origin } == true) {
      respond(output, "403 Forbidden"); return
    }
    if (path == "${prefix}cdp" && headers["upgrade"].equals("websocket", true)) {
      bridge(socket, input, output, headers); return
    }
    asset(path.removePrefix(prefix), output)
  }

  private fun asset(path: String, output: OutputStream) {
    // No percent decoding, dot segments, query-derived file names or access outside the bundled frontend.
    if (!path.matches(Regex("[A-Za-z0-9_./@-]+")) || path.split('/').any { it == ".." || it == "." }) {
      respond(output, "404 Not Found"); return
    }
    val stream = try { assets.open("browser-inspector/$path") }
    catch (_: Exception) { respond(output, "404 Not Found"); return }
    stream.use {
      val type = when (path.substringAfterLast('.')) {
        "html" -> "text/html; charset=utf-8"
        "js", "mjs" -> "text/javascript; charset=utf-8"
        "css" -> "text/css; charset=utf-8"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "wasm" -> "application/wasm"
        else -> "application/octet-stream"
      }
      output.write(("HTTP/1.1 200 OK\r\nContent-Type: $type\r\nConnection: close\r\n" +
        "Cache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n" +
        "Referrer-Policy: no-referrer\r\nCross-Origin-Resource-Policy: same-origin\r\n\r\n").toByteArray())
      it.copyTo(output)
    }
  }

  private fun bridge(socket: Socket, input: InputStream, output: OutputStream, headers: Map<String, String>) {
    if (headers["origin"] != origin || headers["sec-websocket-version"] != "13") {
      respond(output, "403 Forbidden"); return
    }
    val key = headers["sec-websocket-key"] ?: return
    if (!key.matches(Regex("[A-Za-z0-9+/=]{24}"))) return
    connectDevTools(processId).use { upstream ->
      sockets.add(upstream)
      try {
        val request = "GET $target HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n" +
          "Connection: Upgrade\r\nSec-WebSocket-Key: $key\r\nSec-WebSocket-Version: 13\r\n\r\n"
        upstream.outputStream.write(request.toByteArray())
        val response = readHeader(upstream.inputStream)
        check(response.startsWith("HTTP/1.1 101"))
        output.write(response.toByteArray()); output.flush()
        upstream.soTimeout = 0; socket.soTimeout = 0
        workers.execute {
          try { input.copyTo(upstream.outputStream) }
          catch (_: Exception) { /* Peer closed or the owning session was canceled. */ }
          finally { upstream.close() }
        }
        upstream.inputStream.copyTo(output)
      } finally { sockets.remove(upstream) }
    }
  }

  private fun respond(output: OutputStream, status: String) {
    output.write("HTTP/1.1 $status\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
  }

  override fun close() {
    if (!running.getAndSet(false)) return
    server.close()
    synchronized(sockets) {
      sockets.forEach { try { it.close() } catch (_: Exception) { /* Already disconnected. */ } }
      sockets.clear()
    }
    workers.shutdownNow()
  }
}

private fun readHeader(input: InputStream): String {
  val buffer = ByteArrayOutputStream()
  var suffix = 0
  while (buffer.size() < 32768) {
    val value = input.read()
    check(value >= 0)
    buffer.write(value)
    suffix = (suffix shl 8) or value
    if (suffix == 0x0d0a0d0a) return buffer.toString("UTF-8")
  }
  error("Header too large")
}

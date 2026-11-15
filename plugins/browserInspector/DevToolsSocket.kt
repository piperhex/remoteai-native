package com.codexswitch.inspector

import android.net.LocalSocket
import android.net.LocalSocketAddress
import android.os.Process
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.Socket
import java.net.SocketAddress
import javax.net.SocketFactory

/** Only connect to this application's authenticated Unix socket, never another app or a TCP debug port. */
internal fun connectDevTools(processId: Int = Process.myPid()): LocalSocket = LocalSocket().apply {
  connect(LocalSocketAddress("webview_devtools_remote_$processId", LocalSocketAddress.Namespace.ABSTRACT))
  soTimeout = 5000
}

internal class DevToolsSocketFactory : SocketFactory() {
  override fun createSocket(): Socket = UnixSocket()
  override fun createSocket(host: String, port: Int): Socket = throw UnsupportedOperationException()
  override fun createSocket(host: String, port: Int, local: InetAddress, localPort: Int): Socket =
    throw UnsupportedOperationException()
  override fun createSocket(host: InetAddress, port: Int): Socket = throw UnsupportedOperationException()
  override fun createSocket(host: InetAddress, port: Int, local: InetAddress, localPort: Int): Socket =
    throw UnsupportedOperationException()

  private class UnixSocket : Socket() {
    private var socket: LocalSocket? = null
    @Volatile private var closed = false
    override fun connect(endpoint: SocketAddress, timeout: Int) { socket = connectDevTools() }
    override fun getInputStream(): InputStream = requireNotNull(socket).inputStream
    override fun getOutputStream(): OutputStream = requireNotNull(socket).outputStream
    override fun setSoTimeout(timeout: Int) { socket?.soTimeout = timeout }
    override fun getSoTimeout(): Int = socket?.soTimeout ?: 0
    override fun setTcpNoDelay(enabled: Boolean) = Unit
    override fun setKeepAlive(enabled: Boolean) = Unit
    override fun close() { closed = true; socket?.close() }
    override fun isConnected(): Boolean = socket?.isConnected == true
    // LocalSocket.isClosed() exists in the SDK but throws UnsupportedOperationException on Android.
    override fun isClosed(): Boolean = closed
    override fun shutdownInput() { socket?.shutdownInput() }
    override fun shutdownOutput() { socket?.shutdownOutput() }
  }
}

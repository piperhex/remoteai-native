package com.codexswitch.browserdata

import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import com.facebook.react.bridge.*

class BrowserMappingRoutes(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "BrowserMappingRoutes"
  override fun getConstants(): Map<String, Any> = mapOf("supported" to
    WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE_REVERSE_BYPASS))
  companion object { private var activeOwner: BrowserMappingRoutes? = null }

  @ReactMethod
  fun configure(port: Int, routes: ReadableArray, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE_REVERSE_BYPASS)) {
          if (routes.size() == 0) promise.resolve(null) else promise.reject("unsupported", "WebView update required")
          return@runOnUiThread
        }
        val proxy = ProxyController.getInstance()
        val executor = java.util.concurrent.Executor { it.run() }
        if (routes.size() == 0) {
          if (activeOwner !== this) { promise.resolve(null); return@runOnUiThread }
          activeOwner = null
          proxy.clearProxyOverride(executor) { promise.resolve(null) }
          return@runOnUiThread
        }
        require(port in 1..65535)
        val config = ProxyConfig.Builder().addProxyRule("socks://127.0.0.1:$port").setReverseBypassEnabled(true)
        for (index in 0 until routes.size()) {
          val route = requireNotNull(routes.getMap(index))
          config.addBypassRule("${route.getString("domain")}:${route.getInt("port")}")
        }
        proxy.setProxyOverride(config.build(), executor) { promise.resolve(null) }
        activeOwner = this
      } catch (error: Exception) { promise.reject("browser-mappings", error) }
    }
  }

  override fun invalidate() {
    UiThreadUtil.runOnUiThread {
      if (activeOwner === this) {
        activeOwner = null
        ProxyController.getInstance().clearProxyOverride({ it.run() }) {}
      }
    }
    super.invalidate()
  }
}

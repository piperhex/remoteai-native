package com.codexswitch.browserdata

import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

class BrowserDataModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "BrowserData"

  @ReactMethod
  fun derive(passphrase: String, salt: String, promise: Promise) {
    if (passphrase.isEmpty() || passphrase.length > 1024 || !salt.matches(Regex("[a-f0-9]{32}"))) {
      promise.reject("vault-invalid", "Invalid vault input"); return
    }
    Thread {
      val chars = passphrase.toCharArray()
      val bytes = salt.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
      val spec = PBEKeySpec(chars, bytes, 600000, 256)
      try {
        val key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        try { promise.resolve(key.joinToString("") { "%02x".format(it.toInt() and 0xff) }) }
        finally { key.fill(0) }
      } catch (_: Exception) { promise.reject("vault-unavailable", "Vault unavailable") }
      finally { spec.clearPassword(); chars.fill('\u0000'); bytes.fill(0) }
    }.start()
  }

  @ReactMethod
  fun clear(cookies: Boolean, cache: Boolean, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        if (cache) {
          // The HTTP cache belongs to the application WebView profile, not one tab.
          val cleaner = WebView(reactApplicationContext)
          cleaner.clearCache(true)
          cleaner.destroy()
        }
        if (!cookies) { promise.resolve(null); return@runOnUiThread }
        WebStorage.getInstance().deleteAllData()
        CookieManager.getInstance().removeAllCookies {
          Thread {
            try { CookieManager.getInstance().flush(); promise.resolve(null) }
            catch (_: Exception) { promise.reject("browser-data-clear", "Unable to clear browser data") }
          }.start()
        }
      } catch (_: Exception) {
        promise.reject("browser-data-clear", "Unable to clear browser data")
      }
    }
  }
}

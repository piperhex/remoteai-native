package com.codexswitch.browserdata

import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import androidx.webkit.Profile
import androidx.webkit.ProfileStore
import androidx.webkit.WebStorageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
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
        val profiles = mappingProfiles()
        val stores = listOf(WebStorage.getInstance()) + profiles.map { it.webStorage }
        if (cookies && WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA)) {
          // The complete deletion API also removes the network cache and service workers.
          var remaining = stores.size
          stores.forEach { WebStorageCompat.deleteBrowsingData(it) {
            if (--remaining == 0) promise.resolve(null)
          } }
          return@runOnUiThread
        }
        if (cache) clearCache(profiles)
        if (!cookies) { promise.resolve(null); return@runOnUiThread }
        stores.forEach { it.deleteAllData() }
        clearCookies(listOf(CookieManager.getInstance()) + profiles.map { it.cookieManager }, promise)
      } catch (_: Exception) {
        promise.reject("browser-data-clear", "Unable to clear browser data")
      }
    }
  }

  private fun mappingProfiles(): List<Profile> {
    if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) return emptyList()
    val profiles = ProfileStore.getInstance()
    return profiles.allProfileNames.filter { it.startsWith("mapping-") }.mapNotNull { profiles.getProfile(it) }
  }

  private fun clearCache(profiles: List<Profile>) {
    (listOf(null) + profiles.map { it.name }).forEach { name ->
      val cleaner = WebView(reactApplicationContext)
      try {
        if (name != null) WebViewCompat.setProfile(cleaner, name)
        cleaner.clearCache(true)
      } finally { cleaner.destroy() }
    }
  }

  private fun clearCookies(managers: List<CookieManager>, promise: Promise) {
    var remaining = managers.size
    managers.forEach { it.removeAllCookies {
      if (--remaining == 0) Thread {
        try { managers.forEach { it.flush() }; promise.resolve(null) }
        catch (_: Exception) { promise.reject("browser-data-clear", "Unable to clear browser data") }
      }.start()
    } }
  }
}

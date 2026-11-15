package com.codexswitch.inspector

import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.inputmethod.InputMethodManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import java.io.Closeable

/** The app owns the dock toolbar. This remote surface contains only the full upstream frontend. */
internal class InspectorSurface(context: Context, private val options: Bundle) : Closeable {
  private val surfaceColor = Color.parseColor(options.getString("surfaceColor"))
  val root = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(surfaceColor) }
  private val webview = WebView(context)
  private val loading = ProgressBar(context)
  private val error = TextView(context).apply {
    text = options.getString("error"); textSize = 14f; includeFontPadding = true
    val spacing = (16 * resources.displayMetrics.density).toInt()
    setPadding(spacing, spacing, spacing, spacing)
    setTextColor(Color.parseColor(options.getString("contentColor"))); visibility = View.GONE
  }
  private var url = ""

  init {
    root.addView(error)
    root.addView(loading, LinearLayout.LayoutParams(-2, -2).apply { gravity = Gravity.CENTER })
    root.addView(webview, LinearLayout.LayoutParams(-1, 0, 1f))
    webview.setBackgroundColor(surfaceColor)
    webview.settings.apply {
      javaScriptEnabled = true; domStorageEnabled = true; allowFileAccess = false; allowContentAccess = false
      javaScriptCanOpenWindowsAutomatically = false; setSupportMultipleWindows(false)
    }
    webview.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
        !request.url.toString().startsWith(url.substringBefore("devtools_app.html"))
      override fun onPageFinished(view: WebView, loaded: String) { loading.visibility = View.GONE }
      override fun onReceivedError(view: WebView, request: WebResourceRequest, failure: WebResourceError) {
        if (request.isForMainFrame) fail()
      }
    }
  }

  fun load(base: String) {
    // The upstream frontend ships these languages; the app's dock toolbar retains every app language.
    val language = if (options.getString("language") == "zh") "zh" else "en-US"
    val theme = if (options.getString("theme") == "dark") "dark" else "light"
    url = "$base&uiTheme=$theme&language=$language"
    webview.loadUrl(url)
  }

  fun fail() { loading.visibility = View.GONE; error.visibility = View.VISIBLE }
  fun hideKeyboard() {
    webview.windowInsetsController?.hide(WindowInsets.Type.ime())
    webview.context.getSystemService(InputMethodManager::class.java)
      .hideSoftInputFromWindow(webview.windowToken, 0)
    webview.clearFocus()
  }
  override fun close() { webview.destroy() }
}

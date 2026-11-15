package com.codexswitch.inspector

import android.app.Application
import android.os.Build
import android.webkit.WebView

object InspectorProcess {
  @JvmStatic fun isInspectorProcess(): Boolean = Build.VERSION.SDK_INT >= 30 &&
    Application.getProcessName().endsWith(":browser_inspector")

  @JvmStatic fun prepareProcess(): Boolean {
    if (!isInspectorProcess()) return false
    WebView.setDataDirectorySuffix("browser_inspector")
    return true
  }
}

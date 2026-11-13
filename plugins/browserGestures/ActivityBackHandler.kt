package com.codexswitch.browser

import android.os.Build
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.annotation.RequiresApi
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.ReactActivity

/** Route predictive Back through RN's existing screen handlers, including the legacy Back-key path. */
object ActivityBackHandler {
  fun install(activity: ReactActivity) {
    if (Build.VERSION.SDK_INT >= 33) Api33.install(activity)
  }

  // Isolate newer platform types so Android 7-12 can still load the activity.
  @RequiresApi(33)
  private object Api33 {
    @Suppress("DEPRECATION") // RN 0.79 exposes its JS BackHandler dispatch through this Activity method.
    fun install(activity: ReactActivity) {
      val dispatcher = activity.onBackInvokedDispatcher
      val callback = OnBackInvokedCallback { activity.onBackPressed() }
      activity.lifecycle.addObserver(object : DefaultLifecycleObserver {
        override fun onStart(owner: LifecycleOwner) {
          // Browser edge navigation has OVERLAY priority; the IME and modal windows keep their own Back.
          dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)
        }

        override fun onStop(owner: LifecycleOwner) {
          dispatcher.unregisterOnBackInvokedCallback(callback)
        }
      })
    }
  }
}

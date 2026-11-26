package com.codexswitch.browser

import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.webkit.WebView
import org.json.JSONObject

/** Let Chromium scroll the visual viewport or the nested frame under the cursor, just like a hardware wheel. */
internal fun scrollWebView(view: WebView, x: Double, y: Double, input: JSONObject) {
  val horizontal = input.optBoolean("horizontal")
  val axis = if (horizontal) MotionEvent.AXIS_HSCROLL else MotionEvent.AXIS_VSCROLL
  // Chromium negates both wheel axes. The panel reports right and up as positive.
  val notches = input.getDouble("delta").toFloat() / WHEEL_UNITS_PER_NOTCH
  val point = MotionEvent.PointerCoords().apply {
    this.x = x.toFloat(); this.y = y.toFloat()
    setAxisValue(axis, if (horizontal) -notches else notches)
  }
  val pointer = MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_MOUSE }
  val time = SystemClock.uptimeMillis()
  val event = MotionEvent.obtain(time, time, MotionEvent.ACTION_SCROLL, 1, arrayOf(pointer), arrayOf(point),
    0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_MOUSE, 0)
  try { view.dispatchGenericMotionEvent(event) } finally { event.recycle() }
}

private const val WHEEL_UNITS_PER_NOTCH = 120f

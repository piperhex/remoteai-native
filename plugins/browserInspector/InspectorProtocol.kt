package com.codexswitch.inspector

/** Private messages between the app and its non-exported surface service. */
internal object InspectorProtocol {
  const val OPEN = 1
  const val RESIZE = 2
  const val CLOSE = 3
  const val READY = 4
  const val FAILED = 5
  const val HIDE_KEYBOARD = 6
  const val MOUSE = 7
  const val TOUCH = 8
}

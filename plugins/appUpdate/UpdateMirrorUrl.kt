package com.codexswitch.update

import java.net.URI

/** Mirrors contribute bytes only; official digests and installed-app signatures remain authoritative. */
internal fun validMirrorUrl(value: String, official: String): Boolean = try {
  val mirror = URI(value)
  val source = URI(official).rawPath
  val native = source.startsWith("/piperhex/remoteai-native/releases/download/")
  val repository = if (native) "remoteai-native" else "remoteai"
  val endpoint = if (native) "native-update-packages" else "update-packages"
  val path = source.removePrefix("/piperhex/$repository/releases/download/")
  officialUrl(official) && mirror.scheme == "https" && !mirror.host.isNullOrEmpty() &&
    mirror.userInfo == null && mirror.rawQuery == null && mirror.rawFragment == null &&
    mirror.rawPath.endsWith("/$endpoint/" + path)
} catch (_: Exception) { false }

internal fun officialUrl(value: String): Boolean = try {
  val uri = URI(value)
  uri.scheme == "https" && uri.host == "github.com" && uri.port == -1 && uri.userInfo == null
    && uri.query == null && uri.fragment == null
    && (uri.path.startsWith("/piperhex/remoteai-native/releases/download/")
      || uri.path.startsWith("/piperhex/remoteai/releases/download/")) && uri.path.endsWith(".apk")
} catch (_: Exception) { false }

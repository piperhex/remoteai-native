package com.codexswitch.update

fun main() {
  val native = "https://github.com/piperhex/remoteai-native/releases/download/v2.2.1/android.apk"
  val legacy = native.replace("remoteai-native", "remoteai")
  val nativeMirror = "https://example.test/api/native-update-packages/v2.2.1/android.apk"
  val legacyMirror = nativeMirror.replace("native-update-packages", "update-packages")
  check(officialUrl(native) && officialUrl(legacy))
  check(validMirrorUrl(nativeMirror, native) && validMirrorUrl(legacyMirror, legacy))
  check(!validMirrorUrl(legacyMirror, native) && !validMirrorUrl(nativeMirror, legacy))
  for (invalid in listOf(native.replace("remoteai-native", "remoteai-native-evil"),
    native.replace("https:", "http:"), native + "?redirect=other", native + "#fragment",
    native.replace("github.com", "github.com.evil.test"), native.replace("github.com", "user@github.com"))) {
    check(!officialUrl(invalid))
  }
  check(!validMirrorUrl(nativeMirror + "?redirect=other", native))
  check(!validMirrorUrl(nativeMirror.replace("android.apk", "other.apk"), native))
  println("PASS: native and legacy official update URLs and isolated mirrors")
}

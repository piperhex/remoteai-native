# Android local chat packet profiling

## Selected change and result, 2026-11-17

The Android packet codec decoded each hex digit with `String.indexOf`, scanning the digit alphabet
twice per output byte. Replacing those searches with a strict ASCII lookup table raised local
16,000-byte packet decoding/decryption throughput from **25.62 to 85.62 MiB/s** (median, 3.34 times).
The production change is confined to `plugins/chatPacketCipher/PacketCipher.kt`.

Lowercase-only validation, packet bounds, authentication, nonce construction, input wiping and the
wire format are unchanged. Cipher/key caching and Android performance hints were also evaluated;
neither showed a consistent LAN benefit, so neither is part of the production change. The optional
hint diagnostic remains in the isolated instrumentation fixtures.

This is a local CPU improvement. **The foreground LAN comparison did not demonstrate higher overall
throughput:** medians were 8.00 MiB/s before and 7.91 MiB/s after. Receiver decode/decrypt time fell
from 2.092 to 0.968 seconds for the same roughly 31.3 MiB plaintext transfer. Transport, feeding and
scheduling still need investigation before claiming the overall chat transfer bottleneck is solved.

## Device and measurement boundaries

- Physical Xiaomi 2109119BC, Android 15 / API 35, `AndroidOpenSSL` provider 1.0.
- Local benchmark: no network, desktop sender, React Native bridge, JSON parsing, rendering or storage.
  Packets contain uncompressed ASCII at 2,400 and 16,000 plaintext bytes. Unicode, compression and
  authentication are checked separately for correctness, not represented by these throughput figures.
- Final local A/B: same process, frozen Native `0616e48` codec versus the current codec; 512 warmup
  iterations, three rounds of 2,048 operations per case, with alternating old/new order. Volatile
  output references retain the decoded bytes/text so output generation cannot be optimized away.
- LAN A/B: Rust desktop crypto/direct RTC sender, one connection and one Android receiver worker,
  six alternating old/new runs of 2,048 packets. Each run checks every resulting plaintext.
  An idle Activity keeps the test process foreground without starting the React Native app.
- Only isolated `com.codexswitch.mobile.downloadtest` and `.downloadtest.test` packages were installed.
  The normal app, account data and device power/CPU scheduling settings were not changed.
- MiB/s counts useful plaintext bytes, using 1 MiB = 1,048,576 bytes. The existing hex text wire format
  uses roughly twice as many ciphertext characters; these rates are not Wi-Fi link speeds.

## Local stage isolation

Original codec, 1,024 operations with 16,000-byte plaintext, three-round median:

| Stage | Time, ms |
| --- | ---: |
| Complete hex decode, authenticated decrypt and UTF-8 decode | 608.590 |
| Hex decoding alone | 470.979 |
| Fresh cipher/key initialization and AAD | 14.475 |
| AEAD decryption alone, initialization excluded | 32.598 |
| UTF-8 decoding alone | 48.669 |

These independently timed stages do not sum exactly: allocation, copying and timing boundaries differ.
The hex stage accounts for approximately 77% of the original complete-path time. Pure AEAD work is
much faster; disabling encryption is unnecessary for this optimization.

Final same-process comparison (all three rounds, useful MiB/s):

| Plaintext size | Original runs | Lookup runs | Original median | Lookup median |
| --- | --- | --- | ---: | ---: |
| 2,400 bytes | 21.84, 22.43, 22.42 | 59.85, 58.34, 36.02 | 22.42 | 58.34 |
| 16,000 bytes | 25.53, 25.62, 25.70 | 85.44, 86.22, 85.62 | 25.62 | 85.62 |

The slower third small-packet sample is retained. The final 16,000-byte hex-only stage reached
290.22 MiB/s median, compared with 33.18 MiB/s in the initial stage-isolation run. The complete-path
A/B is stronger evidence than comparisons across separately started processes.

## Foreground LAN comparison

Each row transferred 32,781,226 plaintext bytes. Hints were disabled and every plaintext matched.

| Run | Decoder | Useful MiB/s | Decode/decrypt wall time, ms | Decode/decrypt CPU time, ms |
| --- | --- | ---: | ---: | ---: |
| 0 | Original | 6.925 | 2305.689 | 1996.077 |
| 1 | Lookup | 7.311 | 967.596 | 745.992 |
| 2 | Original | 8.000 | 2080.539 | 1748.956 |
| 3 | Lookup | 7.907 | 997.955 | 756.041 |
| 4 | Original | 8.173 | 2091.899 | 1735.595 |
| 5 | Lookup | 8.248 | 941.396 | 733.966 |

Earlier background runs often placed the lighter lookup decoder on cores 0-2, whose reported CPU
capacity was 378, while the heavier original ran on cores 5-6 with capacity 957. Samples recorded
the same nice value, 0. This is evidence of different scheduling, not proof of the sole limiting
factor. Advisory performance hints did not consistently improve throughput. CPU affinity, priority
and power settings were not forced. The foreground comparison above reduces one source of ambiguity.

## Reproduction

From this Native repository, regenerate Android plugin sources before building:

```powershell
node scripts/expo.cjs prebuild --platform android --no-install
Set-Location android
.\gradlew.bat -I ../e2e/downloads.init.gradle -I ../scripts/download-throughput.init.gradle `
  :app:assembleDebug :app:assembleDebugAndroidTest -PreactNativeArchitectures=arm64-v8a
Set-Location ..
$env:PATH = "$env:ANDROID_HOME/platform-tools;$env:PATH"
adb -s <serial> install -r android/app/build-download-throughput/outputs/apk/debug/app-debug.apk
adb -s <serial> install -r android/app/build-download-throughput/outputs/apk/androidTest/debug/app-debug-androidTest.apk
node scripts/benchmark-chat-packet-android.mjs <serial> <report.json> lookup 2048
adb -s <serial> shell am instrument -w -e class `
  com.codexswitch.downloads.PacketCipherCompatibilityTest,com.codexswitch.downloads.BulkRecordCipherTest `
  com.codexswitch.mobile.downloadtest.test/com.codexswitch.downloads.DownloadTestRunner
```

The local runner checks instrumentation success and 49 JSON status records, saving raw output, device
metadata and source/APK SHA-256. Valid iteration counts are 64-8192. Build and test jobs must finish
before collecting timed comparisons. The foreground Activity and manifest are injected only by
`scripts/download-throughput.init.gradle`; ordinary builds do not include them.

For LAN reproduction in the parent Remote AI checkout, start its isolated Vite RTC fixture and use
the optimized Rust test executable as described in `docs/chat-sync-throughput.md`. Then, from that root:

```powershell
$env:P2P_BENCH_CHAT = '1'
$env:P2P_BENCH_CHAT_CRYPTO = 'rust'
$env:P2P_BENCH_CHAT_COMPARE = '1'
$env:P2P_BENCH_CHAT_LEGACY = '0'
$env:P2P_BENCH_CHAT_HINT = '0'
$env:P2P_BENCH_CHAT_FOREGROUND = '1'
$env:P2P_BENCH_NATIVE_APP = '0'
$env:P2P_BENCH_RUST = '0'
Remove-Item Env:NATIVE_RTC_TEST_LOOPBACK -ErrorAction SilentlyContinue
node scripts/benchmark-android-data-channel.mjs <serial> <report.json> 256 16 <test-executable>
```

`P2P_BENCH_CHAT_LEGACY=1` selects the old codec when comparison mode is off.
`P2P_BENCH_CHAT_HINT=1` enables the experimental hint diagnostic only for the new codec.
Do not launch the full desktop app for these measurements. After testing, remove only the isolated
packages and the benchmark's ADB reverse rule, and stop its Vite process:

```powershell
adb -s <serial> uninstall com.codexswitch.mobile.downloadtest.test
adb -s <serial> uninstall com.codexswitch.mobile.downloadtest
# The LAN runner normally removes this rule in its finally block.
adb -s <serial> reverse --list
# If the benchmark's tcp:18786 rule remains:
adb -s <serial> reverse --remove tcp:18786
```

## Evidence and validation

The parent checkout retains raw reports under `.codex-tmp/`; LAN reports can contain network addresses
and are intentionally not committed:

- `android-packet-baseline.json`: original stage isolation.
- `android-packet-selected-final.json`: final lookup-only local A/B.
- `android-packet-lan-foreground.json`: final foreground LAN A/B.
- `android-packet-lan-hex-only.json`: background lookup-only A/B.
- `android-packet-lan-scheduling.json` and `android-packet-lan-hint-trial.json`: scheduling experiments.
- `android-packet-final-tests.log`: nine passing actual-device crypto tests.
- `android-packet-foreground.png`: inspected Android light-mode idle foreground fixture screenshot;
  captured during a separate visual-only run, whose timings are excluded from the tables.

Final measured production source SHA-256:
`7d0f57e138dfe977e1e97d8c201e7297600bc265639e658dc531952b1e9030fd`.
Final measured app APK SHA-256:
`f8e817632c7ecf1e383e3794700a924f8f847a149e4016a6ef8f55c170bb194c`.

Validation passed: isolated Android APK builds, nine physical-device crypto tests, Native type and
generated-asset checks, 1,513 Native tests across 274 suites, Native i18n checks, and 17 portable
desktop crypto tests. Device tests include the fixed Web/Noble wire vector in both directions,
strict hex validation, Unicode/BOM/NUL, tamper/truncation/wrong-AAD rejection, subsequent valid packets,
compression, binary AAD, concurrent calls and destruction.

This Android implementation optimization preserves browser/iOS wire behavior and requires no Web
implementation change. No product UI changed. These fixtures do not verify a complete installed-app
chat synchronization flow, account integration, or a production release.

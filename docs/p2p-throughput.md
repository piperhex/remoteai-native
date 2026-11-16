# Android P2P throughput benchmark

## Android emulator measurement, 2026-11-16

The receiver was the Android 15 / API 35 Pixel 9 x86_64 emulator, with four virtual CPU cores
and 2 GiB RAM. A separately installed test application used the production `MobileChatConnection`,
`downloadManager`, native binary router, authenticated block decryption, Kotlin file writer, whole-file
verification and Android Downloads publication. It ran bundled Hermes with development mode disabled.
No transport, file response, policy or storage implementation was replaced.

The production source revision was `9c1d464c2debc6640bde2307b94fa1bdfe83a888` with its committed
dependency snapshots. The sender was the installed Remote AI desktop host on the ZH2 Windows VM.
Three sequential downloads used the same 128 MiB random file. Its SHA-256 was computed independently
on ZH2 and checked again against each exported Android file, in addition to protocol verification.
The same file was then downloaded three times using the parent project's repaired Chromium receiver.
Builds and test suites were stopped before measurements.

| Receiver | Runs (MiB/s) | Mean (MiB/s) | Independent SHA-256 |
| --- | --- | --- | --- |
| Android native, emulator | 4.04, 3.87, 4.00 | 3.97 | 3/3 passed, including exported files |
| Chromium production shared downloader | 11.55, 11.69, 11.58 | 11.61 | 3/3 passed |
| Android native, fresh-connection cleanup verification | 2.86 | 2.86 | 1/1 passed, including exported file |

Native throughput is approximately 4.17 decimal MB/s. Downloading took 31.65, 33.04 and 32.00 seconds.
Including final verification and publication, the respective durations were 32.16, 33.65 and 32.40 seconds.
Timing uses native task status events received by JS, so it includes event-delivery scheduling latency.
Preparation, including manifest negotiation, and the additional independent saved-file hash are excluded.
The later fresh-connection run verified runner cleanup after its final change. Its download took 44.74
seconds (45.70 seconds through publication). It demonstrates variation between connections; 3.97 MiB/s
is the first three-run session's mean, not a stable emulator ceiling.

All native samples used the application's `direct` bulk path and processed 134,949,888 encrypted wire
bytes for 134,217,728 useful bytes. The connection diagnostic endpoints were public mapped UDP addresses
on the same public IP. Those diagnostics describe the connection; they do not prove a LAN-address route
for the separate file channel. Emulator NAT and CPU/storage scheduling differ from a physical phone.
These results must not be presented as real-device Wi-Fi throughput or an isolated platform comparison.

Native counters reported 4.56-4.93 seconds of record decryption, 0.51-0.86 seconds of block plus final
verification, 0.14-0.15 seconds inside block writes, and 0.13-0.23 seconds of final publication per sample.
The write counter does not include all checkpoint/fsync work, and these counters do not account for the
whole transfer duration. The remaining time requires transport and scheduling profiling; this benchmark
does not establish the cause of the lower native speed. The earlier IndexedDB commit fix does not alter
Android's separate native writer.

The parent checkout retains raw local reports in `.codex-tmp/p2p-android/native.json`, `browser.json`
and `cleanup-check.json`.
They include connection addresses and are intentionally not committed. They contain no account tokens.

## Physical Android follow-up, 2026-11-16

The physical receiver was a Xiaomi 2109119BC running Android 15 (arm64), connected over 5 GHz Wi-Fi 6.
The benchmark still used a separate production Hermes package and verified every published file against
the independently calculated SHA-256 of the same 128 MiB random source. ADB carried configuration and
results only. Packet headers correlated with the selected file-channel port confirmed LAN-address traffic
from ZH2 to the phone; this supersedes the emulator's inconclusive route observation for these runs only.

| Sender / Android receiver | Three runs (MiB/s) | Mean | Integrity |
| --- | --- | --- | --- |
| Installed ZH2 / original Android, clean recheck | 6.22, 6.54, 6.54 | 6.43 | 3/3 saved-file hashes passed |
| Installed ZH2 / bounded socket receive buffer and native optimizations | 10.34, 10.47, 10.41 | 10.40 | 3/3 passed |
| Local release desktop / Rust file encryption, optimized Android | 10.31, 9.71, 9.36 | 9.79 | 3/3 passed |

The original file socket had a 224 KiB receive buffer and thousands of UDP drops. During the clean
baseline recheck, the phone's UDP `RcvbufErrors` increased by 2,653. The bundled M124 WebRTC factory now
requests a bounded 1 MiB socket receive buffer before initialization. Linux reported a doubled 2 MiB
socket accounting limit and zero drops on the active file socket; the clean three-run fix session added
no system UDP receive-buffer errors. The same-source improvement was approximately 62%.
This uses the supported `WebRTC-SetSocketReceiveBuffer/Enabled-1024/` field trial, preserves an existing
explicit setting, and changes neither system sysctls nor the application request window. The upstream
[M124 transport implementation](https://raw.githubusercontent.com/jitsi/webrtc/M124/p2p/base/p2p_transport_channel.cc)
parses the value in KiB and applies `OPT_RCVBUF`.

The Android decoder also reuses its cipher/key provider objects while initializing every record's
distinct nonce, and reads AAD/ciphertext slices without making intermediate arrays. The observer caches
the immutable channel label and reflection lookup. Cipher reuse alone reduced measured decryption time
but did not establish an end-to-end throughput gain; neither did the dispatch cache in isolation.
Decryption in the clean socket-fix session took 1.65-1.69 seconds per file. Summed record queue times
overlap across records and must not be treated as additional wall-clock stalls. A Wi-Fi low-latency lock
experiment did not demonstrate a clear improvement and was removed.

The Rust sender is a different source computer, so its results do not isolate the effect of replacing
JavaScript encryption. It passed real Android decryption, block hashes, final hashes and publication.
A later diagnostic session with thread sampling measured 9.10, 8.47 and 8.90 MiB/s; it is not a clean
comparison. Initial test-host setup attempts failed before file transfer, and one earlier socket-fix
attempt lost its connection partway through. Subsequent successful runs do not prove those transient
connection failures resolved. The runner now writes failure reports as well as successes.

Raw TCP streaming of the same file measured 31.84 MiB/s from ZH2 and 29.64 MiB/s from the local computer.
The phone-side hashes passed. These timings cover sender writes and shutdown, including socket buffering;
they exclude the production encrypted protocol and are not product download rates. They show remaining
headroom, not a proven hardware ceiling. Rust migration did not eliminate the approximately 10 MiB/s
product limit. A test-only larger sender DataChannel buffer gave 10.88 MiB/s in one sample, insufficient
evidence to change the production buffer policy. It was reverted.

Local reports are under the parent `.codex-tmp/p2p-phone/`: `baseline-repeat.json`, `socket-repeat.json`,
`rust-phone-final.json`, `rust-cpu-final.json` and `rust-buffer-experiment.json`. Source file contents and
credentials are excluded. Reports now identify APK SHA-256, native revision and dirty status.

Final validation includes native checks, 1,513 unit tests and 46 physical-device instrumentation tests,
covering authenticated cipher reuse, replay/corruption, cancellation, resume, storage and socket setup.
The browser cannot set Android socket options; its shared authenticated protocol and download behavior
remain compatible. These Android-specific changes do not require advancing Native's pinned shared
dependency snapshot; the Rust sender interoperates with that existing protocol.

## Reproduction

Select a physical Android device or emulator explicitly. Create a disposable random file on an authorized,
signed-in desktop host, and independently calculate its SHA-256. From this repository, build the
isolated package using the current generated Android project:

```powershell
$env:NODE_ENV = 'production'
# Use arm64-v8a for the physical phone; x86_64 below is for the emulator.
cd android
./gradlew.bat :app:assembleDebug -I ../scripts/p2p-benchmark.init.gradle -PreactNativeArchitectures=x86_64
cd ..
node scripts/benchmark-p2p-android.mjs `
  --serial emulator-5580 --apk android/app/build-p2p-benchmark/outputs/apk/debug/app-debug.apk `
  --device <source-device-id> --file <source-file> --sha256 <source-sha256> `
  --server <server-url> --auth-file <saved-cloud-auth.json> --runs 3 --output .codex-tmp/p2p.json
```

The fixed test package is `com.codexswitch.mobile.p2pbenchmark`. Its debug build type is explicitly
non-debuggable and includes a production Hermes bundle. Existing installed app data is independent.
ADB reverse on port 18786 carries only configuration/results to a loopback control server. All file
bytes go through the normal authenticated P2P connection. Credentials are never bundled or printed;
the normal native session store is cleared after the run, and the runner clears this test package's
data on exit. Downloaded benchmark files are deleted after each verified sample. Remove the disposable
source file, test package and emulator process when no longer needed.

The fixture is Android-specific. It changes no product UI or production download code, so mobile web
does not require a corresponding behavior change. Native type checking, 1,510 tests, translation checks
and the Android test APK build passed.

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

## Reproduction

Start an explicitly selected Android emulator. Create a disposable random file on an authorized,
signed-in desktop host, and independently calculate its SHA-256. From this repository, build the
isolated package using the current generated Android project:

```powershell
$env:NODE_ENV = 'production'
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

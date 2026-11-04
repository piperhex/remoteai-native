# Remote AI Native

Android and iOS application, independently maintained and released from
[piperhex/remoteai-native](https://github.com/piperhex/remoteai-native).
The desktop repository includes this repository as the optional `apps/native` submodule.

## Development

Use Node.js 22 and npm. No parent checkout or other submodule is needed:

```sh
npm ci
npm run check
npm test
npm run check:i18n
npm run export:android
npm run export:ios
npm start
```

`npm run prebuild:android` generates the Android project; `npm run build:apk` builds and verifies
all four supported Android ABIs. Android builds require Java 17, the Android SDK/NDK, Rust,
`cargo-ndk` 4.1.2, CMake and protoc. iOS builds require macOS, Xcode, CocoaPods, Rust and protoc.
See `.github/workflows/build.yml` for the complete toolchain and build commands.

## Independent releases

Pushes to `main` and pull requests run checks, Android and iOS bundle exports, and complete native builds.
The **Native builds** workflow can also build any commit, branch or tag without publishing a release.

Prepare a version, verify it, and push its annotated tag:

```sh
npm run version:native -- 2.2.1
npm run check
npm test
npm run check:i18n
git add package.json package-lock.json app.json
git commit -m "chore(release): v2.2.1"
git push
git tag -a v2.2.1 -m "Remote AI Native v2.2.1"
git push origin v2.2.1
```

Tags `v*` run **Native release**. The tag must agree with the package, Expo version and Android version code.
Both platform builds must succeed before publishing the APK, unsigned iOS `.app.zip` and `SHA256SUMS` to
this repository's GitHub Releases. `v2.2.1-beta.0` creates a prerelease. The workflow can retry an existing tag.
It uses this repository's `GITHUB_TOKEN` and requires no parent repository token or desktop release.
Set `IOS_BUNDLE_IDENTIFIER` as a repository variable when using a different Apple App ID.

The Android build preserves the existing Expo/Gradle signing setup. The iOS archive is unsigned, as it was
before the split; publishing to TestFlight or the App Store requires a separate Apple signing workflow.
The app's update check and release links now use this repository.

## Shared dependencies and translations

`vendor/` is a generated snapshot of reachable shared/application source dependencies and the native Rust crates.
`vendor/source-lock.json` records the parent and shared repository revisions and every source file's SHA-256.
Shared hooks use native React through Metro/Vitest, while embedded browser documents retain React 18.
Update source in its owning repository, then refresh from a compatible desktop checkout:

```sh
npm run export:native -- /path/to/remoteai-native
```

Back in this repository, run `npm install`, `npm run generate:assets`, `npm run generate:i18n` and all checks.
Commit the snapshot, generated assets and lockfile together. Do not hand-edit generated dependencies.
The export includes Web adapters used by parity tests, so these tests also run without a parent checkout.

Translations come from the pinned release of [`@remoteai/i18n`](https://github.com/piperhex/remoteai-i18n).
`i18n.config.json` maps its native permission resources to `locales/`; `npm run check:i18n` verifies these
generated files and application translation ownership. Preserve all existing language and offline behavior.

# Agent Notes

- Keep these instructions in English. This repository owns the Remote AI Android and iOS app.
- Install and validate from this repository: `npm ci`, `npm run check`, `npm test`, and `npm run check:i18n`.
  Run both `npm run export:android` and `npm run export:ios` after changing dependency or bundler configuration.
- `vendor/` contains generated, versioned dependency snapshots. Do not edit them manually. Refresh from a
  compatible `piperhex/remoteai` checkout using `npm run export:native -- /path/to/remoteai-native`.
  Review `vendor/source-lock.json`, regenerate assets, update the lockfile, and rerun the checks.
- Translation resources belong to the independently released `@remoteai/i18n` package. Use its public exports,
  retain language availability and fallback rules, and regenerate platform files with `npm run generate:i18n`.
- Preserve mobile web parity in `piperhex/remoteai` for feature changes. UI changes require inspected screenshots
  from the running native app and mobile web. Context menus must support both right-click and touch long-press.
- Native text must use `textMetrics()` from `src/theme/text.ts`. Verify Chinese glyphs and navigation on a
  physical Android device at font scales 1.0 and 1.3; report any unavailable physical-device verification.
- Preserve the parent project's clean-code constraints, public protocol behavior and platform adaptations.
- Releases belong to this repository. Tags are `v<package.json version>` and publish Android APK and unsigned
  iOS application archives after checks pass. Do not trigger parent desktop releases from this CI.
- Automatically commit and push verified task changes to the configured upstream. Do not include unrelated
  work, bypass failed checks, or force-push. Merge remote updates and rerun checks; abort a conflicted merge.
  Push this repository before updating the parent `apps/native` gitlink.

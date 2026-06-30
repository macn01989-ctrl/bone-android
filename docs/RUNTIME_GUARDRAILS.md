# Runtime Guardrails

This project has two frontend surfaces:

- `src/`: maintainable React source.
- `recovery/good-apk-public/`: the runtime assets copied into the Android APK.

The APK uses `recovery/good-apk-public`. Do not replace it with a fresh Vite build unless the runtime behavior has been audited and the baseline below is intentionally updated.

## Protected Baseline

The current protected baseline is stored in:

```text
docs/runtime-guardrails-baseline.json
```

It records:

- Critical runtime file sizes and SHA256 hashes.
- The runtime route set.
- The active UI function markers in the minified bundle.
- Required Capacitor and custom Android plugin registrations.
- Runtime storage keys.
- Recommendation catalog counts and cover-file counts.
- Known CSS selectors that are present but not active in the runtime JS.

## Verify Before Building

Run this before any APK build or runtime edit:

```powershell
npm run verify:runtime-guardrails
```

The safe Android build path runs it automatically:

```powershell
npm run build:android:safe
```

If this check fails after an intentional runtime change, stop and review the diff first. Update `docs/runtime-guardrails-baseline.json` only after confirming the change keeps the original page details, gestures, popups, platform jumps, storage keys, and Android plugin hooks intact.

## Current Runtime Pages

The current runtime page entries are:

- `home`
- `note`
- `notes`
- `recorder`
- `podcast`
- `album`
- `favorites`
- `settings`

The minified runtime UI functions are:

- `fr`: app shell, routing, toast, back handling.
- `pr`: home gesture entry.
- `mr`: note editor.
- `gr`: notes wall.
- `hr`: recorder.
- `yr`: settings.
- `Cr`: podcast recommendation.
- `Tr`: album recommendation.
- `wr`: album style tag fitting helper.
- `Er`: favorites wall.
- `Dr`: placeholder fallback.

## Production Rule

For each change:

1. Identify the exact page, runtime function, CSS class, storage key, and plugin surface affected.
2. Run the guardrail check.
3. Make the smallest possible change.
4. Run the guardrail check again.
5. Build one APK and verify it separately.

Do not do broad rewrites of minified JS or CSS. If a runtime patch is unavoidable, use an exact string replacement script and keep the baseline update in the same reviewed change.

# Nearby Display + Controller Monorepo Design

## Goal

Bring the existing Display and Controller React/WebView Android apps into one parent repository, make their local Nearby Connections contract compatible, and produce two APKs that can be installed on the connected pad and plus devices.

## Current state

- Both source repositories are Vite + React apps with committed Android WebView wrappers.
- Both already depend on Google Play Services Nearby Connections `19.3.0`.
- Both expose a JavaScript-to-native `AndroidNearby` bridge and declare the required Bluetooth/Wi-Fi permissions.
- Display advertises and applies incoming payloads; Controller discovers displays and sends JSON state.
- Firebase room `444` remains available as the browser/hybrid fallback.
- The Nearby service IDs currently differ:
  - Display: `hic_rhodus_p2p`
  - Controller: `com.example.hicrhodus.p2p`

## Recommended repository layout

Use a new parent Git repository with two independent apps and one shared protocol package:

```text
apks_studio/
  apps/
    display/       # Display repository contents, including app/ Android project
    controller/    # Controller repository contents, including app/ Android project
  packages/
    nearby-protocol/
      README.md
      protocol.json
  docs/superpowers/specs/
```

The apps remain separately buildable and installable. The shared package is intentionally small and contains the canonical service ID plus the JSON payload/version contract. Native Kotlin code will consume the same values through generated/copied constants during the build rather than relying on runtime networking.

## Connection contract

1. Set one canonical service ID to `hic_rhodus_p2p` in both apps.
2. Keep `Strategy.P2P_STAR`.
3. Preserve the existing role split: Display advertises; Controller discovers and sends.
4. Keep payloads as UTF-8 JSON bytes and document the fields currently sent by Controller and consumed by Display.
5. Preserve Firebase as a fallback; do not remove or redesign it in this change.
6. Add a visible native/bridge status path for discovery, connection, and payload errors so installation testing can distinguish permissions from protocol mismatches.

## Build and installation flow

1. Install JavaScript dependencies with the repository's existing Bun lockfiles.
2. Run each app's Vite build so the output is copied into its Android assets directory.
3. Build each Android wrapper with the Gradle wrapper (`display` and `controller` independently).
4. Detect the two connected Android devices by `adb`; identify the pad and plus device from model/serial instead of assuming device order.
5. Install Display APK only on the pad and Controller APK only on the plus device.
6. Launch both apps, grant Nearby permissions if prompted, and verify: Display advertising → Controller discovery → connection → controller payload → display state update.

## Alternatives considered

### Separate repositories

Lowest migration effort, but the service ID and payload contract can drift again and coordinated changes require two commits/releases.

### Git submodules

Keeps upstream history isolated, but makes local development and shared protocol changes cumbersome; device builds still require coordinating two checkouts.

### One role-switching Android app

Avoids duplication but changes the user-facing deployment model and increases runtime complexity. It also makes it harder to guarantee that the pad only runs Display and the plus device only runs Controller.

The parent monorepo with two apps and a tiny shared contract is the recommended balance.

## Verification criteria

- Both apps build successfully from the parent repository.
- The two APKs install on the intended devices.
- Controller discovers Display over Nearby without Firebase.
- A representative controller state change is received and applied by Display.
- Browser/PWA mode continues to use Firebase when `window.AndroidNearby` is unavailable.
- No device-specific serials, secrets, or Firebase credentials are committed.

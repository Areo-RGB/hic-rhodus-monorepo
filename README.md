# APKs Studio Monorepo

This monorepo contains two paired app stacks for the same nearby experience:

- Display: a Vite/React web app wrapped by a Kotlin Android WebView app for the pad device.
- Controller: a Vite/React web app wrapped by a Kotlin Android WebView app for the plus device.

## Setup

Install dependencies and verify the shared Nearby contract before building the Android apps:

```bash
bun install
bun run check:nearby
bun run build:apps
```

## APK Outputs

After `bun run build:apps`, the debug APKs are produced at:

- `apps/display/app/build/outputs/apk/debug/app-debug.apk`
- `apps/controller/app/build/outputs/apk/debug/app-debug.apk`

## Device Roles

- Display package `com.aistudio.paulportfolio.kzmpxr` goes on the pad.
- Controller package `com.aistudio.paulportfolio.likiod` goes on the plus device.
- Xiaomi 2410CRP4CG / serial supplied at install time = pad / Display.
- OnePlus CPH2399 / serial supplied at install time = plus / Controller.

Install and launch both role-specific debug APKs with explicit device serials:

```powershell
.\scripts\install-devices.ps1 -PadSerial <pad-serial> -PlusSerial <plus-serial>
```

## Nearby Contract

- Service ID: `hic_rhodus_p2p`
- Strategy: `P2P_STAR`
- Display advertises.
- Controller discovers and sends UTF-8 JSON bytes.

## Browser and PWA Fallback

When `window.AndroidNearby` is unavailable, the browser/PWA fallback uses Firebase room `444`.

## Troubleshooting

The expected native status sequence is:

`advertising` -> `found_device` -> `connecting` -> `connected`

If the sequence stalls before `advertising` or discovery never starts, check Android Nearby and location permissions first. Permission failures usually prevent advertising or scanning from ever beginning, or leave the UI stuck before it can report the normal sequence.

If both devices appear healthy but never progress from discovery to a stable connection, verify the service ID on each side. A `hic_rhodus_p2p` mismatch typically looks like one device advertising while the other never reports `found_device`, or it repeatedly scans without moving on to `connecting`.

If `window.AndroidNearby` is missing in a browser or PWA environment, that is expected. In that case the apps should use Firebase room `444` instead of native Nearby, which is the intended fallback when the Android bridge is unavailable.

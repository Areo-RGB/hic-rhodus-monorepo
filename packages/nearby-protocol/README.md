# Nearby Protocol

This package defines the shared Nearby Connections contract for the native apps.

- Display advertises with Google Nearby Connections.
- Controller discovers and sends.
- Both use `P2P_STAR`.
- Payloads are UTF-8 JSON bytes.
- Firebase room `444` remains the browser/hybrid fallback.
- The native Kotlin managers must match `protocol.json`.

For monorepo setup, APK output paths, package-to-device mapping, and troubleshooting guidance, see the root [README](../../README.md).

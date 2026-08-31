# Hic Rhodus Native Compose Rewrite

## Goal

Create a standalone Android Jetpack Compose implementation in `native-rewrite` that reproduces the webapp's role selection, local training, duo display/controller flows, Nearby P2P sync, player presets, manual grid, and activity log without WebView or JavaScript.

## Architecture

The rewrite is a single Android application using Compose and Material 3. `MainActivity` hosts a role-driven navigation state, `RhodusViewModel` owns immutable UI state and the training coroutine, and `NearbyManager` exposes connection status and payload events through callbacks/flows. Display and controller share the same JSON payload contract (`activeCellIndex`, `changeCount`, `colors`, `countdown`).

## UX and behavior

- Dark, edge-to-edge UI with German labels and the existing four-color 2×2 grid.
- First launch shows Display, Controller, and Solo/Local role choices; role is persisted.
- Local/controller modes support interval + target flashes, start/stop, manual grid flashes, editable player intervals, connection status, and logs.
- Display mode advertises and renders incoming grid/countdown payloads.
- Nearby uses service id `hic_rhodus_p2p` and `P2P_STAR`; runtime permissions remain explicit for Android 12+.

## Testing

Unit tests cover next-cell selection, target completion, and payload serialization. A Compose test verifies role selection renders the three entry points. Gradle debug compilation is the completion gate.

# Native Compose Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Build a self-contained native Compose app under `native-rewrite` that replaces the current WebView frontend.

**Architecture:** One Android app with a role-driven Compose UI, a coroutine-based training engine, and a native Nearby P2P transport. Existing webapp and `app` module remain untouched.

**Tech Stack:** Kotlin, Android Gradle Plugin, Jetpack Compose Material 3, Kotlin coroutines, Google Nearby Connections, JUnit/Compose UI tests.

**Spec:** `docs/superpowers/specs/2026-08-31-native-compose-rewrite-design.md`

## Global Constraints

- Native UI only; no WebView or JavaScript bridge.
- Preserve service id `hic_rhodus_p2p`, strategy `P2P_STAR`, and payload field names.
- Preserve German-facing labels and dark four-color training experience.

---

### Task 1: Native project scaffold and Compose screens

**Files:** Create the complete `native-rewrite` Gradle project, `MainActivity.kt`, `RhodusScreen.kt`, theme/resources.

**Deliverable:** App launches into role selection and can render Local, Controller, and Display screens with shared grid/components.

### Task 2: Training engine and tests

**Files:** Create `native-rewrite/app/src/main/java/com/aistudio/paulportfolio/rhodus/TrainingEngine.kt` and unit tests.

**Deliverable:** Deterministic sequencing, countdown, target completion, manual flash state, and payload model with tests.

### Task 3: Nearby transport and integration

**Files:** Create `NearbyManager.kt`, manifest permissions, and ViewModel integration.

**Deliverable:** Native advertising/discovery, connection state, payload send/receive, and permission requests.

### Task 4: Verification and polish

**Files:** Compose smoke tests, README for `native-rewrite`, final integration fixes.

**Deliverable:** Debug build and tests pass; app behavior is documented.

# Nearby Display + Controller Monorepo Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a parent monorepo containing the existing Display and Controller Android WebView apps, align their Nearby Connections contract, build both APKs, and install them on the connected pad and plus devices.

**Architecture:** Keep `apps/display` and `apps/controller` as separate Vite/React projects with their existing Kotlin WebView wrappers and package IDs. Add `packages/nearby-protocol` as the canonical service/payload contract and a root validator that checks both native managers. Build each Vite bundle into its app's Android assets, then build and install each APK independently.

**Tech Stack:** React 19, Vite 6, TypeScript 5.8, Bun, Kotlin/Android Gradle Plugin 9.1.1, Google Play Services Nearby Connections 19.3.0, Firebase fallback, Android Debug Bridge.

## Global Constraints

- Display advertises; Controller discovers and sends.
- Both native managers use service ID `hic_rhodus_p2p` and strategy `P2P_STAR`.
- Keep UTF-8 JSON byte payloads and Firebase room `444` fallback.
- Keep package IDs `com.aistudio.paulportfolio.kzmpxr` (Display) and `com.aistudio.paulportfolio.likiod` (Controller).
- Never commit `.env`, credentials, keystores, device serials, or generated Gradle build directories.
- Do not merge both roles into one runtime app.

---

### Task 1: Import both repositories into the parent monorepo

**Files:**
- Create: `apps/display/` from `Areo-RGB/Display-paul-react.vercel.app`
- Create: `apps/controller/` from `Areo-RGB/controller-paul-react.vercel.app`
- Create: `.gitignore`, root `package.json`, root `README.md`

**Interfaces:** Each app retains its source, Vite config, Android project, manifest, and Bun lockfile. Root scripts call each app through `bun --cwd apps/<app> ...`.

- [ ] **Step 1: Clone both remotes into temporary import directories**

    git clone https://github.com/Areo-RGB/Display-paul-react.vercel.app.git $env:TEMP\near-rhodus-display
    git clone https://github.com/Areo-RGB/controller-paul-react.vercel.app.git $env:TEMP\near-rhodus-controller

Expected heads: Display `591c5e7` and Controller `4edd571` (or newer remote heads if they changed).

- [ ] **Step 2: Copy contents while excluding nested Git metadata**

    New-Item -ItemType Directory -Force apps\display,apps\controller | Out-Null
    robocopy $env:TEMP\near-rhodus-display apps\display /E /XD .git | Out-Null
    robocopy $env:TEMP\near-rhodus-controller apps\controller /E /XD .git | Out-Null

Expected: `apps/display/.git` and `apps/controller/.git` do not exist.

- [ ] **Step 3: Add root scripts and ignore rules**

Create root `package.json`:

    {
      "name": "hic-rhodus-monorepo",
      "private": true,
      "workspaces": ["apps/*", "packages/*"],
      "scripts": {
        "check:nearby": "node scripts/check-nearby-protocol.mjs",
        "build:display": "bun --cwd apps/display run build",
        "build:controller": "bun --cwd apps/controller run build",
        "build:apps": "bun run check:nearby && bun run build:display && bun run build:controller"
      }
    }

Create `.gitignore` with `node_modules/`, `.env`, `.env.*` except `.env.example`, `**/build/`, `**/.gradle/`, `*.jks`, and `local.properties`. Do not ignore `app/src/main/assets/`.

- [ ] **Step 4: Rename package names without changing dependencies**

Set `apps/display/package.json` to `@hic-rhodus/display` and `apps/controller/package.json` to `@hic-rhodus/controller`. Keep each existing Bun lockfile.

- [ ] **Step 5: Verify and commit the import**

    git status --short
    Get-ChildItem apps/display/app/src/main/java/com/example/NearbyManager.kt,apps/controller/app/src/main/java/com/example/NearbyManager.kt
    git add .gitignore package.json apps README.md
    git -c user.name="Codex" -c user.email="codex@local" commit -m "chore: import display and controller apps"

### Task 2: Add the shared Nearby protocol and drift check

**Files:**
- Create: `packages/nearby-protocol/package.json`, `protocol.json`, `README.md`
- Create: `scripts/check-nearby-protocol.mjs`

**Interfaces:** `protocol.json` is canonical. The Node script exits 0 only when both Kotlin managers contain the configured service ID and strategy and prints each observed value.

- [ ] **Step 1: Write and run the failing check**

The script reads `packages/nearby-protocol/protocol.json`, then reads both `apps/*/app/src/main/java/com/example/NearbyManager.kt` files. It fails if either lacks the literal line `private const val SERVICE_ID = "<serviceId>"` or `Strategy.<strategy>`, and prints expected/observed IDs.

Run:

    node scripts/check-nearby-protocol.mjs

Expected: FAIL because Controller currently has `com.example.hicrhodus.p2p`.

- [ ] **Step 2: Add the canonical contract**

Create `protocol.json`:

    {
      "version": 1,
      "serviceId": "hic_rhodus_p2p",
      "strategy": "P2P_STAR",
      "payloadEncoding": "utf-8-json"
    }

Create package manifest `@hic-rhodus/nearby-protocol` and README describing Display advertising, Controller discovery, and UTF-8 JSON payloads.

- [ ] **Step 3: Commit the contract**

    git add packages scripts/check-nearby-protocol.mjs
    git -c user.name="Codex" -c user.email="codex@local" commit -m "feat: add shared nearby protocol contract"

### Task 3: Align both native managers

**Files:**
- Modify: `apps/display/app/src/main/java/com/example/NearbyManager.kt`
- Modify: `apps/controller/app/src/main/java/com/example/NearbyManager.kt`

**Interfaces:** Preserve `startDisplayMode`, `startControllerMode`, `sendPayload`, `stopNearby`, `AndroidNearby`, P2P_STAR, and JSON payload behavior.

- [ ] **Step 1: Replace Controller's service ID**

    private const val SERVICE_ID = "com.example.hicrhodus.p2p"

with:

    private const val SERVICE_ID = "hic_rhodus_p2p"

Leave Display's value as `hic_rhodus_p2p`.

- [ ] **Step 2: Verify and commit**

    node scripts/check-nearby-protocol.mjs
    git add apps/display/app/src/main/java/com/example/NearbyManager.kt apps/controller/app/src/main/java/com/example/NearbyManager.kt
    git -c user.name="Codex" -c user.email="codex@local" commit -m "fix: align nearby service ids"

Expected: PASS for both apps.

### Task 4: Document setup, builds, roles, and troubleshooting

**Files:** Modify root `README.md` and `packages/nearby-protocol/README.md`.

- [ ] **Step 1: Document setup and outputs**

Document:

    bun install
    bun run check:nearby
    bun run build:apps

Document APK paths `apps/display/app/build/outputs/apk/debug/app-debug.apk` and `apps/controller/app/build/outputs/apk/debug/app-debug.apk`, package IDs, service ID, and pad/plus mapping.

- [ ] **Step 2: Document troubleshooting**

Document status sequence `advertising -> found_device -> connecting -> connected`, permission failures, service-ID mismatch symptoms, and Firebase fallback when `window.AndroidNearby` is unavailable.

- [ ] **Step 3: Commit docs**

    git add README.md packages/nearby-protocol/README.md
    git -c user.name="Codex" -c user.email="codex@local" commit -m "docs: document nearby builds and device roles"

### Task 5: Provision build tools and produce both debug APKs

**Files:** Generated files under `apps/*/app/build/` only; do not commit them.

**Interfaces:** Requires JDK 17+, Gradle compatible with AGP 9.1.1, Android SDK API 36/build-tools 36.0.0, and platform-tools. Produces both `app-debug.apk` files.

- [ ] **Step 1: Check available tools**

    Get-Command bun,node,java,adb -ErrorAction SilentlyContinue

Expected: Bun/Node are present; Java/ADB may be missing.

- [ ] **Step 2: Provision tools if missing**

Use a user-scoped JDK 17+ and Android SDK with `platform-tools`, `platforms;android-36`, and `build-tools;36.0.0`. Set `JAVA_HOME` and `ANDROID_SDK_ROOT` only for the build session. If necessary, install official command-line tools/platform-tools in a user-owned tools directory.

- [ ] **Step 3: Install JS dependencies and build Vite assets**

    bun install
    bun --cwd apps/display install --frozen-lockfile
    bun --cwd apps/controller install --frozen-lockfile
    bun run build:display
    bun run build:controller

Expected: each `app/src/main/assets/index.html` is refreshed.

- [ ] **Step 4: Build Android wrappers**

The source remotes have no `gradlew`. Invoke a Gradle 9.3.1-compatible distribution with the active JDK:

    gradle -p apps/display :app:assembleDebug
    gradle -p apps/controller :app:assembleDebug

Expected: both debug APKs exist at the documented paths.

- [ ] **Step 5: Verify artifact state**

    Get-Item apps/display/app/build/outputs/apk/debug/app-debug.apk,apps/controller/app/build/outputs/apk/debug/app-debug.apk
    git status --short

Expected: APKs exist and only intentional source/assets/docs changes are tracked.

### Task 6: Identify devices, install role-specific APKs, and verify Nearby

**Files:**
- Create: `scripts/install-devices.ps1`
- Modify: root `README.md` with stable device model notes discovered during verification

**Interfaces:** The script accepts explicit `-PadSerial` and `-PlusSerial`, validates both against `adb devices`, installs the correct APK, and launches the correct package.

- [ ] **Step 1: Enumerate and identify devices**

    adb devices -l
    adb -s PAD_SERIAL shell getprop ro.product.model
    adb -s PLUS_SERIAL shell getprop ro.product.model
    adb -s PAD_SERIAL shell getprop ro.product.manufacturer
    adb -s PLUS_SERIAL shell getprop ro.product.manufacturer

Do not infer roles from list order.

- [ ] **Step 2: Write guarded installation**

Validate both serials, then execute:

    adb -s $PadSerial install -r apps/display/app/build/outputs/apk/debug/app-debug.apk
    adb -s $PlusSerial install -r apps/controller/app/build/outputs/apk/debug/app-debug.apk
    adb -s $PadSerial shell monkey -p com.aistudio.paulportfolio.kzmpxr 1
    adb -s $PlusSerial shell monkey -p com.aistudio.paulportfolio.likiod 1

- [ ] **Step 3: Install and verify package assignment**

    .\scripts/install-devices.ps1 -PadSerial PAD_SERIAL -PlusSerial PLUS_SERIAL
    adb -s PAD_SERIAL shell pm path com.aistudio.paulportfolio.kzmpxr
    adb -s PLUS_SERIAL shell pm path com.aistudio.paulportfolio.likiod

Expected: Display is installed on pad; Controller is installed on plus.

- [ ] **Step 4: Verify Nearby over native logs**

Grant permissions if prompted, then capture:

    adb -s PAD_SERIAL logcat -d -s NearbyManager
    adb -s PLUS_SERIAL logcat -d -s NearbyManager

Expected: Display advertises `hic_rhodus_p2p`; Controller discovers, connects, and sends a representative state update that Display applies without Firebase.

- [ ] **Step 5: Commit installer**

    git add scripts/install-devices.ps1 README.md
    git -c user.name="Codex" -c user.email="codex@local" commit -m "chore: add role-specific device installer"

### Task 7: Final verification and blocker report

**Files:** No source changes expected.

- [ ] **Step 1: Run repository checks**

    node scripts/check-nearby-protocol.mjs
    bun run build:apps
    git status --short --branch

- [ ] **Step 2: Confirm APKs and installed packages**

    adb -s PAD_SERIAL shell pm path com.aistudio.paulportfolio.kzmpxr
    adb -s PLUS_SERIAL shell pm path com.aistudio.paulportfolio.likiod

- [ ] **Step 3: Commit only final source corrections**

If verification exposes a source bug, fix the smallest focused source change, rerun the relevant check, and report exact external blockers when devices or Android tooling remain unavailable.

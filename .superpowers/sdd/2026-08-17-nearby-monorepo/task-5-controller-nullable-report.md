Status: completed

Root cause:
- `connectionsClient` is declared nullable in `NearbyManager`, but `onConnectionInitiated` called `acceptConnection(...)` as a non-null receiver at `apps/controller/app/src/main/java/com/example/NearbyManager.kt:94`, which caused Kotlin compilation to fail.

Change made:
- Updated only the `acceptConnection(...)` call chain to use safe calls:
  - `connectionsClient?.acceptConnection(endpointId, payloadCallback)?.addOnFailureListener { ... }`
- Preserved the existing failure log message and `notifyStatus("error", "Accept failed: ${e.message}")` string exactly.

Verification:
- Reproduced the failure with:
  - `C:\Users\paul\.local\share\nearby-task5-tools\gradle-9.3.1\bin\gradle.bat -p apps/controller :app:assembleDebug`
- Confirmed compiler error before fix:
  - `NearbyManager.kt:94:24 Only safe (?.) or non-null asserted (!!.) calls are allowed on a nullable receiver of type 'ConnectionsClient?'.`
- Re-ran the same assemble command after the change with provisioned JDK/SDK:
  - `JAVA_HOME=C:\Users\paul\.jdks\jdk-17.0.20+8`
  - `ANDROID_SDK_ROOT=C:\Users\paul\AppData\Local\Android\Sdk`
- Result after fix:
  - `BUILD SUCCESSFUL`
- Verified artifact exists:
  - `apps/controller/app/build/outputs/apk/debug/app-debug.apk`

Concerns:
- The successful build emitted unrelated deprecation warnings in `apps/controller/app/src/main/java/com/example/MainActivity.kt` for WebView settings properties; these did not block the task and were not modified.

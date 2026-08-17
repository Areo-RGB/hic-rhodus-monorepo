$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Installer = Join-Path $RepoRoot "scripts\install-devices.ps1"
$PadSerial = "PAD_TEST_SERIAL"
$PlusSerial = "PLUS_TEST_SERIAL"
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("install-devices-test-" + [System.Guid]::NewGuid().ToString("N"))
$OriginalPath = $env:PATH

function Assert-Contains {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Needle,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not $Text.Contains($Needle)) {
        throw "Expected $Label to contain '$Needle'. Actual: $Text"
    }
}

try {
    New-Item -ItemType Directory -Path $TempRoot | Out-Null
    $AdbLog = Join-Path $TempRoot "adb-calls.log"
    $env:ADB_FAKE_LOG = $AdbLog
    $FakeAdb = Join-Path $TempRoot "adb.cmd"

    Set-Content -LiteralPath $FakeAdb -Encoding ASCII -Value @"
@echo off
echo %* >>"%ADB_FAKE_LOG%"
if "%1"=="devices" (
  echo List of devices attached
  echo PAD_TEST_SERIAL	device
  echo PLUS_TEST_SERIAL	device
  exit /b 0
)
if "%1"=="-s" (
  if "%3"=="shell" if "%4"=="getprop" if "%5"=="ro.product.model" (
    if "%2"=="PAD_TEST_SERIAL" echo Fake Pad Model
    if "%2"=="PLUS_TEST_SERIAL" echo Fake Plus Model
    exit /b 0
  )
  if "%3"=="install" (
    echo Success
    exit /b 0
  )
  if "%3"=="shell" if "%4"=="monkey" (
    echo Events injected: 1
    exit /b 0
  )
)
echo unexpected adb call: %*
exit /b 1
"@

    $env:PATH = "$TempRoot;$OriginalPath"

    $Output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Installer -PadSerial $PadSerial -PlusSerial $PlusSerial 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Installer exited with $LASTEXITCODE. Output: $Output"
    }

    Assert-Contains -Text $Output -Needle "Fake Pad Model" -Label "installer output"
    Assert-Contains -Text $Output -Needle "Fake Plus Model" -Label "installer output"

    $AdbCalls = Get-Content -LiteralPath $AdbLog -Raw
    Assert-Contains -Text $AdbCalls -Needle "-s PAD_TEST_SERIAL install -r" -Label "adb calls"
    Assert-Contains -Text $AdbCalls -Needle "apps\display\app\build\outputs\apk\debug\app-debug.apk" -Label "adb calls"
    Assert-Contains -Text $AdbCalls -Needle "-s PLUS_TEST_SERIAL install -r" -Label "adb calls"
    Assert-Contains -Text $AdbCalls -Needle "apps\controller\app\build\outputs\apk\debug\app-debug.apk" -Label "adb calls"
    Assert-Contains -Text $AdbCalls -Needle "-s PAD_TEST_SERIAL shell monkey -p com.aistudio.paulportfolio.kzmpxr 1" -Label "adb calls"
    Assert-Contains -Text $AdbCalls -Needle "-s PLUS_TEST_SERIAL shell monkey -p com.aistudio.paulportfolio.likiod 1" -Label "adb calls"

    Write-Host "install-devices.ps1 behavior test passed."
}
finally {
    $env:PATH = $OriginalPath
    Remove-Item Env:\ADB_FAKE_LOG -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}

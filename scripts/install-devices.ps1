param(
    [Parameter(Mandatory = $true)]
    [string]$PadSerial,

    [Parameter(Mandatory = $true)]
    [string]$PlusSerial
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DisplayApk = "apps\display\app\build\outputs\apk\debug\app-debug.apk"
$ControllerApk = "apps\controller\app\build\outputs\apk\debug\app-debug.apk"
$DisplayPackage = "com.aistudio.paulportfolio.kzmpxr"
$ControllerPackage = "com.aistudio.paulportfolio.likiod"
$FallbackAdb = "C:\Users\paul\AppData\Local\Android\Sdk\platform-tools\adb.exe"

function Fail {
    param([Parameter(Mandatory = $true)][string]$Message)

    [Console]::Error.WriteLine("ERROR: $Message")
    exit 1
}

function Resolve-Adb {
    $PathAdb = Get-Command "adb" -ErrorAction SilentlyContinue
    if ($PathAdb) {
        return $PathAdb.Source
    }

    if (Test-Path -LiteralPath $FallbackAdb) {
        return $FallbackAdb
    }

    Fail "Could not find adb on PATH or at $FallbackAdb."
}

function Invoke-AdbCapture {
    param(
        [Parameter(Mandatory = $true)][string]$AdbPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$ErrorMessage
    )

    $Output = & $AdbPath @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
    $OutputText = ($Output | Out-String).Trim()

    if ($ExitCode -ne 0) {
        if ($OutputText) {
            Fail "$ErrorMessage (exit $ExitCode): $OutputText"
        }

        Fail "$ErrorMessage (exit $ExitCode)."
    }

    return $OutputText
}

function Assert-DeviceReady {
    param(
        [Parameter(Mandatory = $true)][string]$DevicesOutput,
        [Parameter(Mandatory = $true)][string]$Serial,
        [Parameter(Mandatory = $true)][string]$Role
    )

    if ([string]::IsNullOrWhiteSpace($Serial)) {
        Fail "$Role serial must not be empty."
    }

    $Pattern = "(?m)^$([regex]::Escape($Serial))\s+device\s*$"
    if ($DevicesOutput -notmatch $Pattern) {
        Fail "$Role serial '$Serial' is not listed as an authorized device by adb devices."
    }
}

function Assert-ApkExists {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $FullPath = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
        Fail "Missing APK: $RelativePath"
    }
}

$Adb = Resolve-Adb
Push-Location $RepoRoot
try {
    $DevicesOutput = Invoke-AdbCapture -AdbPath $Adb -Arguments @("devices") -ErrorMessage "Failed to list adb devices"
    Assert-DeviceReady -DevicesOutput $DevicesOutput -Serial $PadSerial -Role "Pad"
    Assert-DeviceReady -DevicesOutput $DevicesOutput -Serial $PlusSerial -Role "Plus"

    Assert-ApkExists -RelativePath $DisplayApk
    Assert-ApkExists -RelativePath $ControllerApk

    $PadModel = Invoke-AdbCapture -AdbPath $Adb -Arguments @("-s", $PadSerial, "shell", "getprop", "ro.product.model") -ErrorMessage "Failed to resolve pad model"
    $PlusModel = Invoke-AdbCapture -AdbPath $Adb -Arguments @("-s", $PlusSerial, "shell", "getprop", "ro.product.model") -ErrorMessage "Failed to resolve plus model"

    Write-Host "Pad model: $PadModel"
    Write-Host "Plus model: $PlusModel"

    Write-Host "Installing Display APK on pad..."
    Invoke-AdbCapture -AdbPath $Adb -Arguments @("-s", $PadSerial, "install", "-r", $DisplayApk) -ErrorMessage "Display APK install failed" | Out-Null

    Write-Host "Installing Controller APK on plus device..."
    Invoke-AdbCapture -AdbPath $Adb -Arguments @("-s", $PlusSerial, "install", "-r", $ControllerApk) -ErrorMessage "Controller APK install failed" | Out-Null

    Write-Host "Launching Display app on pad..."
    Invoke-AdbCapture -AdbPath $Adb -Arguments @("-s", $PadSerial, "shell", "monkey", "-p", $DisplayPackage, "1") -ErrorMessage "Display app launch failed" | Out-Null

    Write-Host "Launching Controller app on plus device..."
    Invoke-AdbCapture -AdbPath $Adb -Arguments @("-s", $PlusSerial, "shell", "monkey", "-p", $ControllerPackage, "1") -ErrorMessage "Controller app launch failed" | Out-Null

    Write-Host "Install and launch completed."
}
finally {
    Pop-Location
}

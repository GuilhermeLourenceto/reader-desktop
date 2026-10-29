$ErrorActionPreference = 'Stop'
$desktopRoot = Split-Path $PSScriptRoot -Parent
$caseRoot = Join-Path $desktopRoot ('.tmp\installer-smoke-' + [guid]::NewGuid().ToString('N'))
$otherRoot = Join-Path $env:TEMP ('lnreader-unrelated-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $caseRoot -Force | Out-Null
New-Item -ItemType Directory -Path $otherRoot -Force | Out-Null
$cacheRoot = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache'
$compiler = Get-ChildItem (Join-Path $cacheRoot 'nsis-3.0.4.1') -Recurse -Filter makensis.exe | Where-Object { $_.Directory.Name -ne 'Bin' } | Select-Object -First 1 -ExpandProperty FullName
$plugin = Get-ChildItem (Join-Path $cacheRoot 'nsis-resources-3.4.1') -Recurse -Filter nsProcess.dll | Where-Object { $_.Directory.Name -eq 'x86-unicode' } | Select-Object -First 1 -ExpandProperty DirectoryName
if (!$compiler -or !$plugin) { throw 'NSIS dependencies not found. Run the Windows build first.' }
$includeRoot = Join-Path $desktopRoot 'node_modules\app-builder-lib\templates\nsis\include'
$registrySubkey = 'Software\LNReaderInstallerSmoke\' + [guid]::NewGuid().ToString('N')
$helperName = 'LNReaderInstallerFixture-' + [guid]::NewGuid().ToString('N') + '.exe'
$helper = Join-Path $caseRoot $helperName
$otherHelper = Join-Path $otherRoot $helperName
$replacement = Join-Path $caseRoot 'replacement.exe'
$legacy = Join-Path $caseRoot 'Uninstall Fixture.exe'
$marker = Join-Path $caseRoot 'repair-ran.txt'
$extract = Get-Content (Join-Path $includeRoot 'installUtil.nsh') -Raw
$extract = $extract.Substring($extract.IndexOf('Function GetInQuotes'))
$extract = $extract.Substring(0, $extract.IndexOf('Function GetFileParent'))

function Build-Fixture([string]$Name, [string]$Source) {
    $sourcePath = Join-Path $caseRoot ($Name + '.nsi')
    Set-Content -LiteralPath $sourcePath -Value $Source -Encoding utf8
    & $compiler /V2 $sourcePath
    if ($LASTEXITCODE -ne 0) { throw "NSIS compilation failed: $Name" }
}

Build-Fixture 'helper' @"
Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "$helper"
Section
Sleep 120000
SectionEnd
"@
Build-Fixture 'unrelated-helper' @"
Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "$otherHelper"
Section
Sleep 120000
SectionEnd
"@
Build-Fixture 'replacement' @"
Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "$replacement"
Section
FileOpen `$0 "$marker" w
FileWrite `$0 "repaired uninstaller ran"
FileClose `$0
SectionEnd
"@
$harness = @'
Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "@ROOT@\harness.exe"
InstallDir "@ROOT@"
!addincludedir "@INCLUDES@"
!addplugindir /x86-unicode "@PLUGINS@"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
Var CmdPath
Var PowerShellPath
Var IsPowerShellAvailable
!define APP_EXECUTABLE_FILENAME "@HELPER@"
!define UNINSTALL_FILENAME "Uninstall Fixture.exe"
!define INSTALL_REGISTRY_KEY "@REGISTRY@\Install"
!define UNINSTALL_REGISTRY_KEY "@REGISTRY@\Uninstall"
!define UNINSTALLER_OUT_FILE "@ROOT@\replacement.exe"
Var FixtureVersion
Var FixtureCommand
!macro LNReaderReadInstallationValue OUT KEY NAME
!if "${NAME}" == "DisplayVersion"
StrCpy ${OUT} $FixtureVersion
!else if "${NAME}" == "InstallLocation"
StrCpy ${OUT} $INSTDIR
!else
StrCpy ${OUT} $FixtureCommand
!endif
!macroend
!include "@CUSTOM@"
!include "allowOnlyOneInstallerInstance.nsh"
@EXTRACT@
Section
SetShellVarContext current
StrCpy $FixtureVersion "2.1.5"
StrCpy $FixtureCommand '$\"$INSTDIR\${UNINSTALL_FILENAME}$\" /currentuser'
StrCpy $CmdPath "$SYSDIR\cmd.exe"
StrCpy $PowerShellPath "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
${GetParameters} $0
${GetOptions} $0 "/mismatch" $1
${IfNot} ${Errors}
StrCpy $FixtureCommand '$\"$INSTDIR\Other.exe$\" /currentuser'
${EndIf}
ClearErrors
${GetOptions} $0 "/other-version" $1
${IfNot} ${Errors}
StrCpy $FixtureVersion "9.9.9"
${EndIf}
!insertmacro customCheckAppRunning
SetErrorLevel 0
SectionEnd
'@
$harness = $harness.Replace('@ROOT@', $caseRoot).Replace('@INCLUDES@', $includeRoot).Replace('@PLUGINS@', $plugin).Replace('@HELPER@', $helperName).Replace('@REGISTRY@', $registrySubkey).Replace('@CUSTOM@', (Join-Path $desktopRoot 'build\installer.nsh')).Replace('@EXTRACT@', $extract)
Build-Fixture 'harness' $harness
$harnessExe = Join-Path $caseRoot 'harness.exe'
$running = $null
try {
    $unrelated = Start-Process -FilePath $otherHelper -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 300
    $result = Start-Process -FilePath $harnessExe -ArgumentList @('/S') -WindowStyle Hidden -Wait -PassThru
    if ($result.ExitCode -ne 0) { throw 'A same-named app outside the install directory must not block installation.' }
    Stop-Process -Id $unrelated.Id -Force
    $unrelated = $null

    foreach ($flag in @('/mismatch', '/other-version')) {
        Set-Content -LiteralPath $legacy -Value 'original legacy uninstaller' -Encoding ascii
        $before = (Get-FileHash -LiteralPath $legacy).Hash
        $result = Start-Process -FilePath $harnessExe -ArgumentList @('/S', $flag) -WindowStyle Hidden -Wait -PassThru
        if ($result.ExitCode -ne 0 -or (Get-FileHash -LiteralPath $legacy).Hash -ne $before) { throw "Unexpected legacy repair: $flag" }
    }
    $running = Start-Process -FilePath $helper -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 300
    $result = Start-Process -FilePath $harnessExe -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    if ($result.ExitCode -ne 2) { throw 'An active application must block replacement.' }
    Stop-Process -Id $running.Id -Force
    $running = $null
    $legacyLock = [System.IO.File]::Open($legacy, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    try {
        $result = Start-Process -FilePath $harnessExe -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
        if ($result.ExitCode -ne 0) { throw 'Recovery must work with the legacy executable locked against writes.' }
    } finally {
        $legacyLock.Dispose()
    }
    if ((Get-FileHash -LiteralPath $legacy).Hash -ne $before) { throw 'Legacy executable must not be overwritten in place.' }

    Write-Output 'PASS: NSIS detection ignores same-named apps outside the install directory, blocks the installed app, allows installation after closing it, and leaves legacy files unchanged.'
} finally {
    if ($running -and !$running.HasExited) { Stop-Process -Id $running.Id -Force }
    if ($unrelated -and !$unrelated.HasExited) { Stop-Process -Id $unrelated.Id -Force }
    Remove-Item -LiteralPath $caseRoot -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $otherRoot -Recurse -Force -ErrorAction SilentlyContinue
}

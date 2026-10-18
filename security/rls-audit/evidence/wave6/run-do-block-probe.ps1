<#
.SYNOPSIS
  Per-block DO-block probe runner with ON_ERROR_STOP=1 (Phase 11 W7 B3).
.DESCRIPTION
  Addresses Blocker 3: prior invocation used `psql -v ON_ERROR_STOP=0`,
  which always exits 0 regardless of SQL errors, so the checklist row
  "Step 3 DO-block FAIL-succeeded exit: non-zero" was unverifiable.
  This runner splits do-block-probe.sql into 3 blocks (Subscription,
  Notification, PaymentProof) on existing \echo markers, invokes each
  via WSL psql with ON_ERROR_STOP=1, captures per-block exit code and
  SQL-level error/notice counts, and emits a JSON summary that cleanly
  separates SQL-level outcome (error count) from runner-level outcome
  (process exit code).
.PARAMETER Mode
  pre  : fail-succeeded path (SELECT granted) - expect exit 3 + 1 ERROR/block
         (psql exit 3 = documented for script error with ON_ERROR_STOP=1)
  post : pass path (containment applied)       - expect exit 0 + 0 ERROR + 1 NOTICE/block
.PARAMETER Database
  Target database (default pg17test2, matches Wave 6A fixtures).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("pre", "post")]
    [string]$Mode = "pre",

    [Parameter(Mandatory = $false)]
    [string]$Database = "pg17test2"
)

$ErrorActionPreference = "Stop"

# --- Fresh variable init ---
Remove-Variable lines, markers, blocks, results, output, exitCode, logLines, outputText -ErrorAction SilentlyContinue

# --- Absolute paths ---
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$sqlAbs    = Join-Path $scriptDir "do-block-probe.sql"
$utc       = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")

$logName   = if ($Mode -eq "pre") { "step3-do-fail-succeeded.log" } else { "step6-do-pass.log" }
$jsonName  = "d1-do-block-$Mode-exit-codes-$utc.json"
$logAbs    = Join-Path $scriptDir $logName
$jsonAbs   = Join-Path $scriptDir $jsonName

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Phase 11 W7 B3 - do-block-probe runner" -ForegroundColor Cyan
Write-Host "Mode:     $Mode" -ForegroundColor Cyan
Write-Host "Database: $Database" -ForegroundColor Cyan
Write-Host "SQL:      $sqlAbs" -ForegroundColor Cyan
Write-Host "Log:      $logAbs" -ForegroundColor Cyan
Write-Host "JSON:     $jsonAbs" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# --- Sanity: SQL file exists ---
if (-not (Test-Path -LiteralPath $sqlAbs -PathType Leaf)) {
    Write-Host "STOP: SQL file not found: $sqlAbs" -ForegroundColor Red
    exit 2
}

# --- Pre-flight: passwordless sudo -u postgres available? ---
Write-Host "`n[0/4] Pre-flight: verifying sudo -u postgres access..." -ForegroundColor Yellow
$sudoUser = (wsl bash -c "sudo -n -u postgres whoami 2>&1") 2>&1
$sudoExit = $LASTEXITCODE
if ($sudoExit -ne 0 -or ($sudoUser -join "").Trim() -ne "postgres") {
    Write-Host "  STOP: passwordless 'sudo -u postgres' not available in WSL." -ForegroundColor Red
    Write-Host "  Pre-flight: exit=$sudoExit output=$($sudoUser -join ' ')" -ForegroundColor Red
    exit 2
}
Write-Host "  sudo -u postgres OK" -ForegroundColor Green

# --- Split SQL on \echo '=== DO probe N/3: <table> ===' markers ---
$lines = @(Get-Content -LiteralPath $sqlAbs)
$markers = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\\echo '=== DO probe (\d)/3: (\w+) ==='\s*$") {
        $markers += [pscustomobject]@{
            Block   = [int]$Matches[1]
            Table   = $Matches[2]
            LineIdx = $i
        }
    }
}
if ($markers.Count -ne 3) {
    Write-Host "STOP: expected 3 '\echo === DO probe N/3' markers, found $($markers.Count)" -ForegroundColor Red
    exit 2
}
$expectedTables = @("Subscription", "Notification", "PaymentProof")
for ($j = 0; $j -lt 3; $j++) {
    if ($markers[$j].Table -ne $expectedTables[$j]) {
        Write-Host "STOP: marker $($j+1) table '$($markers[$j].Table)' != expected '$($expectedTables[$j])'" -ForegroundColor Red
        exit 2
    }
}

$blocks = @()
$blocks += ($lines[$markers[0].LineIdx .. ($markers[1].LineIdx - 1)] -join "`n")
$blocks += ($lines[$markers[1].LineIdx .. ($markers[2].LineIdx - 1)] -join "`n")
$blocks += ($lines[$markers[2].LineIdx .. ($lines.Count - 1)]      -join "`n")

# --- Temp dir for per-block files ---
$tempDir = Join-Path $env:TEMP ("b3-blocks-" + $utc)
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

function ConvertTo-WslPath([string]$winPath) {
    if ($winPath -notmatch '^[A-Za-z]:') { throw "Not a drive path: $winPath" }
    $drive = $winPath.Substring(0,1).ToLower()
    $rest  = $winPath.Substring(2) -replace '\\','/'
    return "/mnt/$drive$rest"
}

# --- Mode-aware expectations ---
# psql documented exit codes: 0=normal, 1=psql fatal, 2=bad connection,
# 3=script error with ON_ERROR_STOP=1. The pre-mode fail-succeeded path
# intentionally raises exactly 1 SQL ERROR per block, so with
# ON_ERROR_STOP=1 psql stops and exits 3 -- NOT 1.
$expect = switch ($Mode) {
    "pre"  { [pscustomobject]@{ Exit = 3; Errors = 1; Notices = 0; Note = "fail-succeeded (SELECT granted); exit 3 (psql: script error w/ ON_ERROR_STOP=1) + 1 ERROR per block" } }
    "post" { [pscustomobject]@{ Exit = 0; Errors = 0; Notices = 1; Note = "pass (containment applied); exit 0 + 0 ERROR + 1 NOTICE per block" } }
}

# --- Run each block ---
$results   = @()
$logLines  = @()
$logLines += "# do-block-probe runner log"
$logLines += "# Generated UTC: $utc"
$logLines += "# Mode:          $Mode"
$logLines += "# Database:      $Database"
$logLines += "# SQL source:    $sqlAbs"
$logLines += "# Invocation:    per-block sudo -u postgres psql -d $Database -v ON_ERROR_STOP=1 -f <block>"
$logLines += "# Expectations:  exit=$($expect.Exit), errors=$($expect.Errors), notices=$($expect.Notices) ($($expect.Note))"
$logLines += ""

$overallPass = $true

for ($i = 0; $i -lt $blocks.Count; $i++) {
    $m         = $markers[$i]
    $blockFile = Join-Path $tempDir ("block-{0}-{1}.sql" -f $m.Block, $m.Table.ToLower())
    [System.IO.File]::WriteAllText($blockFile, $blocks[$i], [System.Text.UTF8Encoding]::new($false))
    $wslBlock  = ConvertTo-WslPath $blockFile

    Write-Host "`n[$($m.Block)/3] $($m.Table)" -ForegroundColor Cyan
    Write-Host "  wsl: sudo -u postgres psql -d $Database -v ON_ERROR_STOP=1 -f $wslBlock"

    $output     = (wsl bash -c "sudo -n -u postgres psql -d $Database -v ON_ERROR_STOP=1 -f '$wslBlock' 2>&1") 2>&1
    $exitCode   = $LASTEXITCODE
    $outputText = ($output -join "`n")

    $errCount    = ([regex]::Matches($outputText, '(?m)^(psql:.*)?ERROR:\s')).Count
    $noticeCount = ([regex]::Matches($outputText, '(?m)^(psql:.*)?NOTICE:\s')).Count

    $blockPass = ($exitCode -eq $expect.Exit) -and
                 ($errCount -eq $expect.Errors) -and
                 ($noticeCount -eq $expect.Notices)
    if (-not $blockPass) { $overallPass = $false }

    Write-Host ("  exit={0} (exp {1})  errors={2} (exp {3})  notices={4} (exp {5})  -> {6}" -f `
        $exitCode, $expect.Exit, $errCount, $expect.Errors, $noticeCount, $expect.Notices,
        $(if ($blockPass) { "PASS" } else { "FAIL" })) `
        -ForegroundColor $(if ($blockPass) { "Green" } else { "Red" })

    # psql's own \echo headers naturally appear in $outputText
    $logLines += ""
    $logLines += $outputText
    $logLines += "# Per-block exit_code:   $exitCode  (expected $($expect.Exit))"
    $logLines += "# Per-block sql_errors:  $errCount  (expected $($expect.Errors))"
    $logLines += "# Per-block notices:     $noticeCount  (expected $($expect.Notices))"
    $logLines += "# Per-block verdict:     $(if ($blockPass) { 'PASS' } else { 'FAIL' })"
    $logLines += ""

    $results += [pscustomobject]@{
        block                 = $m.Table
        block_index           = $m.Block
        exit_code             = $exitCode
        expected_exit         = $expect.Exit
        sql_error_count       = $errCount
        expected_error_count  = $expect.Errors
        notice_count          = $noticeCount
        expected_notice_count = $expect.Notices
        verdict               = $(if ($blockPass) { "PASS" } else { "FAIL" })
    }

    Remove-Item -LiteralPath $blockFile -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue

$logLines += "=== DO-block probe COMPLETE ==="
$logLines += "# Runner verdict: $(if ($overallPass) { 'PASS' } else { 'FAIL' })"
$logLines += "# Runner exit:    $(if ($overallPass) { '0' } else { '1' })"
[System.IO.File]::WriteAllText($logAbs, ($logLines -join "`n") + "`n", [System.Text.UTF8Encoding]::new($false))

# --- JSON summary ---
$summary = [pscustomobject]@{
    wave              = "11-W7-B3"
    generated_utc     = $utc
    mode              = $Mode
    database          = $Database
    invocation        = "per-block sudo -u postgres psql -d $Database -v ON_ERROR_STOP=1 -f <block>"
    sql_source        = (Split-Path -Leaf $sqlAbs)
    mode_expectations = [pscustomobject]@{
        exit_code_per_block    = $expect.Exit
        error_count_per_block  = $expect.Errors
        notice_count_per_block = $expect.Notices
        note                   = $expect.Note
    }
    blocks            = $results
    runner_verdict    = $(if ($overallPass) { "PASS" } else { "FAIL" })
    runner_exit_code  = $(if ($overallPass) { 0 } else { 1 })
}

[System.IO.File]::WriteAllText($jsonAbs, ($summary | ConvertTo-Json -Depth 6) + "`n", [System.Text.UTF8Encoding]::new($false))

# --- Summary ---
Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Mode:           $Mode"
Write-Host "Log:            $(Split-Path -Leaf $logAbs)  ($((Get-Item -LiteralPath $logAbs).Length) bytes)"
Write-Host "JSON:           $(Split-Path -Leaf $jsonAbs)  ($((Get-Item -LiteralPath $jsonAbs).Length) bytes)"
Write-Host "Runner verdict: $(if ($overallPass) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($overallPass) { "Green" } else { "Red" })
Write-Host ""
$results | Format-Table block, block_index, exit_code, expected_exit, sql_error_count, expected_error_count, notice_count, verdict -AutoSize | Out-Host

if ($overallPass) { exit 0 } else { exit 1 }
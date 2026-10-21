# ==================================================================
# Phase 11 Wave 7 B2 - Production anon HTTP probe (mode-aware)
# Read-only. No row data captured. Key never logged.
# Distinguishes PROBE_FAILED (invalid/expired key, 401, transport)
# from EXPECTED_DENIAL (403 in post-containment mode) and from
# CRITICAL_LEAK (2xx in post-mode, or rows returned despite limit=0).
# ==================================================================
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("pre", "post")]
    [string]$Mode = "pre",

    [Parameter(Mandatory = $false)]
    [string]$Base = $null
)

$ErrorActionPreference = "Stop"

$base = if ($Base) { $Base } else { "https://wqwsagnxkamblnefhpzx.supabase.co/rest/v1" }
$tables = @("Subscription", "Notification", "PaymentProof")
$utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")

# Portable output directory: next to the script.
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$outDir = $scriptDir
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outJson = Join-Path $outDir "d2-prod-probe-$Mode-$utc.json"
$outSha  = Join-Path $outDir "d2-prod-probe-$Mode-$utc.sha256"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Phase 11 W7 B2 - Production anon HTTP probe (read-only)" -ForegroundColor Cyan
Write-Host "Mode:   $Mode" -ForegroundColor Cyan
Write-Host "Target: $base" -ForegroundColor Cyan
Write-Host "Output: $outJson" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# ---- Pre-flight ----
Write-Host "`n[1/4] Pre-flight: verify endpoint reachable..." -ForegroundColor Yellow
$preflightCode = curl.exe -sS -o NUL -w "%{http_code}" "$base/"
Write-Host "  Pre-flight HTTP: $preflightCode"
if (-not $preflightCode -or $preflightCode -eq "000") {
    Write-Host "  Endpoint unreachable - STOP (PROBE_FAILED)" -ForegroundColor Red
    exit 11
}

# ---- Anon key (hidden, never logged) ----
Write-Host "`n[2/4] Anon key input" -ForegroundColor Yellow
$anonKeySecure = if ($env:VLTX_PROBE_TEST_KEY) {
    ConvertTo-SecureString -String $env:VLTX_PROBE_TEST_KEY -AsPlainText -Force
} else {
    Read-Host "Paste anon key (hidden)" -AsSecureString
}
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($anonKeySecure)
$anonKey = $null
$anonFp  = $null
$results = @()
$criticalCount = 0
$failedCount = 0

try {
    $anonKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($anonKey))
    $anonFp = (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "").Substring(0,8)
    $sha.Dispose()
    Write-Host "  Anon key fingerprint (SHA256[0:8]): $anonFp"

    # ---- Probe tables ----
    Write-Host "`n[3/4] Probing tables..." -ForegroundColor Yellow
    foreach ($t in $tables) {
        Write-Host "`n  === $t ===" -ForegroundColor Cyan
        $hf = "$env:TEMP\prod-probe-$Mode-$t-headers.txt"
        $bf = "$env:TEMP\prod-probe-$Mode-$t-body.json"
        Remove-Item $hf,$bf -ErrorAction SilentlyContinue

        # Explicit ${t} interpolation - avoids $t? parsing ambiguity
        $url = "$base/${t}?select=id&limit=0"
        $httpStatus = curl.exe -s -S -D $hf -o $bf -w "%{http_code}" -X GET $url -H "apikey: $anonKey" -H "Authorization: Bearer $anonKey" -H "Prefer: count=exact"
        $curlExit = $LASTEXITCODE

        $hdr = if (Test-Path $hf) { Get-Content $hf -Raw } else { "" }
        $bytes = if (Test-Path $bf) { [System.IO.File]::ReadAllBytes($bf) } else { @() }
        $len = if ($bytes) { $bytes.Length } else { 0 }

        # sb-error-code header (Supabase gateway)
        $sbErrCode = "(absent)"
        $sbErrMatch = [regex]::Match($hdr, "(?im)^sb-error-code:\s*(.+)$")
        if ($sbErrMatch.Success) {
            $sbErrCode = $sbErrMatch.Groups[1].Value.Trim()
        }

        $crPresent = ($hdr -match "(?i)Content-Range:") -as [bool]
        $crValue = "(absent)"
        if ($crPresent) {
            $m = [regex]::Match($hdr, "(?im)^Content-Range:\s*(.+)$")
            if ($m.Success) {
                $val = $m.Groups[1].Value.Trim()
                $crValue = $val.Substring(0,[Math]::Min(30,$val.Length))
            } else { $crValue = "(present)" }
        }

        # Body shape (sanitized)
        $shape = "empty"
        $rowCount = 0
        if ($len -gt 0 -and (Test-Path $bf)) {
            $txt = [System.Text.Encoding]::UTF8.GetString($bytes).Trim()
            if ($txt.StartsWith("[")) {
                $rowCount = ([regex]::Matches($txt, '\{"')).Count
                $shape = "JSON array, $rowCount row(s)"
            } elseif ($txt.StartsWith("{")) {
                $keys = ([regex]::Matches($txt, '"[a-zA-Z_]+"\s*:')).Count
                $shape = "JSON object, $keys key(s)"
            } else {
                $shape = "non-JSON (len=$($txt.Length))"
            }
        }

        # ---- Additional post-mode 403 body inspection (JSON-parse based) ----
        $bodyIsJson        = $false
        $bodyIsJsonValid   = $false
        $bodyIsArray       = $false
        $bodyHasData       = $false
        $bodyDbPermErr     = $false
        $bodyRaw           = if ($len -gt 0 -and (Test-Path $bf)) { [System.Text.Encoding]::UTF8.GetString($bytes).Trim() } else { "" }
        if ($bodyRaw.Length -gt 0) {
            $firstChar = $bodyRaw.Substring(0,1)
            if ($firstChar -eq "{" -or $firstChar -eq "[") { $bodyIsJson = $true }
            try {
                $parsed = $bodyRaw | ConvertFrom-Json -ErrorAction Stop
                $bodyIsJsonValid = $true
                if ($parsed -is [System.Array]) {
                    $bodyIsArray = $true
                    if ($parsed.Count -gt 0) { $bodyHasData = $true }
                } elseif ($parsed -is [PSCustomObject]) {
                    foreach ($df in @('rows','data','records','items')) {
                        if ($parsed.PSObject.Properties.Name -contains $df) {
                            $v = $parsed.$df
                            if ($null -ne $v -and (@($v).Count -gt 0)) { $bodyHasData = $true; break }
                        }
                    }
                    if (-not $bodyHasData) {
                        $codeOk = $false; $msgOk = $false
                        if ($parsed.PSObject.Properties.Name -contains 'code')    { if ([string]$parsed.code -eq '42501') { $codeOk = $true } }
                        if ($parsed.PSObject.Properties.Name -contains 'message') { if ([string]$parsed.message -match 'permission denied for (table|relation|sequence)') { $msgOk = $true } }
                        if ($codeOk -and $msgOk) { $bodyDbPermErr = $true }
                    }
                }
            } catch {
                # Malformed JSON - fail-closed (bodyIsJsonValid stays false)
            }
        }

        # ---- Mode-aware classification ----
        $cls = "UNKNOWN"
        $leak = $false
        $failed = $false

        if ($curlExit -ne 0) {
            $cls = "PROBE_FAILED (curl exit $curlExit)"
            $failed = $true
        }
        elseif ($sbErrCode -match "(?i)UNAUTHORIZED_INVALID_API_KEY") {
            $cls = "PROBE_FAILED (invalid API key: sb-error-code=$sbErrCode)"
            $failed = $true
        }
        elseif ($httpStatus -eq "401" -or $httpStatus -eq "403") {
            if ($Mode -eq "post") {
                if ($crPresent) {
                    $cls = "CRITICAL_LEAK ($httpStatus with Content-Range present)"
                    $leak = $true
                }
                elseif ($bodyHasData) {
                    $cls = "CRITICAL_LEAK ($httpStatus + data indicator in body)"
                    $leak = $true
                }
                elseif (-not $bodyIsJsonValid) {
                    $cls = "PROBE_FAILED_NON_JSON_403 ($httpStatus + non-JSON or malformed body)"
                    $failed = $true
                }
                elseif ($bodyDbPermErr) {
                    $cls = "EXPECTED_DENIAL_DB_PERM ($httpStatus + parsed PostgreSQL permission error)"
                }
                else {
                    $cls = "PROBE_FAILED_GATEWAY_403 ($httpStatus + valid JSON but not pg perm error)"
                    $failed = $true
                }
            } else {
                if ($httpStatus -eq "401") {
                    $cls = "PROBE_FAILED (401 auth error in pre-mode; sb-error-code=$sbErrCode)"
                } else {
                    $cls = "UNEXPECTED_PRE_CONTAINMENT_DENIAL (403 in pre-mode)"
                }
                $failed = $true
            }
        }
        elseif ($httpStatus -eq "200" -or $httpStatus -eq "206") {
            if ($Mode -eq "post") {
                # Any 2xx in post-containment mode = anon reached the table
                if ($crPresent -or $rowCount -gt 0) {
                    $cls = "CRITICAL_LEAK (2xx in post-mode with data indicator)"
                } else {
                    $cls = "CRITICAL_LEAK (2xx in post-mode; anon reached endpoint)"
                }
                $leak = $true
            } else {
                # Pre-containment mode
                if ($rowCount -gt 0) {
                    $cls = "CRITICAL_DATA_LEAK (rows returned despite limit=0)"
                    $leak = $true
                } elseif ($crPresent) {
                    $cls = "EXPECTED_PRE_CONTAINMENT_EXPOSURE (2xx + CR, limit=0 empty)"
                } else {
                    $cls = "UNEXPECTED_2XX_NO_CR (2xx without Content-Range; investigate)"
                    $failed = $true
                }
            }
        }
        else {
            $cls = "UNEXPECTED_HTTP_$httpStatus"
            $failed = $true
        }

        if ($leak) { $criticalCount++ }
        if ($failed) { $failedCount++ }

        Write-Host "  HTTP: $httpStatus | curl exit: $curlExit | sb-error-code: $sbErrCode"
        Write-Host "  Content-Range: $crValue"
        Write-Host "  Body length: $len bytes"
        Write-Host "  Body shape: $shape"
        Write-Host "  Classification: $cls" -ForegroundColor $(if ($leak -or $failed) { "Red" } else { "Green" })

        $results += [pscustomobject]@{
            table                    = $t
            url                      = $url
            http_status              = $httpStatus
            curl_exit                = $curlExit
            sb_error_code            = $sbErrCode
            content_range_present    = $crPresent
            content_range_value      = $crValue
            body_length_bytes        = $len
            body_shape               = $shape
            body_is_json             = $bodyIsJson
            body_is_json_valid       = $bodyIsJsonValid
            body_is_array            = $bodyIsArray
            body_has_data            = $bodyHasData
            body_db_permission_error = $bodyDbPermErr
            classification           = $cls
            critical_leak            = $leak
            probe_failed             = $failed
        }
    }

    # ---- Write sanitized JSON ----
    Write-Host "`n[4/4] Writing sanitized evidence..." -ForegroundColor Yellow
    # R-1: Compute final process exit code BEFORE summary (single source of truth)
    $finalExitCode = if ($criticalCount -gt 0) { 10 } elseif ($failedCount -gt 0) { 11 } else { 0 }

    $summary = [pscustomobject]@{
        wave                      = "11-W7-B2"
        generated_utc             = $utc
        mode                      = $Mode
        target_base               = $base
        anon_key_sha256_first8    = $anonFp
        preflight_http_code       = $preflightCode
        classification_matrix     = @{
            "2xx+CR+pre"          = "EXPECTED_PRE_CONTAINMENT_EXPOSURE"
            "2xx+any+post"        = "CRITICAL_LEAK"
            "401+post+pg_perm_err"   = "EXPECTED_DENIAL_DB_PERM"
            "401+post+no_pg_perm"    = "PROBE_FAILED_GATEWAY_403"
            "401+post+non_json"      = "PROBE_FAILED_NON_JSON_403"
            "401+post+cr_present"    = "CRITICAL_LEAK"
            "403+post+pg_perm_err"   = "EXPECTED_DENIAL_DB_PERM"
            "403+post+no_pg_perm"    = "PROBE_FAILED_GATEWAY_403"
            "403+post+non_json"      = "PROBE_FAILED_NON_JSON_403"
            "403+post+cr_present"    = "CRITICAL_LEAK"
            "403+pre"             = "UNEXPECTED_PRE_CONTAINMENT_DENIAL"
            "401+pre"             = "PROBE_FAILED"
            "sb-error-code=UNAUTHORIZED_INVALID_API_KEY" = "PROBE_FAILED"
        }
        sanitization_captured     = @("http_status","sb_error_code","content_range_presence","content_range_value_truncated_30","body_length_bytes","body_shape")
        sanitization_not_captured = @("raw_row_data","anon_key_value","full_body")
        tables                    = $results
        escalation_protocol       = "If CRITICAL_DATA_LEAK: manual WhatsApp to expert with this JSON"
        process_exit_code         = $finalExitCode
    }
    [System.IO.File]::WriteAllText($outJson, ($summary | ConvertTo-Json -Depth 10), [System.Text.UTF8Encoding]::new($false))
    $jsonHash = (Get-FileHash $outJson -Algorithm SHA256).Hash
    "$jsonHash  $(Split-Path -Leaf $outJson)" | Out-File $outSha -Encoding ascii

    Write-Host "  Evidence JSON: $outJson"
    Write-Host "  Evidence SHA:  $outSha"

    # ---- Final summary ----
    Write-Host "`n===============================================" -ForegroundColor Cyan
    Write-Host "PROBE COMPLETE" -ForegroundColor Cyan
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "Mode: $Mode"
    Write-Host "Anon key fingerprint: $anonFp"
    Write-Host "Pre-flight HTTP: $preflightCode"
    $results | Format-Table -Property table, http_status, sb_error_code, body_shape, classification -AutoSize

    if ($criticalCount -gt 0) {
        Write-Host "`n*** CRITICAL_DATA_LEAK DETECTED - $criticalCount table(s) ***" -ForegroundColor Red
        Write-Host "*** IMMEDIATE: WhatsApp expert with $outJson ***" -ForegroundColor Red
        # exit 10 (R-1: replaced by single exit $finalExitCode at end)
    } elseif ($failedCount -gt 0) {
        Write-Host "`n*** PROBE_FAILED - $failedCount table(s) ***" -ForegroundColor Red
        # exit 11 (R-1: replaced by single exit $finalExitCode at end)
    } else {
        Write-Host "`nAll probes completed. Sanitized evidence written." -ForegroundColor Green
        # exit 0 (R-1: replaced by single exit $finalExitCode at end)
    }
}
finally {
    if ($bstr -and $bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $anonKey = $null
    [System.GC]::Collect()
}
exit $finalExitCode
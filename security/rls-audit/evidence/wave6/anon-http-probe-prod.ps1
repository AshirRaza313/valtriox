# ==================================================================
# Wave 6B - Production anon HTTP probe (PRE-containment baseline)
# Read-only. No row data captured. Key never logged.
# ==================================================================
$ErrorActionPreference = "Stop"

$base = "https://wqwsagnxkamblnefhpzx.supabase.co/rest/v1"
$tables = @("Subscription", "Notification", "PaymentProof")
$utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$outDir = "C:\Users\Aashir\Projects\evidence-phase1\phase11-corrections\wave6-test-evidence"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outJson = "$outDir\d2-prod-probe-$utc.json"
$outSha  = "$outDir\d2-prod-probe-$utc.sha256"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Wave 6B - Production anon HTTP probe (read-only)" -ForegroundColor Cyan
Write-Host "Target: $base" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# ---- Pre-flight ----
Write-Host "`n[1/4] Pre-flight: verify endpoint reachable..." -ForegroundColor Yellow
$preflightCode = curl.exe -sS -o NUL -w "%{http_code}" "$base/"
Write-Host "  Pre-flight HTTP: $preflightCode"
if (-not $preflightCode -or $preflightCode -eq "000") {
    Write-Host "  Endpoint unreachable - STOP (PROBE_FAILED)" -ForegroundColor Red
    exit 2
}

# ---- Anon key (hidden, never logged) ----
Write-Host "`n[2/4] Anon key input" -ForegroundColor Yellow
$anonKeySecure = Read-Host "Paste anon key (hidden)" -AsSecureString
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
        $hf = "$env:TEMP\prod-probe-$t-headers.txt"
        $bf = "$env:TEMP\prod-probe-$t-body.json"
        Remove-Item $hf,$bf -ErrorAction SilentlyContinue

        $url = "$base/$t`?select=id`&limit=0"
        $httpStatus = curl.exe -s -S -D $hf -o $bf -w "%{http_code}" -X GET $url -H "apikey: $anonKey" -H "Authorization: Bearer $anonKey" -H "Prefer: count=exact"
        $curlExit = $LASTEXITCODE

        $hdr = if (Test-Path $hf) { Get-Content $hf -Raw } else { "" }
        $bytes = if (Test-Path $bf) { [System.IO.File]::ReadAllBytes($bf) } else { @() }
        $len = if ($bytes) { $bytes.Length } else { 0 }

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
        if ($len -gt 0 -and (Test-Path $bf)) {
            $txt = [System.Text.Encoding]::UTF8.GetString($bytes).Trim()
            if ($txt.StartsWith("[")) {
                $rows = ([regex]::Matches($txt, '\{"')).Count
                $shape = "JSON array, $rows row(s)"
            } elseif ($txt.StartsWith("{")) {
                $keys = ([regex]::Matches($txt, '"[a-zA-Z_]+\s*:')).Count
                $shape = "JSON object, $keys key(s)"
            } else {
                $shape = "non-JSON (len=$($txt.Length))"
            }
        }

        # Classification
        $cls = "UNKNOWN"
        $leak = $false
        if ($curlExit -ne 0) { 
            $cls = "PROBE_FAILED (curl exit $curlExit)"
            $failedCount++ 
        }
        elseif ($httpStatus -eq "401" -or $httpStatus -eq "403") { 
            $cls = "EXPECTED_PRE_CONTAINMENT_DENIAL (unexpected for pre-state)" 
        }
        elseif ($httpStatus -eq "200" -and $shape -match "0 row") { 
            $cls = "EXPECTED_PRE_CONTAINMENT_EXPOSURE (200, 0 rows via limit=0)"
            $leak = $false 
        }
        elseif ($httpStatus -eq "200" -and $shape -match "[1-9][0-9]* row") { 
            $cls = "CRITICAL_DATA_LEAK (200 with actual row data)"
            $leak = $true
            $criticalCount++ 
        }
        elseif ($httpStatus -eq "200") { 
            $cls = "UNEXPECTED_200 ($shape)" 
        }
        else { 
            $cls = "UNEXPECTED_HTTP_$httpStatus" 
        }

        Write-Host "  HTTP: $httpStatus | curl exit: $curlExit"
        Write-Host "  Content-Range: $crValue"
        Write-Host "  Body length: $len bytes"
        Write-Host "  Body shape: $shape"
        Write-Host "  Classification: $cls" -ForegroundColor $(if ($leak) { "Red" } else { "Yellow" })

        $results += [pscustomobject]@{
            table                 = $t
            url                   = $url
            http_status           = $httpStatus
            curl_exit             = $curlExit
            content_range_present = $crPresent
            content_range_value   = $crValue
            body_length_bytes     = $len
            body_shape            = $shape
            classification        = $cls
            critical_leak         = $leak
        }
    }

    # ---- Write sanitized JSON ----
    Write-Host "`n[4/4] Writing sanitized evidence..." -ForegroundColor Yellow
    $summary = [pscustomobject]@{
        wave                    = "6B"
        generated_utc           = $utc
        target_base             = $base
        probe_mode              = "PRE-containment baseline (read-only)"
        anon_key_sha256_first8  = $anonFp
        preflight_http_code     = $preflightCode
        sanitization_captured   = @("http_status","content_range_presence","content_range_value_truncated_30","body_length_bytes","body_shape")
        sanitization_not_captured = @("raw_row_data","anon_key_value","full_body")
        tables                  = $results
        escalation_protocol     = "If any table shows CRITICAL_DATA_LEAK: manual WhatsApp to expert with this JSON"
    }
    $summary | ConvertTo-Json -Depth 10 | Out-File $outJson -Encoding utf8
    $jsonHash = (Get-FileHash $outJson -Algorithm SHA256).Hash
    "$jsonHash  d2-prod-probe-$utc.json" | Out-File $outSha -Encoding ascii

    Write-Host "  Evidence JSON: $outJson"
    Write-Host "  Evidence SHA:  $outSha"

    # ---- Final summary ----
    Write-Host "`n===============================================" -ForegroundColor Cyan
    Write-Host "PROBE COMPLETE" -ForegroundColor Cyan
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "Anon key fingerprint: $anonFp"
    Write-Host "Pre-flight HTTP: $preflightCode"
    $results | Format-Table -Property table, http_status, body_shape, classification -AutoSize

    if ($criticalCount -gt 0) {
        Write-Host "`n*** CRITICAL_DATA_LEAK DETECTED - $criticalCount table(s) ***" -ForegroundColor Red
        Write-Host "*** IMMEDIATE: WhatsApp expert with $outJson ***" -ForegroundColor Red
        exit 10
    } elseif ($failedCount -gt 0) {
        Write-Host "`n*** PROBE_FAILED - $failedCount table(s) ***" -ForegroundColor Red
        exit 11
    } else {
        Write-Host "`nAll probes completed. Sanitized evidence written." -ForegroundColor Green
        exit 0
    }
}
finally {
    if ($bstr -and $bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $anonKey = $null
    [System.GC]::Collect()
}
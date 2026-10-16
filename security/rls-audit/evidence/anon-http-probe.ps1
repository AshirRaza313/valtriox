# anon-http-probe.ps1
# Automated anon HTTP probe with hard-fail assertions.
# ZeroFreeBSTR cleanup on all paths.

$ErrorActionPreference = "Stop"
$base = "https://wqwsagnxkamblnefhpzx.supabase.co/rest/v1"
$tables = @("Subscription", "Notification", "PaymentProof")
$failures = @()

$anonKeySecure = Read-Host "Anon Key" -AsSecureString
$anonKey = $null
try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($anonKeySecure)
    $anonKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

    foreach ($t in $tables) {
        Write-Host "===== $t =====" -ForegroundColor Cyan

        $headersFile = "$env:TEMP\anon-http-$t-headers.txt"
        $bodyFile = "$env:TEMP\anon-http-$t-body.json"

        $httpStatus = curl.exe -s -S `
            -D $headersFile `
            -o $bodyFile `
            -w "%{http_code}" `
            -X GET "$base/$t?select=id&limit=0" `
            -H "apikey: $anonKey" `
            -H "Authorization: Bearer $anonKey" `
            -H "Prefer: count=exact"

        $curlExit = $LASTEXITCODE
        Write-Host "HTTP: $httpStatus | curl exit: $curlExit"

        if ($curlExit -ne 0) {
            $failures += "$t : curl exit $curlExit (transport failure)"
            continue
        }

        if ($httpStatus -notin @("401", "403")) {
            $failures += "$t : unexpected HTTP $httpStatus (expected 401/403)"
            continue
        }

        $headerText = Get-Content $headersFile -Raw
        if ($headerText -match "(?i)Content-Range:") {
            $failures += "$t : Content-Range header present"
        }

        $bodyText = Get-Content $bodyFile -Raw -ErrorAction SilentlyContinue
        if ($bodyText -match '^\s*\[\s*\{\s*"id"') {
            $failures += "$t : body appears to contain row data (id fields present)"
        }

        $bodyPreview = if ($bodyText) {
            $trimmed = $bodyText.Trim()
            if ($trimmed.Length -gt 120) { $trimmed.Substring(0, 120) + "..." } else { $trimmed }
        } else { "(empty)" }
        Write-Host "  Body preview (first 120 chars): $bodyPreview"
        Write-Host "  Content-Range header present: $([bool]($headerText -match '(?i)Content-Range:'))"
        Write-Host ""
    }
}
finally {
    if ($bstr -and $bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $anonKey = $null
    [System.GC]::Collect()
}

if ($failures.Count -gt 0) {
    Write-Host "FAILURES:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
} else {
    Write-Host "ALL ANON PROBES PASSED (401/403, no Content-Range, no row-shaped body)" -ForegroundColor Green
    exit 0
}
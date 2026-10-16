# anon-http-probe-failtest.ps1
# FAIL-PATH test: point the probe at a 200-OK endpoint (httpbin.org)
# Expected: script prints failures + exits 1

$ErrorActionPreference = "Stop"
$base = "https://httpbin.org"
$tables = @("status/200")
$failures = @()

# Skip the Read-Host prompt for automated test
$anonKey = "dummy-key"

foreach ($t in $tables) {
    Write-Host "===== $t =====" -ForegroundColor Cyan

    $headersFile = "$env:TEMP\anon-http-$($t -replace '/','_')-headers.txt"
    $bodyFile = "$env:TEMP\anon-http-$($t -replace '/','_')-body.json"

    $httpStatus = curl.exe -s -S `
        -D $headersFile `
        -o $bodyFile `
        -w "%{http_code}" `
        -X GET "$base/$t" `
        -H "apikey: $anonKey" `
        -H "Authorization: Bearer $anonKey"

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
}

if ($failures.Count -gt 0) {
    Write-Host "FAILURES:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
} else {
    Write-Host "ALL ANON PROBES PASSED" -ForegroundColor Green
    exit 0
}
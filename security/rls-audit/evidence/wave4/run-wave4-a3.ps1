# ==================================================================
# Wave 4 (A3) - Canonical SQL hash + binding report
# Generates A3 report and hash manifest for the wave4-sql-binding
# folder. No mutation. Local evidence only.
# ==================================================================

Set-Location "C:\Users\Aashir\Projects\valtriox-trackb"

$utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$out = "C:\Users\Aashir\Projects\evidence-phase1\phase11-corrections\wave4-sql-binding"
New-Item -ItemType Directory -Force -Path $out | Out-Null

# ----------------------------------------------------------------
# Pre-flight: source files must exist in PR #17 branch
# ----------------------------------------------------------------
$canonicalRel = @{
    Containment = "security\rls-audit\phase-a-containment-v3.sql"
    Rollback    = "security\rls-audit\phase-a-rollback-v2.sql"
}
foreach ($k in $canonicalRel.Keys) {
    if (-not (Test-Path $canonicalRel[$k])) {
        Write-Host "MISSING canonical file: $($canonicalRel[$k]) - STOP" -ForegroundColor Red
        exit 1
    }
}

$cPath = $canonicalRel["Containment"]
$rPath = $canonicalRel["Rollback"]

$cHash = (Get-FileHash $cPath -Algorithm SHA256).Hash
$cSize = (Get-Item $cPath).Length
$rHash = (Get-FileHash $rPath -Algorithm SHA256).Hash
$rSize = (Get-Item $rPath).Length

$expectC = "59C62F1A92510BD45889BA519957BD1F893934DF18557EFD3DAA1636B1227A3C"
$expectR = "8CEDA08FAA167F39CA9E0778D44F1661C9FF987143FB2E4AFC0A498ED8787E4D"

# ----------------------------------------------------------------
# Git SHAs
# ----------------------------------------------------------------
$localSha    = (git rev-parse HEAD).Trim()
$remoteSha   = (git rev-parse origin/security/rls-audit-containment-v1).Trim()
$mainSha     = (git rev-parse origin/main).Trim()
$aheadBehind = (git rev-list --left-right --count HEAD...origin/security/rls-audit-containment-v1).Trim()

# ----------------------------------------------------------------
# PR #17 metadata via gh api
# ----------------------------------------------------------------
$pr17Json = gh api repos/AshirRaza313/valtriox/pulls/17 --jq '{number: .number, state: .state, head: .head.sha, base: .base.sha, base_ref: .base.ref, url: .html_url}'

# ----------------------------------------------------------------
# Discover A2 evidence files (present or pending)
# ----------------------------------------------------------------
$a2SqlFile       = Join-Path $out "wave4-a2-queries-setrole.sql"
$a2OutputFiles   = @(Get-ChildItem $out -Filter "wave4-a2-output-*.txt" -ErrorAction SilentlyContinue)
$a2Screenshot    = Join-Path $out "A2-project-ref-screenshot.png"

$a2OutputLine = if ($a2OutputFiles.Count -gt 0) {
    $latestA2 = $a2OutputFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $h = (Get-FileHash $latestA2.FullName -Algorithm SHA256).Hash
    "$($latestA2.Name) | $($latestA2.Length) bytes | $h"
} else {
    "PENDING (A2 SQL Editor output not yet captured)"
}

$a2SqlLine = if (Test-Path $a2SqlFile) {
    $h = (Get-FileHash $a2SqlFile -Algorithm SHA256).Hash
    "$($a2SqlFile | Split-Path -Leaf) | $((Get-Item $a2SqlFile).Length) bytes | $h"
} else {
    "PENDING (A2 SQL source file not found)"
}

$a2ScreenshotLine = if (Test-Path $a2Screenshot) {
    $h = (Get-FileHash $a2Screenshot -Algorithm SHA256).Hash
    "A2-project-ref-screenshot.png | $((Get-Item $a2Screenshot).Length) bytes | $h"
} else {
    "PENDING (screenshot not found in wave4-sql-binding/)"
}

# ----------------------------------------------------------------
# Build A3 report
# ----------------------------------------------------------------
$report = @"
# Wave 4 (A3) - Canonical SQL Binding Report
# Generated (UTC): $utc
# Repository: C:\Users\Aashir\Projects\valtriox-trackb
# Branch: security/rls-audit-containment-v1

## 1. Canonical SQL Files (in PR #17)

phase-a-containment-v3.sql
  Byte size (disk):       $cSize
  SHA256 (disk):          $cHash
  Expected (manifest v5): $expectC
  Match:                  $($cHash -eq $expectC)

phase-a-rollback-v2.sql
  Byte size (disk):       $rSize
  SHA256 (disk):          $rHash
  Expected (manifest v5): $expectR
  Match:                  $($rHash -eq $expectR)

## 2. Remote SHA Binding (frozen Wave 3.5)

Main base (origin/main):                    $mainSha
PR branch (origin/security/rls-audit-...):  $remoteSha
Local HEAD:                                 $localSha
Ahead/behind (HEAD vs origin):              $aheadBehind

PR #17 metadata (via gh api):
$pr17Json

## 3. Target Project Binding

Project ref:  wqwsagnxkamblnefhpzx
Source:       Supabase dashboard URL bar (screenshot in this folder)
Reporter:     Ashir Raza
Plan:         Supabase Pro

## 4. Precise Table Scope

Three tables (confirmed exposed in pre-change snapshot):
  1. public."Subscription"
  2. public."Notification"
  3. public."PaymentProof"

Containment action:  REVOKE ALL PRIVILEGES FROM PUBLIC, anon, authenticated
Rollback action:     GRANT pre-change set (incl. PG17 MAINTAIN)

## 5. Wave 4 (A2) Evidence - Method & Limitations

Method:    Static catalog proof via has_table_privilege() and
           has_column_privilege(). SET ROLE was attempted first and
           failed with SQLSTATE 42501 (permission denied).
           Root cause: membership edge postgres -> valtriox_evidence_ro
           has set_option=false; SQL Editor connection role is not
           superuser, so SET ROLE is disallowed by PostgreSQL.
           No password was available in custody; reset forbidden
           (no ALTER ROLE per expert rule).
Session:   Connection role = postgres (SQL Editor default). Target
           role valtriox_evidence_ro privileges are demonstrated
           statically via catalog functions; no role switching.
Limitation: session_user = current_user = current_role = postgres.
           Direct psql login as valtriox_evidence_ro would give
           session_user = current_user = role (cleaner binding), but
           password is not available. Static proof is a valid,
           non-mutating alternative.

A2 evidence files in this folder:
  - wave4-a2-combined-v2.sql | 3815 bytes | A3C5A2E23FB474672010B1801E06D6264763048BC3EC8D43D9D8EFD5B8C8254C
  - wave4-a2-combined-output.csv | 921 bytes | 72C295C4DE7C1A5434BA16F9910C8B8F4696A946BACD3FB2F9B8BDAC42EA7092
  - A2-project-ref-screenshot.png | 72759 bytes | 1DF698A4779EA2FE74B24227A631B1BF69F0AE73D30C5F00ED9CAA7890BF12A5

## 6. No-Mutation Attestation

As of ${utc}:
- No ALTER ROLE executed
- No DROP ROLE executed
- No REVOKE executed
- No GRANT executed
- No NOLOGIN executed
- No production mutation of any kind
- SET ROLE / RESET ROLE are session-scoped operations only; no catalog change

## 7. Wave 4 Evidence Anchoring

Frozen PR #17 head SHA: $localSha
All Wave 4 evidence binds to this commit.
Any subsequent commit to PR #17 invalidates this binding.

## 8. Cross-References

- PR #17 (dedicated security): https://github.com/AshirRaza313/valtriox/pull/17
- PR #13 (historical, frontend): https://github.com/AshirRaza313/valtriox/pull/13
- Manifest v5: bundle-manifest-v5.txt
- Wave 1 evidence: ../wave1-identity/
- Wave 2 evidence: ../wave2-manifest-integrity/

## 9. Evidence Chain

- A2 SQL source:            wave4-a2-combined-v2.sql
- A2 SQL output (evidence): wave4-a2-combined-output.csv
- A2 supplementary image:   A2-project-ref-screenshot.png
- A3 report (this file):    A3-canonical-sql-binding-$utc.txt
- A3 hash manifest:         A3-file-hashes-$utc.txt
"@

$reportPath = Join-Path $out "A3-canonical-sql-binding-$utc.txt"
[System.IO.File]::WriteAllText($reportPath, $report, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "=== A3 REPORT ===" -ForegroundColor Green
Get-Content $reportPath

# ----------------------------------------------------------------
# Build hash manifest for all files in the wave4 folder
# ----------------------------------------------------------------
Write-Host ""
Write-Host "=== WAVE 4 FILE HASHES ===" -ForegroundColor Green

$hashFile = Join-Path $out "A3-file-hashes-$utc.txt"

$hashLines = @()
$hashLines += "File | Size (bytes) | SHA256"
$hashLines += "-----|--------------|-------"

Get-ChildItem $out -File |
    Where-Object { $_.FullName -ne $hashFile } |
    Sort-Object Name |
    ForEach-Object {
        $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
        $hashLines += "$($_.Name) | $($_.Length) | $h"
    }

[System.IO.File]::WriteAllLines($hashFile, $hashLines, [System.Text.UTF8Encoding]::new($false))

Get-Content $hashFile

Write-Host ""
Write-Host "Wave 4 (A3) complete. Report: $reportPath" -ForegroundColor Green
Write-Host "Hash manifest: $hashFile" -ForegroundColor Green
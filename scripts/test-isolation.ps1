$BASE = "http://localhost:3000"

function LoginUser($email, $password) {
    $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $csrf = Invoke-RestMethod -Method GET -Uri "$BASE/api/auth/csrf" -WebSession $s
    $token = $csrf.csrfToken
    $body = "csrfToken=$token" + "&email=$email" + "&password=$password" + "&redirect=false" + "&callbackUrl=$BASE" + "&json=true"
    Invoke-RestMethod -Method POST -Uri "$BASE/api/auth/callback/credentials" `
        -ContentType "application/x-www-form-urlencoded" -Body $body -WebSession $s | Out-Null
    return $s
}

function GetCookieSnippet($s) {
    $c = $s.Cookies.GetCookies($BASE) | Where-Object { $_.Name -eq "authjs.session-token" }
    if ($c) { return $c.Value.Substring(0, [Math]::Min(30, $c.Value.Length)) + "..." } else { return "(no session)" }
}

Write-Host ""
Write-Host "==========================================="
Write-Host " REAL API ISOLATION TEST"
Write-Host "==========================================="

# ─── TEST 1: Health check ────────────────────────────────
Write-Host ""
Write-Host "[1] Health check..."
$h = Invoke-RestMethod -Uri "$BASE/api/health"
Write-Host "    Status: $($h.status) | Env: $($h.environment)"

# ─── TEST 2: Register (idempotent — ignore errors if exists) ─
Write-Host ""
Write-Host "[2] Register users..."
try {
    $r = Invoke-RestMethod -Method POST -Uri "$BASE/api/auth/register" `
        -ContentType "application/json" `
        -Body '{"name":"Test User A","email":"usera@test.com","password":"password123"}'
    Write-Host "    User A register: $($r.message)"
} catch { Write-Host "    User A: already exists (OK)" }

try {
    $r = Invoke-RestMethod -Method POST -Uri "$BASE/api/auth/register" `
        -ContentType "application/json" `
        -Body '{"name":"Test User B","email":"userb@test.com","password":"password123"}'
    Write-Host "    User B register: $($r.message)"
} catch { Write-Host "    User B: already exists (OK)" }

# ─── TEST 3: Login ───────────────────────────────────────
Write-Host ""
Write-Host "[3] Login both users..."
$sA = LoginUser "usera@test.com" "password123"
$sB = LoginUser "userb@test.com" "password123"
Write-Host "    Session A: $(GetCookieSnippet $sA)"
Write-Host "    Session B: $(GetCookieSnippet $sB)"

# ─── TEST 4: GET leads per user ──────────────────────────
Write-Host ""
Write-Host "[4] GET /api/leads isolation check..."
$aLeads = Invoke-RestMethod -Uri "$BASE/api/leads" -WebSession $sA
$bLeads = Invoke-RestMethod -Uri "$BASE/api/leads" -WebSession $sB
$noAuthLeads = Invoke-RestMethod -Uri "$BASE/api/leads"
Write-Host "    User A leads:   $($aLeads.data.total)"
Write-Host "    User B leads:   $($bLeads.data.total)"
Write-Host "    No-auth leads:  $($noAuthLeads.data.total)"

# ─── TEST 5: Generate outreach for User A (no lead ID needed) ─
Write-Host ""
Write-Host "[5] POST /api/outreach (User A, no lead id)..."
$outreach = Invoke-RestMethod -Method POST -Uri "$BASE/api/outreach" `
    -ContentType "application/json" `
    -Body '{"business_name":"Warung Makan Jaya","niche":"restoran","location":"Denpasar, Bali"}' `
    -WebSession $sA
Write-Host "    Subject: $($outreach.data.subject)"
Write-Host "    Source:  $($outreach.data.source)"

# ─── TEST 6: Score a lead (no DB needed) ─────────────────
Write-Host ""
Write-Host "[6] POST /api/score (User A)..."
$score = Invoke-RestMethod -Method POST -Uri "$BASE/api/score" `
    -ContentType "application/json" `
    -Body '{"rating":2.5,"review_count":5,"website":""}' `
    -WebSession $sA
Write-Host "    Score: $($score.data.score) pts"
Write-Host "    Reasons: $($score.data.reasons -join ', ')"

# ─── TEST 7: Double-check isolation still holds ───────────
Write-Host ""
Write-Host "[7] Re-check isolation after outreach call..."
$aLeads2 = Invoke-RestMethod -Uri "$BASE/api/leads" -WebSession $sA
$bLeads2 = Invoke-RestMethod -Uri "$BASE/api/leads" -WebSession $sB
Write-Host "    User A leads: $($aLeads2.data.total)"
Write-Host "    User B leads: $($bLeads2.data.total)"
if ($aLeads2.data.total -ne $bLeads2.data.total -or $aLeads2.data.total -eq 0) {
    Write-Host "    PASS: data tidak bocor antar user"
} else {
    Write-Host "    WARNING: perlu dicek manual"
}

Write-Host ""
Write-Host "==========================================="
Write-Host " DONE"
Write-Host "==========================================="

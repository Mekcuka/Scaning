# Refresh Atlas Grid MCP config for Cursor (Windows: ${env:...} in HTTP headers often fails).
# Usage:
#   .\scripts\get-atlas-grid-token.ps1              # write .cursor/mcp.json (default)
#   .\scripts\get-atlas-grid-token.ps1 -McpUrl "http://127.0.0.1:8000/api/v1/mcp"
param(
    [string]$ApiUrl = "https://erascaning.duckdns.org/api/v1",
    [string]$McpUrl = "https://erascaning.duckdns.org/api/v1/mcp/",
    [string]$Email = "admin@oilgas.ru",
    [string]$Password = "admin1234",
    [switch]$SetUserEnv,
    [switch]$IncludeDevMcp
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$mcpPath = Join-Path $repoRoot ".cursor\mcp.json"

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Method Post -Uri "$ApiUrl/auth/login" -ContentType "application/json" -Body $loginBody
} catch {
    Write-Error "Login failed: $($_.Exception.Message)"
    exit 1
}

$token = $response.access_token
if (-not $token) {
    Write-Error "No access_token in response"
    exit 1
}

$backendDir = Join-Path $repoRoot "decision-matrix\backend"
$pythonExe = Join-Path $backendDir "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

$servers = @{
    "atlas-grid" = @{
        url = $McpUrl
        headers = @{
            Authorization = "Bearer $token"
        }
    }
}

if ($IncludeDevMcp) {
    $servers["atlas-grid-dev"] = @{
        command = $pythonExe
        args = @("-m", "app.assistant.dev.stdio_mcp")
        cwd = $backendDir
    }
}

$mcpConfig = @{ mcpServers = $servers } | ConvertTo-Json -Depth 5

$cursorDir = Split-Path -Parent $mcpPath
if (-not (Test-Path $cursorDir)) {
    New-Item -ItemType Directory -Path $cursorDir | Out-Null
}
# UTF-8 without BOM (BOM can break some JSON parsers)
[System.IO.File]::WriteAllText($mcpPath, $mcpConfig, [System.Text.UTF8Encoding]::new($false))

Write-Host "Wrote $mcpPath (Bearer token embedded; file is gitignored)." -ForegroundColor Green
Write-Host "In Cursor: Settings -> Tools & MCP -> reload atlas-grid (or restart Cursor)." -ForegroundColor Cyan
if ($IncludeDevMcp) {
    Write-Host "Included atlas-grid-dev stdio MCP (pytest, search, git)." -ForegroundColor Cyan
} else {
    Write-Host "Tip: add -IncludeDevMcp for local dev stdio MCP (pytest, search, git)." -ForegroundColor DarkGray
}
Write-Host "Token expires ~60 min - re-run this script when MCP returns 401." -ForegroundColor Yellow

if ($SetUserEnv) {
    [Environment]::SetEnvironmentVariable("ATLAS_GRID_ACCESS_TOKEN", $token, "User")
    Write-Host "Also saved ATLAS_GRID_ACCESS_TOKEN to user environment." -ForegroundColor Green
}

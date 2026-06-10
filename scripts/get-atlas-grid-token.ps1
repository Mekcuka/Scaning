# Refresh Atlas Grid MCP config for Cursor (Windows: ${env:...} in HTTP headers often fails).
# Usage:
#   .\scripts\get-atlas-grid-token.ps1              # prod HTTP MCP + atlas-grid-dev (default)
#   .\scripts\get-atlas-grid-token.ps1 -McpUrl "http://127.0.0.1:8002/api/v1/mcp/"
#   .\scripts\get-atlas-grid-token.ps1 -NoDevMcp    # HTTP MCP only
param(
    [string]$ApiUrl = "https://erascaning.duckdns.org/api/v1",
    [string]$McpUrl = "https://erascaning.duckdns.org/api/v1/mcp/",
    [string]$Email = "admin@oilgas.ru",
    [string]$Password = "admin1234",
    [switch]$SetUserEnv,
    [switch]$IncludeDevMcp,
    [switch]$NoDevMcp
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

# Merge with existing mcp.json so re-auth does not drop atlas-grid-dev / atlas-grid-local.
$servers = @{}
if (Test-Path $mcpPath) {
    try {
        $existing = Get-Content -Raw $mcpPath | ConvertFrom-Json
        if ($existing.mcpServers) {
            $existing.mcpServers.PSObject.Properties | ForEach-Object {
                $servers[$_.Name] = $_.Value
            }
        }
    } catch {
        Write-Warning "Could not parse existing $mcpPath - will recreate."
    }
}

$servers["atlas-grid"] = @{
    url = $McpUrl
    headers = @{
        Authorization = "Bearer $token"
    }
}

$includeDev = (-not $NoDevMcp) -or $IncludeDevMcp
if ($includeDev) {
    $servers["atlas-grid-dev"] = @{
        command = $pythonExe
        args = @("-m", "app.assistant.dev.stdio_mcp")
        cwd = $backendDir
        env = @{
            ASSISTANT_DEV_MCP_DOMAIN_TOOLS = "false"
            ASSISTANT_DEV_MCP_USER_EMAIL = "admin@test.ru"
        }
    }
}

$mcpConfig = @{ mcpServers = $servers } | ConvertTo-Json -Depth 6

$cursorDir = Split-Path -Parent $mcpPath
if (-not (Test-Path $cursorDir)) {
    New-Item -ItemType Directory -Path $cursorDir | Out-Null
}
# UTF-8 without BOM (BOM can break some JSON parsers)
[System.IO.File]::WriteAllText($mcpPath, $mcpConfig, [System.Text.UTF8Encoding]::new($false))

Write-Host "Wrote $mcpPath - Bearer token embedded, file is gitignored." -ForegroundColor Green
Write-Host "Servers: $($servers.Keys -join ', ')" -ForegroundColor Cyan
Write-Host 'In Cursor: Settings -> Tools and MCP -> Reload.' -ForegroundColor Cyan
if ($includeDev) {
    Write-Host 'atlas-grid-dev included - pytest, search, git.' -ForegroundColor Cyan
} else {
    Write-Host 'atlas-grid-dev omitted -NoDevMcp.' -ForegroundColor DarkGray
}
Write-Host 'Token expires ~60 min - re-run this script when MCP returns 401.' -ForegroundColor Yellow

if ($SetUserEnv) {
    [Environment]::SetEnvironmentVariable("ATLAS_GRID_ACCESS_TOKEN", $token, "User")
    Write-Host "Also saved ATLAS_GRID_ACCESS_TOKEN to user environment." -ForegroundColor Green
}

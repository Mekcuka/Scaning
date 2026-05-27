# Create SPPR database on local PostgreSQL + PostGIS and seed demo data.
# Usage:
#   .\scripts\setup_postgres.ps1 -SuperuserPassword "YOUR_POSTGRES_PASSWORD"
# Or:
#   $env:POSTGRES_SUPERUSER_PASSWORD = "..."
#   .\scripts\setup_postgres.ps1

param(
    [string]$SuperuserPassword = $env:POSTGRES_SUPERUSER_PASSWORD,
    [string]$DbUser = "sppr",
    [string]$DbPassword = "sppr_secret",
    [string]$DbName = "sppr",
    [string]$DbHost = "127.0.0.1",
    [int]$Port = 5432,
    [string]$Superuser = "postgres",
    [string]$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
)

$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent

if (-not $SuperuserPassword) {
    $sec = Read-Host "Password for PostgreSQL user '$Superuser'" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try {
        $SuperuserPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if (-not (Test-Path $Psql)) {
    throw "psql not found at $Psql. Adjust -Psql or install PostgreSQL 18."
}

$env:PGPASSWORD = $SuperuserPassword

function Invoke-Psql {
    param([string]$Database, [string]$Sql, [string]$User = $Superuser, [string]$Password = $null)
    if ($Password) { $env:PGPASSWORD = $Password }
    & $Psql -U $User -h $DbHost -p $Port -d $Database -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql failed (exit $LASTEXITCODE)" }
}

Write-Host "Checking PostgreSQL connection..."
Invoke-Psql -Database "postgres" -Sql "SELECT version();" | Out-Null

Write-Host "Creating role '$DbUser' if missing..."
$escapedPwd = $DbPassword.Replace("'", "''")
$createRole = (
    'DO $$ BEGIN CREATE ROLE {0} WITH LOGIN PASSWORD ''{1}''; ' +
    'EXCEPTION WHEN duplicate_object THEN ALTER ROLE {0} WITH LOGIN PASSWORD ''{1}''; END $$;'
) -f $DbUser, $escapedPwd
Invoke-Psql -Database "postgres" -Sql $createRole

Write-Host "Creating database '$DbName' if missing..."
$createDb = @"
SELECT 'exists' FROM pg_database WHERE datname = '$DbName';
"@
$exists = & $Psql -U $Superuser -h $DbHost -p $Port -d postgres -tAc $createDb
if (-not ($exists -match "exists")) {
    Invoke-Psql -Database "postgres" -Sql "CREATE DATABASE $DbName OWNER $DbUser ENCODING 'UTF8';"
} else {
    Write-Host "Database '$DbName' already exists."
}

Write-Host "Enabling PostGIS (as superuser)..."
Invoke-Psql -Database $DbName -Sql "CREATE EXTENSION IF NOT EXISTS postgis;" -Password $SuperuserPassword
$env:PGPASSWORD = $DbPassword
$pgis = & $Psql -U $DbUser -h $DbHost -p $Port -d $DbName -tAc "SELECT PostGIS_Version();"
Write-Host "PostGIS: $pgis"

$databaseUrl = "postgresql+asyncpg://${DbUser}:${DbPassword}@${DbHost}:${Port}/${DbName}"
$envFile = Join-Path $BackendRoot ".env"
$envContent = @"
DATABASE_URL=$databaseUrl
SECRET_KEY=change-me-in-production
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5173/Cursor_Scan/
"@
Set-Content -Path $envFile -Value $envContent.TrimEnd() -Encoding utf8
Write-Host "Wrote $envFile"

$env:DATABASE_URL = $databaseUrl
Push-Location $BackendRoot
try {
    Write-Host "Creating tables and seeding..."
    python seed.py
    if ($LASTEXITCODE -ne 0) { throw "seed.py failed" }
    Write-Host "Done. Start API: uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
} finally {
    Pop-Location
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

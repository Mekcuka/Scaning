# Upload /opt/decision-matrix/shared/app.env (and db.env for local Postgres) to VM.
# Usage (Managed PostgreSQL):
#   .\deploy\setup-vm-app-env.ps1 -VmHost "51.250.x.x" -PostgresHost "c-xxx.rw.mdb.yandexcloud.net"
# Usage (Postgres in Docker on VM, no Yandex MDB):
#   .\deploy\setup-vm-app-env.ps1 -VmHost "51.250.x.x" -LocalDb

param(
    [Parameter(Mandatory = $true)]
    [string] $VmHost,

    [string] $VmUser = "deploy",
    [string] $KeyPath = "$env:USERPROFILE\.ssh\yc_deploy_key",

    [switch] $LocalDb,
    [string] $PostgresHost = "",

    [int] $PostgresPort = 5432,
    [string] $PostgresUser = "sppr",
    [string] $PostgresPassword = "",
    [string] $PostgresDb = "sppr",

    [string] $CorsOrigins = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,https://mekcuka.github.io",
    [string] $SecretKey = "",

    [int] $AccessTokenExpireMinutes = 60,
    [int] $RefreshTokenExpireDays = 7,
    [string] $Algorithm = "HS256"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $KeyPath)) {
    Write-Error "SSH key not found: $KeyPath. Create with: ssh-keygen -t ed25519 -f `$env:USERPROFILE\.ssh\yc_deploy_key"
}

if ($LocalDb) {
    $PostgresHost = "db"
    $PostgresPort = 5432
} elseif (-not $PostgresHost) {
    Write-Error "Specify -PostgresHost for Managed PostgreSQL or -LocalDb for Postgres in Docker on the VM."
}

if (-not $PostgresPassword) {
    if ($LocalDb) {
        $pgBytes = New-Object byte[] 24
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($pgBytes)
        $PostgresPassword = [Convert]::ToBase64String($pgBytes) -replace '[+/=]', 'a'
        Write-Host "Generated Postgres password for local db (stored in db.env on VM only)."
    } else {
        $secure = Read-Host "Postgres password for user '$PostgresUser'" -AsSecureString
        $PostgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        )
    }
}

if (-not $SecretKey) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $SecretKey = [BitConverter]::ToString($bytes).Replace("-", "").ToLower()
    Write-Host "Generated new SECRET_KEY (saved only on VM)."
}

$encodedUser = [uri]::EscapeDataString($PostgresUser)
$encodedPass = [uri]::EscapeDataString($PostgresPassword)
$databaseUrl = "postgresql+asyncpg://${encodedUser}:${encodedPass}@${PostgresHost}:${PostgresPort}/${PostgresDb}"

$appEnv = @"
DATABASE_URL=$databaseUrl
SECRET_KEY=$SecretKey
ACCESS_TOKEN_EXPIRE_MINUTES=$AccessTokenExpireMinutes
REFRESH_TOKEN_EXPIRE_DAYS=$RefreshTokenExpireDays
CORS_ORIGINS=$CorsOrigins
ALGORITHM=$Algorithm
COOKIE_SECURE=true
"@

$localAppEnv = Join-Path $env:TEMP "decision-matrix-app.env"
Set-Content -Path $localAppEnv -Value $appEnv -Encoding UTF8 -NoNewline

$dbEnv = ""
$localDbEnv = ""
if ($LocalDb) {
    $dbEnv = @"
POSTGRES_USER=$PostgresUser
POSTGRES_PASSWORD=$PostgresPassword
POSTGRES_DB=$PostgresDb
"@
    $localDbEnv = Join-Path $env:TEMP "decision-matrix-db.env"
    Set-Content -Path $localDbEnv -Value $dbEnv -Encoding UTF8 -NoNewline
}

$sshTarget = "${VmUser}@${VmHost}"
$remoteAppTmp = "/tmp/decision-matrix-app.env"
$remoteFinalApp = "/opt/decision-matrix/shared/app.env"
$remoteDbTmp = "/tmp/decision-matrix-db.env"
$remoteFinalDb = "/opt/decision-matrix/shared/db.env"

Write-Host "Uploading to $sshTarget ..."
scp -i $KeyPath -o StrictHostKeyChecking=accept-new $localAppEnv "${sshTarget}:${remoteAppTmp}"
if ($LocalDb) {
    scp -i $KeyPath $localDbEnv "${sshTarget}:${remoteDbTmp}"
}

Write-Host "Installing on VM with permissions 600 ..."
$installDb = ""
if ($LocalDb) {
    $installDb = @"
sudo mv $remoteDbTmp $remoteFinalDb
sudo chown ${VmUser}:${VmUser} $remoteFinalDb
sudo chmod 600 $remoteFinalDb
"@
}

ssh -i $KeyPath $sshTarget @"
set -e
sudo mkdir -p /opt/decision-matrix/shared
sudo mv $remoteAppTmp $remoteFinalApp
sudo chown ${VmUser}:${VmUser} $remoteFinalApp
sudo chmod 600 $remoteFinalApp
$installDb
echo 'Installed:'
ls -la /opt/decision-matrix/shared/
"@

Remove-Item -Force $localAppEnv, $localDbEnv -ErrorAction SilentlyContinue
Write-Host "Done. Restart stack if already running:"
Write-Host "  ssh -i `"$KeyPath`" $sshTarget 'cd /opt/decision-matrix/current && docker compose up -d'"

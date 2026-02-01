param(
    [Parameter(Mandatory = $true)]
    [string]$AppName
)

$ErrorActionPreference = 'Stop'

$AppName = $AppName.Trim().ToLower()
if ($AppName -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    Write-Error "Invalid app name. Use kebab-case like 'food-shop'."
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $repoRoot ("apps\\" + $AppName)

if (Test-Path $appDir) {
    Write-Error "Target folder already exists: $appDir"
    exit 1
}

New-Item -ItemType Directory -Path $appDir | Out-Null
Push-Location $appDir
try {
    & npx -y create-vite@latest ./ --template react-ts
} finally {
    Pop-Location
}

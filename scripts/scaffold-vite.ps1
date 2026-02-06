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
$appDir = Join-Path $repoRoot ("apps" + [IO.Path]::DirectorySeparatorChar + $AppName)

if (Test-Path $appDir) {
    $entries = Get-ChildItem -LiteralPath $appDir -Force

    if ($entries.Count -eq 0) {
        Write-Host "Target folder exists but is empty. Recreating scaffold." -ForegroundColor Yellow
        Remove-Item -LiteralPath $appDir -Recurse -Force
    }
    elseif ($entries.Count -eq 1 -and $entries[0].Name -eq 'node_modules') {
        Write-Host "Target folder contains only node_modules. Cleaning and recreating scaffold." -ForegroundColor Yellow
        Remove-Item -LiteralPath $entries[0].FullName -Recurse -Force
        Remove-Item -LiteralPath $appDir -Recurse -Force
    }
    elseif (Test-Path (Join-Path $appDir 'package.json')) {
        Write-Host "package.json detected; assuming scaffold already exists. Skipping scaffold." -ForegroundColor Yellow
        exit 0
    }
    else {
        Write-Error "Target folder already exists and is not empty: $appDir"
        exit 1
    }
}

New-Item -ItemType Directory -Path $appDir | Out-Null
Push-Location $appDir
try {
    & npx -y create-vite@5.2.3 ./ --template react-ts

    # Update package.json name
    $pkgPath = Join-Path . "package.json"
    if (Test-Path $pkgPath) {
        $json = Get-Content $pkgPath -Raw | ConvertFrom-Json
        $json.name = $AppName
        $json | ConvertTo-Json -Depth 10 | Set-Content $pkgPath
    }

    # Update index.html title
    $indexPath = Join-Path . "index.html"
    if (Test-Path $indexPath) {
        (Get-Content $indexPath) -replace '<title>.*?</title>', "<title>$AppName</title>" | Set-Content $indexPath
    }

    # Copy Docker configuration from scaffold-vite
    $scaffoldSource = Join-Path $repoRoot ("apps" + [IO.Path]::DirectorySeparatorChar + "scaffold-vite")
    if (Test-Path $scaffoldSource) {
        Write-Host "Copying Docker configuration from scaffold-vite..." -ForegroundColor Cyan
        Copy-Item (Join-Path $scaffoldSource "Dockerfile") -Destination . -ErrorAction SilentlyContinue
        Copy-Item (Join-Path $scaffoldSource "nginx.conf") -Destination . -ErrorAction SilentlyContinue
        
        # Create .dockerignore
        if (-not (Test-Path ".dockerignore")) {
            "node_modules`ndist`n.git`n.env.local`n.DS_Store" | Set-Content ".dockerignore"
        }
    } else {
        Write-Warning "Reference app 'scaffold-vite' not found. Skipping Docker config copy."
    }
} finally {
    Pop-Location
}

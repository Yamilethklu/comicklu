param(
  [Parameter(Mandatory=$true)][string]$ZipPath,
  [string]$Destination = (Join-Path (Get-Location) "comick")
)
$ErrorActionPreference = "Stop"
$zip = (Resolve-Path $ZipPath).Path
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git no está instalado o no aparece en PATH." }
if (Test-Path $Destination) { throw "La carpeta destino ya existe: $Destination. Usa otra con -Destination." }
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("comick-source-" + [guid]::NewGuid().ToString("N"))
New-Item -Type Directory -Path $temporary | Out-Null
try {
  Expand-Archive -LiteralPath $zip -DestinationPath $temporary
  $source = Join-Path $temporary "comic-studio"
  if (-not (Test-Path (Join-Path $source "package.json"))) { throw "El ZIP no contiene comic-studio/package.json." }
  git clone https://github.com/Yamilethklu/comick.git $Destination
  if ($LASTEXITCODE -ne 0) { throw "No se pudo clonar el repositorio." }
  Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -notin @(".env", "node_modules", "dist", ".git", "uploads") } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
  }
  Push-Location $Destination
  try {
    git add --all
    git commit -m "feat: import ComicAI Studio source code"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el commit." }
    git push origin HEAD:main
    if ($LASTEXITCODE -ne 0) { throw "No se pudo subir. Revisa tu sesión de GitHub y permisos." }
    Write-Host "Proyecto completo publicado en https://github.com/Yamilethklu/comick"
  } finally { Pop-Location }
} finally { Remove-Item $temporary -Recurse -Force -ErrorAction SilentlyContinue }

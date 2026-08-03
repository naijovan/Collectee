[CmdletBinding()]
param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot "../collectee-asset-pack"),
    [string]$OutputRoot = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$SourceRoot = [IO.Path]::GetFullPath($SourceRoot)
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$manifestPath = Join-Path $SourceRoot "asset-manifest.json"

if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

$magick = Get-Command magick -ErrorAction SilentlyContinue
$convert = $null
$identify = $null

if (-not $magick) {
    $convert = Get-Command convert -ErrorAction SilentlyContinue
    $identify = Get-Command identify -ErrorAction SilentlyContinue
    if (-not $convert -or -not $identify -or ((& $convert.Source -version) -notmatch "ImageMagick")) {
        throw "ImageMagick is required. Install it so the 'magick' command is available."
    }
}

function Invoke-Convert {
    param([string[]]$Arguments)
    if ($script:magick) {
        & $script:magick.Source @Arguments
    } else {
        & $script:convert.Source @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        throw "ImageMagick convert failed with exit code $LASTEXITCODE"
    }
}

function Get-ImageSize {
    param([string]$Path)
    if ($script:magick) {
        $value = & $script:magick.Source identify -format "%w %h" $Path
    } else {
        $value = & $script:identify.Source -format "%w %h" $Path
    }
    if ($LASTEXITCODE -ne 0) {
        throw "ImageMagick identify failed for $Path"
    }
    $parts = $value -split "\s+"
    return @([int]$parts[0], [int]$parts[1])
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path (Join-Path $OutputRoot "images/subjects") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $OutputRoot "images/items") | Out-Null

foreach ($asset in $manifest.assets) {
    $relativePath = $asset.file -replace '/', [IO.Path]::DirectorySeparatorChar
    $inputPath = Join-Path $SourceRoot $relativePath
    $outputPath = Join-Path $OutputRoot $relativePath
    $tempOutput = "$outputPath.tmp.png"
    $size = Get-ImageSize $inputPath
    $sourceWidth = $size[0]
    $sourceHeight = $size[1]

    if ($asset.assetType -eq "hero_skin") {
        $focalParts = $asset.focalPoint -split "\s+"
        $focalX = [double]($focalParts[0].TrimEnd('%')) / 100.0
        $focalY = [double]($focalParts[1].TrimEnd('%')) / 100.0

        if (($sourceWidth / $sourceHeight) -lt 1.5) {
            $cropWidth = $sourceWidth
            $cropHeight = [Math]::Floor($sourceWidth / 1.5)
            $cropX = 0
            $cropY = [Math]::Round(($sourceHeight - $cropHeight) * $focalY)
        } else {
            $cropHeight = $sourceHeight
            $cropWidth = [Math]::Floor($sourceHeight * 1.5)
            $cropX = [Math]::Round(($sourceWidth - $cropWidth) * $focalX)
            $cropY = 0
        }

        Remove-Item $tempOutput -Force -ErrorAction SilentlyContinue
        Invoke-Convert @(
            $inputPath,
            "-crop", "${cropWidth}x${cropHeight}+${cropX}+${cropY}", "+repage",
            "-filter", "Lanczos", "-resize", "660x440!", "-colorspace", "sRGB", "-strip",
            "-define", "png:compression-level=9", $tempOutput
        )
        $generatedSize = Get-ImageSize $tempOutput
        if ($generatedSize[0] -ne 660 -or $generatedSize[1] -ne 440) {
            throw "Unexpected portrait dimensions for $($asset.id): $($generatedSize -join 'x')"
        }
        Move-Item $tempOutput $outputPath -Force
        continue
    }

    $insetById = @{
        "dota2-arcana-relic" = 30
        "lol-voidblade" = 60
        "mlbb-neon-katana" = 28
        "mlbb-rose-crystal-charm" = 72
    }
    $inset = if ($insetById.ContainsKey($asset.id)) { $insetById[$asset.id] } else { 28 }
    $side = [Math]::Min($sourceWidth, $sourceHeight)
    $cropSide = $side - (2 * $inset)

    Remove-Item $tempOutput -Force -ErrorAction SilentlyContinue
    Invoke-Convert @(
        $inputPath,
        "-crop", "${cropSide}x${cropSide}+${inset}+${inset}", "+repage",
        "-filter", "Lanczos", "-resize", "620x620!", "-colorspace", "sRGB", "-strip",
        "-define", "png:compression-level=9", $tempOutput
    )
    $generatedSize = Get-ImageSize $tempOutput
    if ($generatedSize[0] -ne 620 -or $generatedSize[1] -ne 620) {
        throw "Unexpected object dimensions for $($asset.id): $($generatedSize -join 'x')"
    }
    Move-Item $tempOutput $outputPath -Force
}

Write-Host "App-ready art written to $OutputRoot/images"
Get-ChildItem (Join-Path $OutputRoot "images") -Recurse -Filter "*.tmp.png" |
    Remove-Item -Force -ErrorAction SilentlyContinue

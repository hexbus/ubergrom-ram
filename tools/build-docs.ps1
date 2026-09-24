[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string[]]$Path,

    [switch]$All,
    [switch]$Force,
    [switch]$OpenOutput
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutputRoot = Join-Path $RepoRoot 'output\pdf'
$Renderer = Join-Path $PSScriptRoot 'docs/render-markdown-pdf.mjs'
$Stylesheet = Join-Path $PSScriptRoot 'docs/markdown-print.css'

function Resolve-Executable {
    param([string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    throw "Required executable not found. Tried: $($Candidates -join ', ')"
}

$Node = Resolve-Executable @(
    'node',
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
)

$NodeModules = if ($env:MARKDOWN_PDF_NODE_MODULES) {
    $env:MARKDOWN_PDF_NODE_MODULES
} elseif (Test-Path -LiteralPath (Join-Path $RepoRoot 'node_modules\marked')) {
    Join-Path $RepoRoot 'node_modules'
} else {
    Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
}
if (-not (Test-Path -LiteralPath (Join-Path $NodeModules 'marked'))) {
    throw "The bundled 'marked' package was not found under $NodeModules"
}
if (-not (Test-Path -LiteralPath (Join-Path $NodeModules 'playwright'))) {
    throw "The bundled 'playwright' package was not found under $NodeModules"
}

$Browser = Resolve-Executable @(
    $env:MARKDOWN_PDF_BROWSER,
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
)

function Get-SourceFiles {
    if ($Path -and $Path.Count -gt 0) {
        foreach ($item in $Path) {
            $candidate = if ([System.IO.Path]::IsPathRooted($item)) {
                $item
            } else {
                Join-Path $RepoRoot $item
            }
            $resolved = Resolve-Path -LiteralPath $candidate
            $file = Get-Item -LiteralPath $resolved.Path
            if ($file.Extension -ne '.md') {
                throw "Not a Markdown file: $($file.FullName)"
            }
            $file
        }
        return
    }

    $sources = @()
    $rootReadme = Join-Path $RepoRoot 'README.md'
    if (Test-Path -LiteralPath $rootReadme) {
        $sources += Get-Item -LiteralPath $rootReadme
    }
    $docsRoot = Join-Path $RepoRoot 'docs'
    if (Test-Path -LiteralPath $docsRoot) {
        $sources += Get-ChildItem -LiteralPath $docsRoot -Recurse -File -Filter '*.md'
    }
    $sources | Sort-Object FullName -Unique
}

$env:MARKDOWN_PDF_NODE_MODULES = $NodeModules
$env:MARKDOWN_PDF_BROWSER = $Browser
$sources = @(Get-SourceFiles)
if ($sources.Count -eq 0) {
    throw 'No Markdown source files were found.'
}

$built = @()
$skipped = @()

Push-Location $RepoRoot
try {
    foreach ($source in $sources) {
        $normalizedRoot = $RepoRoot.TrimEnd('\')
        if (-not $source.FullName.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Markdown source is outside the repository: $($source.FullName)"
        }
        $relative = $source.FullName.Substring($normalizedRoot.Length).TrimStart([char[]]'\/')
        $relativePdf = [System.IO.Path]::ChangeExtension($relative, '.pdf')
        $destination = Join-Path $OutputRoot $relativePdf

        $needsBuild = $All -or $Force -or -not (Test-Path -LiteralPath $destination)
        if (-not $needsBuild) {
            $freshness = & $Node $Renderer --input $source.FullName --output $destination --css $Stylesheet --check-stale
            if ($LASTEXITCODE -ne 0 -or $freshness -notin @('stale', 'current')) {
                throw "PDF dependency check failed for $relative"
            }
            $needsBuild = $freshness -eq 'stale'
        }

        if (-not $needsBuild) {
            $skipped += $destination
            continue
        }

        $destinationDirectory = Split-Path -Parent $destination
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        & $Node $Renderer --input $source.FullName --output $destination --css $Stylesheet
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $destination)) {
            throw "PDF rendering failed for $relative"
        }
        $built += $destination
        Write-Host "Built $relativePdf"
    }
} finally {
    Pop-Location
}

Write-Host "PDF documentation complete: $($built.Count) built, $($skipped.Count) current."
Write-Host "Output: $OutputRoot"

if ($OpenOutput) {
    Start-Process explorer.exe -ArgumentList $OutputRoot
}

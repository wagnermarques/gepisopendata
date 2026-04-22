# Tail the latest application log for Gepis Dados Abertos
# Usage: .\tail-log.ps1 [<log-file-name>]
# If no filename is provided, the newest log file in the app log folder is tailed.

$AppName = 'Gepis Dados Abertos'
$AppDirNames = @(
    'Gepis Dados Abertos',
    'com.gepis.dadosabertos',
    'com.gepisopendata.gepisopendata',
    'gepis-dados-abertos'
)

function Get-PossibleLogDirs {
    $dirs = @()
    if ($env:APPDATA) {
        foreach ($name in $AppDirNames) { $dirs += Join-Path $env:APPDATA $name }
    }
    if ($env:LOCALAPPDATA) {
        foreach ($name in $AppDirNames) { $dirs += Join-Path $env:LOCALAPPDATA $name }
    }
    if ($env:USERPROFILE) {
        foreach ($name in $AppDirNames) { $dirs += Join-Path $env:USERPROFILE ".local\share\$name" }
    }
    return $dirs | Where-Object { Test-Path $_ }
}

try {
    $possibleDirs = Get-PossibleLogDirs
    if (-not $possibleDirs) {
        Write-Host "No app data directories found for $AppName." -ForegroundColor Yellow
        Write-Host "Checked candidates:" -ForegroundColor Yellow
        $AppDirNames | ForEach-Object { Write-Host "  $_" }
        Exit 1
    }

    Write-Host "Found app data candidates:" -ForegroundColor Green
    $possibleDirs | ForEach-Object { Write-Host "  $_" }

    $logDir = $possibleDirs | ForEach-Object { Join-Path $_ 'logs' } | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $logDir) {
        Write-Host "Log directory not found in any candidate path." -ForegroundColor Yellow
        Write-Host "Checked: $($possibleDirs -join ', ')" -ForegroundColor Yellow
        Exit 1
    }

    Write-Host "Resolved log directory: $logDir" -ForegroundColor Green

    if ($args.Count -gt 0) {
        $logPath = Join-Path $logDir $args[0]
        if (-not (Test-Path $logPath)) {
            Write-Host "Specified log file not found: $logPath" -ForegroundColor Red
            Exit 1
        }
    } else {
        $logPath = Get-ChildItem -Path $logDir -Filter '*.log*' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Select-Object -ExpandProperty FullName -ErrorAction Stop
        if (-not $logPath) {
            Write-Host "No log files found in: $logDir" -ForegroundColor Yellow
            Exit 1
        }
    }

    Write-Host "Tailing log: $logPath" -ForegroundColor Green
    Get-Content -Path $logPath -Tail 50 -Wait
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Exit 1
}

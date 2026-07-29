# publish.ps1 - Commit & push static site to GitHub after daily data update.
# Triggered by scheduled task FundflowDailyPublicPush.
#
# Behavior:
#   - git fetch origin to refresh remote tracking
#   - If local is behind origin: fast-forward pull (safety net)
#   - If working tree has changes: commit them and push
#   - If nothing to do: log and exit 0
#   - All output is tee'd to logs\publish.log for post-mortem

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = 'E:\Fundflow\fundflow-public'
$logDir   = Join-Path $repoRoot 'logs'
$logFile  = Join-Path $logDir  'publish.log'
$botName  = 'Fundflow Publisher'
$botEmail = 'publisher@fundflow.local'

# Avoid git asking for credentials interactively when the helper is missing.
$env:GIT_TERMINAL_PROMPT = '0'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts   = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $line = "[{0}] [{1}] {2}" -f $ts, $Level, $Message
    Write-Host $line
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Invoke-Git {
    # PowerShell 5.1 wraps every native-command stderr line as an
    # ErrorRecord. Under $ErrorActionPreference='Stop' that becomes a
    # terminating exception even when the underlying command exits 0.
    # Workaround: temporarily flip to 'Continue' for the git call only.
    param(
        [string]   $Description,
        [string[]] $GitArgs
    )
    Write-Log ("$Description : git " + ($GitArgs -join ' '))

    $oldPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & git @GitArgs 2>&1
        $exit   = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPref
    }

    foreach ($line in $output) {
        if ($line) { Write-Log ("    " + $line.ToString().TrimEnd("`r", "`n")) }
    }
    if ($exit -ne 0) {
        throw ("$Description failed (exit {0})" -f $exit)
    }
    return $output
}

try {
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    Set-Location $repoRoot
    Write-Log ("publish.ps1 started (pid={0})" -f $PID)

    # Sanity: is this still a git repo?
    $probe = & git rev-parse --is-inside-work-tree 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Not a git repository: $repoRoot"
    }

    # core.fileMode=false keeps Windows happy when file modes drift.
    & git config core.fileMode false | Out-Null

    # Refresh origin tracking.
    Invoke-Git 'fetch' @('fetch', 'origin', 'main')

    # Are we behind / ahead of origin? Wrap in @() so .Trim() is uniform.
    $behind = (@(& git rev-list --count HEAD..origin/main))[0].Trim()
    $ahead  = (@(& git rev-list --count origin/main..HEAD))[0].Trim()
    Write-Log ("ahead={0} behind={1}" -f $ahead, $behind)

    if ([int]$behind -gt 0) {
        Invoke-Git 'pull' @('pull', '--ff-only')
    }

    # Inspect working tree. @(...) guarantees an array even when there's
    # exactly zero or one entry (StrictMode would otherwise complain that
    # a single string has no .Count).
    $statusLines = @(git status --porcelain)
    $dirtyLines  = @($statusLines | Where-Object { $_ })
    Write-Log ("working tree entries: {0}" -f $dirtyLines.Count)

    if ($dirtyLines.Count -eq 0) {
        Write-Log 'nothing to commit; exit 0'
        exit 0
    }

    # Snapshot what is about to be committed (for the log).
    Write-Log 'changes to be committed:'
    foreach ($line in $dirtyLines) { Write-Log ("  " + $line) }

    Invoke-Git 'add' @('add', '-A')

    $tradeDate = (Get-Date).ToString('yyyy-MM-dd')
    $commitMsg = "Auto-publish public snapshot $tradeDate"

    # Use --author so we keep the local committer identity (which owns
    # the push credentials) but tag the commit author as the bot.
    Invoke-Git 'commit' @('commit', "--author=`"$botName <$botEmail>`"", '-m', $commitMsg)

    Invoke-Git 'push' @('push', 'origin', 'main')

    Write-Log 'publish.ps1 succeeded'
    exit 0
}
catch {
    $msg = $_.Exception.Message
    Write-Log ("publish.ps1 FAILED: " + $msg) 'ERROR'
    exit 1
}

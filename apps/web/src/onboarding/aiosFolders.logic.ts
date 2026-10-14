/**
 * Renders the no-chat AIOS folder script from the starter preset. The committed
 * scripts/New-AiosFolders.ps1 is this output (scripts/generate-aios-folders.ts writes it);
 * a test fails when the two drift apart.
 */
export interface AiosFolderEntry {
  readonly path: string;
}

/** PowerShell single-quoted strings escape a quote by doubling it. */
function psQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Raw file on the public main branch; the installed app has no repo checkout to run it from. */
export const AIOS_FOLDERS_SCRIPT_URL =
  "https://raw.githubusercontent.com/ItzJsimp/leonidas-code/main/scripts/New-AiosFolders.ps1";

/** A leading ~/ becomes the user's home, since PowerShell would not expand it inside quotes. */
function psFolderArgument(folder: string): string {
  const underHome = folder.match(/^~(?:[\\/](.*))?$/);
  if (!underHome) return psQuote(folder);
  const rest = underHome[1] ?? "";
  return rest ? `(Join-Path $HOME ${psQuote(rest)})` : "$HOME";
}

/** One PowerShell line that creates the starter AIOS folders with no chat. */
export function buildAiosFoldersCommand(folder: string): string {
  return `& ([scriptblock]::Create((irm ${AIOS_FOLDERS_SCRIPT_URL}))) -Path ${psFolderArgument(folder)}`;
}

export function renderAiosFoldersScript(entries: readonly AiosFolderEntry[]): string {
  const entryLines = entries.map((entry) => `  ${psQuote(entry.path)}`).join("\n");

  return `# GENERATED from AIOS_PRESET (apps/web/src/onboarding/leonidasSetup.logic.ts). Do not edit by hand.
# To change it: edit the preset, then run: node scripts/generate-aios-folders.ts
# Creates the starter AIOS folders and empty files without a chat. Existing files are kept.

[CmdletBinding()]
param(
  [string]$Path = (Join-Path $HOME 'AIOS')
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($Path)
New-Item -ItemType Directory -Force -Path $root | Out-Null

$entries = @(
${entryLines}
)
foreach ($entry in $entries) {
  $target = Join-Path $root $entry
  if ($entry.EndsWith('/')) {
    New-Item -ItemType Directory -Force -Path $target | Out-Null
  } elseif (-not (Test-Path -LiteralPath $target)) {
    New-Item -ItemType File -Path $target | Out-Null
  }
}
Write-Host "AIOS folders ready at $root"
`;
}

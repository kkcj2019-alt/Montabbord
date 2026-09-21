# purge-cloud-backups.ps1 — Purge les vieux snapshots de la table Supabase `backups`
# Contexte : createFullBackup() pousse un snapshot complet toutes les 30 min vers
# enterprises/{uid}/backups/{ts} SANS rotation (le local, lui, garde 2 versions).
# Ce script garde les N plus recents (defaut 2) et supprime le reste.
#
# PREREQUIS : quota Supabase retabli (sinon l'API repond 402). Ne rien lancer tant
# que https://pywacfwhwsvidkhqsjqv.supabase.co/rest/v1/ ne repond pas 200/401.
#
# USAGE :
#   1) Simulation (aucune suppression) :
#      .\purge-cloud-backups.ps1 -EnterpriseUid "VOTRE_UID" -WhatIf
#   2) Suppression reelle (demande confirmation) :
#      .\purge-cloud-backups.ps1 -EnterpriseUid "VOTRE_UID" -Keep 2
#
# Ou trouver l'UID ? Dans l'app : F12 > Console > localStorage.getItem('mdb_enterpriseUid')

param(
  [Parameter(Mandatory = $true)][string]$EnterpriseUid,
  [int]$Keep = 2,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$Base = 'https://pywacfwhwsvidkhqsjqv.supabase.co/rest/v1/backups'
# Cle ANON publique (identique a celle embarquee dans public/supabase-sdk/mdb-supabase.js)
$AnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5d2FjZndod3N2aWRraHFzanF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDMyMTksImV4cCI6MjEwMjg3OTIxOX0.wmt5vKo189wxQ9loIYprj8PE-Xd3y0Xs_-n61UJjbls'
$Headers = @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey" }

function Invoke-Sb([string]$Method, [string]$Uri) {
  try {
    return Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -TimeoutSec 30
  } catch {
    $code = $null
    try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -eq 402) { throw "Supabase repond 402 Payment Required : quota toujours bloque. Attendez le reset du cycle, puis relancez." }
    throw "Echec API ($Method) : $($_.Exception.Message)"
  }
}

Write-Host "1) Liste des backups cloud pour enterprise_id=$EnterpriseUid ..."
$listUri = "$Base?enterprise_id=eq.$EnterpriseUid&select=ts&order=ts.desc"
$rows = @(Invoke-Sb 'GET' $listUri)
if ($rows.Count -eq 0) { Write-Host "Aucun backup cloud trouve. Rien a faire."; exit 0 }

$sorted = $rows | Sort-Object { [long]$_.ts } -Descending
Write-Host ("   -> {0} snapshot(s) cloud." -f $sorted.Count)
$sorted | Select-Object -First 5 | ForEach-Object {
  $d = ([datetime]'1970-01-01Z').AddMilliseconds([long]$_.ts).ToLocalTime()
  Write-Host ("      ts={0}  ({1})" -f $_.ts, $d.ToString('dd/MM/yyyy HH:mm'))
}
if ($sorted.Count -gt 5) { Write-Host "      ... et $($sorted.Count - 5) autre(s)." }

if ($sorted.Count -le $Keep) { Write-Host "Deja <= $Keep backup(s). Rien a supprimer."; exit 0 }

$victims = @($sorted | Select-Object -Skip $Keep)
Write-Host ""
Write-Host ("2) A supprimer : {0} snapshot(s) (garde les {1} plus recents)." -f $victims.Count, $Keep)

if ($WhatIf) {
  Write-Host "*** MODE SIMULATION : aucune suppression effectuee. Relancez sans -WhatIf pour purger. ***"
  exit 0
}

$confirm = Read-Host "Taper OUI pour confirmer la suppression definitive"
if ($confirm -ne 'OUI') { Write-Host "Annule."; exit 0 }

$deleted = 0; $failed = 0
foreach ($v in $victims) {
  $delUri = "$Base?enterprise_id=eq.$EnterpriseUid&ts=eq.$($v.ts)"
  try { Invoke-Sb 'DELETE' $delUri | Out-Null; $deleted++ }
  catch { Write-Host ("   ECHEC ts={0} : {1}" -f $v.ts, $_); $failed++ }
}
Write-Host ""
Write-Host ("Termine : {0} supprime(s), {1} echec(s). Restants : {2}." -f $deleted, $failed, ($sorted.Count - $deleted))
Write-Host "Verifiez ensuite la page Supabase Usage > Database Size (refresh jusqu'a 1h)."

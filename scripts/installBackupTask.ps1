param(
  [string]$TaskName = "ProveedorCentralBackup",
  [string]$Time = "23:30",
  [string]$Empresa = "proveedor-central"
)

$ErrorActionPreference = "Stop"

$projectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$npmPath = (Get-Command npm.cmd).Source
$backupCommand = "run backup"

if ($Empresa -and $Empresa.Trim().Length -gt 0) {
  $backupCommand = "run backup -- --empresa=$Empresa"
}

$action = New-ScheduledTaskAction `
  -Execute $npmPath `
  -Argument $backupCommand `
  -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Backup automatico diario de Firestore para Proveedor Central." `
  -Force

Write-Host "Tarea instalada: $TaskName"
Write-Host "Hora diaria: $Time"
Write-Host "Empresa: $Empresa"
Write-Host "Carpeta del proyecto: $projectDir"

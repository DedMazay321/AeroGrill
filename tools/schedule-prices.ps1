# Создаёт задачу планировщика Windows «АэроГриль — цены»: каждые 3 часа без окна
# пересчитывает цены из каталогов «Копейки» и выкладывает их в ветку prices (tools/prices.mjs --publish).
# Приложение при запуске забирает оттуда свежие цены. Повторный запуск скрипта пересоздаёт задачу.
#   powershell -ExecutionPolicy Bypass -File E:\AeroGrill\tools\schedule-prices.ps1
$root = Split-Path $PSScriptRoot
$node = (Get-Command node).Source
$name = 'АэроГриль — цены'
$a = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\conhost.exe" -Argument "--headless `"$node`" `"$root\tools\prices.mjs`" --publish" -WorkingDirectory $root
$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Hours 3)
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName $name -Action $a -Trigger $t -Settings $s -Force `
  -Description 'Пересчитывает цены АэроГриля из каталогов Копейки и выкладывает в ветку prices' | Out-Null
Write-Host "Задача «$name» создана. Журнал: $root\build\prices-publish.log"

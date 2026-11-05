@echo off
title 2021 - zaxira agenti (Sherzod PC)
set U=https://raw.githubusercontent.com/Jahongir1202/kalit/main
cd /d C:\yukbor
echo [1/4] Skriptlar tortilmoqda...
curl -sL -o wa-bridge-keeper2.cjs %U%/wa-bridge-keeper2.cjs
curl -sL -o zaxira-agent.cjs %U%/zaxira-agent.cjs
echo [2/4] Kalit yaratilmoqda...
powershell -NoProfile -Command "$t = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) }); [IO.File]::WriteAllText('C:\yukbor\zaxira.token', $t)"
echo [3/4] Kalit serverga yuborilmoqda...
%SystemRoot%\System32\OpenSSH\scp.exe -i C:\yukbor\id_yukbor -o StrictHostKeyChecking=no -o BatchMode=yes C:\yukbor\zaxira.token root@46.8.114.230:/root/zaxira.token
if errorlevel 1 (
  echo XATO: serverga ulanmadi. Jahongir akaga skrinshot yuboring.
  pause
  exit /b 1
)
echo [4/4] Qo'riqchi qayta ishga tushirilmoqda...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'wa-bridge-keeper2|zaxira-agent' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'C:\nodejs\node.exe' -ArgumentList 'wa-bridge-keeper2.cjs' -WorkingDirectory 'C:\yukbor'"
timeout /t 10 /nobreak >nul
echo.
echo TAYYOR! Jahongir akaga "TAYYOR" deb yozing. Oynani yopsa bo'ladi.
pause

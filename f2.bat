@echo off
title 2021 - yangi serverga ulash (Sherzod PC)
set U=https://raw.githubusercontent.com/Jahongir1202/kalit/main
echo [1/4] Yangi skriptlar tortilmoqda...
cd /d C:\yukbor
curl -sL -o cf-failover.cjs %U%/cf-failover.cjs
curl -sL -o wa-bridge-keeper2.cjs %U%/wa-bridge-keeper2.cjs
echo [2/4] Eski jarayonlar to'xtatilmoqda (nazoratchi 5 daqiqada qayta ko'taradi)...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'cf-failover|wa-bridge-keeper2' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo [3/4] Bazadan xavfsiz nusxa olinmoqda (1-2 daqiqa)...
C:\nodejs\node.exe -e "require('better-sqlite3')('data/yukbor.sqlite',{readonly:true}).backup('data/nusxa.sqlite').then(()=>console.log('nusxa tayyor')).catch(e=>{console.log('XATO',e.message);process.exit(1)})"
if errorlevel 1 (
  echo XATO: nusxa olinmadi. Jahongir akaga skrinshot yuboring.
  pause
  exit /b 1
)
echo [4/4] Nusxa yangi serverga yuborilmoqda (hajmiga qarab 5-30 daqiqa, kuting)...
%SystemRoot%\System32\OpenSSH\scp.exe -i C:\yukbor\id_yukbor -o StrictHostKeyChecking=no -o BatchMode=yes C:\yukbor\data\nusxa.sqlite root@46.8.114.230:/root/sherzod.sqlite
if errorlevel 1 (
  echo XATO: yuborilmadi. Jahongir akaga skrinshot yuboring.
  pause
  exit /b 1
)
del C:\yukbor\data\nusxa.sqlite 2>nul
echo.
echo TAYYOR! Jahongir akaga "TAYYOR" deb yozing. Oynani yopsa bo'ladi.
pause

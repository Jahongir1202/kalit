@echo off
title 2021 - zaxira agenti tuzatish (Sherzod PC)
cd /d C:\yukbor
echo [1/2] Tuzatilgan agent tortilmoqda...
curl -sL -o zaxira-agent.cjs "https://raw.githubusercontent.com/Jahongir1202/kalit/main/zaxira-agent.cjs?v=2"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'zaxira-agent' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'C:\nodejs\node.exe' -ArgumentList 'zaxira-agent.cjs' -WorkingDirectory 'C:\yukbor'"
echo [2/2] Tekshirilmoqda (10 soniya)...
timeout /t 10 /nobreak >nul
curl -s -m 5 http://127.0.0.1:3003/health
echo.
echo TAYYOR! Jahongir akaga "tayyor" deb yozing.
pause

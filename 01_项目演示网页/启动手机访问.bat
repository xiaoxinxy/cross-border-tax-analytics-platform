@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo E路退网页服务已准备启动
echo.
echo 电脑本机访问：
echo   http://127.0.0.1:8010/index.html
echo.
echo 手机访问方式：
echo   1. 手机和电脑连接同一个 WiFi 或热点
echo   2. 在手机浏览器输入下面其中一个电脑地址，加上 :8010/index.html
echo.
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown'} | ForEach-Object { '   http://' + $_.IPAddress + ':8010/index.html' }"
echo.
echo 如果手机打不开，请允许 Windows 防火墙访问，或换用同一 WiFi 下的另一个 IP 地址。
echo 按 Ctrl + C 可以停止服务。
echo.
python -m http.server 8010 --bind 0.0.0.0

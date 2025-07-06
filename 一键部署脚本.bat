@echo off
chcp 65001 > nul
echo 正在进入 qiros-server 目录...
cd /d "%~dp0"
echo 正在执行 npm install...
call npm install
if %errorlevel% neq 0 (
    echo npm install 失败，请检查错误信息。
    pause
    exit /b %errorlevel%
)
echo 正在执行 npm run build...
call npm run build
if %errorlevel% neq 0 (
    echo npm run build 失败，请检查错误信息。
    pause
    exit /b %errorlevel%
)
echo 部署完成！
pause
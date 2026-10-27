@echo off
chcp 65001 >nul
title 크로스핏 레벤 존다 챌린지 어플 서버
cd /d "%~dp0"
echo ========================================================
echo   크로스핏 레벤 존다(Zone Diet) 챌린지 웹앱을 시작합니다...
echo ========================================================
start "" "http://localhost:3000"
node server.js
pause

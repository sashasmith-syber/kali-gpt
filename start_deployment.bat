@echo off
echo ==========================================
echo KALI-GPT OFFENSIVE SECURITY DEPLOYMENT
echo Owner: sashasmith-syber
echo Authorization: AUTHORISED
echo ==========================================
echo.

REM Check if Docker Desktop is running
echo [*] Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo [!] Docker Desktop is not running!
    echo [*] Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo [*] Waiting for Docker to start (30 seconds)...
    timeout /t 30 /nobreak >nul
)

REM Verify Docker is now running
docker info >nul 2>&1
if errorlevel 1 (
    echo [X] Failed to start Docker Desktop
    echo [*] Please start Docker Desktop manually and re-run this script
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Build and start services
echo [*] Building and starting KALI-GPT services...
cd /d d:\kali-gpt
docker-compose down
docker-compose up -d --build

echo.
echo [*] Waiting for services to initialize (10 seconds)...
timeout /t 10 /nobreak >nul

echo.
echo ==========================================
echo DEPLOYMENT STATUS
echo ==========================================
docker-compose ps

echo.
echo ==========================================
echo OFFENSIVE MODE STATUS
echo ==========================================
type offensive_mode_activation.json | findstr "activation_status profile"

echo.
echo ==========================================
echo ACCESS URLs
echo ==========================================
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo NET REAPER Health: http://localhost:8000/net-reaper/health

echo.
echo ==========================================
echo SECURITY PROFILE: AGGRESSIVE
echo ==========================================
echo Threat Threshold: 6 (Auto-block enabled)
echo Counter-Scan: ENABLED
echo Tarpit: ENABLED
echo Block Duration: 2 hours

echo.
echo [*] Deployment complete!
echo [*] Press any key to exit...
pause >nul

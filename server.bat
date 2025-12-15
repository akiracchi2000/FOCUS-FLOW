@echo off
echo Starting FOCUS & FLOW install server...
echo 1. Browser will open at http://localhost:8000
echo 2. Click the "Install" icon in the address bar to install as Desktop App.
echo 3. Once installed, you can close this window and launch the app from Desktop.
start http://localhost:8000
python -m http.server 8000
pause

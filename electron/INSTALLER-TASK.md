# IDMAM Windows Installer - Build Task

## Context
IDMAM (Internet Download Manager AI Max) is complete at D:\IDMAM\ with 3 components:
- `app/` - Download engine server (Node.js, port 9977)
- `extension/` - Chrome Extension (Manifest V3)
- `electron/` - Desktop UI (Electron + React, build at electron/ui/build/)

## Task
Create a professional Windows installer using Electron Builder that works like IDM.

### Requirements:
1. **electron-builder** config in electron/package.json:
   - Target: NSIS installer (.exe) + portable
   - App name: IDMAM
   - Icon: electron/assets/icon.png (convert to .ico if needed)
   - Include: main.js, preload.js, src/, ui/build/, node_modules for server deps
   - Extra resources: copy app/ engine files, extension/ folder
   - Install to: C:\Program Files\IDMAM\

2. **NSIS installer customization** (electron/builder-config.yml or in package.json build):
   - Start Menu shortcut
   - Desktop shortcut  
   - Auto-start on Windows boot (registry: HKCU\Software\Microsoft\Windows\CurrentVersion\Run)
   - File associations: .idmam (optional)
   - Uninstaller that cleans up

3. **Auto-start server**: Electron main.js should automatically start the IDMAM API server (port 9977) on app launch - ALREADY DONE in electron/main.js

4. **Chrome Extension auto-install**: Copy extension files to a known location and provide a registry entry or batch script that loads it into Chrome via --load-extension flag

5. **Startup flow**:
   - Windows boots → IDMAM starts minimized to tray
   - API server starts on 127.0.0.1:9977
   - Chrome extension connects to server
   - User clicks tray icon → opens IDMAM window
   - Downloads go through IDMAM automatically

### Steps:
1. Read D:\IDMAM\electron\package.json and update the "build" section for electron-builder
2. Create D:\IDMAM\electron\assets\icon.ico (convert from png or create)
3. Create D:\IDMAM\electron\installer.nsh for NSIS customization (auto-start registry)
4. Run: cd D:\IDMAM\electron && npm install --save-dev electron-builder && npx electron-builder --win --config
5. Report: installer location, size, how to test

### Important:
- Use electron-builder (NOT electron-packager)
- NSIS target for .exe installer
- Windows 10/11 compatible
- The installer should bundle ALL dependencies so end user doesn't need Node.js
- electron/package.json must have correct "build" config

After building, report the output .exe path and file size.

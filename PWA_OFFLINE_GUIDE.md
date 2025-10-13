# Pixel Blaster - PWA Offline Play Guide

## Overview
Pixel Blaster is a fully functional Progressive Web App (PWA) that can be installed on your device and played completely offline. Once installed, the game runs independently of browser restrictions and does not require an internet connection.

## How It Works

### Service Worker & Caching
- **Offline-First Strategy**: The service worker caches all game assets on first load
- **Cached Assets**: HTML, CSS, JavaScript, manifest, and icon files
- **Runtime Caching**: Additional resources are cached as they're loaded
- **Auto-Updates**: New versions are automatically downloaded and activated in the background

### What Gets Cached
The following assets are cached for offline use:
- `/` (root path)
- `/index.html` (game HTML)
- `/style.css` (styles)
- `/game.js` (game logic)
- `/manifest.json` (PWA manifest)
- `/icon-192.png` (app icon)
- `/icon-512.png` (app icon)

## Installation Instructions

### Android Devices
1. Open the game in Chrome, Edge, or Firefox
2. Tap the menu icon (⋮) in the browser
3. Select "Install app" or "Add to Home Screen"
4. Confirm the installation
5. The app icon will appear on your home screen

### iOS Devices (iPhone/iPad)
1. Open the game in Safari browser
2. Tap the Share button (□↑) at the bottom
3. Scroll down and select "Add to Home Screen"
4. Edit the name if desired and tap "Add"
5. The app icon will appear on your home screen

### Desktop (Windows/Mac/Linux/ChromeOS)
1. Open the game in Chrome, Edge, or Brave
2. Look for the install icon (⊕) in the address bar
3. Click the icon and confirm installation
4. The game will open in its own window

## Offline Capabilities

### ✅ What Works Offline
- **Complete gameplay**: All game mechanics work without internet
- **Game state**: Progress, scores, and coins are saved locally
- **Upgrades shop**: Purchase and use perks offline
- **High scores**: Tracked and saved in browser storage
- **Settings**: All preferences persist offline
- **Loot system**: All power-ups and effects work normally
- **Full UI**: All menus, buttons, and screens function completely

### ❌ What Requires Internet
- **First-time load**: Initial visit requires internet to cache assets
- **Service worker updates**: New game versions download in background when online
- **None for gameplay**: No internet connection is needed during actual gameplay

## Technical Details

### Local Storage
The game uses browser localStorage to persist:
- High scores
- Coin balance
- Player preferences

This data is stored on your device and available offline.

### Service Worker
- **Cache Name**: `pixel-blaster-v2`
- **Strategy**: Offline-first (cache, then network)
- **Update Mechanism**: Automatic background updates
- **Skip Waiting**: New versions activate immediately

### Browser Requirements
- Modern browser with Service Worker support
- Chrome 45+, Firefox 44+, Safari 11.1+, Edge 17+
- JavaScript enabled
- LocalStorage enabled

## Benefits of Installing as PWA

### 1. Bypasses Browser Time Restrictions
When installed as a standalone app, Pixel Blaster:
- Runs independently of Chrome browser restrictions
- No time limits imposed by browser parental controls
- Works like a native app on your device

### 2. Better Performance
- Faster load times after installation
- Assets served from cache (no network latency)
- Smoother gameplay without browser overhead

### 3. Convenient Access
- Launch directly from home screen/desktop
- No need to open browser and navigate to URL
- Appears in app drawer/start menu like native apps

### 4. Offline Anywhere
- Play during flights (airplane mode)
- Play in areas with no internet
- Play without using mobile data
- No connection interruptions

## Troubleshooting

### Game Won't Load Offline
**Solution**: Visit the game once while online to cache all assets

### Old Version After Update
**Solution**: 
1. Close all game tabs/windows
2. Clear browser cache (Ctrl+Shift+Del)
3. Revisit the game URL
4. The new version will be cached automatically

### Service Worker Not Registering
**Solution**:
1. Ensure you're using HTTPS or localhost
2. Check browser console for errors (F12)
3. Verify Service Workers are enabled in browser settings

### Lost Progress/Scores
**Solution**:
- Don't clear browser data/localStorage
- Scores are device-specific (don't sync across devices)
- Reinstalling browser may clear local storage

## Privacy & Data

### What's Stored Locally
- Game assets (HTML, CSS, JS, images)
- High scores and game progress
- Coin balance
- Service worker cache

### What's NOT Collected
- No analytics or tracking
- No personal information
- No network requests during gameplay
- No data sent to external servers

## Uninstalling

### Android
- Long press the app icon → App info → Uninstall

### iOS
- Long press the app icon → Remove App → Delete App

### Desktop
- Right-click app icon → Uninstall
- Or: Browser settings → Installed apps → Remove

## Future Compatibility

The game is built with standard web technologies and follows PWA best practices. As long as browsers support:
- Service Workers
- Cache API
- Canvas API
- LocalStorage

The game will continue to work offline. These are stable, well-supported web standards.

## Support

For issues or questions:
- Check browser console (F12) for error messages
- Ensure Service Workers are supported and enabled
- Try clearing cache and revisiting the game
- Make sure JavaScript is enabled

---

**Enjoy playing Pixel Blaster offline, anytime, anywhere!** 🚀

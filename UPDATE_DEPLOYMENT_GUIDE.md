# PWA Update Deployment Guide

This document explains how the Pixel Blaster PWA update notification system works and how to deploy new versions.

## Update Notification System Overview

The update notification system ensures that all users get the latest version of Pixel Blaster without needing to manually clear their cache or reinstall the app.

### How It Works

1. **Version Detection**: When a new service worker is deployed with an updated `CACHE_NAME`, the browser detects it as a new version
2. **User Notification**: A prominent green banner appears at the top of the screen: "🚀 A new version is available!"
3. **User Control**: Users can either:
   - Click "Reload to Update" to immediately get the new version
   - Click "×" to dismiss and continue with the current version
4. **Automatic Reload**: When the user accepts, the new service worker activates and the page reloads automatically

### Key Components

#### 1. Service Worker (sw.js)
- **CACHE_NAME**: Version identifier that triggers updates (currently `pixel-blaster-v5`)
- **skipWaiting()**: Allows immediate activation when user accepts update
- **clients.claim()**: Takes control of all open tabs
- **Message Handler**: Listens for `SKIP_WAITING` command from main app

#### 2. Main App (game.js)
- **Update Detection**: Listens for `updatefound` event from service worker
- **User Notification**: Shows banner via `showUpdateNotification()` function
- **Periodic Checks**: Checks for updates every hour automatically
- **Reload Handler**: Reloads page when new service worker takes control

#### 3. UI Components
- **index.html**: Update notification banner with reload and dismiss buttons
- **style.css**: Responsive styling with slide-down animation

## Deployment Process

### For Every New Deployment

**STEP 1: Update Cache Version**

Edit `sw.js` and increment the `CACHE_NAME` version number:

```javascript
// Before
const CACHE_NAME = 'pixel-blaster-v5';
const RUNTIME_CACHE = 'pixel-blaster-runtime-v5';

// After (for next deployment)
const CACHE_NAME = 'pixel-blaster-v6';
const RUNTIME_CACHE = 'pixel-blaster-runtime-v6';
```

**STEP 2: Deploy Changes**

Deploy your updated code to the production server. This can be done via:
- Git push to deployment branch
- Manual upload to hosting service
- CI/CD pipeline

**STEP 3: Verify Update System**

After deployment:
1. Open the app in a browser that has the old version cached
2. The update notification should appear within a few seconds
3. Click "Reload to Update" to verify the new version loads

### Testing Updates Locally

To test the update system during development:

1. Start a local web server: `python3 -m http.server 8080`
2. Open http://localhost:8080 in your browser
3. Open DevTools → Application → Service Workers
4. Note the current service worker version
5. Make a change to `sw.js` (increment `CACHE_NAME`)
6. Refresh the page - a new service worker should install
7. The update notification should appear
8. Click "Reload to Update" to activate the new version

### Troubleshooting

**Update notification doesn't appear:**
- Check that `CACHE_NAME` was actually changed
- Verify the new service worker installed (DevTools → Application → Service Workers)
- Ensure there's an existing service worker running (updates don't show on first visit)

**Page doesn't reload after accepting update:**
- Check browser console for errors
- Verify the `controllerchange` event listener is working
- Try manually reloading the page

**Old version still showing after reload:**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache manually
- Check that old caches were properly deleted in service worker activate event

## Best Practices

1. **Always increment version**: Never reuse version numbers
2. **Consistent naming**: Use sequential numbering (v5, v6, v7...) for clarity
3. **Test before deploying**: Always test the update flow in a staging environment
4. **Monitor updates**: Check analytics to see how many users get the update
5. **Document changes**: Keep a changelog of what changed in each version

## Version History

- **v5**: Added update notification system with user prompt (current)
- **v4**: Previous version with auto-update (replaced)

## Technical Details

### Service Worker Lifecycle

1. **Install**: New service worker downloads and caches assets
2. **Waiting**: New service worker waits for user confirmation
3. **Activate**: User accepts, `skipWaiting()` is called, old caches cleaned up
4. **Claim**: New service worker takes control of all pages
5. **Reload**: Page reloads to run with new version

### Message Flow

```
User clicks "Reload to Update"
    ↓
game.js: newWorker.postMessage({type: 'SKIP_WAITING'})
    ↓
sw.js: Receives message, calls self.skipWaiting()
    ↓
sw.js: Activates and calls self.clients.claim()
    ↓
game.js: 'controllerchange' event fires
    ↓
game.js: window.location.reload()
    ↓
User sees new version
```

## Additional Resources

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Progressive Web Apps](https://web.dev/progressive-web-apps/)
- [Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)

(() => {
    const promptBox = document.getElementById('installPrompt');
    const message = document.getElementById('installPromptMessage');
    const action = document.getElementById('installActionBtn');
    const dismiss = document.getElementById('dismissInstallBtn');
    if (!promptBox || !message || !action || !dismiss) return;

    let deferredInstallPrompt = null;
    let promptPending = false;
    let promptMonitor = null;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    if (isStandalone) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(navigator.userAgent) &&
        !/crios|fxios|edgios|opios/i.test(navigator.userAgent);

    function isPlaying() {
        return window.gameState === 'playing';
    }

    function showPromptWhenSafe() {
        if (!promptPending || isPlaying()) return;
        if (sessionStorage.getItem('pixelBlasterInstallDismissed') === '1') {
            promptPending = false;
            stopPromptMonitor();
            return;
        }
        promptBox.hidden = false;
        promptPending = false;
        stopPromptMonitor();
    }

    function queuePrompt() {
        if (sessionStorage.getItem('pixelBlasterInstallDismissed') === '1') return;
        promptPending = true;
        showPromptWhenSafe();
        if (promptPending && !promptMonitor) {
            // Wait until the player returns to a menu or game-over screen.
            promptMonitor = window.setInterval(showPromptWhenSafe, 500);
        }
    }

    function stopPromptMonitor() {
        if (promptMonitor) {
            window.clearInterval(promptMonitor);
            promptMonitor = null;
        }
    }

    function hidePrompt() {
        promptBox.hidden = true;
        promptPending = false;
        stopPromptMonitor();
        sessionStorage.setItem('pixelBlasterInstallDismissed', '1');
    }

    dismiss.addEventListener('click', hidePrompt);

    if (isIOS) {
        message.textContent = isSafari
            ? 'Install from Safari: tap Share, then choose “Add to Home Screen”. If offered, switch on “Open as Web App”.'
            : 'To install Pixel Blaster on iPhone or iPad, open this page in Safari, tap Share, then choose “Add to Home Screen”.';
        action.textContent = isSafari ? 'Got it' : 'How to install';
        action.addEventListener('click', hidePrompt);
        window.addEventListener('load', () => window.setTimeout(queuePrompt, 900), { once: true });
    } else {
        window.addEventListener('beforeinstallprompt', event => {
            // Preserve the native install event, but never interrupt an active run.
            event.preventDefault();
            deferredInstallPrompt = event;
            action.textContent = 'Install';
            message.textContent = 'Add Pixel Blaster to your home screen for quick access and a full-screen game.';
            queuePrompt();
        });

        action.addEventListener('click', async () => {
            if (!deferredInstallPrompt) {
                hidePrompt();
                return;
            }
            const installEvent = deferredInstallPrompt;
            deferredInstallPrompt = null;
            promptBox.hidden = true;
            try {
                await installEvent.prompt();
                const choice = await installEvent.userChoice;
                if (choice && choice.outcome === 'accepted') {
                    sessionStorage.setItem('pixelBlasterInstallDismissed', '1');
                }
            } catch (error) {
                console.warn('Pixel Blaster install prompt failed:', error);
            }
        });

        // Some Android browsers never dispatch beforeinstallprompt. Queue
        // manual instructions and show them only after the run has ended.
        if (/android/i.test(navigator.userAgent)) {
            window.addEventListener('load', () => {
                window.setTimeout(() => {
                    if (deferredInstallPrompt || !promptBox.hidden) return;
                    message.textContent = 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”. If neither appears, open this page directly in Chrome.';
                    action.textContent = 'Got it';
                    action.onclick = hidePrompt;
                    queuePrompt();
                }, 2500);
            }, { once: true });
        }
    }

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        promptBox.hidden = true;
        sessionStorage.setItem('pixelBlasterInstallDismissed', '1');
    });
})();

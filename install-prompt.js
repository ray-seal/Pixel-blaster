(() => {
    const promptBox = document.getElementById('installPrompt');
    const message = document.getElementById('installPromptMessage');
    const action = document.getElementById('installActionBtn');
    const dismiss = document.getElementById('dismissInstallBtn');
    if (!promptBox || !message || !action || !dismiss) return;

    let deferredInstallPrompt = null;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    if (isStandalone) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(navigator.userAgent) &&
        !/crios|fxios|edgios|opios/i.test(navigator.userAgent);

    function showPrompt() {
        if (sessionStorage.getItem('pixelBlasterInstallDismissed') === '1') return;
        promptBox.hidden = false;
    }

    function hidePrompt() {
        promptBox.hidden = true;
        sessionStorage.setItem('pixelBlasterInstallDismissed', '1');
    }

    dismiss.addEventListener('click', hidePrompt);

    if (isIOS) {
        message.textContent = isSafari
            ? 'Install from Safari: tap Share, then choose “Add to Home Screen”. If offered, switch on “Open as Web App”.'
            : 'To install Pixel Blaster on iPhone or iPad, open this page in Safari, tap Share, then choose “Add to Home Screen”.';
        action.textContent = isSafari ? 'Got it' : 'How to install';
        action.addEventListener('click', hidePrompt);
        window.addEventListener('load', () => window.setTimeout(showPrompt, 900), { once: true });
        return;
    }

    window.addEventListener('beforeinstallprompt', event => {
        // Keep the browser's native install sheet available for our button.
        event.preventDefault();
        deferredInstallPrompt = event;
        action.textContent = 'Install';
        message.textContent = 'Add Pixel Blaster to your home screen for quick access and a full-screen game.';
        showPrompt();
    });

    action.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
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

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        promptBox.hidden = true;
        sessionStorage.setItem('pixelBlasterInstallDismissed', '1');
    });
})();

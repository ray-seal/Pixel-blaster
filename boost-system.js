(function () {
    if (typeof window === 'undefined') return;
    const KEYS_TO_PRESERVE = ['coins','highScore','globalHighScores','queuedScores','purchasedPerks','equippedPerks'];

    function restoreLocalStateFallback() {
        try {
            const backup = localStorage.getItem('pixel-blaster-localbackup-v1');
            if (!backup) return;
            const snap = JSON.parse(backup);
            KEYS_TO_PRESERVE.forEach(key => {
                if ((localStorage.getItem(key) === null || localStorage.getItem(key) === undefined) && snap[key] !== undefined) {
                    localStorage.setItem(key, typeof snap[key] === 'string' ? snap[key] : JSON.stringify(snap[key]));
                    console.log('Restored', key, 'from backup');
                }
            });
        } catch (e) { console.warn('restoreLocalStateFallback', e); }
    }

    function saveLocalStateBackup() {
        try {
            const snap = {};
            KEYS_TO_PRESERVE.forEach(key => {
                const v = localStorage.getItem(key);
                try { snap[key] = JSON.parse(v); } catch { snap[key] = v; }
            });
            localStorage.setItem('pixel-blaster-localbackup-v1', JSON.stringify(snap));
            console.log('Saved local state backup');
        } catch (e) { console.warn('saveLocalStateBackup', e); }
    }

    restoreLocalStateFallback();

    // Boost UI
    function ensureBoostUI() {
        if (!document.getElementById('boostContainer')) {
            const cont = document.createElement('div');
            cont.id = 'boostContainer';
            cont.setAttribute('aria-hidden','true');
            cont.innerHTML = `
                <div id="boostLabel">BOOST</div>
                <div id="boostBar"><div id="boostFill"></div></div>`;
            const gameContainer = document.getElementById('gameContainer') || document.body;
            gameContainer.appendChild(cont);
        }
    }
    ensureBoostUI();

    // Initialize player boost fields if missing
    function ensurePlayerBoost() {
        try {
            if (!window.player) return;
            if (typeof window.player.boost === 'undefined') window.player.boost = 1.0;
            if (typeof window.player.boostMax === 'undefined') window.player.boostMax = 1.0;
            if (typeof window.player.boostDrainSeconds === 'undefined') window.player.boostDrainSeconds = 3.0; // hold to deplete in 3s
        } catch (e) { console.warn('ensurePlayerBoost', e); }
    }
    ensurePlayerBoost();

    let isPointerDown = false;

    function onPressStart(e) {
        try { e.preventDefault(); } catch {}
        isPointerDown = true;
        if (typeof window.isThrusting !== 'undefined' && window.gameState === 'playing') {
            window.isThrusting = true;
            window.isShooting = true;
        }
    }
    function onPressEnd(e) {
        try { e.preventDefault(); } catch {}
        isPointerDown = false;
        // instant refill on release
        try { if (window.player) window.player.boost = window.player.boostMax; } catch (e) {}
        if (typeof window.isThrusting !== 'undefined') window.isThrusting = false;
        if (typeof window.isShooting !== 'undefined') window.isShooting = false;
    }

    // Wire to canvas if present
    try {
        const c = document.getElementById('gameCanvas');
        if (c) {
            c.addEventListener('touchstart', onPressStart, {passive:false});
            c.addEventListener('touchend', onPressEnd, {passive:false});
            c.addEventListener('mousedown', onPressStart);
            c.addEventListener('mouseup', onPressEnd);
        }
    } catch (e) { console.warn('boost input wiring', e); }

    function updateBoost() {
        try {
            ensurePlayerBoost();
            if (!window.player) return;
            const dt = typeof window.deltaTime === 'number' ? window.deltaTime : 1;
            if (isPointerDown && window.isThrusting && window.gameState === 'playing') {
                const drainPerSecond = 1 / window.player.boostDrainSeconds;
                window.player.boost = Math.max(0, window.player.boost - drainPerSecond * dt);
                if (window.player.boost <= 0) {
                    // prevent further thrust until release
                    window.isThrusting = false;
                }
            }
            // update DOM bar
            const fill = document.getElementById('boostFill');
            if (fill) fill.style.transform = `scaleX(${Math.max(0, window.player.boost)})`;
        } catch (e) { console.warn('updateBoost', e); }
    }

    // Wrap drawStars to call updateBoost() each frame (safe place in render pipeline)
    if (typeof window.drawStars === 'function' && !window._boostPatchedDraw) {
        window._boostPatchedDraw = true;
        const _orig = window.drawStars;
        window.drawStars = function (...args) {
            const res = _orig.apply(this, args);
            updateBoost();
            return res;
        };
    }

    // Patch showUpdateNotification to save backup before SKIP_WAITING
    if (typeof window.showUpdateNotification === 'function' && !window._boostPatchedUpdate) {
        window._boostPatchedUpdate = true;
        const orig = window.showUpdateNotification;
        window.showUpdateNotification = function (newWorker) {
            // wrap updateBtn handler after calling original to preserve UI setup
            orig.apply(this, [newWorker]);
            try {
                const updateBtn = document.getElementById('updateBtn');
                if (updateBtn) {
                    const oldOnclick = updateBtn.onclick;
                    updateBtn.onclick = function () {
                        try { saveLocalStateBackup(); } catch (e) { console.warn(e); }
                        if (typeof oldOnclick === 'function') oldOnclick.apply(this, arguments);
                        else newWorker.postMessage({type:'SKIP_WAITING'});
                        document.getElementById('updateNotification').style.display = 'none';
                    };
                }
            } catch (e) { console.warn('patch update button', e); }
        };
    }

    // Expose helpers for manual use
    window.saveLocalStateBackup = saveLocalStateBackup;
    window.restoreLocalStateFallback = restoreLocalStateFallback;

})();

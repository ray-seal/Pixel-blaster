(function () {
    // Wait for canvas, ctx, and player to be available
    if (typeof window.canvas === 'undefined' || typeof window.ctx === 'undefined') {
        console.warn('edge-hazards: canvas or ctx not available yet');
        return;
    }
    if (typeof window.player === 'undefined') {
        console.warn('edge-hazards: player not available yet');
        return;
    }

    window.edgeHazards = window.edgeHazards || {
        ceilingThickness: 8,
        floorThickness: 8,
        nextChange: Date.now() + 3000
    };

    window._lastEdgeDamageTime = window._lastEdgeDamageTime || 0;
    const EDGE_DAMAGE_COOLDOWN = 500;

    function spawnEdgeHazards() {
        const canvas = window.canvas;
        const minThickness = 8;
        const maxCandidate = Math.max(minThickness, Math.floor(canvas.height * 0.06));
        const ceil = minThickness + Math.floor(Math.random() * Math.max(1, maxCandidate - minThickness + 1));
        const floor = minThickness + Math.floor(Math.random() * Math.max(1, maxCandidate - minThickness + 1));
        window.edgeHazards.ceilingThickness = ceil;
        window.edgeHazards.floorThickness = floor;
        window.edgeHazards.nextChange = Date.now() + 1500 + Math.floor(Math.random() * 3500);
    }

    function drawEdgeHazards() {
        const canvas = window.canvas;
        const ctx = window.ctx;
        const width = canvas.width;
        const ceilH = window.edgeHazards.ceilingThickness;
        const floorH = window.edgeHazards.floorThickness;

        const g1 = ctx.createLinearGradient(0, 0, 0, Math.max(ceilH, 1));
        g1.addColorStop(0, 'rgba(120, 180, 255, 0.22)');
        g1.addColorStop(1, 'rgba(120, 180, 255, 0.06)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, ceilH);

        const g2 = ctx.createLinearGradient(0, canvas.height - Math.max(floorH, 1), 0, canvas.height);
        g2.addColorStop(0, 'rgba(120, 180, 255, 0.06)');
        g2.addColorStop(1, 'rgba(120, 180, 255, 0.22)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, canvas.height - floorH, width, floorH);

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < 6; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * ceilH);
            ctx.fillRect(x, y, 1, 1);
            const y2 = canvas.height - Math.floor(Math.random() * floorH) - 1;
            ctx.fillRect(x, y2, 1, 1);
        }
    }

    if (typeof window.startGame === 'function' && !window._edgeHazardsPatchedStart) {
        window._edgeHazardsPatchedStart = true;
        const _origStartGame = window.startGame;
        window.startGame = function (...args) {
            const res = _origStartGame.apply(this, args);
            spawnEdgeHazards();
            try {
                const gameContainer = document.getElementById('gameContainer');
                let perkPanel = document.getElementById('perkPanel');
                if (!perkPanel && gameContainer) {
                    perkPanel = document.createElement('div');
                    perkPanel.id = 'perkPanel';
                    gameContainer.appendChild(perkPanel);
                }
                const shopPerkButtons = document.getElementById('perkButtons');
                if (shopPerkButtons && perkPanel) {
                    perkPanel.innerHTML = '';
                    const clones = shopPerkButtons.cloneNode(true);
                    const buttons = clones.querySelectorAll('button, .perk-item, .perk-btn');
                    if (buttons.length) {
                        buttons.forEach(btn => {
                            btn.classList.add('perk-btn');
                        });
                        perkPanel.appendChild(clones);
                    } else {
                        const fallback = document.createElement('div');
                        fallback.className = 'perk-placeholder';
                        fallback.textContent = 'Perks';
                        perkPanel.appendChild(fallback);
                    }
                }
            } catch (e) {
                console.warn('perk panel wiring failed', e);
            }
            return res;
        };
    }

    if (typeof window.checkCollisions === 'function' && !window._edgeHazardsPatchedCollision) {
        window._edgeHazardsPatchedCollision = true;
        const _origCheckCollisions = window.checkCollisions;
        window.checkCollisions = function (...args) {
            const res = _origCheckCollisions.apply(this, args);

            try {
                const player = window.player;
                const canvas = window.canvas;
                if (!player || !canvas) return res;
                
                const now = Date.now();
                const ceilH = window.edgeHazards.ceilingThickness;
                const floorH = window.edgeHazards.floorThickness;

                if (player.y < ceilH) {
                    if (now - window._lastEdgeDamageTime > EDGE_DAMAGE_COOLDOWN) {
                        if (!player.invincible) {
                            if (typeof window.takeDamage === 'function') window.takeDamage();
                        }
                        window._lastEdgeDamageTime = now;
                    }
                    player.y = Math.max(ceilH, player.y);
                    if (player.velocityY < 0) player.velocityY = 0;
                }

                if (player.y + player.height > canvas.height - floorH) {
                    if (now - window._lastEdgeDamageTime > EDGE_DAMAGE_COOLDOWN) {
                        if (!player.invincible) {
                            if (typeof window.takeDamage === 'function') window.takeDamage();
                        }
                        window._lastEdgeDamageTime = now;
                    }
                    player.y = Math.min(canvas.height - floorH - player.height, player.y);
                    if (player.velocityY > 0) player.velocityY = 0;
                }
            } catch (e) {
                console.warn('edge collision error', e);
            }

            return res;
        };
    }

    if (typeof window.drawStars === 'function' && !window._edgeHazardsPatchedDraw) {
        window._edgeHazardsPatchedDraw = true;
        const _origDrawStars = window.drawStars;
        window.drawStars = function (...args) {
            const res = _origDrawStars.apply(this, args);

            if (Date.now() > window.edgeHazards.nextChange) {
                spawnEdgeHazards();
            }

            try {
                drawEdgeHazards();
            } catch (e) {
                console.warn('edge draw error', e);
            }

            return res;
        };
    }

    if (typeof window.resizeCanvas === 'function' && !window._edgeHazardsPatchedResize) {
        window._edgeHazardsPatchedResize = true;
        const _origResize = window.resizeCanvas;
        window.resizeCanvas = function (...args) {
            const res = _origResize.apply(this, args);
            const canvas = window.canvas;
            if (canvas) {
                window.edgeHazards.ceilingThickness = Math.max(8, Math.min(window.edgeHazards.ceilingThickness, Math.floor(canvas.height / 2)));
                window.edgeHazards.floorThickness = Math.max(8, Math.min(window.edgeHazards.floorThickness, Math.floor(canvas.height / 2)));
            }
            return res;
        };
    }

    try {
        if ((typeof window.gameState !== 'undefined' && window.gameState === 'playing') || (typeof window.startGame === 'function')) {
            spawnEdgeHazards();
        }
    } catch (e) {}

})();

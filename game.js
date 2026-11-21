// Game constants
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuScreen = document.getElementById('menu');
const gameOverScreen = document.getElementById('gameOver');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('score');
const healthDisplay = document.getElementById('health');
const finalScoreDisplay = document.getElementById('finalScore');
const highScoreDisplay = document.getElementById('highScore');
const highScoreTable = document.getElementById('highScoreTable');
const highScoreList = document.getElementById('highScoreList');
const newHighScorePrompt = document.getElementById('newHighScorePrompt');
const highScoreName = document.getElementById('highScoreName');
const submitHighScore = document.getElementById('submitHighScore');
const highScoreBtn = document.getElementById('highScoreBtn');
const menuLeaderboardBtn = document.getElementById('menuLeaderboardBtn');
const homeLeaderboard = document.getElementById('homeLeaderboard');
const homeLeaderboardEntries = document.getElementById('homeLeaderboardEntries');
const backToMenuFromScores = document.getElementById('backToMenuFromScores');

// Neon leaderboard API. Database credentials stay server-side in Vercel.
const LEADERBOARD_API = '/api/scores';
let leaderboardConnectionStatus = 'unknown'; // unknown, connected, error, offline

const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
};

async function leaderboardRequest(path = '', options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
        const response = await fetch(`${LEADERBOARD_API}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            signal: controller.signal,
            cache: 'no-store'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Leaderboard request failed (${response.status})`);
        return payload;
    } finally {
        clearTimeout(timeout);
    }
}

async function retryWithBackoff(fn, context = '', retryCount = 0) {
    try {
        return await fn();
    } catch (error) {
        if (retryCount >= RETRY_CONFIG.maxRetries) {
            console.error(`✗ ${context} failed after ${RETRY_CONFIG.maxRetries} retries:`, error.message);
            throw error;
        }
        const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
            RETRY_CONFIG.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, context, retryCount + 1);
    }
}

// Online/offline status
let isOnline = navigator.onLine;
window.addEventListener('online', () => {
    console.log('🌐 Network connection restored');
    isOnline = true;
    leaderboardConnectionStatus = 'unknown';
    fetchGlobalHighScores();
    syncQueuedScores();
});
window.addEventListener('offline', () => {
    console.log('📴 Network connection lost - switching to offline mode');
    isOnline = false;
    leaderboardConnectionStatus = 'offline';
});

// Queued scores for offline support
let queuedScores = JSON.parse(localStorage.getItem('queuedScores') || '[]');

// Tunnel generation variables (declared early for use in resizeCanvas)
let tunnelGap = 180;
let tunnelWidth = 60;
let nextTunnelX = 0; // Will be set after canvas initialization

// Canvas setup
function resizeCanvas() {
    // Detect orientation
    const isPortrait = window.innerHeight > window.innerWidth;
    
    if (isPortrait) {
        // Portrait mode: limit width, allow more height
        canvas.width = Math.min(window.innerWidth, 600);
        canvas.height = Math.min(window.innerHeight, 900);
    } else {
        // Landscape mode: optimize for wider screens
        canvas.width = Math.min(window.innerWidth, 900);
        canvas.height = Math.min(window.innerHeight, 600);
    }
    
    // Update tunnel gap based on canvas height for better gameplay
    tunnelGap = Math.max(canvas.height * 0.25, 150);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100); // Delay to ensure orientation change completes
});

// Game state
window.gameState = 'menu'; // menu, playing, gameOver
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
let gameSpeed = 2;
let distanceTraveled = 0;
let coins = parseInt(localStorage.getItem('coins')) || 0;
let lastScoreMilestone = 0;

// High score table management
let globalHighScores = JSON.parse(localStorage.getItem('globalHighScores') || '[]');

async function addHighScore(name, score, distance) {
    const highScoreEntry = {
        name: name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3),
        score: Math.max(0, Math.floor(score)),
        distance: Math.max(0, Math.floor(distance))
    };

    globalHighScores.push(highScoreEntry);
    globalHighScores.sort((a, b) => b.score - a.score);
    globalHighScores = globalHighScores.slice(0, 20);
    localStorage.setItem('globalHighScores', JSON.stringify(globalHighScores));
    renderHomeLeaderboard();
    console.log('✓ High score saved locally:', highScoreEntry);

    if (!isOnline) {
        queueScore(highScoreEntry);
        leaderboardConnectionStatus = 'offline';
        return;
    }

    try {
        await retryWithBackoff(
            () => leaderboardRequest('', { method: 'POST', body: JSON.stringify(highScoreEntry) }),
            'High score submission'
        );
        leaderboardConnectionStatus = 'connected';
        await fetchGlobalHighScores();
    } catch (err) {
        console.warn('Leaderboard unavailable; score queued locally:', err.message);
        queueScore(highScoreEntry);
        leaderboardConnectionStatus = 'error';
    }
}

function queueScore(scoreEntry) {
    queuedScores.push(scoreEntry);
    localStorage.setItem('queuedScores', JSON.stringify(queuedScores));
    console.log('Score queued for later submission');
}

async function syncQueuedScores() {
    if (!isOnline || queuedScores.length === 0) return;

    const scoresToSync = [...queuedScores];
    const failedScores = [];
    queuedScores = [];
    localStorage.setItem('queuedScores', JSON.stringify(queuedScores));

    for (const scoreEntry of scoresToSync) {
        try {
            await retryWithBackoff(
                () => leaderboardRequest('', { method: 'POST', body: JSON.stringify(scoreEntry) }),
                `Syncing score for ${scoreEntry.name}`
            );
        } catch (err) {
            console.warn('Could not sync queued score:', err.message);
            failedScores.push(scoreEntry);
        }
    }

    queuedScores = failedScores;
    localStorage.setItem('queuedScores', JSON.stringify(queuedScores));
    if (failedScores.length === 0) {
        await fetchGlobalHighScores();
    } else {
        leaderboardConnectionStatus = 'error';
    }
}

async function fetchGlobalHighScores() {
    if (!isOnline) {
        leaderboardConnectionStatus = 'offline';
        return;
    }

    try {
        const payload = await retryWithBackoff(
            () => leaderboardRequest(''),
            'Fetch global high scores'
        );
        if (Array.isArray(payload.scores)) {
            globalHighScores = payload.scores.slice(0, 20);
            localStorage.setItem('globalHighScores', JSON.stringify(globalHighScores));
        }
        leaderboardConnectionStatus = 'connected';
        renderHomeLeaderboard();
    } catch (err) {
        console.warn('Using cached leaderboard scores:', err.message);
        leaderboardConnectionStatus = 'error';
    }
}

function renderHomeLeaderboard() {
    if (!homeLeaderboardEntries) return;
    const leaders = [...globalHighScores]
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, 3);
    if (leaders.length === 0) {
        homeLeaderboardEntries.innerHTML = '<div class="home-leaderboard-empty">NO SCORES YET</div>';
        return;
    }
    homeLeaderboardEntries.innerHTML = leaders.map((entry, index) => `
        <div class="home-leader-row rank-${index + 1}">
            <span class="home-leader-rank">${['①', '②', '③'][index]}</span>
            <span class="home-leader-name">${String(entry.name || '---').replace(/[^A-Z0-9]/gi, '').slice(0, 3)}</span>
            <strong class="home-leader-score">${Math.max(0, Number(entry.score) || 0).toLocaleString()}</strong>
        </div>
    `).join('');
}

function isHighScore(score) {
    if (globalHighScores.length < 20) return true;
    return Math.floor(score) > globalHighScores[globalHighScores.length - 1].score;
}

function displayHighScores() {
    highScoreList.innerHTML = '';
    
    // Add connection status indicator
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'text-align: center; padding: 10px; margin-bottom: 10px; font-size: 0.9rem; border-radius: 5px;';
    
    let statusIcon = '';
    let statusText = '';
    let statusColor = '';
    
    if (!isOnline) {
        statusIcon = '📴';
        statusText = 'Offline Mode - Showing cached scores';
        statusColor = '#888';
    } else if (leaderboardConnectionStatus === 'connected') {
        statusIcon = '🌐';
        statusText = 'Global Leaderboard - Neon Online';
        statusColor = '#00ff00';
    } else if (leaderboardConnectionStatus === 'error') {
        statusIcon = '⚠';
        statusText = 'Connection Issues - Showing cached scores';
        statusColor = '#ffaa00';
    } else {
        statusIcon = '🔄';
        statusText = 'Checking leaderboard...';
        statusColor = '#888';
    }
    
    statusDiv.innerHTML = `<span style="color: ${statusColor};">${statusIcon} ${statusText}</span>`;
    
    // Add queued scores indicator if any
    if (queuedScores.length > 0) {
        const queuedDiv = document.createElement('div');
        queuedDiv.style.cssText = 'text-align: center; padding: 5px; font-size: 0.85rem; color: #ffaa00;';
        queuedDiv.textContent = `📥 ${queuedScores.length} score(s) queued for sync`;
        statusDiv.appendChild(queuedDiv);
    }
    
    highScoreList.appendChild(statusDiv);
    
    if (globalHighScores.length === 0) {
        highScoreList.innerHTML += '<p style="color: #888; text-align: center; padding: 20px;">No high scores yet. Be the first!</p>';
        return;
    }
    
    globalHighScores.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'high-score-entry' + (index < 3 ? ' top3' : '');
        
        // Format date if available
        let dateStr = '';
        if (entry.created_at) {
            const date = new Date(entry.created_at);
            dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        // Format distance - handle both old entries without distance and new ones
        const distanceStr = entry.distance ? `${entry.distance}m` : '-';
        
        div.innerHTML = `
            <span class="high-score-rank">${index + 1}.</span>
            <span class="high-score-name">${entry.name}</span>
            <span class="high-score-score">${entry.score.toLocaleString()}</span>
            <span class="high-score-distance">${distanceStr}</span>
            <span class="high-score-date">${dateStr}</span>
        `;
        highScoreList.appendChild(div);
    });
}

// Progressive difficulty system
let enemySpawnRate = 0.005; // Start with fewer enemies (0.5% chance per frame)

// Score-based upgrades tracking
let playerColorIndex = 0;
let enemyColorIndex = 0;
let baseShootCooldown = 15;
let shootingEnemiesEnabled = false;
let enemyFireSpeed = 3; // Speed of enemy bullets

// Delta time tracking for consistent game speed across devices
let lastFrameTime = 0;
window.deltaTime = 0;
const TARGET_FPS = 60;
const TARGET_FRAME_TIME = 1000 / TARGET_FPS; // 16.67ms per frame at 60 FPS

// Player
const player = {
    x: 100,
    y: canvas.height / 2,
    width: 20,
    height: 12,
    velocityY: 0,
    gravity: 0.3,
    thrust: -6,
    health: 3,
    maxHealth: 3,
    shootCooldown: 0,
    color: '#00ff00',
    // Loot effect flags
    doubleShot: false,
    bigEnemyMode: false,
    obstacleMode: false,
    originalWidth: 20,
    originalHeight: 12,
    // Shield perk
    hasShield: false
};

// Expose to window for edge-hazards.js
window.canvas = canvas;
window.ctx = ctx;
window.player = player;

// Color palettes for distance-based upgrades
const playerColors = ['#00ff00', '#00ffff', '#ffff00', '#ff00ff', '#ff8800', '#00ff88'];
const enemyBaseColors = ['#ff0066', '#ff3366', '#ff6600', '#ff00aa', '#cc00ff', '#ff0033'];

// Game objects arrays
let tunnels = [];
let enemies = [];
let bullets = [];
let particles = [];
let powerups = [];
let lootDrops = [];
let obstacles = []; // Random obstacles spawned by loot effects
let enemyBullets = []; // Bullets fired by shooting enemies
let coins_on_screen = []; // Coin pickups

// Active effects tracking
let activeEffects = [];

// Purchased perks inventory
let purchasedPerks = JSON.parse(localStorage.getItem('purchasedPerks') || '{}');

// Equipped perks for game start
let equippedPerks = JSON.parse(localStorage.getItem('equippedPerks') || '[]');

/**
 * LOOT DROP SYSTEM
 * 
 * Loot types are defined in a registry for easy extensibility.
 * Each loot type has:
 * - id: unique identifier
 * - name: display name
 * - color: visual color for the loot drop
 * - shape: 'circle' or 'square' for visual distinction
 * - duration: effect duration in milliseconds
 * - type: 'beneficial' or 'challenging'
 * - apply: function to apply the effect
 * - remove: function to remove the effect when it expires
 */
const LOOT_TYPES = {
    DOUBLE_SHOT: {
        id: 'double_shot',
        name: 'Double Shot',
        color: '#00ffff',
        shape: 'circle',
        duration: 8000,
        type: 'beneficial',
        apply: () => {
            player.doubleShot = true;
        },
        remove: () => {
            player.doubleShot = false;
        }
    },
    BIGGER_ENEMIES: {
        id: 'bigger_enemies',
        name: 'Big Enemy Spawner',
        color: '#ff00ff',
        shape: 'circle',
        duration: 10000,
        type: 'beneficial',
        apply: () => {
            player.bigEnemyMode = true;
        },
        remove: () => {
            player.bigEnemyMode = false;
        }
    },
    EXTRA_LIFE: {
        id: 'extra_life',
        name: 'Extra Life',
        color: '#00ff00',
        shape: 'circle',
        duration: 0, // Instant effect
        type: 'beneficial',
        apply: () => {
            // Grant one additional life (can exceed maxHealth for extra lives)
            player.health++;
        },
        remove: () => {
            // No removal needed for instant effect
        }
    },
    RANDOM_OBSTACLES: {
        id: 'random_obstacles',
        name: 'Random Obstacles',
        color: '#ff4400',
        shape: 'square',
        duration: 8000,
        type: 'challenging',
        apply: () => {
            player.obstacleMode = true;
        },
        remove: () => {
            player.obstacleMode = false;
        }
    },
    SHRINK_PLAYER: {
        id: 'shrink_player',
        name: 'Shrink Ship',
        color: '#ff0000',
        shape: 'square',
        duration: 6000,
        type: 'challenging',
        apply: () => {
            player.originalWidth = player.width;
            player.originalHeight = player.height;
            player.width = Math.floor(player.width * 0.6);
            player.height = Math.floor(player.height * 0.6);
        },
        remove: () => {
            player.width = player.originalWidth;
            player.height = player.originalHeight;
        }
    }
};

// Initialize nextTunnelX now that canvas is sized
nextTunnelX = canvas.width;

// Input handling
let isThrusting = false;
let isShooting = false;

function handleStart(e) {
    e.preventDefault();
    if (window.gameState === 'menu') {
        startGame();
    } else if (window.gameState === 'gameOver') {
        startGame();
    } else if (window.gameState === 'playing') {
        isThrusting = true;
        isShooting = true;
    }
}

function handleEnd(e) {
    e.preventDefault();
    if (window.gameState === 'playing') {
        isThrusting = false;
        isShooting = false;
    }
}

// Touch and mouse events
canvas.addEventListener('touchstart', handleStart);
canvas.addEventListener('touchend', handleEnd);
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mouseup', handleEnd);

menuScreen.addEventListener('click', () => {
    if (window.gameState === 'menu') startGame();
});

// Game functions
function startGame() {
    window.gameState = 'playing';
    score = 0;
    distanceTraveled = 0;
    lastScoreMilestone = 0;
    gameSpeed = 2;
    enemySpawnRate = 0.005; // Reset to easy difficulty
    baseShootCooldown = 15;
    playerColorIndex = 0;
    enemyColorIndex = 0;
    shootingEnemiesEnabled = false;
    enemyFireSpeed = 3;
    player.x = 100;
    player.y = canvas.height / 2;
    player.velocityY = 0;
    player.health = player.maxHealth;
    player.width = 20;
    player.height = 12;
    player.doubleShot = false;
    player.bigEnemyMode = false;
    player.obstacleMode = false;
    player.hasShield = false;
    player.invincible = false;
    player.coinMagnet = false;
    player.color = playerColors[0];
    tunnels = [];
    enemies = [];
    bullets = [];
    enemyBullets = [];
    coins_on_screen = [];
    particles = [];
    powerups = [];
    lootDrops = [];
    obstacles = [];
    activeEffects = [];
    nextTunnelX = canvas.width;
    lastFrameTime = 0; // Reset delta time tracking
    
    // Apply equipped perks at game start
    equippedPerks.forEach(perkId => {
        if (PERK_DEFINITIONS[perkId]) {
            const perk = PERK_DEFINITIONS[perkId];
            perk.apply();
            
            // Add to active effects
            activeEffects.push({
                lootType: {
                    id: perkId,
                    name: perk.name,
                    type: 'beneficial',
                    remove: perk.remove
                },
                startTime: Date.now(),
                endTime: Date.now() + perk.duration
            });
        }
    });
    
    menuScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    upgradesMenu.classList.remove('active');
    perkSelectionMenu.classList.remove('active');
    hud.classList.add('active');

    renderHomeLeaderboard();
    fetchGlobalHighScores();
    updatePerkButtons();
}

function gameOver() {
    window.gameState = 'gameOver';
    hud.classList.remove('active');

    perkButtonsContainer.classList.remove('active');
    gameOverScreen.classList.add('active');
    finalScoreDisplay.textContent = `Score: ${Math.floor(score)}, Distance: ${Math.floor(distanceTraveled)}m`;
    
    if (score > highScore) {
        highScore = Math.floor(score);
        localStorage.setItem('highScore', highScore);
    }
    highScoreDisplay.textContent = `High Score: ${highScore}`;
    
    // Check if this is a global high score
    if (isHighScore(score)) {
        newHighScorePrompt.style.display = 'block';
        highScoreName.value = '';
        highScoreName.focus();
        // Disable main menu and retry buttons until name is submitted
        mainMenuBtn.disabled = true;
        retryBtn.disabled = true;
    } else {
        newHighScorePrompt.style.display = 'none';
        mainMenuBtn.disabled = false;
        retryBtn.disabled = false;
    }
}

function createTunnel(x) {
    const gapY = Math.random() * (canvas.height - tunnelGap - 100) + 50;
    return {
        x: x,
        topHeight: gapY,
        bottomY: gapY + tunnelGap,
        width: tunnelWidth,
        passed: false
    };
}

function createEnemy() {
    const isBig = player.bigEnemyMode && Math.random() < 0.5; // 50% chance when mode is active
    const size = isBig ? 32 : 16;
    const points = isBig ? 150 : 50; // Big enemies worth more points
    
    // Check if this should be a shooting enemy (only after 5000 distance)
    const canShoot = shootingEnemiesEnabled && Math.random() < 0.3; // 30% chance
    
    return {
        x: canvas.width + 50,
        y: Math.random() * (canvas.height - size - 40) + 20,
        width: size,
        height: size,
        speed: gameSpeed + Math.random() * 2,
        health: 1,
        color: isBig ? '#ff0099' : enemyBaseColors[enemyColorIndex],
        isBig: isBig,
        points: points,
        canShoot: canShoot,
        shootCooldown: canShoot ? Math.random() * 60 + 30 : 0
    };
}

function createBullet() {
    return {
        x: player.x + player.width,
        y: player.y + player.height / 2,
        width: 8,
        height: 3,
        speed: 8,
        color: '#ffff00'
    };
}

function createEnemyBullet(enemy) {
    return {
        x: enemy.x,
        y: enemy.y + enemy.height / 2,
        width: 6,
        height: 3,
        speed: enemyFireSpeed,
        color: '#ff0000'
    };
}

function createCoin(x, y, isRare = false) {
    return {
        x: x,
        y: y,
        width: 10,
        height: 10,
        speed: gameSpeed * 0.5,
        value: isRare ? 10 : 1,
        isRare: isRare,
        rotation: 0,
        color: isRare ? '#ffd700' : '#ffaa00'
    };
}

function createParticle(x, y, color) {
    const particles = [];
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size: Math.random() * 3 + 1,
            life: 30,
            color: color
        });
    }
    return particles;
}

/**
 * Creates a loot drop at the specified position
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {object} Loot drop object
 */
function createLootDrop(x, y) {
    const lootTypesArray = Object.values(LOOT_TYPES);
    const lootType = lootTypesArray[Math.floor(Math.random() * lootTypesArray.length)];
    
    return {
        x: x,
        y: y,
        width: 12,
        height: 12,
        speed: gameSpeed * 0.5, // Slower than enemies
        lootType: lootType,
        rotation: 0 // For animation
    };
}

/**
 * Applies a loot effect to the player
 * @param {object} lootType - The loot type to apply
 */
function applyLootEffect(lootType) {
    // Handle instant effects (duration 0) separately
    if (lootType.duration === 0) {
        lootType.apply();
        return;
    }
    
    // Check if this effect is already active
    const existingEffect = activeEffects.find(e => e.lootType.id === lootType.id);
    
    if (existingEffect) {
        // Extend the duration
        existingEffect.endTime = Date.now() + lootType.duration;
    } else {
        // Apply new effect
        lootType.apply();
        activeEffects.push({
            lootType: lootType,
            startTime: Date.now(),
            endTime: Date.now() + lootType.duration
        });
    }
}

/**
 * Updates active loot effects and removes expired ones
 */
function updateLootEffects() {
    const now = Date.now();
    
    for (let i = activeEffects.length - 1; i >= 0; i--) {
        const effect = activeEffects[i];
        
        if (now >= effect.endTime) {
            effect.lootType.remove();
            activeEffects.splice(i, 1);
        }
    }
}

/**
 * Updates loot drops - moves them and removes off-screen ones
 */
function updateLootDrops() {
    for (let i = lootDrops.length - 1; i >= 0; i--) {
        const loot = lootDrops[i];
        loot.x -= loot.speed * window.deltaTime;
        loot.rotation += 0.05 * window.deltaTime; // Rotate for visual effect (scaled by delta time)
        
        // Remove off-screen loot
        if (loot.x + loot.width < 0) {
            lootDrops.splice(i, 1);
        }
    }
}

/**
 * Creates a random obstacle
 */
function createObstacle() {
    return {
        x: canvas.width + 20,
        y: Math.random() * (canvas.height - 60) + 30,
        width: 20,
        height: 20,
        speed: gameSpeed,
        color: '#ff4400'
    };
}

/**
 * Updates random obstacles spawned by loot effects
 */
function updateObstacles() {
    // Spawn obstacles if obstacle mode is active
    if (player.obstacleMode && Math.random() < 0.03) {
        obstacles.push(createObstacle());
    }
    
    // Update and remove obstacles (movement scaled by delta time)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.x -= obstacle.speed * window.deltaTime;
        
        // Remove off-screen obstacles
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function updatePlayer() {
    // Apply thrust (check boost if available)
    if (isThrusting) {
        const hasBoost = typeof player.boost === 'undefined' || player.boost > 0;
        if (hasBoost) {
            player.velocityY = player.thrust;
        }
    }
    
    // Apply gravity (scaled by delta time for consistent physics)
    player.velocityY += player.gravity * window.deltaTime;
    player.y += player.velocityY * window.deltaTime;
    
    // Screen boundaries
    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }
    // Check if player falls out the bottom
    if (player.y + player.height > canvas.height) {
        gameOver();
    }
    
    // Shooting (cooldown scaled by delta time)
    if (isShooting && player.shootCooldown <= 0) {
        bullets.push(createBullet());
        
        // Double shot effect
        if (player.doubleShot) {
            bullets.push({
                ...createBullet(),
                y: player.y + player.height / 2 + 5
            });
            bullets.push({
                ...createBullet(),
                y: player.y + player.height / 2 - 5
            });
        }
        
        player.shootCooldown = baseShootCooldown;
    }
    if (player.shootCooldown > 0) {
        player.shootCooldown -= window.deltaTime;
    }
}

function updateTunnels() {
    // Generate new tunnels
    if (nextTunnelX < canvas.width + 200) {
        tunnels.push(createTunnel(nextTunnelX));
        nextTunnelX += 250;
    }
    
    // Update and remove tunnels (movement scaled by delta time)
    for (let i = tunnels.length - 1; i >= 0; i--) {
        const tunnel = tunnels[i];
        tunnel.x -= gameSpeed * window.deltaTime;
        
        // Check if player passed tunnel
        if (!tunnel.passed && player.x > tunnel.x + tunnel.width) {
            tunnel.passed = true;
            score += 10;
        }
        
        // Remove off-screen tunnels
        if (tunnel.x + tunnel.width < 0) {
            tunnels.splice(i, 1);
        }
    }
}

function updateEnemies() {
    // Progressive enemy spawning - starts easy and gradually increases
    // Spawn rate increases from 0.5% to 2.5% as player progresses
    if (Math.random() < enemySpawnRate) {
        enemies.push(createEnemy());
    }
    
    // Update enemies (movement scaled by delta time)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.x -= enemy.speed * window.deltaTime;
        
        // Handle shooting enemies
        if (enemy.canShoot && enemy.shootCooldown > 0) {
            enemy.shootCooldown -= window.deltaTime;
        }
        
        if (enemy.canShoot && enemy.shootCooldown <= 0 && enemy.x < canvas.width - 100) {
            enemyBullets.push(createEnemyBullet(enemy));
            enemy.shootCooldown = Math.random() * 60 + 60; // Shoot every 60-120 frames
        }
        
        // Remove off-screen enemies
        if (enemy.x + enemy.width < 0) {
            enemies.splice(i, 1);
        }
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.speed * window.deltaTime;
        
        // Remove off-screen bullets
        if (bullet.x > canvas.width) {
            bullets.splice(i, 1);
        }
    }
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.x -= bullet.speed * window.deltaTime;
        
        // Remove off-screen bullets
        if (bullet.x + bullet.width < 0) {
            enemyBullets.splice(i, 1);
        }
    }
}

function updateCoins() {
    for (let i = coins_on_screen.length - 1; i >= 0; i--) {
        const coin = coins_on_screen[i];
        coin.x -= coin.speed * window.deltaTime;
        coin.rotation += 0.1 * window.deltaTime;
        
        // Remove off-screen coins
        if (coin.x + coin.width < 0) {
            coins_on_screen.splice(i, 1);
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx * window.deltaTime;
        particle.y += particle.vy * window.deltaTime;
        particle.life -= window.deltaTime;
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function checkCollisions() {
    // Player vs enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (isColliding(player, enemy)) {
            particles.push(...createParticle(enemy.x, enemy.y, enemy.color));
            
            // Shield kills enemy on contact
            if (player.hasShield) {
                score += enemy.points;
                // Drop coin chance
                if (Math.random() < 0.5) {
                    const isRare = Math.random() < 0.1;
                    coins_on_screen.push(createCoin(enemy.x, enemy.y, isRare));
                }
            } else {
                takeDamage();
            }
            
            enemies.splice(i, 1);
        }
    }
    
    // Player vs obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        if (isColliding(player, obstacle)) {
            particles.push(...createParticle(obstacle.x, obstacle.y, obstacle.color));
            obstacles.splice(i, 1);
            
            if (player.hasShield) {
                // Shield protects from obstacles
                score += 25;
            } else {
                takeDamage();
            }
        }
    }
    
    // Player vs enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        if (isColliding(player, bullet)) {
            particles.push(...createParticle(bullet.x, bullet.y, bullet.color));
            enemyBullets.splice(i, 1);
            
            if (!player.hasShield) {
                takeDamage();
            }
        }
    }
    
    // Player vs loot drops
    for (let i = lootDrops.length - 1; i >= 0; i--) {
        const loot = lootDrops[i];
        if (isColliding(player, loot)) {
            // Create particles for visual feedback
            particles.push(...createParticle(loot.x, loot.y, loot.lootType.color));
            
            // Apply loot effect
            applyLootEffect(loot.lootType);
            
            // Remove loot drop
            lootDrops.splice(i, 1);
        }
    }
    
    // Player vs coins
    for (let i = coins_on_screen.length - 1; i >= 0; i--) {
        const coin = coins_on_screen[i];
        
        // Coin magnet effect - attract coins from farther away
        if (player.coinMagnet) {
            const dx = player.x - coin.x;
            const dy = player.y - coin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 100) {
                coin.x += dx * 0.1;
                coin.y += dy * 0.1;
            }
        }
        
        if (isColliding(player, coin)) {
            particles.push(...createParticle(coin.x, coin.y, coin.color));
            coins += coin.value;
            localStorage.setItem('coins', coins);
            coins_on_screen.splice(i, 1);
        }
    }
    
    // Bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (isColliding(bullet, enemy)) {
                particles.push(...createParticle(enemy.x, enemy.y, enemy.color));
                
                // Drop coin (50% chance, 10% rare)
                if (Math.random() < 0.5) {
                    const isRare = Math.random() < 0.1;
                    coins_on_screen.push(createCoin(enemy.x, enemy.y, isRare));
                }
                
                // Random chance to drop loot (20% chance)
                if (Math.random() < 0.2) {
                    lootDrops.push(createLootDrop(enemy.x, enemy.y));
                }
                
                score += enemy.points; // Use enemy points
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

function isColliding(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

function takeDamage() {
    if (player.invincible) return; // Invincibility perk prevents damage
    
    player.health--;
    if (player.health <= 0) {
        gameOver();
    }
}

function updateScore() {
    distanceTraveled += gameSpeed * window.deltaTime;
    score += 0.1 * window.deltaTime; // Gradual score increase for distance (scaled by delta time)
    
    // Check for score milestones (every 1000 points)
    const currentMilestone = Math.floor(score / 1000);
    if (currentMilestone > lastScoreMilestone) {
        lastScoreMilestone = currentMilestone;
        
        // Odd milestones (1000, 3000, 5000, etc.): Increase rate of fire
        if (currentMilestone % 2 === 1) {
            baseShootCooldown = Math.max(5, baseShootCooldown - 2); // Reduce cooldown, min 5
        }
        
        // Even milestones (2000, 4000, 6000, etc.): Change colors
        if (currentMilestone % 2 === 0) {
            playerColorIndex = (playerColorIndex + 1) % playerColors.length;
            player.color = playerColors[playerColorIndex];
            enemyColorIndex = (enemyColorIndex + 1) % enemyBaseColors.length;
        }
        
        // At 5000: Enable shooting enemies
        if (currentMilestone === 5) {
            shootingEnemiesEnabled = true;
        }
        
        // Every 2000 after 5000: Increase enemy fire speed
        if (currentMilestone >= 5 && currentMilestone % 2 === 1) {
            enemyFireSpeed = Math.min(7, enemyFireSpeed + 0.5);
        }
    }
    
    // Progressive difficulty system - gradually increase game speed and enemy spawn rate
    // Every 1000 units of distance traveled:
    // - Game speed increases by 0.1 (capped at 5)
    // - Enemy spawn rate increases by 0.0025 (capped at 0.025 for max 2.5% spawn chance)
    if (distanceTraveled % 1000 < gameSpeed * window.deltaTime) {
        gameSpeed = Math.min(gameSpeed + 0.1, 5);
        enemySpawnRate = Math.min(enemySpawnRate + 0.0025, 0.025);
    }
}

function drawPlayer() {
 const x=player.x,y=player.y,w=player.width,h=player.height,cy=y+h/2,pulse=.82+Math.sin(Date.now()/75)*.18;
 ctx.save();ctx.translate(x,cy);ctx.scale(w/30,h/18);
 if(player.hasShield){ctx.save();ctx.globalAlpha=.42+Math.sin(Date.now()/110)*.12;ctx.strokeStyle='#55f7ff';ctx.lineWidth=1.8;ctx.shadowColor='#00eaff';ctx.shadowBlur=15;ctx.beginPath();ctx.ellipse(15,0,19,13,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 ctx.save();ctx.globalAlpha=isThrusting?1:.55;ctx.shadowColor='#ff6a24';ctx.shadowBlur=isThrusting?16:8;ctx.fillStyle='#ff5b35';ctx.beginPath();ctx.moveTo(-1,-4);ctx.lineTo(-12-(isThrusting?5*pulse:0),0);ctx.lineTo(-1,4);ctx.closePath();ctx.fill();ctx.fillStyle='#ffe66d';ctx.beginPath();ctx.moveTo(1,-2);ctx.lineTo(-7-(isThrusting?4*pulse:0),0);ctx.lineTo(1,2);ctx.closePath();ctx.fill();ctx.restore();
 ctx.shadowColor='#00dfff';ctx.shadowBlur=10;ctx.fillStyle='#176c91';ctx.beginPath();ctx.moveTo(-4,-4);ctx.lineTo(8,-9);ctx.lineTo(20,-7);ctx.lineTo(11,-2);ctx.lineTo(7,0);ctx.lineTo(11,2);ctx.lineTo(20,7);ctx.lineTo(8,9);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();
 const hull=ctx.createLinearGradient(0,-7,0,7);hull.addColorStop(0,'#e8fbff');hull.addColorStop(.45,'#72d9f2');hull.addColorStop(1,'#2374a8');ctx.fillStyle=hull;ctx.beginPath();ctx.moveTo(-8,-4);ctx.lineTo(8,-6);ctx.lineTo(29,0);ctx.lineTo(8,6);ctx.lineTo(-8,4);ctx.lineTo(-3,0);ctx.closePath();ctx.fill();ctx.strokeStyle='#d8ffff';ctx.lineWidth=.65;ctx.stroke();
 ctx.shadowColor='#20f5ff';ctx.shadowBlur=8;ctx.fillStyle='#07324e';ctx.beginPath();ctx.ellipse(8,0,5.5,2.7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9fffff';ctx.beginPath();ctx.ellipse(9,-.7,3.2,1,-.15,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ffdf73';ctx.fillRect(-5,-5,3,1);ctx.fillRect(-5,4,3,1);ctx.restore();
}

function drawTunnels() { /* Retired: no tunnel gates are drawn. */ }

function drawEnemies() {
 for(const enemy of enemies){const cx=enemy.x+enemy.width/2,cy=enemy.y+enemy.height/2,scale=enemy.isBig?1.75:1,pulse=.88+Math.sin(Date.now()/(enemy.canShoot?85:125)+enemy.y)*.12;ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);const color=enemy.color||'#ff397e';ctx.shadowColor=color;ctx.shadowBlur=enemy.isBig?18:11;ctx.fillStyle='#381333';ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-6,-7);ctx.lineTo(1,-9);ctx.lineTo(9,-5);ctx.lineTo(12,0);ctx.lineTo(9,5);ctx.lineTo(1,9);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-5,-6);ctx.lineTo(-12,-11);ctx.lineTo(-9,-2);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(-5,6);ctx.lineTo(-12,11);ctx.lineTo(-9,2);ctx.closePath();ctx.fill();ctx.fillStyle='#ff335f';ctx.beginPath();ctx.arc(2,0,4.5*pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff3f7';ctx.beginPath();ctx.arc(3,-1,1.5,0,Math.PI*2);ctx.fill();if(enemy.canShoot){ctx.shadowColor='#ffe45c';ctx.shadowBlur=12;ctx.fillStyle='#ffe45c';ctx.beginPath();ctx.arc(-6,0,2.2,0,Math.PI*2);ctx.fill();}if(enemy.isBig){ctx.strokeStyle='rgba(255,110,220,.8)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,14+pulse,0,Math.PI*2);ctx.stroke();}ctx.restore();}
}

function drawBullets(){for(const bullet of bullets){ctx.save();ctx.shadowColor='#ffe66d';ctx.shadowBlur=13;const g=ctx.createLinearGradient(bullet.x,0,bullet.x+bullet.width,0);g.addColorStop(0,'rgba(255,190,70,0)');g.addColorStop(.35,'#ffbf4d');g.addColorStop(1,'#fff');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(bullet.x+bullet.width/2,bullet.y+bullet.height/2,Math.max(4,bullet.width/2),Math.max(1.5,bullet.height),0,0,Math.PI*2);ctx.fill();ctx.restore();}}

function drawEnemyBullets(){for(const bullet of enemyBullets){ctx.save();ctx.shadowColor='#ff276f';ctx.shadowBlur=12;ctx.fillStyle='#ff397e';ctx.beginPath();ctx.moveTo(bullet.x,bullet.y+bullet.height/2);ctx.lineTo(bullet.x+bullet.width,bullet.y);ctx.lineTo(bullet.x+bullet.width-2,bullet.y+bullet.height/2);ctx.lineTo(bullet.x+bullet.width,bullet.y+bullet.height);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(bullet.x+1,bullet.y+bullet.height/2-.5,2,1);ctx.restore();}}

function drawCoins(){for(const coin of coins_on_screen){const cx=coin.x+coin.width/2,cy=coin.y+coin.height/2,r=coin.width/2;ctx.save();ctx.translate(cx,cy);ctx.rotate(coin.rotation);ctx.shadowColor=coin.isRare?'#fff0a0':'#ffb52e';ctx.shadowBlur=coin.isRare?18:10;const gold=ctx.createRadialGradient(-r*.35,-r*.4,1,0,0,r);gold.addColorStop(0,'#fffbd0');gold.addColorStop(.3,coin.isRare?'#fff0a0':'#ffd65a');gold.addColorStop(1,coin.isRare?'#d58b20':'#b85a16');ctx.fillStyle=gold;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff2ae';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold '+Math.max(7,r*1.25)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(coin.isRare?'★':'¢',0,1);ctx.restore();}}

function drawParticles() {
    for (const particle of particles) {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life / 30;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
}

function drawStars() {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 50; i++) {
        const x = (i * 37 + distanceTraveled * 0.5) % canvas.width;
        const y = (i * 73) % canvas.height;
        ctx.fillRect(x, y, 1, 1);
    }
}

/**
 * Draws loot drops with visual distinction
 */
function drawLootDrops(){for(const loot of lootDrops){const cx=loot.x+loot.width/2,cy=loot.y+loot.height/2,color=loot.lootType.color||'#42efff',symbol=({double_shot:'Ⅱ',bigger_enemies:'✦',extra_life:'+',random_obstacles:'!',shrink_player:'↓'})[loot.lootType.id]||'✧',pulse=1+Math.sin(Date.now()/105+loot.y)*.08;ctx.save();ctx.translate(cx,cy);ctx.rotate(loot.rotation);ctx.scale(pulse,pulse);ctx.shadowColor=color;ctx.shadowBlur=17;ctx.fillStyle='rgba(7,13,35,.92)';ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=8;ctx.fillStyle=color;ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(symbol,0,.5);ctx.restore();}}

function drawObstacles(){for(const obstacle of obstacles){const cx=obstacle.x+obstacle.width/2,cy=obstacle.y+obstacle.height/2;ctx.save();ctx.translate(cx,cy);ctx.shadowColor='#ff552f';ctx.shadowBlur=13;ctx.fillStyle='#431c2b';ctx.strokeStyle='#ff613e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-obstacle.height/2);ctx.lineTo(obstacle.width/2,0);ctx.lineTo(0,obstacle.height/2);ctx.lineTo(-obstacle.width/2,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#ffc06a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-obstacle.width*.22,-obstacle.height*.22);ctx.lineTo(obstacle.width*.22,obstacle.height*.22);ctx.stroke();ctx.restore();}}

function drawActiveEffects() {
    const now = Date.now();
    let yOffset = 60;
    
    for (const effect of activeEffects) {
        const timeLeft = Math.ceil((effect.endTime - now) / 1000);
        const text = `${effect.lootType.name}: ${timeLeft}s`;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(10, yOffset, 180, 20);
        
        // Text color based on type
        ctx.fillStyle = effect.lootType.type === 'beneficial' ? '#00ff00' : '#ff4400';
        ctx.font = '12px Courier New';
        ctx.fillText(text, 15, yOffset + 14);
        
        yOffset += 25;
    }
}

function updateHUD() {
    scoreDisplay.textContent = `Score: ${Math.floor(score)} | Coins: ${coins} | ${Math.floor(distanceTraveled)}m`;
    // Handle cases where health exceeds maxHealth (e.g., from EXTRA_LIFE loot)
    const emptyHearts = Math.max(0, player.maxHealth - player.health);
    healthDisplay.textContent = `Health: ${'❤'.repeat(player.health)}${'🖤'.repeat(emptyHearts)}`;
}

/**
 * Main game loop with delta time for consistent speed across devices
 * @param {number} timestamp - Current timestamp from requestAnimationFrame
 */
function gameLoop(timestamp) {
    // Calculate delta time (time since last frame)
    if (lastFrameTime === 0) {
        lastFrameTime = timestamp;
    }
    const frameTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    
    // Calculate delta multiplier normalized to 60 FPS
    // This ensures consistent game speed regardless of actual frame rate
    window.deltaTime = frameTime / TARGET_FRAME_TIME;
    
    // Cap delta time to prevent huge jumps (e.g., when tab loses focus)
    window.deltaTime = Math.min(window.deltaTime, 3);
    
    // Clear canvas
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (window.gameState === 'playing') {
        // Draw stars background
        drawStars();
        
        // Update (all update functions now use window.deltaTime for consistent speed)
        updatePlayer();
        updateTunnels(); // Keep distance-gate score milestones; gates are no longer drawn or collidable.
        updateEnemies();
        updateBullets();
        updateEnemyBullets();
        updateCoins();
        updateParticles();
        updateLootDrops();
        updateLootEffects();
        updateObstacles();
        checkCollisions();
        updateScore();
        updateHUD();
        
        // Draw
        drawObstacles();
        drawEnemies();
        drawLootDrops();
        drawCoins();
        drawBullets();
        drawEnemyBullets();
        drawPlayer();
        drawParticles();
        drawActiveEffects();
    }
    
    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();

/**
 * Renders loot type icons in the legend on the menu screen
 */
function renderLootLegendIcons() {
    const icons = document.querySelectorAll('.loot-icon');
    
    icons.forEach(canvas => {
        const lootKey = canvas.getAttribute('data-loot');
        const lootType = LOOT_TYPES[lootKey];
        
        if (!lootType) return;
        
        const ctx = canvas.getContext('2d');
        const size = 30;
        canvas.width = size;
        canvas.height = size;
        
        const centerX = size / 2;
        const centerY = size / 2;
        const iconSize = 20;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        
        // Draw based on shape (matching in-game appearance)
        if (lootType.shape === 'circle') {
            // Draw circle
            ctx.fillStyle = lootType.color;
            ctx.beginPath();
            ctx.arc(0, 0, iconSize / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Add glow effect
            ctx.strokeStyle = lootType.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, iconSize / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Draw square
            ctx.fillStyle = lootType.color;
            ctx.fillRect(-iconSize / 2, -iconSize / 2, iconSize, iconSize);
            
            // Add border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(-iconSize / 2, -iconSize / 2, iconSize, iconSize);
        }
        
        // Add sparkle
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1, -1, 2, 2);
        
        ctx.restore();
    });
}

// Render loot icons when page loads
renderLootLegendIcons();

// UPGRADES SHOP SYSTEM
const PERK_DEFINITIONS = {
    speed2x: {
        name: '2x Speed',
        cost: 50,
        duration: 15000,
        category: 'secondary',
        apply: () => {
            player.thrust = -12;
            player.gravity = 0.6;
        },
        remove: () => {
            player.thrust = -6;
            player.gravity = 0.3;
        }
    },
    lessEnemies: {
        name: 'Enemy Reducer',
        cost: 40,
        duration: 15000,
        category: 'secondary',
        apply: () => {
            enemySpawnRate *= 0.5;
        },
        remove: () => {
            enemySpawnRate = Math.min(0.005 + Math.floor(distanceTraveled / 1000) * 0.0025, 0.025);
        }
    },
    shield: {
        name: 'Shield',
        cost: 60,
        duration: 15000,
        category: 'primary',
        apply: () => {
            player.hasShield = true;
        },
        remove: () => {
            player.hasShield = false;
        }
    },
    rapidFire: {
        name: 'Rapid Fire',
        cost: 45,
        duration: 15000,
        category: 'secondary',
        apply: () => {
            baseShootCooldown = 3;
        },
        remove: () => {
            baseShootCooldown = Math.max(5, 15 - Math.floor(score / 1000) * 2);
        }
    },
    coinMagnet: {
        name: 'Coin Magnet',
        cost: 30,
        duration: 15000,
        category: 'secondary',
        apply: () => {
            player.coinMagnet = true;
        },
        remove: () => {
            player.coinMagnet = false;
        }
    },
    invincibility: {
        name: 'Invincibility',
        cost: 100,
        duration: 15000,
        category: 'primary',
        apply: () => {
            player.invincible = true;
        },
        remove: () => {
            player.invincible = false;
        }
    }
};

// Get DOM elements for shop
const upgradesMenu = document.getElementById('upgradesMenu');
const shopBtn = document.getElementById('shopBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const mainMenuBtn = document.getElementById('mainMenuBtn');
const retryBtn = document.getElementById('retryBtn');
const coinDisplayShop = document.getElementById('coinDisplay');
const perkButtonsContainer = document.getElementById('perkButtons');

// Get DOM elements for perk selection
const perkSelectionMenu = document.getElementById('perkSelectionMenu');
const equipPerksBtn = document.getElementById('equipPerksBtn');
const backToShopBtn = document.getElementById('backToShopBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const primaryPerksContainer = document.getElementById('primaryPerks');
const secondaryPerksContainer = document.getElementById('secondaryPerks');
const primaryStatus = document.getElementById('primaryStatus');
const secondaryStatus = document.getElementById('secondaryStatus');
const selectionError = document.getElementById('selectionError');

// Shop button handlers
shopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openShop();
});

backToMenuBtn.addEventListener('click', () => {
    window.gameState = 'menu';
    upgradesMenu.classList.remove('active');
    menuScreen.classList.add('active');
    menuScreen.scrollTop = 0; // Reset scroll position
});

// Perk selection handlers
equipPerksBtn.addEventListener('click', () => {
    openPerkSelection();
});

backToShopBtn.addEventListener('click', () => {
    perkSelectionMenu.classList.remove('active');
    upgradesMenu.classList.add('active');
});

clearSelectionBtn.addEventListener('click', () => {
    equippedPerks = [];
    localStorage.setItem('equippedPerks', JSON.stringify(equippedPerks));
    updatePerkSelection();
});

mainMenuBtn.addEventListener('click', () => {
    window.gameState = 'menu';
    gameOverScreen.classList.remove('active');
    menuScreen.classList.add('active');
    menuScreen.scrollTop = 0; // Reset scroll position
});

retryBtn.addEventListener('click', () => {
    startGame();
});

menuLeaderboardBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    menuScreen.classList.remove('active');
    highScoreTable.classList.add('active');
    await fetchGlobalHighScores();
    displayHighScores();
});

highScoreBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    menuScreen.classList.remove('active');
    highScoreTable.classList.add('active');
    await fetchGlobalHighScores();
    displayHighScores();
});

backToMenuFromScores.addEventListener('click', () => {
    highScoreTable.classList.remove('active');
    menuScreen.classList.add('active');
    menuScreen.scrollTop = 0; // Reset scroll position
});

submitHighScore.addEventListener('click', () => {
    const name = highScoreName.value.trim();
    if (name.length === 3) {
        addHighScore(name, score, distanceTraveled);
        newHighScorePrompt.style.display = 'none';
        // Re-enable the buttons
        mainMenuBtn.disabled = false;
        retryBtn.disabled = false;
    } else {
        // Show validation message
        alert('Please enter exactly 3 characters for your name!');
        highScoreName.focus();
    }
});

highScoreName.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        submitHighScore.click();
    }
    // Auto-uppercase
    highScoreName.value = highScoreName.value.toUpperCase();
});

function openShop() {
    menuScreen.classList.remove('active');
    upgradesMenu.classList.add('active');
    upgradesMenu.scrollTop = 0; // Reset scroll position
    updateShopDisplay();
}

function openPerkSelection() {
    upgradesMenu.classList.remove('active');
    perkSelectionMenu.classList.add('active');
    perkSelectionMenu.scrollTop = 0;
    updatePerkSelection();
}

function updatePerkSelection() {
    // Clear error message
    selectionError.textContent = '';
    
    // Clear existing items
    primaryPerksContainer.innerHTML = '';
    secondaryPerksContainer.innerHTML = '';
    
    // Count equipped perks by category
    let primaryCount = 0;
    let secondaryCount = 0;
    
    equippedPerks.forEach(perkId => {
        const perk = PERK_DEFINITIONS[perkId];
        if (perk) {
            if (perk.category === 'primary') primaryCount++;
            else if (perk.category === 'secondary') secondaryCount++;
        }
    });
    
    // Update status display
    primaryStatus.textContent = `${primaryCount}/1`;
    secondaryStatus.textContent = `${secondaryCount}/2`;
    
    // Render perks by category
    for (const perkId in purchasedPerks) {
        if (purchasedPerks[perkId] > 0) {
            const perk = PERK_DEFINITIONS[perkId];
            if (!perk) continue;
            
            const isEquipped = equippedPerks.includes(perkId);
            const container = perk.category === 'primary' ? primaryPerksContainer : secondaryPerksContainer;
            
            const item = document.createElement('div');
            item.className = 'selection-perk-item';
            if (isEquipped) {
                item.classList.add('selected');
            }
            
            item.innerHTML = `
                <div class="count-badge">${purchasedPerks[perkId]}</div>
                <h4>${perk.name}</h4>
                <p>${Math.floor(perk.duration / 1000)}s duration</p>
            `;
            
            item.addEventListener('click', () => {
                togglePerkSelection(perkId);
            });
            
            container.appendChild(item);
        }
    }
    
    // Show message if no perks are purchased
    if (primaryPerksContainer.children.length === 0) {
        primaryPerksContainer.innerHTML = '<p style="color: #888; padding: 20px;">No primary perks purchased</p>';
    }
    if (secondaryPerksContainer.children.length === 0) {
        secondaryPerksContainer.innerHTML = '<p style="color: #888; padding: 20px;">No secondary perks purchased</p>';
    }
}

function togglePerkSelection(perkId) {
    const perk = PERK_DEFINITIONS[perkId];
    if (!perk) return;
    
    const isEquipped = equippedPerks.includes(perkId);
    
    if (isEquipped) {
        // Unequip the perk
        equippedPerks = equippedPerks.filter(id => id !== perkId);
        selectionError.textContent = '';
    } else {
        // Check limits before equipping
        const primaryCount = equippedPerks.filter(id => 
            PERK_DEFINITIONS[id] && PERK_DEFINITIONS[id].category === 'primary'
        ).length;
        const secondaryCount = equippedPerks.filter(id => 
            PERK_DEFINITIONS[id] && PERK_DEFINITIONS[id].category === 'secondary'
        ).length;
        
        if (perk.category === 'primary' && primaryCount >= 1) {
            selectionError.textContent = '⚠️ Maximum 1 primary perk allowed! Unequip one first.';
            return;
        }
        if (perk.category === 'secondary' && secondaryCount >= 2) {
            selectionError.textContent = '⚠️ Maximum 2 secondary perks allowed! Unequip one first.';
            return;
        }
        
        // Equip the perk
        equippedPerks.push(perkId);
        selectionError.textContent = '';
    }
    
    // Save and update display
    localStorage.setItem('equippedPerks', JSON.stringify(equippedPerks));
    updatePerkSelection();
}

function updateShopDisplay() {
    coinDisplayShop.textContent = `Coins: ${coins}`;
    
    // Check if player has any purchased perks
    let hasAnyPerks = false;
    for (const perkId in purchasedPerks) {
        if (purchasedPerks[perkId] > 0) {
            hasAnyPerks = true;
            break;
        }
    }
    
    // Show/hide equip perks button
    equipPerksBtn.style.display = hasAnyPerks ? 'block' : 'none';
    
    // Update buy buttons
    document.querySelectorAll('.upgrade-item').forEach(item => {
        const perkId = item.getAttribute('data-perk');
        const perk = PERK_DEFINITIONS[perkId];
        const buyButton = item.querySelector('.buy-button');
        const owned = purchasedPerks[perkId] || 0;
        
        if (owned > 0) {
            buyButton.textContent = `Owned (${owned})`;
            buyButton.disabled = true;
        } else if (coins >= perk.cost) {
            buyButton.textContent = 'Buy';
            buyButton.disabled = false;
        } else {
            buyButton.textContent = 'Not Enough Coins';
            buyButton.disabled = true;
        }
    });
}

// Add click handlers to buy buttons
document.querySelectorAll('.buy-button').forEach(button => {
    const item = button.closest('.upgrade-item');
    const perkId = item.getAttribute('data-perk');
    
    button.addEventListener('click', () => {
        buyPerk(perkId);
    });
});

function buyPerk(perkId) {
    const perk = PERK_DEFINITIONS[perkId];
    
    if (coins >= perk.cost) {
        coins -= perk.cost;
        localStorage.setItem('coins', coins);
        
        purchasedPerks[perkId] = (purchasedPerks[perkId] || 0) + 1;
        localStorage.setItem('purchasedPerks', JSON.stringify(purchasedPerks));
        
        updateShopDisplay();
    }
}

function updatePerkButtons() {
    // Clear existing buttons
    perkButtonsContainer.innerHTML = '';
    
    // Icon mappings for perks
    const perkIcons = {
        speed2x: '⚡',
        lessEnemies: '🛡️',
        shield: '🔰',
        rapidFire: '🔫',
        coinMagnet: '🧲',
        invincibility: '✨'
    };
    
    let hasPerks = false;
    for (const perkId in purchasedPerks) {
        if (purchasedPerks[perkId] > 0) {
            hasPerks = true;
            const perk = PERK_DEFINITIONS[perkId];
            const button = document.createElement('button');
            button.className = 'perk-button';
            const icon = perkIcons[perkId] || '⭐';
            button.innerHTML = `${icon}<span class="count">x${purchasedPerks[perkId]}</span>`;
            button.title = perk.name; // Tooltip for full name
            button.addEventListener('click', () => usePerk(perkId));
            perkButtonsContainer.appendChild(button);
        }
    }
    
    if (hasPerks && window.gameState === 'playing') {
        perkButtonsContainer.classList.add('active');
    } else {
        perkButtonsContainer.classList.remove('active');
    }
}

function usePerk(perkId) {
    if (window.gameState !== 'playing') return;
    if (!purchasedPerks[perkId] || purchasedPerks[perkId] <= 0) return;
    
    const perk = PERK_DEFINITIONS[perkId];
    
    // Consume the perk
    purchasedPerks[perkId]--;
    localStorage.setItem('purchasedPerks', JSON.stringify(purchasedPerks));
    
    // Apply the perk
    perk.apply();
    
    // Add to active effects
    activeEffects.push({
        lootType: {
            id: perkId,
            name: perk.name,
            type: 'beneficial',
            remove: perk.remove
        },
        startTime: Date.now(),
        endTime: Date.now() + perk.duration
    });
    
    updatePerkButtons();
}

// Initialize the leaderboard without blocking game startup.
(async function initializeHighScores() {
    console.log('🚀 Initializing Pixel Blaster...');
    if (isOnline) {
        await fetchGlobalHighScores();
        await syncQueuedScores();
    } else {
        leaderboardConnectionStatus = 'offline';
    }
    console.log('✓ Initialization complete');
})();

// Service worker registration with reliable, automatic PWA updates.
if ('serviceWorker' in navigator) {
    // Listen before registration. A fast worker can take control before
    // register() resolves, and attaching this afterwards can miss the event.
    let refreshingForWorkerUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshingForWorkerUpdate) return;
        refreshingForWorkerUpdate = true;
        console.log('New app version activated. Reloading...');
        window.location.reload();
    });

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                updateViaCache: 'none'
            });
            console.log('Service Worker registered:', registration.scope);

            // Check on every app launch, plus periodically while it remains open.
            const checkForUpdate = () => registration.update().catch(error => {
                console.warn('Service worker update check failed:', error);
            });
            checkForUpdate();
            setInterval(checkForUpdate, 30 * 60 * 1000);

            // iOS standalone PWAs may sit suspended for long periods. Check
            // again whenever the app is brought back to the foreground.
            window.addEventListener('pageshow', checkForUpdate);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') checkForUpdate();
            });

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // sw.js calls skipWaiting() after its new cache is ready.
                        // No prompt needed: controllerchange reloads the app.
                        console.log('New version installed and activating automatically.');
                    }
                });
            });
        } catch (error) {
            console.error('Service worker registration failed:', error);
        }
    });
}

/**
 * Shows update notification banner to the user
 * Allows user to accept or dismiss the update
 * @param {ServiceWorker} newWorker - The new service worker waiting to activate
 */
function showUpdateNotification(newWorker) {
    const notification = document.getElementById('updateNotification');
    const updateBtn = document.getElementById('updateBtn');
    const dismissBtn = document.getElementById('dismissUpdateBtn');
    
    // Show the notification banner
    notification.style.display = 'block';
    
    // Handle update button click - activate new service worker and reload
    updateBtn.onclick = () => {
        console.log('User accepted update, activating new service worker...');
        // Send SKIP_WAITING message to the new service worker
        newWorker.postMessage({ type: 'SKIP_WAITING' });
        notification.style.display = 'none';
        // Page will reload automatically via controllerchange event
    };
    
    // Handle dismiss button click - hide notification but keep it available
    dismissBtn.onclick = () => {
        console.log('User dismissed update notification');
        notification.style.display = 'none';
        // User can still manually reload later to get the update
    };
}

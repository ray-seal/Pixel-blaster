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
const backToMenuFromScores = document.getElementById('backToMenuFromScores');

// Supabase configuration
// Note: Replace with your actual Supabase anon key from your project settings
const SUPABASE_URL = 'https://qxocafbohchpfqndiibj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2NhZmJvaGNocGZxbmRpaWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDk2MDgsImV4cCI6MjA3NTkyNTYwOH0.5ZadVcRbXGqBqYd838wWl8Xifzv0HjiPLmCTsygsRJc';
let supabase = null;

// Initialize Supabase when available
function initSupabase() {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase initialized');
        return true;
    }
    return false;
}

// Online/offline status
let isOnline = navigator.onLine;
window.addEventListener('online', () => {
    isOnline = true;
    syncQueuedScores();
});
window.addEventListener('offline', () => {
    isOnline = false;
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
let gameState = 'menu'; // menu, playing, gameOver
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
        name: name.toUpperCase().substring(0, 3), 
        score: Math.floor(score),
        distance: Math.floor(distance)
    };
    
    // Update local cache
    globalHighScores.push(highScoreEntry);
    globalHighScores.sort((a, b) => b.score - a.score);
    globalHighScores = globalHighScores.slice(0, 20); // Keep top 20
    localStorage.setItem('globalHighScores', JSON.stringify(globalHighScores));
    
    // Try to submit to Supabase if available
    if (!supabase) initSupabase();
    
    if (isOnline && supabase) {
        try {
            const { error } = await supabase
                .from('high_scores')
                .insert([highScoreEntry]);
            
            if (error) {
                console.error('Error submitting high score:', error);
                queueScore(highScoreEntry);
            } else {
                console.log('High score submitted successfully!');
                // Refresh high scores after submission
                await fetchGlobalHighScores();
            }
        } catch (err) {
            console.error('Network error submitting high score:', err);
            queueScore(highScoreEntry);
        }
    } else {
        queueScore(highScoreEntry);
    }
}

function queueScore(scoreEntry) {
    queuedScores.push(scoreEntry);
    localStorage.setItem('queuedScores', JSON.stringify(queuedScores));
    console.log('Score queued for later submission');
}

async function syncQueuedScores() {
    if (!isOnline || queuedScores.length === 0) return;
    
    if (!supabase) initSupabase();
    if (!supabase) return;
    
    console.log(`Syncing ${queuedScores.length} queued score(s)...`);
    const scoresToSync = [...queuedScores];
    queuedScores = [];
    localStorage.setItem('queuedScores', JSON.stringify(queuedScores));
    
    for (const scoreEntry of scoresToSync) {
        try {
            const { error } = await supabase
                .from('high_scores')
                .insert([scoreEntry]);
            
            if (error) {
                console.error('Error syncing queued score:', error);
                queuedScores.push(scoreEntry);
            }
        } catch (err) {
            console.error('Network error syncing queued score:', err);
            queuedScores.push(scoreEntry);
        }
    }
    
    // Save any failed scores back to queue
    if (queuedScores.length > 0) {
        localStorage.setItem('queuedScores', JSON.stringify(queuedScores));
    }
    
    // Refresh high scores after sync
    await fetchGlobalHighScores();
}

async function fetchGlobalHighScores() {
    if (!isOnline) {
        console.log('Offline - using cached high scores');
        return;
    }
    
    if (!supabase) initSupabase();
    if (!supabase) {
        console.log('Supabase not available - using cached high scores');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('high_scores')
            .select('name, score, distance, created_at')
            .order('score', { ascending: false })
            .limit(20);
        
        if (error) {
            console.error('Error fetching high scores:', error);
            return;
        }
        
        if (data && data.length > 0) {
            globalHighScores = data;
            localStorage.setItem('globalHighScores', JSON.stringify(globalHighScores));
            console.log('High scores fetched from Supabase:', data.length);
        }
    } catch (err) {
        console.error('Network error fetching high scores:', err);
    }
}

function isHighScore(score) {
    if (globalHighScores.length < 20) return true;
    return Math.floor(score) > globalHighScores[globalHighScores.length - 1].score;
}

function displayHighScores() {
    highScoreList.innerHTML = '';
    if (globalHighScores.length === 0) {
        highScoreList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No high scores yet. Be the first!</p>';
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
let deltaTime = 0;
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
    if (gameState === 'menu') {
        startGame();
    } else if (gameState === 'gameOver') {
        startGame();
    } else if (gameState === 'playing') {
        isThrusting = true;
        isShooting = true;
    }
}

function handleEnd(e) {
    e.preventDefault();
    if (gameState === 'playing') {
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
    if (gameState === 'menu') startGame();
});

// Game functions
function startGame() {
    gameState = 'playing';
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
    updatePerkButtons();
}

function gameOver() {
    gameState = 'gameOver';
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
        loot.x -= loot.speed * deltaTime;
        loot.rotation += 0.05 * deltaTime; // Rotate for visual effect (scaled by delta time)
        
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
        obstacle.x -= obstacle.speed * deltaTime;
        
        // Remove off-screen obstacles
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function updatePlayer() {
    // Apply thrust
    if (isThrusting) {
        player.velocityY = player.thrust;
    }
    
    // Apply gravity (scaled by delta time for consistent physics)
    player.velocityY += player.gravity * deltaTime;
    player.y += player.velocityY * deltaTime;
    
    // Screen boundaries
    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }
    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
        player.velocityY = 0;
        takeDamage();
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
        player.shootCooldown -= deltaTime;
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
        tunnel.x -= gameSpeed * deltaTime;
        
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
        enemy.x -= enemy.speed * deltaTime;
        
        // Handle shooting enemies
        if (enemy.canShoot && enemy.shootCooldown > 0) {
            enemy.shootCooldown -= deltaTime;
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
        bullet.x += bullet.speed * deltaTime;
        
        // Remove off-screen bullets
        if (bullet.x > canvas.width) {
            bullets.splice(i, 1);
        }
    }
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.x -= bullet.speed * deltaTime;
        
        // Remove off-screen bullets
        if (bullet.x + bullet.width < 0) {
            enemyBullets.splice(i, 1);
        }
    }
}

function updateCoins() {
    for (let i = coins_on_screen.length - 1; i >= 0; i--) {
        const coin = coins_on_screen[i];
        coin.x -= coin.speed * deltaTime;
        coin.rotation += 0.1 * deltaTime;
        
        // Remove off-screen coins
        if (coin.x + coin.width < 0) {
            coins_on_screen.splice(i, 1);
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.life -= deltaTime;
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function checkCollisions() {
    // Player vs tunnels
    for (const tunnel of tunnels) {
        if (player.x + player.width > tunnel.x && player.x < tunnel.x + tunnel.width) {
            if (player.y < tunnel.topHeight || player.y + player.height > tunnel.bottomY) {
                takeDamage();
                // Push player back slightly
                player.x = Math.max(50, player.x - 10);
            }
        }
    }
    
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
    distanceTraveled += gameSpeed * deltaTime;
    score += 0.1 * deltaTime; // Gradual score increase for distance (scaled by delta time)
    
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
    if (distanceTraveled % 1000 < gameSpeed * deltaTime) {
        gameSpeed = Math.min(gameSpeed + 0.1, 5);
        enemySpawnRate = Math.min(enemySpawnRate + 0.0025, 0.025);
    }
}

function drawPlayer() {
    // Draw shield if active
    if (player.hasShield) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
            player.x + player.width / 2,
            player.y + player.height / 2,
            Math.max(player.width, player.height) / 2 + 4,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        
        // Pulsing inner circle
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
        ctx.fillStyle = '#00ffff';
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    // Draw ship body
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Draw ship nose
    ctx.fillStyle = '#00cc00';
    ctx.fillRect(player.x + player.width - 4, player.y + 4, 4, 4);
    
    // Draw engine flame if thrusting
    if (isThrusting) {
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(player.x - 6, player.y + 3, 6, 6);
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(player.x - 4, player.y + 4, 4, 4);
    }
}

function drawTunnels() {
    ctx.fillStyle = '#444';
    for (const tunnel of tunnels) {
        // Top tunnel
        ctx.fillRect(tunnel.x, 0, tunnel.width, tunnel.topHeight);
        // Bottom tunnel
        ctx.fillRect(tunnel.x, tunnel.bottomY, tunnel.width, canvas.height - tunnel.bottomY);
        
        // Draw edge highlights
        ctx.fillStyle = '#666';
        ctx.fillRect(tunnel.x, tunnel.topHeight - 4, tunnel.width, 4);
        ctx.fillRect(tunnel.x, tunnel.bottomY, tunnel.width, 4);
        ctx.fillStyle = '#444';
    }
}

function drawEnemies() {
    for (const enemy of enemies) {
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        
        // Draw enemy details
        const detailSize = enemy.isBig ? 16 : 8;
        const eyeSize = enemy.isBig ? 4 : 2;
        ctx.fillStyle = '#ff0033';
        ctx.fillRect(enemy.x + 4, enemy.y + 4, detailSize, detailSize);
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 6, enemy.y + 6, eyeSize, eyeSize);
        ctx.fillRect(enemy.x + (enemy.isBig ? 10 : 10), enemy.y + 6, eyeSize, eyeSize);
        
        // Show indicator for shooting enemies
        if (enemy.canShoot) {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(enemy.x + 2, enemy.y + 2, 3, 3);
        }
    }
}

function drawBullets() {
    for (const bullet of bullets) {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(bullet.x + 2, bullet.y + 1, 4, 1);
    }
}

function drawEnemyBullets() {
    for (const bullet of enemyBullets) {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        ctx.fillStyle = '#ff6666';
        ctx.fillRect(bullet.x + 1, bullet.y + 1, 3, 1);
    }
}

function drawCoins() {
    for (const coin of coins_on_screen) {
        const centerX = coin.x + coin.width / 2;
        const centerY = coin.y + coin.height / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(coin.rotation);
        
        // Draw coin
        ctx.fillStyle = coin.color;
        ctx.beginPath();
        ctx.arc(0, 0, coin.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add shine effect
        ctx.fillStyle = coin.isRare ? '#ffffff' : '#ffdd66';
        ctx.beginPath();
        ctx.arc(-1, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Rare coins have a star
        if (coin.isRare) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);
        }
        
        ctx.restore();
    }
}

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
function drawLootDrops() {
    for (const loot of lootDrops) {
        const centerX = loot.x + loot.width / 2;
        const centerY = loot.y + loot.height / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(loot.rotation);
        
        // Draw based on shape
        if (loot.lootType.shape === 'circle') {
            // Draw circle
            ctx.fillStyle = loot.lootType.color;
            ctx.beginPath();
            ctx.arc(0, 0, loot.width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Add glow effect
            ctx.strokeStyle = loot.lootType.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, loot.width / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Draw square
            ctx.fillStyle = loot.lootType.color;
            ctx.fillRect(-loot.width / 2, -loot.height / 2, loot.width, loot.height);
            
            // Add border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(-loot.width / 2, -loot.height / 2, loot.width, loot.height);
        }
        
        // Add sparkle
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1, -1, 2, 2);
        
        ctx.restore();
    }
}

/**
 * Draws random obstacles
 */
function drawObstacles() {
    for (const obstacle of obstacles) {
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // Add warning stripes
        ctx.fillStyle = '#000';
        ctx.fillRect(obstacle.x + 2, obstacle.y + 2, obstacle.width - 4, 4);
        ctx.fillRect(obstacle.x + 2, obstacle.y + 10, obstacle.width - 4, 4);
    }
}

/**
 * Draws active effect indicators on HUD
 */
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
    deltaTime = frameTime / TARGET_FRAME_TIME;
    
    // Cap delta time to prevent huge jumps (e.g., when tab loses focus)
    deltaTime = Math.min(deltaTime, 3);
    
    // Clear canvas
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        // Draw stars background
        drawStars();
        
        // Update (all update functions now use deltaTime for consistent speed)
        updatePlayer();
        updateTunnels();
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
        drawTunnels();
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
    gameState = 'menu';
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
    gameState = 'menu';
    gameOverScreen.classList.remove('active');
    menuScreen.classList.add('active');
    menuScreen.scrollTop = 0; // Reset scroll position
});

retryBtn.addEventListener('click', () => {
    startGame();
});

highScoreBtn.addEventListener('click', async (e) => {
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
    
    if (hasPerks && gameState === 'playing') {
        perkButtonsContainer.classList.add('active');
    } else {
        perkButtonsContainer.classList.remove('active');
    }
}

function usePerk(perkId) {
    if (gameState !== 'playing') return;
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

// Initialize high scores and sync on page load
(async function initializeHighScores() {
    initSupabase();
    await fetchGlobalHighScores();
    await syncQueuedScores();
})();

// Service worker registration for PWA offline support with update notification
// This ensures users always get the latest version without manual cache clearing
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration.scope);
                
                // Check for updates periodically (every hour)
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);
                
                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New service worker found, installing...');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New service worker installed, waiting for user confirmation');
                            // Show update notification to user instead of auto-updating
                            showUpdateNotification(newWorker);
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Service worker registration failed:', error);
            });
        
        // Reload page when new service worker takes control
        // This happens after user accepts the update
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                console.log('New service worker activated, reloading page...');
                window.location.reload();
            }
        });
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

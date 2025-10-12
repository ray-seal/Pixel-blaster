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

// Canvas setup
function resizeCanvas() {
    canvas.width = Math.min(window.innerWidth, 800);
    canvas.height = Math.min(window.innerHeight, 600);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
let gameState = 'menu'; // menu, playing, gameOver
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
let gameSpeed = 2;
let distanceTraveled = 0;

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
    originalHeight: 12
};

// Game objects arrays
let tunnels = [];
let enemies = [];
let bullets = [];
let particles = [];
let powerups = [];
let lootDrops = [];
let obstacles = []; // Random obstacles spawned by loot effects

// Active effects tracking
let activeEffects = [];

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

// Tunnel generation
let tunnelGap = 180;
let tunnelWidth = 60;
let nextTunnelX = canvas.width;

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

gameOverScreen.addEventListener('click', () => {
    if (gameState === 'gameOver') startGame();
});

// Game functions
function startGame() {
    gameState = 'playing';
    score = 0;
    distanceTraveled = 0;
    gameSpeed = 2;
    player.x = 100;
    player.y = canvas.height / 2;
    player.velocityY = 0;
    player.health = player.maxHealth;
    player.width = 20;
    player.height = 12;
    player.doubleShot = false;
    player.bigEnemyMode = false;
    player.obstacleMode = false;
    tunnels = [];
    enemies = [];
    bullets = [];
    particles = [];
    powerups = [];
    lootDrops = [];
    obstacles = [];
    activeEffects = [];
    nextTunnelX = canvas.width;
    lastFrameTime = 0; // Reset delta time tracking
    
    menuScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    hud.classList.add('active');
}

function gameOver() {
    gameState = 'gameOver';
    hud.classList.remove('active');
    gameOverScreen.classList.add('active');
    finalScoreDisplay.textContent = `Score: ${Math.floor(score)}`;
    
    if (score > highScore) {
        highScore = Math.floor(score);
        localStorage.setItem('highScore', highScore);
    }
    highScoreDisplay.textContent = `High Score: ${highScore}`;
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
    
    return {
        x: canvas.width + 50,
        y: Math.random() * (canvas.height - size - 40) + 20,
        width: size,
        height: size,
        speed: gameSpeed + Math.random() * 2,
        health: 1,
        color: isBig ? '#ff0099' : '#ff0066',
        isBig: isBig,
        points: points
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
        
        player.shootCooldown = 15;
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
    // Spawn enemies
    if (Math.random() < 0.02) {
        enemies.push(createEnemy());
    }
    
    // Update enemies (movement scaled by delta time)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.x -= enemy.speed * deltaTime;
        
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
            enemies.splice(i, 1);
            takeDamage();
        }
    }
    
    // Player vs obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        if (isColliding(player, obstacle)) {
            particles.push(...createParticle(obstacle.x, obstacle.y, obstacle.color));
            obstacles.splice(i, 1);
            takeDamage();
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
    
    // Bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (isColliding(bullet, enemy)) {
                particles.push(...createParticle(enemy.x, enemy.y, enemy.color));
                
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
    player.health--;
    if (player.health <= 0) {
        gameOver();
    }
}

function updateScore() {
    distanceTraveled += gameSpeed * deltaTime;
    score += 0.1 * deltaTime; // Gradual score increase for distance (scaled by delta time)
    
    // Gradually increase difficulty
    if (distanceTraveled % 1000 < gameSpeed * deltaTime) {
        gameSpeed = Math.min(gameSpeed + 0.1, 5);
    }
}

function drawPlayer() {
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
    scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
    healthDisplay.textContent = `Health: ${'❤'.repeat(player.health)}${'🖤'.repeat(player.maxHealth - player.health)}`;
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
        drawBullets();
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

// Service worker registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
        console.log('Service worker registration failed');
    });
}

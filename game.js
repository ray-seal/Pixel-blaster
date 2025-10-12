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
    color: '#00ff00'
};

// Game objects arrays
let tunnels = [];
let enemies = [];
let bullets = [];
let particles = [];
let powerups = [];

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
    tunnels = [];
    enemies = [];
    bullets = [];
    particles = [];
    powerups = [];
    nextTunnelX = canvas.width;
    
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
    return {
        x: canvas.width + 50,
        y: Math.random() * (canvas.height - 40) + 20,
        width: 16,
        height: 16,
        speed: gameSpeed + Math.random() * 2,
        health: 1,
        color: '#ff0066'
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

function updatePlayer() {
    // Apply thrust
    if (isThrusting) {
        player.velocityY = player.thrust;
    }
    
    // Apply gravity
    player.velocityY += player.gravity;
    player.y += player.velocityY;
    
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
    
    // Shooting
    if (isShooting && player.shootCooldown <= 0) {
        bullets.push(createBullet());
        player.shootCooldown = 15;
    }
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }
}

function updateTunnels() {
    // Generate new tunnels
    if (nextTunnelX < canvas.width + 200) {
        tunnels.push(createTunnel(nextTunnelX));
        nextTunnelX += 250;
    }
    
    // Update and remove tunnels
    for (let i = tunnels.length - 1; i >= 0; i--) {
        const tunnel = tunnels[i];
        tunnel.x -= gameSpeed;
        
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
    
    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.x -= enemy.speed;
        
        // Remove off-screen enemies
        if (enemy.x + enemy.width < 0) {
            enemies.splice(i, 1);
        }
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.speed;
        
        // Remove off-screen bullets
        if (bullet.x > canvas.width) {
            bullets.splice(i, 1);
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        
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
    
    // Bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (isColliding(bullet, enemy)) {
                particles.push(...createParticle(enemy.x, enemy.y, enemy.color));
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                score += 50; // Bonus for killing enemies
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
    distanceTraveled += gameSpeed;
    score += 0.1; // Gradual score increase for distance
    
    // Gradually increase difficulty
    if (distanceTraveled % 1000 < gameSpeed) {
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
        ctx.fillStyle = '#ff0033';
        ctx.fillRect(enemy.x + 4, enemy.y + 4, 8, 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 6, enemy.y + 6, 2, 2);
        ctx.fillRect(enemy.x + 10, enemy.y + 6, 2, 2);
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

function updateHUD() {
    scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
    healthDisplay.textContent = `Health: ${'❤'.repeat(player.health)}${'🖤'.repeat(player.maxHealth - player.health)}`;
}

function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        // Draw stars background
        drawStars();
        
        // Update
        updatePlayer();
        updateTunnels();
        updateEnemies();
        updateBullets();
        updateParticles();
        checkCollisions();
        updateScore();
        updateHUD();
        
        // Draw
        drawTunnels();
        drawEnemies();
        drawBullets();
        drawPlayer();
        drawParticles();
    }
    
    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();

// Service worker registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
        console.log('Service worker registration failed');
    });
}

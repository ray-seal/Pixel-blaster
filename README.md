# Pixel Blaster

A retro-style side-scrolling space shooter PWA game for mobile devices.

## Game Description

Pixel Blaster is a progressive web app (PWA) game that combines the mechanics of Flappy Bird with the action of classic space shooters like Asteroids. Navigate your pixelated spaceship through dangerous tunnels that protrude from the top and bottom of the screen while shooting alien ships and collecting points.

## Features

- **Side-scrolling gameplay**: Endless runner style with increasing difficulty
- **Simple controls**: Tap/click to thrust up and shoot
- **Pixel art graphics**: Retro-style visuals with smooth animations
- **Scoring system**: 
  - Points increase gradually based on distance traveled
  - Bonus points (50) for destroying alien ships, (150) for big enemies
  - Pass through tunnels for additional points (10)
- **Loot Drop System**: Random enemies drop power-ups with temporary effects
  - **Beneficial Effects**:
    - 🔵 **Double Shot** (8s): Fire three bullets at once for massive firepower
    - 🟣 **Big Enemy Spawner** (10s): Spawn larger enemies worth 3x points (150 vs 50)
  - **Challenging Effects**:
    - 🟠 **Random Obstacles** (8s): Dodge randomly spawning hazardous obstacles
    - 🔴 **Shrink Ship** (6s): Your ship shrinks to 60% size, harder to maneuver
  - Loot drops have distinct shapes (circles for beneficial, squares for challenging) and colors
  - Active effects display with countdown timers on screen
  - 20% chance to drop loot when defeating enemies
- **Progressive difficulty**: Game speed increases as you progress
- **Health system**: Three lives to survive as long as possible
- **High score tracking**: Local storage saves your best score
- **PWA support**: Install on mobile devices for offline play
- **Mobile-optimized**: Responsive design for various screen sizes

## How to Play

1. Open `index.html` in a modern web browser
2. Tap or click anywhere to start the game
3. Tap/hold to make your ship thrust upward
4. Your ship automatically shoots while holding
5. Avoid hitting the tunnels (top and bottom obstacles)
6. Destroy alien ships for bonus points
7. Collect loot drops (colorful rotating shapes) for power-ups
8. Try to survive as long as possible and achieve the highest score!

### Loot System Tips

- **Circular loot** = Beneficial effects (cyan/magenta colors)
- **Square loot** = Challenging effects (red/orange colors)
- Active effects show in the top-left with countdown timers
- Effects can be refreshed by collecting the same loot type again
- Big enemies (when spawned) are worth 3x more points but are harder to avoid

## Controls

- **Touch/Click**: Thrust up and shoot
- The ship falls due to gravity when not thrusting
- Shooting happens automatically while holding

## Installation

### Play in Browser
Simply open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).

### Install as PWA (Mobile)
1. Open the game in your mobile browser
2. Use the browser's "Add to Home Screen" option
3. Launch from your home screen for a full-screen experience

## Technologies Used

- HTML5 Canvas for rendering
- Vanilla JavaScript for game logic
- CSS3 for styling and animations
- Service Worker for PWA capabilities
- Web App Manifest for installation

## Development

No build tools required! This is a pure HTML/CSS/JavaScript game that runs directly in the browser.

To modify the game:
1. Edit `game.js` for game logic
2. Edit `style.css` for visual styling
3. Edit `index.html` for structure

### Adding New Loot Types

The loot system is designed to be extensible. To add a new loot type:

1. Add a new entry to the `LOOT_TYPES` object in `game.js`:
```javascript
NEW_LOOT: {
    id: 'unique_id',
    name: 'Display Name',
    color: '#hexcolor',
    shape: 'circle', // or 'square'
    duration: 8000, // milliseconds
    type: 'beneficial', // or 'challenging'
    apply: () => {
        // Code to apply the effect
        player.someProperty = true;
    },
    remove: () => {
        // Code to remove the effect
        player.someProperty = false;
    }
}
```

2. Add any necessary player properties or game state variables
3. Implement the effect logic in the appropriate game functions
4. The loot will automatically appear in the random drop pool

### Loot System Architecture

- **LOOT_TYPES**: Registry of all available loot types with their properties
- **lootDrops[]**: Active loot drops on screen
- **activeEffects[]**: Currently active effects with timers
- **createLootDrop()**: Spawns a random loot at enemy defeat position
- **applyLootEffect()**: Applies or extends an effect duration
- **updateLootEffects()**: Manages effect timers and removal
- **drawLootDrops()**: Renders loot with visual distinction
- **drawActiveEffects()**: Shows active effect indicators with countdown

## License

Open source - feel free to modify and use as you wish!
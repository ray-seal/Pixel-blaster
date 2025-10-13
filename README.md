# Pixel Blaster

A retro-style side-scrolling space shooter PWA game for mobile devices.

> **🎮 Fully Offline Playable!** Install as a PWA and play anywhere, anytime - no internet required!  
> See [PWA_OFFLINE_GUIDE.md](PWA_OFFLINE_GUIDE.md) for complete offline play documentation.

## Game Description

Pixel Blaster is a progressive web app (PWA) game that combines the mechanics of Flappy Bird with the action of classic space shooters like Asteroids. Navigate your pixelated spaceship through dangerous tunnels that protrude from the top and bottom of the screen while shooting alien ships and collecting points.

## Features

- **Side-scrolling gameplay**: Endless runner style with increasing difficulty
- **Simple controls**: Tap/click to thrust up and shoot
- **Pixel art graphics**: Retro-style visuals with smooth animations
- **Consistent game speed**: Delta time system ensures smooth gameplay at any frame rate on Android, iPhone, and all devices
- **Scoring system**: 
  - Points increase gradually based on distance traveled
  - Bonus points (50) for destroying alien ships, (150) for big enemies
  - Pass through tunnels for additional points (10)
- **Loot Drop System**: Random enemies drop power-ups with temporary effects
  - **Interactive Legend**: Menu screen displays all loot types with visual icons and descriptions
  - **Beneficial Effects**:
    - 🔵 **Double Shot** (8s): Fire three bullets at once for massive firepower
    - 🟣 **Big Enemy Spawner** (10s): Spawn larger enemies worth 3x points (150 vs 50)
    - 🟢 **Extra Life**: Gain one additional life (instant effect, capped at max health)
  - **Challenging Effects**:
    - 🟠 **Random Obstacles** (8s): Dodge randomly spawning hazardous obstacles
    - 🔴 **Shrink Ship** (6s): Your ship shrinks to 60% size, harder to maneuver
  - Loot drops have distinct shapes (circles for beneficial, squares for challenging) and colors
  - Active effects display with countdown timers on screen
  - 20% chance to drop loot when defeating enemies
- **Progressive difficulty**: Game speed and enemy spawn rate increase as you progress
  - Starts with fewer enemies (0.5% spawn chance per frame)
  - Every 1000 distance units: spawn rate increases by 0.25% and game speed by 0.1
  - Spawn rate caps at 2.5% and speed caps at 5 for balanced gameplay
- **Health system**: Three lives to survive as long as possible
- **Global High Score System**: Compete with players worldwide
  - 🏆 **Global Leaderboard**: View top 20 high scores from all players
  - **Rich Display**: Shows score, name, distance traveled, and date achieved
  - **Name Entry**: Required 3-character name for high score submission
  - **Offline Support**: Scores queued locally and synced when online
  - **Powered by Supabase**: Real-time global leaderboard with fallback to local storage
- **Local high score tracking**: Your personal best score saved in browser
- **Upgrades Shop System**: Earn coins by destroying enemies and purchase temporary power-ups
  - Various perks available: speed boost, enemy reduction, shields, rapid fire, coin magnet, and invincibility
  - Coins persist between game sessions
  - Perks can be activated during gameplay for strategic advantage
- **Full PWA Support**: Complete offline functionality as a Progressive Web App
  - **Offline-first**: All game assets cached for offline play
  - **No internet required**: Play anywhere, anytime after first load
  - **Standalone app**: Runs independently of browser after installation
  - **No time restrictions**: Bypasses browser time limits when installed as PWA
  - **Auto-updates**: Service worker automatically updates the game in the background
  - **Cross-platform**: Install on Android, iOS, Windows, macOS, Linux, and ChromeOS
- **Mobile-optimized**: Responsive design for various screen sizes

## How to Play

1. Open `index.html` in a modern web browser
2. Tap or click anywhere to start the game
3. Review the **Loot Drops Legend** on the menu screen to learn about power-ups
4. Tap/hold to make your ship thrust upward
5. Your ship automatically shoots while holding
6. Avoid hitting the tunnels (top and bottom obstacles)
7. Destroy alien ships for bonus points
8. Collect loot drops (colorful rotating shapes) for power-ups
9. Try to survive as long as possible and achieve the highest score!

### Loot System Tips

- **Circular loot** = Beneficial effects (cyan/magenta colors)
- **Square loot** = Challenging effects (red/orange colors)
- Active effects show in the top-left with countdown timers
- Effects can be refreshed by collecting the same loot type again
- Big enemies (when spawned) are worth 3x more points but are harder to avoid
- Check the legend on the menu screen for details on each loot type

## Controls

- **Touch/Click**: Thrust up and shoot
- The ship falls due to gravity when not thrusting
- Shooting happens automatically while holding

## Installation

### Play in Browser
Simply open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).

### Install as PWA (Progressive Web App)

#### Mobile Installation
1. **Android (Chrome/Edge)**:
   - Open the game in Chrome or Edge browser
   - Tap the menu (⋮) and select "Install app" or "Add to Home Screen"
   - The game will be installed as a standalone app
   - Launch from your home screen for a full-screen experience

2. **iOS (Safari)**:
   - Open the game in Safari browser
   - Tap the Share button (□↑)
   - Scroll down and tap "Add to Home Screen"
   - Tap "Add" to install
   - Launch from your home screen

#### Desktop Installation
1. **Chrome/Edge**:
   - Open the game in your browser
   - Look for the install icon (⊕) in the address bar
   - Click "Install" when prompted
   - The game will open in its own window

### Offline Play
Once installed, **Pixel Blaster works completely offline**! 
- All game assets are cached on first load
- No internet connection required after installation
- Play anywhere, anytime - even in airplane mode
- Game state, scores, and coins are saved locally
- Works independently of browser restrictions

**Note**: The game must be loaded at least once while online to cache all assets. After that, it will work offline indefinitely.

## Technologies Used

- HTML5 Canvas for rendering
- Vanilla JavaScript for game logic
- CSS3 for styling and animations
- Service Worker for offline-first PWA capabilities
- Web App Manifest for installation
- Cache API for offline asset storage
- Supabase for global high score leaderboard

## Supabase Setup (Optional)

The game includes a global high score system powered by Supabase. If you want to use this feature:

1. Create a free account at [Supabase](https://supabase.com)
2. Create a new project
3. In the SQL Editor, create the `high_scores` table:
   ```sql
   CREATE TABLE high_scores (
     id BIGSERIAL PRIMARY KEY,
     name VARCHAR(3) NOT NULL,
     score INTEGER NOT NULL,
     distance INTEGER NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Add index for faster queries
   CREATE INDEX idx_high_scores_score ON high_scores(score DESC);
   
   -- Enable Row Level Security
   ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;
   
   -- Allow public read access
   CREATE POLICY "Allow public read access" ON high_scores
     FOR SELECT USING (true);
   
   -- Allow public insert access
   CREATE POLICY "Allow public insert access" ON high_scores
     FOR INSERT WITH CHECK (true);
   ```
4. Get your project URL and anon key from Project Settings > API
5. Update the configuration in `game.js`:
   ```javascript
   const SUPABASE_URL = 'your-project-url';
   const SUPABASE_KEY = 'your-anon-key';
   ```

**Note**: The game works perfectly offline without Supabase. Scores are cached locally and synced when online.

## Development

No build tools required! This is a pure HTML/CSS/JavaScript game that runs directly in the browser.

To modify the game:
1. Edit `game.js` for game logic
2. Edit `style.css` for visual styling
3. Edit `index.html` for structure

### Delta Time System

The game uses a delta time system to ensure consistent gameplay speed across all devices, regardless of screen refresh rate or device performance:

- **Time-based movement**: All movements, animations, and timers are scaled by delta time
- **60 FPS baseline**: Delta time is normalized to a 60 FPS target (16.67ms per frame)
- **Frame rate independent**: Game runs at the same logical speed whether at 30 FPS, 60 FPS, 120 FPS, or variable frame rates
- **Cross-platform consistency**: Ensures identical gameplay experience on Android, iPhone, and desktop
- **Performance handling**: Caps delta time at 3x to prevent huge jumps when tabs lose/regain focus

Implementation details:
- `deltaTime` variable tracks time multiplier relative to target frame rate
- All velocity, position, rotation, and timer updates multiply by `deltaTime`
- `lastFrameTime` tracks previous frame timestamp for delta calculation

### Progressive Difficulty System

The game implements a progressive difficulty system to ensure an easy start with gradual challenge increase:

- **Initial difficulty**: Game starts with low enemy spawn rate (0.5% chance per frame) and base game speed (2)
- **Difficulty scaling**: Every 1000 distance units traveled:
  - Enemy spawn rate increases by 0.25 percentage points
  - Game speed increases by 0.1
- **Difficulty caps**: 
  - Enemy spawn rate maxes at 2.5% to prevent overwhelming the player
  - Game speed maxes at 5 for manageable gameplay
- **Reset on restart**: Both spawn rate and speed reset to initial values when starting a new game

This system ensures:
- New players can learn the game mechanics without being overwhelmed
- Experienced players face increasing challenges as they progress
- The game maintains a balanced difficulty curve throughout gameplay

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

2. Add a corresponding legend item in `index.html` in the loot legend section:
```html
<div class="legend-item">
    <canvas class="loot-icon" data-loot="NEW_LOOT"></canvas>
    <div class="loot-info">
        <span class="loot-name">Display Name</span>
        <span class="loot-desc">Brief description of effect (duration)</span>
    </div>
</div>
```

3. Add any necessary player properties or game state variables
4. Implement the effect logic in the appropriate game functions
5. The loot will automatically appear in the random drop pool and legend icons will render automatically

### Loot System Architecture

- **LOOT_TYPES**: Registry of all available loot types with their properties
- **lootDrops[]**: Active loot drops on screen
- **activeEffects[]**: Currently active effects with timers
- **createLootDrop()**: Spawns a random loot at enemy defeat position
- **applyLootEffect()**: Applies or extends an effect duration
- **updateLootEffects()**: Manages effect timers and removal
- **drawLootDrops()**: Renders loot with visual distinction
- **drawActiveEffects()**: Shows active effect indicators with countdown
- **renderLootLegendIcons()**: Renders loot type icons on menu screen legend

## License

Open source - feel free to modify and use as you wish!
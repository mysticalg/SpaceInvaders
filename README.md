# Galaxion Retro (HTML5)

A retro-inspired **Space Invaders / Galaxian-style** arcade game built with pure HTML5, CSS, and JavaScript.

## Features

- Splash screen with controls and one-click start.
- Fluid movement and shooting at 60fps with `requestAnimationFrame`.
- Polished retro HUD with score, wave, lives, shield %, active weapon, bombs, probe wing status, enemies left, next extra life target, and wave timer.
- Multi-layer parallax backdrop with stars, galaxies, and drifting planets.
- Animated enemies with 360° spin, staged formation entries, and attack patterns (arcs, circles, and sine runs).
- Wave-window pressure system: each wave has a countdown and surviving enemies fly away when time expires.
- Expanded weapon system with selectable loadouts:
  - Pulse
  - Spread
  - Laser
  - Nova burst
- EMP bomb system (`B`) to clear enemy bullets and damage clustered invaders.
- Regenerative shield-energy system that absorbs hits before hull lives are consumed.
- Colorful animated collectible cores with unique icons and effects.
- In-game pilot help panel + live strategy tips.
- Gradius-style probe options that ghost the player path, auto-fire, and can be upgraded with Probe Cores.
- Multiple enemy classes and formations:
  - Grunt units
  - Zig-zag units
  - Elite multi-hit units
  - Bonus raid enemies
- Progressive wave difficulty and attack rate scaling.
- Bonus rounds every 4th wave.
- Extra life score milestones.
- Hall of Fame (Top 10) stored in Local Storage for durable persistence on each browser/device.
- Pause/resume support.

## Controls

- **Move:** Arrow Left/Right or A/D
- **Fire:** Space
- **Bomb:** B
- **Cycle Weapon:** Q / E
- **Pause:** P
- **Wave goal:** destroy enemies before they complete attack runs and escape
- **Start:** Enter

## Run locally

Because this is a static app, you can open `index.html` directly or serve it:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## High score persistence details

Scores are stored using `localStorage` key `galaxionRetroHighScoresV1`.

This means scores are retained across page refreshes and browser restarts on the same browser profile.

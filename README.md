# Galaxion Retro (HTML5)

A retro-inspired **Space Invaders / Galaxian-style** arcade game built with pure HTML5, CSS, and JavaScript.

## Features

- Splash screen with controls and one-click start.
- Fluid movement and shooting at 60fps with `requestAnimationFrame`.
- Multiple enemy classes and formations:
  - Grunt units
  - Zig-zag units
  - Elite multi-hit units
  - Bonus raid enemies
- Progressive wave difficulty and attack rate scaling.
- Bonus rounds every 4th wave.
- Power-ups:
  - Shield
  - Rapid fire
  - Multi-shot
  - Extra life capsules
- Extra life score milestones.
- Hall of Fame (Top 10) stored in Local Storage for durable persistence on each browser/device.
- Pause/resume support.

## Controls

- **Move:** Arrow Left/Right or A/D
- **Fire:** Space
- **Pause:** P
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

## CI build workflow

A GitHub Action is included to validate the project on each push to `main`:

- checks HTML/CSS/JS files exist
- packages the static site as an artifact

File: `.github/workflows/build.yml`

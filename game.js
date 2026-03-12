const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  lives: document.getElementById("lives"),
  power: document.getElementById("power"),
  enemiesLeft: document.getElementById("enemiesLeft"),
  nextLife: document.getElementById("nextLife"),
  splash: document.getElementById("splashScreen"),
  pause: document.getElementById("pauseScreen"),
  gameOver: document.getElementById("gameOverScreen"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  finalScore: document.getElementById("finalScore"),
  startBtn: document.getElementById("startBtn"),
  restartBtn: document.getElementById("restartBtn"),
  scores: document.getElementById("highScores"),
  form: document.getElementById("newRecordForm"),
  initials: document.getElementById("initials"),
  saveScoreBtn: document.getElementById("saveScoreBtn"),
  statusTip: document.getElementById("statusTip"),
};

const STORAGE_KEY = "galaxionRetroHighScoresV1";
const MAX_SCORES = 10;

const keys = new Set();
let running = false;
let paused = false;
let lastTime = 0;

const stars = Array.from({ length: 120 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  speed: 30 + Math.random() * 70,
  size: Math.random() * 2,
}));

let game;

function initialState() {
  return {
    score: 0,
    wave: 1,
    lives: 3,
    player: {
      x: canvas.width / 2,
      y: canvas.height - 58,
      w: 36,
      h: 26,
      speed: 360,
      cooldown: 0,
      shield: 0,
      rapid: 0,
      multishot: 0,
    },
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    powerUps: [],
    bonusRound: false,
    extraLifeAt: 15000,
    formationPhase: 0,
  };
}

function loadScores() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveScores(scores) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
}

function renderScores() {
  const list = loadScores();
  ui.scores.innerHTML = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.textContent = "No records yet";
    ui.scores.appendChild(li);
    return;
  }
  list.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s.name} — ${s.score}`;
    ui.scores.appendChild(li);
  });
}

function showOverlay(el, visible) {
  el.classList.toggle("visible", visible);
}

function spawnWave() {
  game.enemies = [];
  game.enemyBullets = [];
  const cols = 10;
  const rows = 5;
  const spacingX = 70;
  const spacingY = 52;
  const startX = canvas.width / 2 - ((cols - 1) * spacingX) / 2;
  const startY = 70;

  // Build a mixed enemy roster with different behavior, HP, and score values.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = r === 0 ? "elite" : r < 3 ? "zig" : "grunt";
      const hp = type === "elite" ? 3 : type === "zig" ? 2 : 1;
      game.enemies.push({
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        baseX: startX + c * spacingX,
        baseY: startY + r * spacingY,
        w: 32,
        h: 24,
        hp,
        type,
        t: Math.random() * Math.PI * 2,
      });
    }
  }

  if (game.wave % 4 === 0) {
    game.bonusRound = true;
    for (let i = 0; i < 18; i++) {
      game.enemies.push({
        x: -80 - i * 80,
        y: 80 + (i % 4) * 36,
        baseX: 0,
        baseY: 0,
        w: 34,
        h: 20,
        hp: 1,
        type: "bonus",
        t: i,
      });
    }
  } else {
    game.bonusRound = false;
  }
}

function startGame() {
  game = initialState();
  spawnWave();
  running = true;
  paused = false;
  ui.form.classList.add("hidden");
  showOverlay(ui.splash, false);
  showOverlay(ui.gameOver, false);
  showOverlay(ui.pause, false);
}

function shoot() {
  if (game.player.cooldown > 0) return;
  const cd = game.player.rapid > 0 ? 0.1 : 0.22;
  game.player.cooldown = cd;
  const x = game.player.x;
  const y = game.player.y - game.player.h / 2;
  game.playerBullets.push({ x, y, vx: 0, vy: -620, r: 3 });
  if (game.player.multishot > 0) {
    game.playerBullets.push({ x, y, vx: -170, vy: -570, r: 3 });
    game.playerBullets.push({ x, y, vx: 170, vy: -570, r: 3 });
  }
}

function update(dt) {
  // Timers are decremented once per frame and clamped at 0 to avoid drift.
  game.player.cooldown = Math.max(0, game.player.cooldown - dt);
  game.player.shield = Math.max(0, game.player.shield - dt);
  game.player.rapid = Math.max(0, game.player.rapid - dt);
  game.player.multishot = Math.max(0, game.player.multishot - dt);

  const left = keys.has("ArrowLeft") || keys.has("a");
  const right = keys.has("ArrowRight") || keys.has("d");
  if (left) game.player.x -= game.player.speed * dt;
  if (right) game.player.x += game.player.speed * dt;
  game.player.x = Math.max(25, Math.min(canvas.width - 25, game.player.x));

  for (const s of stars) {
    s.y += s.speed * dt;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  }

  game.playerBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  game.playerBullets = game.playerBullets.filter((b) => b.y > -20 && b.x > -20 && b.x < canvas.width + 20);

  game.formationPhase += dt * (0.85 + game.wave * 0.03);

  game.enemies.forEach((e, i) => {
    e.t += dt;

    if (e.type === "bonus") {
      e.x += (180 + game.wave * 20) * dt;
      e.y += Math.sin(e.t * 6) * 45 * dt;
      return;
    }

    // Formation movement with smooth sine patterns to emulate classic diving feel.
    e.x = e.baseX + Math.sin(game.formationPhase + i * 0.15) * (40 + game.wave * 1.5);
    e.y = e.baseY + Math.cos(game.formationPhase * 0.65 + i * 0.09) * 12;

    if (e.type === "zig") {
      e.y += Math.sin(e.t * 5) * 1.3;
    }
    if (e.type === "elite") {
      e.y += Math.sin(e.t * 2) * 0.8;
    }

    // Randomized attack dives increase with wave difficulty.
    if (Math.random() < dt * (0.12 + game.wave * 0.02)) {
      game.enemyBullets.push({ x: e.x, y: e.y, vx: 0, vy: 180 + game.wave * 15, r: 4 });
    }

    if (Math.random() < dt * (0.03 + game.wave * 0.004)) {
      e.baseY += 8;
    }
  });

  game.enemyBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  game.enemyBullets = game.enemyBullets.filter((b) => b.y < canvas.height + 20);

  game.powerUps.forEach((p) => {
    p.y += p.vy * dt;
    p.t += dt;
  });
  game.powerUps = game.powerUps.filter((p) => p.y < canvas.height + 30);

  // Bullet to enemy collisions.
  for (const b of game.playerBullets) {
    for (const e of game.enemies) {
      if (Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
        b.y = -999;
        e.hp -= 1;
        if (e.hp <= 0) {
          const scoreGain = e.type === "elite" ? 220 : e.type === "zig" ? 120 : e.type === "bonus" ? 350 : 80;
          game.score += scoreGain;
          if (Math.random() < 0.12) {
            const options = ["shield", "rapid", "multishot", "life"];
            const kind = options[Math.floor(Math.random() * options.length)];
            game.powerUps.push({ x: e.x, y: e.y, vy: 90, kind, t: 0 });
          }
          for (let i = 0; i < 8; i++) {
            game.particles.push({
              x: e.x,
              y: e.y,
              vx: (Math.random() - 0.5) * 220,
              vy: (Math.random() - 0.5) * 220,
              life: 0.6,
              color: e.type === "elite" ? "#ff2a6d" : "#00ff99",
            });
          }
        }
      }
    }
  }

  game.enemies = game.enemies.filter((e) => e.hp > 0 && e.y < canvas.height + 50 && e.x < canvas.width + 100);

  // Enemy bullets hitting player.
  const p = game.player;
  for (const b of game.enemyBullets) {
    if (Math.abs(b.x - p.x) < p.w / 2 && Math.abs(b.y - p.y) < p.h / 2) {
      b.y = canvas.height + 999;
      if (p.shield > 0) {
        continue;
      }
      game.lives -= 1;
      p.shield = 1.8;
      if (game.lives <= 0) {
        return endGame();
      }
    }
  }

  // Player collects power ups.
  for (const power of game.powerUps) {
    if (Math.abs(power.x - p.x) < p.w / 2 + 12 && Math.abs(power.y - p.y) < p.h / 2 + 12) {
      power.y = canvas.height + 999;
      if (power.kind === "shield") p.shield = 10;
      if (power.kind === "rapid") p.rapid = 10;
      if (power.kind === "multishot") p.multishot = 10;
      if (power.kind === "life") game.lives += 1;
    }
  }
  game.powerUps = game.powerUps.filter((power) => power.y < canvas.height + 100);

  game.particles.forEach((px) => {
    px.x += px.vx * dt;
    px.y += px.vy * dt;
    px.life -= dt;
  });
  game.particles = game.particles.filter((px) => px.life > 0);

  if (game.score >= game.extraLifeAt) {
    game.lives += 1;
    game.extraLifeAt += 15000;
  }

  // New wave spawn and difficulty climb.
  if (!game.enemies.length) {
    game.wave += 1;
    spawnWave();
  }

  // Lose condition from enemies descending too far.
  if (game.enemies.some((e) => e.y > canvas.height - 95 && e.type !== "bonus")) {
    game.lives = 0;
    endGame();
  }

  ui.score.textContent = game.score;
  ui.wave.textContent = game.wave;
  ui.lives.textContent = game.lives;
  ui.enemiesLeft.textContent = game.enemies.length;
  ui.nextLife.textContent = Math.max(0, game.extraLifeAt - game.score);
  ui.power.textContent =
    p.shield > 0 ? "SHIELD" : p.multishot > 0 ? "MULTI" : p.rapid > 0 ? "RAPID" : "NONE";

  // Lightweight adaptive gameplay hint that updates without expensive analysis.
  if (game.bonusRound) {
    ui.statusTip.textContent = "Bonus raid active: focus on speed and chain hits for score spikes.";
  } else if (game.lives === 1) {
    ui.statusTip.textContent = "Critical hull: prioritize shield and life capsules before damage trading.";
  } else if (game.enemies.length < 8) {
    ui.statusTip.textContent = "Wave almost clear: keep pressure on remaining invaders.";
  } else {
    ui.statusTip.textContent = "Tip: clear elites first to reduce incoming fire pressure.";
  }
}

function endGame() {
  running = false;
  ui.finalScore.textContent = `Final Score: ${game.score}`;
  const scores = loadScores();
  const qualifies = scores.length < MAX_SCORES || game.score > scores[scores.length - 1].score;
  ui.form.classList.toggle("hidden", !qualifies);
  showOverlay(ui.gameOver, true);
}

function drawShip(x, y, color = "#00ff99") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x - 16, y + 12);
  ctx.lineTo(x + 16, y + 12);
  ctx.closePath();
  ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  stars.forEach((s) => {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });

  if (!game) return;

  drawShip(game.player.x, game.player.y, game.player.shield > 0 ? "#8ecae6" : "#00ff99");

  for (const b of game.playerBullets) {
    ctx.fillStyle = "#ffe066";
    ctx.fillRect(b.x - 1, b.y - 8, 3, 12);
  }

  for (const b of game.enemyBullets) {
    ctx.fillStyle = "#ff2a6d";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of game.enemies) {
    if (e.type === "elite") {
      drawShip(e.x, e.y, "#ff2a6d");
    } else if (e.type === "zig") {
      drawShip(e.x, e.y, "#ffaa00");
    } else if (e.type === "bonus") {
      drawShip(e.x, e.y, "#ffffff");
    } else {
      drawShip(e.x, e.y, "#00e5ff");
    }

    if (e.hp > 1) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(e.x - 10, e.y - 18, e.hp * 6, 2);
    }
  }

  for (const power of game.powerUps) {
    const icon = power.kind === "life" ? "+" : "P";
    ctx.strokeStyle = "#ffe066";
    ctx.strokeRect(power.x - 10, power.y - 10, 20, 20);
    ctx.fillStyle = "#ffe066";
    ctx.font = "bold 14px Courier New";
    ctx.fillText(icon, power.x - 4, power.y + 5);
  }

  for (const px of game.particles) {
    ctx.globalAlpha = Math.max(0, px.life);
    ctx.fillStyle = px.color;
    ctx.fillRect(px.x, px.y, 2, 2);
  }
  ctx.globalAlpha = 1;

  if (game.bonusRound) {
    ctx.fillStyle = "#ffe066";
    ctx.font = "bold 26px Courier New";
    ctx.fillText("BONUS RAID ROUND", canvas.width / 2 - 140, 34);
  }
}

function gameLoop(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0);
  lastTime = ts;

  if (running && !paused) {
    update(dt);
  }

  render();
  requestAnimationFrame(gameLoop);
}

ui.startBtn.addEventListener("click", startGame);
ui.restartBtn.addEventListener("click", startGame);
ui.saveScoreBtn.addEventListener("click", () => {
  const name = (ui.initials.value || "AAA").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "AAA";
  const scores = loadScores();
  scores.push({ name, score: game.score });
  scores.sort((a, b) => b.score - a.score);
  saveScores(scores.slice(0, MAX_SCORES));
  ui.form.classList.add("hidden");
  renderScores();
});

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", " ", "a", "d", "p", "Enter"].includes(e.key)) e.preventDefault();
  if (e.key === "p" || e.key === "P") {
    paused = !paused;
    showOverlay(ui.pause, paused && running);
    return;
  }
  if (e.key === "Enter" && !running) {
    startGame();
  }
  if (e.key === " ") {
    if (running && !paused) shoot();
  }
  keys.add(e.key);
});

window.addEventListener("keyup", (e) => keys.delete(e.key));

renderScores();
showOverlay(ui.splash, true);
requestAnimationFrame(gameLoop);

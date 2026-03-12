const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  lives: document.getElementById("lives"),
  shield: document.getElementById("shield"),
  weapon: document.getElementById("weapon"),
  bombs: document.getElementById("bombs"),
  enemiesLeft: document.getElementById("enemiesLeft"),
  nextLife: document.getElementById("nextLife"),
  power: document.getElementById("power"),
  splash: document.getElementById("splashScreen"),
  pause: document.getElementById("pauseScreen"),
  gameOver: document.getElementById("gameOverScreen"),
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
const WEAPONS = ["pulse", "spread", "laser", "nova"];

const keys = new Set();
let running = false;
let paused = false;
let lastTime = 0;

const stars = Array.from({ length: 120 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  speed: 25 + Math.random() * 75,
  size: 0.8 + Math.random() * 2,
}));

const planetLayer = Array.from({ length: 5 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: 35 + Math.random() * 55,
  speed: 8 + Math.random() * 10,
  hue: Math.floor(180 + Math.random() * 140),
}));

const nebulaLayer = Array.from({ length: 8 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  w: 140 + Math.random() * 220,
  h: 65 + Math.random() * 120,
  speed: 14 + Math.random() * 16,
  alpha: 0.06 + Math.random() * 0.08,
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
      speed: 390,
      cooldown: 0,
      shieldEnergy: 100,
      shieldRegen: 5,
      weaponIndex: 0,
      rapid: 0,
      multishot: 0,
      bombCount: 2,
      bombCooldown: 0,
    },
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    powerUps: [],
    bonusRound: false,
    extraLifeAt: 15000,
    formationPhase: 0,
    nextAttackAt: 0.8,
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

  // Mixed roster with spin rates and attack pattern metadata for wave choreography.
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
        mode: "formation",
        divePattern: "sine",
        diveTime: 0,
        attackCooldown: 0,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: 1.2 + Math.random() * 1.8,
      });
    }
  }

  if (game.wave % 4 === 0) {
    game.bonusRound = true;
    for (let i = 0; i < 18; i++) {
      game.enemies.push({
        x: -80 - i * 90,
        y: 70 + (i % 5) * 42,
        baseX: 0,
        baseY: 0,
        w: 34,
        h: 20,
        hp: 1,
        type: "bonus",
        t: i,
        mode: "dive",
        divePattern: i % 2 ? "spiral" : "sine",
        diveTime: i * 0.12,
        attackCooldown: 0,
        spin: i,
        spinSpeed: 4,
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

function getWeaponName() {
  return WEAPONS[game.player.weaponIndex].toUpperCase();
}

function shoot() {
  if (game.player.cooldown > 0) return;
  const player = game.player;
  const weapon = WEAPONS[player.weaponIndex];
  const rapidFactor = player.rapid > 0 ? 0.55 : 1;

  if (weapon === "pulse") {
    player.cooldown = 0.2 * rapidFactor;
    game.playerBullets.push({ x: player.x, y: player.y - 12, vx: 0, vy: -640, r: 3, style: "pulse", life: 1.5 });
  }

  if (weapon === "spread") {
    player.cooldown = 0.24 * rapidFactor;
    [-190, 0, 190].forEach((vx) => {
      game.playerBullets.push({ x: player.x, y: player.y - 10, vx, vy: -560, r: 3, style: "spread", life: 1.4 });
    });
  }

  if (weapon === "laser") {
    player.cooldown = 0.14 * rapidFactor;
    game.playerBullets.push({ x: player.x, y: player.y - 20, vx: 0, vy: -760, r: 2, style: "laser", life: 1.1 });
    if (player.multishot > 0) {
      game.playerBullets.push({ x: player.x - 10, y: player.y - 15, vx: -80, vy: -740, r: 2, style: "laser", life: 1.1 });
      game.playerBullets.push({ x: player.x + 10, y: player.y - 15, vx: 80, vy: -740, r: 2, style: "laser", life: 1.1 });
    }
  }

  if (weapon === "nova") {
    player.cooldown = 0.31 * rapidFactor;
    for (let i = -2; i <= 2; i++) {
      game.playerBullets.push({ x: player.x, y: player.y - 12, vx: i * 140, vy: -540, r: 4, style: "nova", life: 1.25 });
    }
  }
}

function detonateBomb() {
  const player = game.player;
  if (player.bombCount <= 0 || player.bombCooldown > 0) return;

  player.bombCount -= 1;
  player.bombCooldown = 1.2;

  game.enemyBullets = [];
  for (const e of game.enemies) {
    e.hp -= e.type === "elite" ? 2 : 1;
  }

  for (let i = 0; i < 80; i++) {
    const angle = (Math.PI * 2 * i) / 80;
    const speed = 140 + Math.random() * 240;
    game.particles.push({
      x: game.player.x,
      y: game.player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.8,
      color: i % 2 ? "#8ecae6" : "#ffe066",
    });
  }
}

function cycleWeapon(dir) {
  const player = game.player;
  const maxIndex = player.multishot > 0 ? WEAPONS.length - 1 : 2;
  player.weaponIndex = (player.weaponIndex + dir + maxIndex + 1) % (maxIndex + 1);
}

function maybeStartDiveAttack(dt) {
  game.nextAttackAt -= dt;
  if (game.nextAttackAt > 0 || game.bonusRound) return;

  const formationEnemies = game.enemies.filter((e) => e.mode === "formation");
  if (!formationEnemies.length) return;

  const attacks = Math.min(4, 1 + Math.floor(game.wave / 3));
  for (let i = 0; i < attacks; i++) {
    const enemy = formationEnemies[Math.floor(Math.random() * formationEnemies.length)];
    if (!enemy || enemy.mode !== "formation") continue;
    enemy.mode = "dive";
    enemy.diveTime = 0;
    enemy.startX = enemy.x;
    enemy.startY = enemy.y;
    enemy.divePattern = ["sine", "spiral", "arc"][Math.floor(Math.random() * 3)];
    enemy.spinSpeed += 2.4;
  }

  game.nextAttackAt = Math.max(0.45, 1.8 - game.wave * 0.08);
}

function updateParallax(dt) {
  for (const s of stars) {
    s.y += s.speed * dt;
    if (s.y > canvas.height) {
      s.y = -2;
      s.x = Math.random() * canvas.width;
    }
  }

  for (const p of planetLayer) {
    p.y += p.speed * dt;
    if (p.y - p.r > canvas.height) {
      p.y = -p.r * 2;
      p.x = Math.random() * canvas.width;
    }
  }

  for (const n of nebulaLayer) {
    n.y += n.speed * dt;
    if (n.y - n.h > canvas.height) {
      n.y = -n.h;
      n.x = Math.random() * canvas.width;
    }
  }
}

function update(dt) {
  const p = game.player;

  // Time-based counters are clamped to keep update logic stable and deterministic.
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.rapid = Math.max(0, p.rapid - dt);
  p.multishot = Math.max(0, p.multishot - dt);
  p.bombCooldown = Math.max(0, p.bombCooldown - dt);

  // Regenerative shield system keeps moment-to-moment gameplay forgiving but tactical.
  p.shieldEnergy = Math.min(100, p.shieldEnergy + p.shieldRegen * dt);

  const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  if (left) p.x -= p.speed * dt;
  if (right) p.x += p.speed * dt;
  p.x = Math.max(25, Math.min(canvas.width - 25, p.x));

  updateParallax(dt);
  maybeStartDiveAttack(dt);

  game.playerBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  });
  game.playerBullets = game.playerBullets.filter((b) => b.life > 0 && b.y > -30 && b.x > -60 && b.x < canvas.width + 60);

  for (const e of game.enemies) {
    e.t += dt;
    e.spin += e.spinSpeed * dt;

    if (e.mode === "formation") {
      e.x = e.baseX + Math.sin(game.formationPhase + e.t) * (42 + game.wave * 1.4);
      e.y = e.baseY + Math.cos(game.formationPhase * 0.7 + e.t * 0.6) * 14;
      if (Math.random() < dt * (0.09 + game.wave * 0.013)) {
        game.enemyBullets.push({ x: e.x, y: e.y, vx: 0, vy: 210 + game.wave * 14, r: 4 });
      }
    } else {
      e.diveTime += dt;
      if (e.divePattern === "sine") {
        e.y += (180 + game.wave * 12) * dt;
        e.x += Math.sin(e.diveTime * 9) * 240 * dt;
      } else if (e.divePattern === "spiral") {
        const radius = 16 + e.diveTime * 50;
        e.x += Math.cos(e.diveTime * 14) * radius * dt;
        e.y += (220 + game.wave * 14) * dt;
      } else {
        e.y += (200 + game.wave * 10) * dt;
        e.x += Math.sin(e.diveTime * 5.2) * 160 * dt + (e.startX < canvas.width / 2 ? 35 : -35) * dt;
      }

      if (Math.random() < dt * (0.18 + game.wave * 0.02)) {
        game.enemyBullets.push({ x: e.x, y: e.y, vx: Math.sin(e.diveTime * 5) * 80, vy: 250 + game.wave * 18, r: 4 });
      }

      if (e.y > canvas.height + 70) {
        e.mode = "formation";
        e.baseY = 70 + Math.random() * 160;
        e.baseX = 80 + Math.random() * (canvas.width - 160);
        e.y = e.baseY;
        e.x = e.baseX;
      }
    }
  }

  game.formationPhase += dt * (0.9 + game.wave * 0.03);

  game.enemyBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  game.enemyBullets = game.enemyBullets.filter((b) => b.y < canvas.height + 20 && b.x > -30 && b.x < canvas.width + 30);

  game.powerUps.forEach((power) => {
    power.y += power.vy * dt;
    power.t += dt;
    power.x += Math.sin(power.t * 4 + power.phase) * 22 * dt;
  });
  game.powerUps = game.powerUps.filter((power) => power.y < canvas.height + 50);

  // Projectile collision checks are strict AABB for speed and stable hit feel.
  for (const b of game.playerBullets) {
    for (const e of game.enemies) {
      if (Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
        b.life = 0;
        e.hp -= b.style === "laser" ? 1.4 : b.style === "nova" ? 0.9 : 1;
        if (e.hp <= 0) {
          const scoreGain = e.type === "elite" ? 240 : e.type === "zig" ? 120 : e.type === "bonus" ? 380 : 80;
          game.score += scoreGain;

          if (Math.random() < 0.2) {
            const options = ["shield", "rapid", "multishot", "life", "bomb", "weapon"];
            const kind = options[Math.floor(Math.random() * options.length)];
            game.powerUps.push({ x: e.x, y: e.y, vy: 96, kind, t: 0, phase: Math.random() * Math.PI * 2 });
          }

          for (let i = 0; i < 12; i++) {
            game.particles.push({
              x: e.x,
              y: e.y,
              vx: (Math.random() - 0.5) * 260,
              vy: (Math.random() - 0.5) * 260,
              life: 0.7,
              color: e.type === "elite" ? "#ff2a6d" : "#00ff99",
            });
          }
        }
      }
    }
  }

  game.enemies = game.enemies.filter((e) => e.hp > 0 && e.y < canvas.height + 100 && e.x > -120 && e.x < canvas.width + 120);

  for (const b of game.enemyBullets) {
    if (Math.abs(b.x - p.x) < p.w / 2 && Math.abs(b.y - p.y) < p.h / 2) {
      b.y = canvas.height + 999;
      p.shieldEnergy -= 35;
      if (p.shieldEnergy > 0) continue;
      game.lives -= 1;
      p.shieldEnergy = 45;
      if (game.lives <= 0) {
        endGame();
        return;
      }
    }
  }

  for (const power of game.powerUps) {
    if (Math.abs(power.x - p.x) < p.w / 2 + 14 && Math.abs(power.y - p.y) < p.h / 2 + 14) {
      power.y = canvas.height + 999;
      if (power.kind === "shield") p.shieldEnergy = Math.min(100, p.shieldEnergy + 40);
      if (power.kind === "rapid") p.rapid = 12;
      if (power.kind === "multishot") {
        p.multishot = 12;
        p.weaponIndex = Math.max(p.weaponIndex, 1);
      }
      if (power.kind === "life") game.lives += 1;
      if (power.kind === "bomb") p.bombCount += 1;
      if (power.kind === "weapon") p.weaponIndex = Math.min(WEAPONS.length - 1, p.weaponIndex + 1);
    }
  }

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

  if (!game.enemies.length) {
    game.wave += 1;
    spawnWave();
  }

  if (game.enemies.some((e) => e.y > canvas.height - 95 && e.type !== "bonus")) {
    game.lives = 0;
    endGame();
    return;
  }

  const activePower = [p.rapid > 0 ? "RAPID" : "", p.multishot > 0 ? "MULTI" : ""].filter(Boolean).join(" + ") || "NONE";
  ui.score.textContent = game.score;
  ui.wave.textContent = game.wave;
  ui.lives.textContent = game.lives;
  ui.shield.textContent = `${Math.max(0, Math.round(p.shieldEnergy))}%`;
  ui.weapon.textContent = getWeaponName();
  ui.bombs.textContent = p.bombCount;
  ui.enemiesLeft.textContent = game.enemies.length;
  ui.nextLife.textContent = Math.max(0, game.extraLifeAt - game.score);
  ui.power.textContent = activePower;

  if (game.bonusRound) {
    ui.statusTip.textContent = "Bonus raid: chain lasers or nova bursts for huge score multipliers.";
  } else if (p.bombCount > 0 && game.enemies.length > 20) {
    ui.statusTip.textContent = "Heavy wave: use EMP bomb (B) to clear bullets and damage spinning divers.";
  } else if (game.lives === 1) {
    ui.statusTip.textContent = "Critical hull! Keep moving, rebuild shield, and avoid dive lanes.";
  } else {
    ui.statusTip.textContent = "Q/E cycles weapons. Keep shield above 40% before committing to aggressive lines.";
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

function drawShip(x, y, color, rotation = 0, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(-17, 11);
  ctx.lineTo(17, 11);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(-4, -4, 8, 6);
  ctx.restore();
}

function drawParallax() {
  for (const n of nebulaLayer) {
    ctx.fillStyle = `rgba(120, 70, 190, ${n.alpha})`;
    ctx.beginPath();
    ctx.ellipse(n.x, n.y, n.w, n.h, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of planetLayer) {
    const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.2, p.x, p.y, p.r);
    g.addColorStop(0, `hsla(${p.hue}, 75%, 75%, 0.28)`);
    g.addColorStop(1, `hsla(${p.hue + 40}, 60%, 40%, 0.09)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of stars) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawParallax();

  if (!game) return;

  const shieldGlow = Math.max(0.2, game.player.shieldEnergy / 100);
  drawShip(game.player.x, game.player.y, `rgba(0,255,153,${0.5 + shieldGlow * 0.5})`, 0, 1.1);
  ctx.strokeStyle = `rgba(142,202,230,${shieldGlow * 0.55})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(game.player.x, game.player.y, 22, 0, Math.PI * 2);
  ctx.stroke();

  for (const b of game.playerBullets) {
    if (b.style === "laser") {
      ctx.fillStyle = "#8ecae6";
      ctx.fillRect(b.x - 1, b.y - 10, 2, 18);
      continue;
    }
    ctx.fillStyle = b.style === "nova" ? "#ff8fab" : b.style === "spread" ? "#ffe066" : "#9bf6ff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of game.enemyBullets) {
    ctx.fillStyle = "#ff2a6d";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of game.enemies) {
    const color = e.type === "elite" ? "#ff2a6d" : e.type === "zig" ? "#ffaa00" : e.type === "bonus" ? "#ffffff" : "#00e5ff";
    drawShip(e.x, e.y, color, e.spin, e.mode === "dive" ? 1.12 : 1);

    if (e.hp > 1) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(e.x - 12, e.y - 20, e.hp * 7, 3);
    }
  }

  for (const power of game.powerUps) {
    const colorMap = {
      shield: "#8ecae6",
      rapid: "#ffe066",
      multishot: "#ffadad",
      life: "#80ed99",
      bomb: "#f72585",
      weapon: "#c77dff",
    };

    const iconMap = {
      shield: "🛡",
      rapid: "⚡",
      multishot: "🔱",
      life: "❤",
      bomb: "💣",
      weapon: "🔫",
    };

    ctx.save();
    ctx.translate(power.x, power.y);
    ctx.rotate(power.t * 2.6);
    ctx.fillStyle = colorMap[power.kind];
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Courier New";
    ctx.fillText(iconMap[power.kind] || "?", power.x - 5, power.y + 4);
  }

  for (const px of game.particles) {
    ctx.globalAlpha = Math.max(0, px.life);
    ctx.fillStyle = px.color;
    ctx.fillRect(px.x, px.y, 2, 2);
  }
  ctx.globalAlpha = 1;

  if (game.bonusRound) {
    ctx.fillStyle = "#ffe066";
    ctx.font = "bold 24px Courier New";
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
  if (["ArrowLeft", "ArrowRight", " ", "a", "A", "d", "D", "p", "P", "b", "B", "q", "Q", "e", "E", "Enter"].includes(e.key)) {
    e.preventDefault();
  }

  if ((e.key === "p" || e.key === "P") && running) {
    paused = !paused;
    showOverlay(ui.pause, paused);
    return;
  }

  if (e.key === "Enter" && !running) {
    startGame();
  }

  if (e.key === " " && running && !paused) shoot();
  if ((e.key === "b" || e.key === "B") && running && !paused) detonateBomb();
  if ((e.key === "q" || e.key === "Q") && running && !paused) cycleWeapon(-1);
  if ((e.key === "e" || e.key === "E") && running && !paused) cycleWeapon(1);

  keys.add(e.key);
});

window.addEventListener("keyup", (e) => keys.delete(e.key));

renderScores();
showOverlay(ui.splash, true);
requestAnimationFrame(gameLoop);

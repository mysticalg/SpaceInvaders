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
  waveTime: document.getElementById("waveTime"),
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

const stars = Array.from({ length: 120 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, speed: 25 + Math.random() * 75, size: 0.8 + Math.random() * 2 }));
const planetLayer = Array.from({ length: 5 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 35 + Math.random() * 55, speed: 8 + Math.random() * 10, hue: Math.floor(180 + Math.random() * 140) }));
const nebulaLayer = Array.from({ length: 8 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, w: 140 + Math.random() * 220, h: 65 + Math.random() * 120, speed: 14 + Math.random() * 16, alpha: 0.06 + Math.random() * 0.08 }));

let game;

function initialState() {
  return {
    score: 0,
    wave: 1,
    lives: 3,
    player: { x: canvas.width / 2, y: canvas.height - 58, w: 36, h: 26, speed: 390, cooldown: 0, shieldEnergy: 100, shieldRegen: 5, weaponIndex: 0, rapid: 0, multishot: 0, bombCount: 2, bombCooldown: 0 },
    playerBullets: [], enemyBullets: [], enemies: [], particles: [], powerUps: [],
    extraLifeAt: 15000, formationPhase: 0,
    waveLength: 24, waveClock: 24, escapedThisWave: 0,
  };
}

function loadScores() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function saveScores(scores) { localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); }
function showOverlay(el, visible) { el.classList.toggle("visible", visible); }

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

function getSpawnPoint(formation, offset) {
  if (formation === "left") return { x: -70 - offset * 40, y: 60 + offset * 18 };
  if (formation === "right") return { x: canvas.width + 70 + offset * 40, y: 60 + offset * 18 };
  if (formation === "top-arc") return { x: 120 + offset * 70, y: -80 - offset * 30 };
  return { x: canvas.width / 2 + Math.sin(offset * 0.6) * 380, y: -110 - offset * 35 };
}

function spawnWave() {
  game.enemies = [];
  game.enemyBullets = [];
  game.waveLength = Math.max(15, 24 - game.wave * 0.45);
  game.waveClock = game.waveLength;
  game.escapedThisWave = 0;

  const cols = 10;
  const rows = 4;
  const spacingX = 72;
  const spacingY = 55;
  const startX = canvas.width / 2 - ((cols - 1) * spacingX) / 2;
  const startY = 90;
  const formations = ["left", "right", "top-arc", "circle-in"];

  // Enemies now enter in staged formations, run attack patterns, then leave the area.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const formation = formations[(r + c) % formations.length];
      const type = r === 0 ? "elite" : r < 2 ? "zig" : "grunt";
      const hp = type === "elite" ? 3 : type === "zig" ? 2 : 1;
      const spawn = getSpawnPoint(formation, c);
      game.enemies.push({
        x: spawn.x,
        y: spawn.y,
        spawnX: spawn.x,
        spawnY: spawn.y,
        targetX: startX + c * spacingX,
        targetY: startY + r * spacingY,
        w: 32,
        h: 24,
        hp,
        type,
        phase: "enter",
        enterProgress: 0,
        attackTimer: 2.8 + Math.random() * 2.8,
        divePattern: ["arc", "circle", "sine"][idx % 3],
        exitVX: (Math.random() - 0.5) * 210,
        exitVY: -(180 + Math.random() * 110),
        shootCooldown: 0.35 + Math.random() * 0.6,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: 2.2 + Math.random() * 2.6,
        escaped: false,
      });
    }
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

function getWeaponName() { return WEAPONS[game.player.weaponIndex].toUpperCase(); }

function shoot() {
  if (game.player.cooldown > 0) return;
  const p = game.player;
  const w = WEAPONS[p.weaponIndex];
  const rapidFactor = p.rapid > 0 ? 0.55 : 1;

  if (w === "pulse") {
    p.cooldown = 0.2 * rapidFactor;
    game.playerBullets.push({ x: p.x, y: p.y - 12, vx: 0, vy: -640, r: 3, style: "pulse", life: 1.5 });
  } else if (w === "spread") {
    p.cooldown = 0.24 * rapidFactor;
    [-190, 0, 190].forEach((vx) => game.playerBullets.push({ x: p.x, y: p.y - 10, vx, vy: -560, r: 3, style: "spread", life: 1.4 }));
  } else if (w === "laser") {
    p.cooldown = 0.14 * rapidFactor;
    game.playerBullets.push({ x: p.x, y: p.y - 20, vx: 0, vy: -760, r: 2, style: "laser", life: 1.1 });
  } else {
    p.cooldown = 0.31 * rapidFactor;
    for (let i = -2; i <= 2; i++) game.playerBullets.push({ x: p.x, y: p.y - 12, vx: i * 140, vy: -540, r: 4, style: "nova", life: 1.25 });
  }
}

function detonateBomb() {
  const p = game.player;
  if (p.bombCount <= 0 || p.bombCooldown > 0) return;
  p.bombCount -= 1;
  p.bombCooldown = 1.2;
  game.enemyBullets = [];
  game.enemies.forEach((e) => (e.hp -= e.type === "elite" ? 2 : 1));
}

function cycleWeapon(dir) {
  const p = game.player;
  const maxIndex = p.multishot > 0 ? WEAPONS.length - 1 : 2;
  p.weaponIndex = (p.weaponIndex + dir + maxIndex + 1) % (maxIndex + 1);
}

function updateParallax(dt) {
  stars.forEach((s) => { s.y += s.speed * dt; if (s.y > canvas.height) { s.y = -2; s.x = Math.random() * canvas.width; } });
  planetLayer.forEach((p) => { p.y += p.speed * dt; if (p.y - p.r > canvas.height) { p.y = -p.r * 2; p.x = Math.random() * canvas.width; } });
  nebulaLayer.forEach((n) => { n.y += n.speed * dt; if (n.y - n.h > canvas.height) { n.y = -n.h; n.x = Math.random() * canvas.width; } });
}

function updateEnemyLifecycle(e, dt) {
  e.spin += e.spinSpeed * dt;
  e.shootCooldown -= dt;

  if (e.phase === "enter") {
    e.enterProgress = Math.min(1, e.enterProgress + dt * (0.45 + game.wave * 0.03));
    const t = e.enterProgress;
    const curve = 1 - (1 - t) * (1 - t);
    e.x = e.spawnX + (e.targetX - e.spawnX) * curve;
    e.y = e.spawnY + (e.targetY - e.spawnY) * curve + Math.sin(t * Math.PI * 2) * 14;
    if (t >= 1) e.phase = "attack";
    return;
  }

  if (e.phase === "attack") {
    e.attackTimer -= dt;
    const t = e.attackTimer;
    if (e.divePattern === "arc") {
      e.x = e.targetX + Math.sin(game.formationPhase + e.spin * 0.2) * 70;
      e.y = e.targetY + Math.cos(game.formationPhase * 0.8 + e.spin * 0.15) * 30;
    } else if (e.divePattern === "circle") {
      e.x = e.targetX + Math.cos(e.spin) * 45;
      e.y = e.targetY + Math.sin(e.spin) * 45;
    } else {
      e.x = e.targetX + Math.sin(e.spin * 0.9) * 90;
      e.y = e.targetY + Math.sin(e.spin * 1.4) * 24;
    }

    if (e.shootCooldown <= 0) {
      game.enemyBullets.push({ x: e.x, y: e.y, vx: Math.sin(e.spin) * 90, vy: 220 + game.wave * 16, r: 4 });
      e.shootCooldown = Math.max(0.2, 0.9 - game.wave * 0.03) + Math.random() * 0.4;
    }

    if (t <= 0 || game.waveClock <= 0) {
      e.phase = "exit";
      e.exitVX += (e.x < canvas.width / 2 ? -80 : 80);
    }
    return;
  }

  if (e.phase === "exit") {
    e.x += e.exitVX * dt;
    e.y += e.exitVY * dt;
    if (!e.escaped && (e.y < -80 || e.x < -120 || e.x > canvas.width + 120)) {
      e.escaped = true;
      game.escapedThisWave += 1;
      e.hp = 0;
    }
  }
}

function update(dt) {
  const p = game.player;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.rapid = Math.max(0, p.rapid - dt);
  p.multishot = Math.max(0, p.multishot - dt);
  p.bombCooldown = Math.max(0, p.bombCooldown - dt);
  p.shieldEnergy = Math.min(100, p.shieldEnergy + p.shieldRegen * dt);

  const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  if (left) p.x -= p.speed * dt;
  if (right) p.x += p.speed * dt;
  p.x = Math.max(25, Math.min(canvas.width - 25, p.x));

  updateParallax(dt);
  game.waveClock = Math.max(0, game.waveClock - dt);
  game.formationPhase += dt * (0.9 + game.wave * 0.03);

  game.playerBullets.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; });
  game.playerBullets = game.playerBullets.filter((b) => b.life > 0 && b.y > -30 && b.x > -60 && b.x < canvas.width + 60);

  game.enemies.forEach((e) => updateEnemyLifecycle(e, dt));

  game.enemyBullets.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; });
  game.enemyBullets = game.enemyBullets.filter((b) => b.y < canvas.height + 20 && b.x > -30 && b.x < canvas.width + 30);

  game.powerUps.forEach((power) => { power.y += power.vy * dt; power.t += dt; power.x += Math.sin(power.t * 4 + power.phase) * 22 * dt; });
  game.powerUps = game.powerUps.filter((power) => power.y < canvas.height + 50);

  // Fast AABB checks keep combat responsive under heavy projectile counts.
  for (const b of game.playerBullets) {
    for (const e of game.enemies) {
      if (e.hp > 0 && Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
        b.life = 0;
        e.hp -= b.style === "laser" ? 1.4 : b.style === "nova" ? 0.9 : 1;
        if (e.hp <= 0) {
          game.score += e.type === "elite" ? 240 : e.type === "zig" ? 120 : 80;
          if (Math.random() < 0.2) {
            const kinds = ["shield", "rapid", "multishot", "life", "bomb", "weapon"];
            game.powerUps.push({ x: e.x, y: e.y, vy: 96, kind: kinds[Math.floor(Math.random() * kinds.length)], t: 0, phase: Math.random() * Math.PI * 2 });
          }
        }
      }
    }
  }

  for (const b of game.enemyBullets) {
    if (Math.abs(b.x - p.x) < p.w / 2 && Math.abs(b.y - p.y) < p.h / 2) {
      b.y = canvas.height + 999;
      p.shieldEnergy -= 35;
      if (p.shieldEnergy <= 0) {
        game.lives -= 1;
        p.shieldEnergy = 45;
        if (game.lives <= 0) return endGame();
      }
    }
  }

  for (const power of game.powerUps) {
    if (Math.abs(power.x - p.x) < p.w / 2 + 14 && Math.abs(power.y - p.y) < p.h / 2 + 14) {
      power.y = canvas.height + 999;
      if (power.kind === "shield") p.shieldEnergy = Math.min(100, p.shieldEnergy + 40);
      if (power.kind === "rapid") p.rapid = 12;
      if (power.kind === "multishot") { p.multishot = 12; p.weaponIndex = Math.max(p.weaponIndex, 1); }
      if (power.kind === "life") game.lives += 1;
      if (power.kind === "bomb") p.bombCount += 1;
      if (power.kind === "weapon") p.weaponIndex = Math.min(WEAPONS.length - 1, p.weaponIndex + 1);
    }
  }

  game.enemies = game.enemies.filter((e) => e.hp > 0 && e.y < canvas.height + 120 && e.x > -140 && e.x < canvas.width + 140);

  if (game.score >= game.extraLifeAt) { game.lives += 1; game.extraLifeAt += 15000; }

  // Limited clear window: if enemies survive long enough they escape and the wave advances.
  if (!game.enemies.length || game.waveClock <= 0) {
    game.wave += 1;
    spawnWave();
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
  ui.waveTime.textContent = `${Math.ceil(game.waveClock)}s`;
  ui.power.textContent = activePower;

  if (game.waveClock < 6) {
    ui.statusTip.textContent = "Final seconds! Enemies are escaping—finish them before they break away.";
  } else if (game.escapedThisWave > 6) {
    ui.statusTip.textContent = "Many invaders escaped this wave. Start firing earlier during entry formations.";
  } else {
    ui.statusTip.textContent = "Baddies enter, attack in arcs/circles, then leave—focus fire before the timer expires.";
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
  nebulaLayer.forEach((n) => { ctx.fillStyle = `rgba(120, 70, 190, ${n.alpha})`; ctx.beginPath(); ctx.ellipse(n.x, n.y, n.w, n.h, 0.4, 0, Math.PI * 2); ctx.fill(); });
  planetLayer.forEach((p) => {
    const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.2, p.x, p.y, p.r);
    g.addColorStop(0, `hsla(${p.hue}, 75%, 75%, 0.28)`);
    g.addColorStop(1, `hsla(${p.hue + 40}, 60%, 40%, 0.09)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  stars.forEach((s) => { ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.fillRect(s.x, s.y, s.size, s.size); });
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

  game.playerBullets.forEach((b) => {
    if (b.style === "laser") { ctx.fillStyle = "#8ecae6"; ctx.fillRect(b.x - 1, b.y - 10, 2, 18); }
    else { ctx.fillStyle = b.style === "nova" ? "#ff8fab" : b.style === "spread" ? "#ffe066" : "#9bf6ff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
  });

  game.enemyBullets.forEach((b) => { ctx.fillStyle = "#ff2a6d"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });

  game.enemies.forEach((e) => {
    const color = e.type === "elite" ? "#ff2a6d" : e.type === "zig" ? "#ffaa00" : "#00e5ff";
    drawShip(e.x, e.y, color, e.spin, e.phase === "attack" ? 1.1 : 1);
  });

  const colorMap = { shield: "#8ecae6", rapid: "#ffe066", multishot: "#ffadad", life: "#80ed99", bomb: "#f72585", weapon: "#c77dff" };
  const iconMap = { shield: "🛡", rapid: "⚡", multishot: "🔱", life: "❤", bomb: "💣", weapon: "🔫" };
  game.powerUps.forEach((power) => {
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
  });

  ctx.fillStyle = "rgba(255,224,102,0.9)";
  ctx.font = "bold 18px Courier New";
  ctx.fillText(`WAVE WINDOW: ${Math.ceil(game.waveClock)}s`, canvas.width - 240, 28);
}

function gameLoop(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0);
  lastTime = ts;
  if (running && !paused) update(dt);
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
  if (["ArrowLeft", "ArrowRight", " ", "a", "A", "d", "D", "p", "P", "b", "B", "q", "Q", "e", "E", "Enter"].includes(e.key)) e.preventDefault();
  if ((e.key === "p" || e.key === "P") && running) { paused = !paused; showOverlay(ui.pause, paused); return; }
  if (e.key === "Enter" && !running) startGame();
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

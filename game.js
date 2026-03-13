const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  lives: document.getElementById("lives"),
  shield: document.getElementById("shield"),
  weapon: document.getElementById("weapon"),
  bombs: document.getElementById("bombs"),
  probes: document.getElementById("probes"),
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
      probeLevel: 1,
      probes: [],
      trail: [],
    },
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    enemyRows: [],
    powerUps: [],
    extraLifeAt: 15000,
    formationPhase: 0,
    waveLength: 24,
    waveClock: 24,
    escapedThisWave: 0,
  };
}

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
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

function getWeaponName() {
  return WEAPONS[game.player.weaponIndex].toUpperCase();
}

function getSpawnPoint(formation, rowIndex) {
  if (formation === "left") return { x: -120, y: 80 + rowIndex * 82 };
  if (formation === "right") return { x: canvas.width + 120, y: 80 + rowIndex * 82 };
  if (formation === "top") return { x: 120 + rowIndex * 210, y: -90 };
  return { x: canvas.width / 2, y: -120 - rowIndex * 20 };
}

function spawnWave() {
  game.enemies = [];
  game.enemyBullets = [];
  game.enemyRows = [];
  game.waveLength = Math.max(14, 23 - game.wave * 0.45);
  game.waveClock = game.waveLength;
  game.escapedThisWave = 0;

  const rows = 4;
  const cols = 8;
  const spacingX = 48;
  const spacingY = 78;
  const startX = canvas.width / 2 - ((cols - 1) * spacingX) / 2;
  const startY = 95;
  const formations = ["left", "right", "top", "center"];
  const manoeuvres = ["arc", "circle", "wave", "loop"];

  for (let r = 0; r < rows; r++) {
    const rowId = `row-${game.wave}-${r}`;
    const spawn = getSpawnPoint(formations[r % formations.length], r);
    const rowType = r === 0 ? "elite" : r === 1 ? "zig" : "grunt";
    const rowHp = rowType === "elite" ? 3 : rowType === "zig" ? 2 : 1;

    const leader = {
      id: `${rowId}-leader`,
      rowId,
      slot: 0,
      x: spawn.x,
      y: spawn.y,
      w: 34,
      h: 24,
      hp: rowHp,
      type: rowType,
      phase: "enter",
      t: Math.random() * Math.PI * 2,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: 2 + Math.random() * 1.8,
      enterProgress: 0,
      spawnX: spawn.x,
      spawnY: spawn.y,
      anchorX: startX,
      anchorY: startY + r * spacingY,
      manoeuvre: manoeuvres[(r + game.wave) % manoeuvres.length],
      attackTimer: 4.2 + Math.random() * 2.4,
      shootCooldown: 0.35 + Math.random() * 0.4,
      exitVX: formations[r % formations.length] === "left" ? -250 : 250,
      exitVY: -(130 + Math.random() * 70),
      escaped: false,
      trail: [],
    };

    game.enemies.push(leader);

    for (let c = 1; c < cols; c++) {
      game.enemies.push({
        id: `${rowId}-follower-${c}`,
        rowId,
        leaderId: leader.id,
        slot: c,
        x: spawn.x - c * 20,
        y: spawn.y,
        w: 30,
        h: 22,
        hp: rowHp,
        type: rowType,
        phase: "enter",
        t: Math.random() * Math.PI * 2,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: 2 + Math.random() * 1.5,
        escaped: false,
      });
    }

    game.enemyRows.push({ rowId, leaderId: leader.id });
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
  const p = game.player;
  if (p.cooldown > 0) return;

  const weapon = WEAPONS[p.weaponIndex];
  const rapidFactor = p.rapid > 0 ? 0.55 : 1;

  if (weapon === "pulse") {
    p.cooldown = 0.2 * rapidFactor;
    game.playerBullets.push({ x: p.x, y: p.y - 12, vx: 0, vy: -640, r: 3, style: "pulse", life: 1.5 });
  } else if (weapon === "spread") {
    p.cooldown = 0.24 * rapidFactor;
    [-190, 0, 190].forEach((vx) => game.playerBullets.push({ x: p.x, y: p.y - 10, vx, vy: -560, r: 3, style: "spread", life: 1.4 }));
  } else if (weapon === "laser") {
    p.cooldown = 0.14 * rapidFactor;
    game.playerBullets.push({ x: p.x, y: p.y - 20, vx: 0, vy: -760, r: 2, style: "laser", life: 1.1 });
  } else {
    p.cooldown = 0.31 * rapidFactor;
    for (let i = -2; i <= 2; i++) {
      game.playerBullets.push({ x: p.x, y: p.y - 12, vx: i * 140, vy: -540, r: 4, style: "nova", life: 1.25 });
    }
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

function addOrUpgradeProbe() {
  const p = game.player;
  if (p.probes.length < 2) {
    p.probes.push({ x: p.x, y: p.y, delayFrames: p.probes.length === 0 ? 16 : 32, cooldown: 0, level: p.probeLevel });
  } else {
    p.probeLevel = Math.min(4, p.probeLevel + 1);
    p.probes.forEach((probe) => (probe.level = p.probeLevel));
  }
}

function updateParallax(dt) {
  stars.forEach((s) => {
    s.y += s.speed * dt;
    if (s.y > canvas.height) {
      s.y = -2;
      s.x = Math.random() * canvas.width;
    }
  });
  planetLayer.forEach((p) => {
    p.y += p.speed * dt;
    if (p.y - p.r > canvas.height) {
      p.y = -p.r * 2;
      p.x = Math.random() * canvas.width;
    }
  });
  nebulaLayer.forEach((n) => {
    n.y += n.speed * dt;
    if (n.y - n.h > canvas.height) {
      n.y = -n.h;
      n.x = Math.random() * canvas.width;
    }
  });
}

function updateLeader(leader, dt) {
  leader.spin += leader.spinSpeed * dt;
  leader.shootCooldown -= dt;

  if (leader.phase === "enter") {
    leader.enterProgress = Math.min(1, leader.enterProgress + dt * (0.52 + game.wave * 0.025));
    const t = leader.enterProgress;
    const ease = 1 - (1 - t) * (1 - t);
    leader.x = leader.spawnX + (leader.anchorX - leader.spawnX) * ease;
    leader.y = leader.spawnY + (leader.anchorY - leader.spawnY) * ease;
    if (leader.enterProgress >= 1) leader.phase = "attack";
  } else if (leader.phase === "attack") {
    leader.attackTimer -= dt;
    leader.t += dt;

    if (leader.manoeuvre === "arc") {
      leader.x = leader.anchorX + Math.sin(leader.t * 2.2) * 150;
      leader.y = leader.anchorY + Math.cos(leader.t * 1.4) * 45;
    } else if (leader.manoeuvre === "circle") {
      leader.x = leader.anchorX + Math.cos(leader.t * 1.8) * 95;
      leader.y = leader.anchorY + Math.sin(leader.t * 1.8) * 95;
    } else if (leader.manoeuvre === "loop") {
      leader.x = leader.anchorX + Math.sin(leader.t * 1.8) * 130;
      leader.y = leader.anchorY + Math.sin(leader.t * 3.6) * 62;
    } else {
      leader.x = leader.anchorX + Math.sin(leader.t * 2.7) * 165;
      leader.y = leader.anchorY + Math.sin(leader.t * 1.6) * 38;
    }

    if (leader.shootCooldown <= 0) {
      game.enemyBullets.push({ x: leader.x, y: leader.y, vx: Math.sin(leader.t * 2.1) * 90, vy: 215 + game.wave * 15, r: 4 });
      leader.shootCooldown = Math.max(0.22, 0.82 - game.wave * 0.03) + Math.random() * 0.34;
    }

    if (leader.attackTimer <= 0 || game.waveClock <= 0) {
      leader.phase = "exit";
      leader.exitVX += leader.x < canvas.width / 2 ? -110 : 110;
    }
  } else if (leader.phase === "exit") {
    leader.x += leader.exitVX * dt;
    leader.y += leader.exitVY * dt;
    if (!leader.escaped && (leader.y < -90 || leader.x < -160 || leader.x > canvas.width + 160)) {
      leader.escaped = true;
      leader.hp = 0;
      game.escapedThisWave += 1;
    }
  }

  // Leaders write trails. Followers consume these points to stay aligned in a clean train.
  leader.trail.unshift({ x: leader.x, y: leader.y, phase: leader.phase });
  if (leader.trail.length > 220) leader.trail.length = 220;
}

function updateFollower(follower, leader, dt) {
  follower.spin += follower.spinSpeed * dt;
  if (!leader) return;

  const delay = 8 + follower.slot * 8;
  const target = leader.trail[Math.min(delay, leader.trail.length - 1)] || { x: leader.x, y: leader.y, phase: leader.phase };
  follower.phase = target.phase;

  follower.x += (target.x - follower.x) * Math.min(1, dt * 14);
  follower.y += (target.y - follower.y) * Math.min(1, dt * 14);

  if (follower.phase === "attack" && Math.random() < dt * (0.04 + game.wave * 0.004)) {
    game.enemyBullets.push({ x: follower.x, y: follower.y, vx: Math.sin(follower.spin) * 55, vy: 180 + game.wave * 12, r: 3.5 });
  }

  if (!follower.escaped && (follower.y < -90 || follower.x < -160 || follower.x > canvas.width + 160)) {
    follower.escaped = true;
    follower.hp = 0;
    game.escapedThisWave += 1;
  }
}

function updateProbes(dt) {
  const p = game.player;
  p.trail.unshift({ x: p.x, y: p.y });
  if (p.trail.length > 90) p.trail.length = 90;

  p.probes.forEach((probe, i) => {
    const trailIndex = Math.min(p.trail.length - 1, probe.delayFrames + i * 6);
    const target = p.trail[trailIndex] || { x: p.x, y: p.y };
    probe.x += (target.x - probe.x) * Math.min(1, dt * 12);
    probe.y += (target.y - probe.y) * Math.min(1, dt * 12);

    probe.cooldown -= dt;
    if (probe.cooldown <= 0 && running && !paused) {
      const level = Math.max(probe.level, p.probeLevel);
      if (level >= 3) {
        game.playerBullets.push({ x: probe.x, y: probe.y - 8, vx: -110, vy: -560, r: 2.5, style: "probe", life: 1.3 });
        game.playerBullets.push({ x: probe.x, y: probe.y - 8, vx: 110, vy: -560, r: 2.5, style: "probe", life: 1.3 });
      }
      game.playerBullets.push({ x: probe.x, y: probe.y - 8, vx: 0, vy: -620, r: level >= 4 ? 3 : 2.5, style: "probe", life: 1.35 });
      probe.cooldown = Math.max(0.09, 0.28 - level * 0.03);
    }
  });
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
  updateProbes(dt);

  game.waveClock = Math.max(0, game.waveClock - dt);
  game.formationPhase += dt * (0.9 + game.wave * 0.03);

  game.playerBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  });
  game.playerBullets = game.playerBullets.filter((b) => b.life > 0 && b.y > -30 && b.x > -60 && b.x < canvas.width + 60);

  const enemiesById = new Map(game.enemies.map((e) => [e.id, e]));
  const leaders = game.enemies.filter((e) => !e.leaderId);
  const followers = game.enemies.filter((e) => e.leaderId);
  leaders.forEach((leader) => updateLeader(leader, dt));
  followers.forEach((follower) => updateFollower(follower, enemiesById.get(follower.leaderId), dt));

  game.enemyBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  game.enemyBullets = game.enemyBullets.filter((b) => b.y < canvas.height + 20 && b.x > -40 && b.x < canvas.width + 40);

  game.powerUps.forEach((power) => {
    power.y += power.vy * dt;
    power.t += dt;
    power.x += Math.sin(power.t * 4 + power.phase) * 22 * dt;
  });
  game.powerUps = game.powerUps.filter((power) => power.y < canvas.height + 50);

  // Fast AABB checks keep combat smooth under heavy bullet counts.
  for (const b of game.playerBullets) {
    for (const e of game.enemies) {
      if (e.hp > 0 && Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
        b.life = 0;
        const probeBonus = b.style === "probe" ? 1.1 : 1;
        e.hp -= (b.style === "laser" ? 1.4 : b.style === "nova" ? 0.9 : 1) * probeBonus;
        if (e.hp <= 0) {
          game.score += e.type === "elite" ? 240 : e.type === "zig" ? 120 : 80;
          if (Math.random() < 0.22) {
            const kinds = ["shield", "rapid", "multishot", "life", "bomb", "weapon", "probe"];
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
        if (game.lives <= 0) {
          endGame();
          return;
        }
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
      if (power.kind === "probe") addOrUpgradeProbe();
    }
  }

  game.enemies = game.enemies.filter((e) => e.hp > 0 && e.y < canvas.height + 140 && e.x > -180 && e.x < canvas.width + 180);

  if (game.score >= game.extraLifeAt) {
    game.lives += 1;
    game.extraLifeAt += 15000;
  }

  if (!game.enemies.length || game.waveClock <= 0) {
    game.wave += 1;
    spawnWave();
  }

  const activePower = [p.rapid > 0 ? "RAPID" : "", p.multishot > 0 ? "MULTI" : "", p.probes.length ? "PROBES" : ""]
    .filter(Boolean)
    .join(" + ") || "NONE";

  ui.score.textContent = game.score;
  ui.wave.textContent = game.wave;
  ui.lives.textContent = game.lives;
  ui.shield.textContent = `${Math.max(0, Math.round(p.shieldEnergy))}%`;
  ui.weapon.textContent = getWeaponName();
  ui.bombs.textContent = p.bombCount;
  ui.probes.textContent = `${p.probes.length} / L${p.probeLevel}`;
  ui.enemiesLeft.textContent = game.enemies.length;
  ui.nextLife.textContent = Math.max(0, game.extraLifeAt - game.score);
  ui.waveTime.textContent = `${Math.ceil(game.waveClock)}s`;
  ui.power.textContent = activePower;

  if (game.waveClock < 6) {
    ui.statusTip.textContent = "Final seconds! Finish the row leaders before they escort their squad out.";
  } else {
    ui.statusTip.textContent = "Rows now follow a leader: track the lead bug to predict full formation movement.";
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

function drawPlayerShip(x, y, shieldLevel) {
  ctx.save();
  ctx.translate(x, y);

  // Main hull
  ctx.fillStyle = "#9be6ff";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-12, 12);
  ctx.lineTo(-6, 8);
  ctx.lineTo(6, 8);
  ctx.lineTo(12, 12);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = "#0b1d2e";
  ctx.beginPath();
  ctx.ellipse(0, -3, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings/engines
  ctx.fillStyle = "#6cc1ff";
  ctx.fillRect(-20, 8, 8, 4);
  ctx.fillRect(12, 8, 8, 4);
  ctx.fillStyle = "#ffe066";
  ctx.fillRect(-6, 12, 4, 4);
  ctx.fillRect(2, 12, 4, 4);

  // Shield ring
  ctx.strokeStyle = `rgba(142,202,230,${Math.max(0.2, shieldLevel / 100) * 0.6})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBugAlien(x, y, type, spin = 0, scale = 1) {
  const colorMap = { elite: "#ff2a6d", zig: "#ff9f1c", grunt: "#3ddcff" };
  const body = colorMap[type] || "#3ddcff";

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(scale, scale);

  // Bug body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head and eyes
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.ellipse(0, -8, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d1d1d";
  ctx.fillRect(-3, -9, 2, 2);
  ctx.fillRect(1, -9, 2, 2);

  // Legs
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4, 2);
    ctx.lineTo(i * 8, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * 4, -1);
    ctx.lineTo(i * 8, -7);
    ctx.stroke();
  }

  // Antenna
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.lineTo(-4, -16);
  ctx.moveTo(2, -12);
  ctx.lineTo(4, -16);
  ctx.stroke();

  ctx.restore();
}

function drawParallax() {
  nebulaLayer.forEach((n) => {
    ctx.fillStyle = `rgba(120, 70, 190, ${n.alpha})`;
    ctx.beginPath();
    ctx.ellipse(n.x, n.y, n.w, n.h, 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  planetLayer.forEach((p) => {
    const gradient = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.2, p.x, p.y, p.r);
    gradient.addColorStop(0, `hsla(${p.hue}, 75%, 75%, 0.28)`);
    gradient.addColorStop(1, `hsla(${p.hue + 40}, 60%, 40%, 0.09)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  stars.forEach((s) => {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawParallax();
  if (!game) return;

  drawPlayerShip(game.player.x, game.player.y, game.player.shieldEnergy);

  game.player.probes.forEach((probe, index) => {
    const tint = index === 0 ? "#9bf6ff" : "#bdb2ff";
    ctx.save();
    ctx.translate(probe.x, probe.y);
    ctx.scale(0.7 + probe.level * 0.05, 0.7 + probe.level * 0.05);
    drawPlayerShip(0, 0, 65);
    ctx.restore();
    ctx.strokeStyle = tint;
    ctx.beginPath();
    ctx.arc(probe.x, probe.y, 12 + probe.level * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  });

  game.playerBullets.forEach((b) => {
    if (b.style === "laser") {
      ctx.fillStyle = "#8ecae6";
      ctx.fillRect(b.x - 1, b.y - 10, 2, 18);
      return;
    }
    ctx.fillStyle = b.style === "probe" ? "#f1fa8c" : b.style === "nova" ? "#ff8fab" : b.style === "spread" ? "#ffe066" : "#9bf6ff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });

  game.enemyBullets.forEach((b) => {
    ctx.fillStyle = "#ff2a6d";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });

  game.enemies.forEach((e) => drawBugAlien(e.x, e.y, e.type, e.spin, e.phase === "attack" ? 1.12 : 1));

  const colorMap = {
    shield: "#8ecae6",
    rapid: "#ffe066",
    multishot: "#ffadad",
    life: "#80ed99",
    bomb: "#f72585",
    weapon: "#c77dff",
    probe: "#9bf6ff",
  };
  const iconMap = {
    shield: "🛡",
    rapid: "⚡",
    multishot: "🔱",
    life: "❤",
    bomb: "💣",
    weapon: "🔫",
    probe: "🛰",
  };
  game.powerUps.forEach((power) => {
    ctx.save();
    ctx.translate(power.x, power.y);
    ctx.rotate(power.t * 2.6);
    ctx.fillStyle = colorMap[power.kind] || "#ffffff";
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
  if (["ArrowLeft", "ArrowRight", " ", "a", "A", "d", "D", "p", "P", "b", "B", "q", "Q", "e", "E", "Enter"].includes(e.key)) {
    e.preventDefault();
  }

  if ((e.key === "p" || e.key === "P") && running) {
    paused = !paused;
    showOverlay(ui.pause, paused);
    return;
  }

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

// Breakout Game (Vanilla JS + Canvas)
// This file implements the game loop, input, rendering, collisions,
// levels, simple audio cues, and a start/restart menu overlay.
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: true });

// ---------------- Audio (Web Audio API, no external assets) ----------------
/**
 * Minimal sound layer using Web Audio API (no external files).
 * Exposes short event-based beeps for: wall/paddle/brick hits,
 * life loss, level clear, win, and game over.
 */
const audio = (() => {
  let ac;
  function ensure() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    return ac;
  }
  function beep({ freq = 440, type = 'sine', time = 0.06, gain = 0.12 }) {
    const ctx = ensure();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + time);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + time + 0.02);
  }
  return {
    hitWall: () => beep({ freq: 560, type: 'square', time: 0.03, gain: 0.08 }),
    hitPaddle: () =>
      beep({ freq: 420, type: 'triangle', time: 0.05, gain: 0.1 }),
    hitBrick: () => beep({ freq: 720, type: 'square', time: 0.04, gain: 0.09 }),
    loseLife: () =>
      beep({ freq: 180, type: 'sawtooth', time: 0.18, gain: 0.12 }),
    nextLevel: () => {
      beep({ freq: 660, type: 'triangle', time: 0.06, gain: 0.1 });
      setTimeout(
        () => beep({ freq: 990, type: 'triangle', time: 0.08, gain: 0.1 }),
        70
      );
    },
    gameOver: () => {
      beep({ freq: 220, type: 'sawtooth', time: 0.12, gain: 0.12 });
      setTimeout(
        () => beep({ freq: 155, type: 'sawtooth', time: 0.18, gain: 0.12 }),
        90
      );
    },
    win: () => {
      [784, 988, 1175].forEach((f, i) =>
        setTimeout(
          () => beep({ freq: f, type: 'triangle', time: 0.08, gain: 0.12 }),
          i * 90
        )
      );
    },
  };
})();

// ---------------------------- Game State -----------------------------------
// Core runtime values for score/lives/flags and level index.
let score = 0;
let lives = 3;
let running = false; // ball doesn't move until click
let gameOver = false;
let youWin = false;
let animId = null;
let currentLevel = 0;

// ----------------------- Brick Break Particles ------------------------------
// Tiny particles spawned when a brick is broken.
// Purely visual; no gameplay effect.
const particles = [];
function spawnParticles(x, y, color = 'rgba(255,255,255,1)', amount = 14) {
  for (let i = 0; i < amount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 2.4;
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 22 + Math.floor(Math.random() * 18),
      color,
    });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // gravity
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / 30));
    ctx.fillStyle = p.color.replace(/\d?\.\d+\)$/, '') || 'rgba(255,255,255,';
    // fallback: compute with alpha explicitly
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

// High score (persisted across sessions)
// Uses localStorage to keep best score between sessions.
const HIGH_SCORE_KEY = 'breakout_high_score';
let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);

// ------------------------------- Paddle ------------------------------------
// Player-controlled paddle with a short-lived glow effect on contact.
const paddle = {
  width: 100,
  height: 20,
  x: (canvas.width - 100) / 2,
  y: canvas.height - 25,
  speed: 5,
  dx: 0,
  glowUntil: 0,
  /** Draw a rounded capsule-like rectangle used for the paddle shape. */
  capsuleRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
  },
  /** Render the paddle (with glow when recently hit). */
  draw() {
    const now = performance.now();
    if (now < this.glowUntil) {
      ctx.save();
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff2a5aa6';
      paddle.capsuleRect(
        ctx,
        this.x,
        this.y,
        this.width,
        this.height,
        this.height / 2
      );
      ctx.restore();
    } else {
      ctx.fillStyle = '#af003492';
      paddle.capsuleRect(
        ctx,
        this.x,
        this.y,
        this.width,
        this.height,
        this.height / 2
      );
    }
  },

  /** Update paddle position based on current horizontal velocity. */
  update() {
    this.x += this.dx;
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
  },
};

// -------------------------------- Ball -------------------------------------
// Ball physics: movement, wall/paddle interactions, bottom out (lose life).
const ball = {
  radius: 8,
  x: canvas.width / 2,
  y: 0,
  dx: 2,
  dy: -2,
  /** Render the ball. */
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffffff';
    ctx.fill();
  },
  /**
   * Integrate position and handle wall/paddle/bottom interactions.
   * - Horizontal/vertical wall bounces
   * - Paddle bounce with angle based on hit position
   * - Life loss when falling below canvas bottom
   */
  update() {
    this.x += this.dx;
    this.y += this.dy;
    if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
      this.dx *= -1;
      audio.hitWall();
    }
    if (this.y - this.radius < 0) {
      this.dy *= -1;
      audio.hitWall();
    }
    if (
      this.y + this.radius >= paddle.y &&
      this.y - this.radius <= paddle.y + paddle.height &&
      this.x >= paddle.x &&
      this.x <= paddle.x + paddle.width &&
      this.dy > 0
    ) {
      this.dy *= -1;
      const hitPos =
        (this.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
      this.dx = 4 * hitPos;
      audio.hitPaddle();
      paddle.glowUntil = performance.now() + 120; // brief glow
    }
    if (this.y - this.radius > canvas.height) {
      // Ball touched bottom: lose a life and pause until click
      lives = Math.max(0, lives - 1);
      running = false;
      resetBall();
      if (lives === 0) {
        gameOver = true;
        audio.gameOver();
        showMenu('gameover');
      }
      audio.loseLife();
    }
  },
};

ball.y = paddle.y - ball.radius - 2;

// ------------------------- Bricks/Grid Definitions -------------------------
// Brick layout sizing and placement helpers. Each brick has x/y/width/height
// and a transient `status` (1 = alive, 0 = cleared).
const brick = {
  rows: 5,
  cols: 9,
  width: 80,
  height: 40,
  padding: 10,
  offsetTop: 40,
  offsetLeft: 35,
};

/** Random Japanese character (Katakana-like set for visual flair). */
function randomJapaneseChar() {
  const chars =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワンガギグゲゴザジズゼゾダヂヅデドパピプペポバビブベボ';
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * Reverse-pyramid: centered rows, widest at the top, narrowing each row.
 * Returns a 2D array (rows -> bricks).
 */
function generateReversePyramidBricks() {
  const maxCols = brick.cols % 2 === 1 ? brick.cols : brick.cols - 1;
  const rows = Math.floor((maxCols + 1) / 2);
  return Array.from({ length: rows }, (_, row) => {
    const colsInRow = maxCols - 2 * row;
    const rowWidth = colsInRow * brick.width + (colsInRow - 1) * brick.padding;
    const startX = (canvas.width - rowWidth) / 2;
    return Array.from({ length: colsInRow }, (_, col) => ({
      x: startX + col * (brick.width + brick.padding),
      y: brick.offsetTop + row * (brick.height + brick.padding),
      width: brick.width,
      height: brick.height,
      status: 1,
      char: randomJapaneseChar(),
    }));
  });
}

// Level generators
function generateFullGrid(rows = 5, cols = 9) {
  const rowWidth = cols * brick.width + (cols - 1) * brick.padding;
  const startX = (canvas.width - rowWidth) / 2;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      x: startX + c * (brick.width + brick.padding),
      y: brick.offsetTop + r * (brick.height + brick.padding),
      width: brick.width,
      height: brick.height,
      status: 1,
      char: randomJapaneseChar(),
    }))
  );
}
function generateHollowRect(rows = 6, cols = 11) {
  const rowWidth = cols * brick.width + (cols - 1) * brick.padding;
  const startX = (canvas.width - rowWidth) / 2;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const edge = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
      return {
        x: startX + c * (brick.width + brick.padding),
        y: brick.offsetTop + r * (brick.height + brick.padding),
        width: brick.width,
        height: brick.height,
        status: edge ? 1 : 0,
        char: randomJapaneseChar(),
      };
    })
  );
}

// ------------------------------- Levels ------------------------------------
// Level generators: define brick shapes for each stage.
const levels = [
  () => generateReversePyramidBricks(),
  () => generateFullGrid(5, 9),
  () => generateHollowRect(6, 11),
];

let bricks = [];
let remainingBricks = 0;

/**
 * Set the current level: generate bricks, count remaining, and
 * apply difficulty tweaks (paddle width). Also normalize layout
 * to fit within the canvas.
 */
function setLevel(idx) {
  currentLevel = idx;
  bricks = levels[currentLevel % levels.length]();
  remainingBricks = bricks.reduce(
    (sum, row) => sum + row.filter(b => b.status).length,
    0
  );
  // difficulty tweaks
  paddle.width = Math.max(70, 100 - currentLevel * 10);
  // Fit bricks within canvas and add safe top margin
  normalizeAndFitBricks();
}

setLevel(0);

// Using blocks with random Japanese characters; no texture image.

// ----------------------------- Input Handling ------------------------------
/** Handle keydown: arrows/A-D move, Space serves if paused. */
function keyDown(e) {
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
    paddle.dx = paddle.speed;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
    paddle.dx = -paddle.speed;
  if (e.code === 'Space' || e.key === ' ') {
    // Launch ball with spacebar if paused and not ended
    if (!running && lives > 0 && !gameOver && !youWin) {
      startRound();
    }
    if (e.preventDefault) e.preventDefault();
  }
}

/** Handle keyup: stop paddle horizontal movement on key release. */
function keyUp(e) {
  if (['ArrowRight', 'ArrowLeft', 'a', 'd', 'A', 'D'].includes(e.key))
    paddle.dx = 0;
}

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

/** Mouse move: direct paddle control with canvas-relative X. */
function mouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const x = (e.clientX - rect.left) * scaleX;
  paddle.x = x - paddle.width / 2;
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.width > canvas.width)
    paddle.x = canvas.width - paddle.width;
}

canvas.addEventListener('mousemove', mouseMove);
canvas.addEventListener('click', () => {
  if (!running && lives > 0) {
    startRound();
  }
});

// -------------------------- Game Update/Draw Loop --------------------------
/** Update world: paddle, ball (when running), and particles. */
function update() {
  paddle.update();
  if (running) {
    ball.update();
    checkBrickCollisions();
    updateParticles();
  } else {
    // Keep ball stuck to paddle before start / between lives
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 2;
  }
}

/** Render frame: world, HUD, and pause overlay when applicable. */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paddle.draw();
  drawBricks();
  drawParticles();
  ball.draw();
  drawHUD();
  if (!running && !menuVisible) drawPauseOverlay();
}

/** Animation frame loop: update + draw until win/lose. */
function loop() {
  update();
  draw();
  if (gameOver || youWin) {
    animId = null;
    return;
  }
  animId = requestAnimationFrame(loop);
}

// ---- Start/Restart Menu Overlay ----
let menuVisible = true;
const menuEl = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const menuTitle = document.getElementById('menuTitle');

/** Show the menu overlay for start/win/gameover modes. */
function showMenu(mode = 'start') {
  if (menuTitle) {
    if (mode === 'gameover') menuTitle.textContent = 'Game Over';
    else if (mode === 'win') menuTitle.textContent = 'You Win';
    else menuTitle.textContent = 'Breakout';
  }
  if (startBtn)
    startBtn.textContent =
      mode === 'gameover' ? 'Restart' : mode === 'win' ? 'Play Again' : 'Start';
  if (menuEl) menuEl.classList.add('visible');
  menuVisible = true;
}
/** Hide the menu overlay. */
function hideMenu() {
  if (menuEl) menuEl.classList.remove('visible');
  menuVisible = false;
}
if (startBtn)
  startBtn.addEventListener('click', () => {
    hideMenu();
    resetGame();
  });

loop();

/** Draw all alive bricks (block + centered character). */
function drawBricks() {
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      if (!b.status) continue;
      // Draw block background
      ctx.fillStyle = 'rgba(109, 0, 24, 0.67)';
      ctx.fillRect(b.x, b.y, b.width, b.height);
      // Draw character centered on the block
      const fontSize = Math.floor(b.height * 0.65);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.char, b.x + b.width / 2, b.y + b.height / 2);
    }
  }
}

/**
 * Broad-phase AABB vs circle overlap, then infer collision side using
 * prior ball position. Updates score/high score and triggers next level
 * or win when bricks are cleared.
 */
function checkBrickCollisions() {
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      if (!b.status) continue;

      // Circle-rect overlap test (AABB vs circle approximation)
      const withinX =
        ball.x + ball.radius > b.x && ball.x - ball.radius < b.x + b.width;
      const withinY =
        ball.y + ball.radius > b.y && ball.y - ball.radius < b.y + b.height;
      if (!(withinX && withinY)) continue;

      // Determine collision side using previous position
      const prevX = ball.x - ball.dx;
      const prevY = ball.y - ball.dy;

      const fromLeft = prevX + ball.radius <= b.x;
      const fromRight = prevX - ball.radius >= b.x + b.width;
      const fromTop = prevY + ball.radius <= b.y;
      const fromBottom = prevY - ball.radius >= b.y + b.height;

      if (fromLeft) {
        ball.dx *= -1;
        ball.x = b.x - ball.radius - 0.1;
      } else if (fromRight) {
        ball.dx *= -1;
        ball.x = b.x + b.width + ball.radius + 0.1;
      }

      if (fromTop) {
        ball.dy *= -1;
        ball.y = b.y - ball.radius - 0.1;
      } else if (fromBottom) {
        ball.dy *= -1;
        ball.y = b.y + b.height + ball.radius + 0.1;
      }

      // Fallback: if none of the above sides detected, flip vertical
      if (!fromLeft && !fromRight && !fromTop && !fromBottom) {
        ball.dy *= -1;
      }

      b.status = 0;
      score += 10;
      audio.hitBrick();
      spawnParticles(
        b.x + b.width / 2,
        b.y + b.height / 2,
        'rgba(255,255,255,1)',
        18
      );
      if (score > (typeof highScore !== 'undefined' ? highScore : 0)) {
        highScore = score;
        try {
          localStorage.setItem('breakout_high_score', String(highScore));
        } catch (e) {}
      }
      remainingBricks = Math.max(0, remainingBricks - 1);
      if (remainingBricks === 0) {
        running = false;
        if (currentLevel < levels.length - 1) {
          audio.nextLevel();
          setLevel(currentLevel + 1);
          resetBall();
        } else {
          youWin = true;
          audio.win();
          showMenu('win');
        }
      }
      return; // handle one brick per frame
    }
  }
}

/** Heads-up display: score, level, top score, and lives. */
function drawHUD() {
  // Score (left)
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Score: ${score}`, 10, 8);
  // Level below score (nudged down for spacing)
  ctx.fillText(`Level: ${currentLevel + 1}`, 10, 36);
  // Top score (center)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Top Score: ${highScore}`, canvas.width / 2, 8);

  // Lives as red hearts (right)
  const heart = '❤';
  const hearts = heart.repeat(Math.max(0, lives));
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ca1815ff';
  ctx.fillText(hearts, canvas.width - 10, 8);
}

/** Translucent overlay shown when paused, win, or game over. */
function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 24px sans-serif';
  const base = gameOver ? 'Game Over' : youWin ? 'You Win' : 'Click to start';
  const msg = youWin || gameOver ? base : `${base} — Level ${currentLevel + 1}`;
  ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

/** Snap ball to paddle and clear velocity (serve-ready). */
function resetBall() {
  ball.x = paddle.x + paddle.width / 2;
  ball.y = paddle.y - ball.radius - 2;
  ball.dx = 0;
  ball.dy = 0;
}

/** Full game reset to level 1 with fresh score/lives. */
function resetGame() {
  score = 0;
  lives = 3;
  gameOver = false;
  youWin = false;
  particles.length = 0;
  setLevel(0);
  running = false;
  resetBall();
  if (!animId) loop();
}

/** Serve the ball upward with slight randomized horizontal speed. */
function startRound() {
  running = true;
  // Give the ball an initial upward velocity with slight horizontal randomness
  const speed = 2.5 + Math.min(3, currentLevel * 0.6);
  ball.dx = (Math.random() * 2 + speed) * (Math.random() > 0.5 ? 1 : -1);
  ball.dy = -Math.max(3, speed + 0.5);
}

// Fit current bricks inside canvas width and add safe top margin.
/**
 * Ensure brick rows fit in the canvas width and add safe top spacing.
 * May expand canvas width for very wide levels. Pure layout adjustment.
 */
function normalizeAndFitBricks() {
  if (!bricks || !bricks.length) return;
  const leftRightMargin = 40; // total = 20 left + 20 right
  const padX = 10;
  const padY = 10;
  const topMargin = 80; // extra room so HUD isn't crowded
  const maxCols = bricks.reduce((m, row) => Math.max(m, row.length), 0);
  const minBrickWidth = 40;

  // Compute required width; grow canvas if needed
  const requiredWidth =
    leftRightMargin +
    maxCols * minBrickWidth +
    (maxCols - 1) * padX +
    leftRightMargin;
  if (requiredWidth > canvas.width) {
    canvas.width = requiredWidth;
    // Keep paddle within bounds after resize
    paddle.x = Math.min(paddle.x, canvas.width - paddle.width);
  }

  const availableWidth = canvas.width - leftRightMargin * 2;
  const w = Math.floor((availableWidth - padX * (maxCols - 1)) / maxCols);
  const h = brick.height; // keep height consistent

  for (let r = 0; r < bricks.length; r++) {
    const cols = bricks[r].length;
    const rowWidth = cols * w + (cols - 1) * padX;
    const startX = (canvas.width - rowWidth) / 2;
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      b.x = startX + c * (w + padX);
      b.y = topMargin + r * (h + padY);
      b.width = w;
      b.height = h;
    }
  }
}

'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: true });

const paddle = {
  width: 100,
  height: 20,
  x: (canvas.width - 100) / 2,
  y: canvas.height - 25,
  speed: 5,
  dx: 0,
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
  draw() {
    ctx.fillStyle = '#af003492';
    paddle.capsuleRect(
      ctx,
      this.x,
      this.y,
      this.width,
      this.height,
      this.height / 2
    );
  },

  update() {
    this.x += this.dx;
    if (this.x < 0) this.x = 0;
    if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
  },
};

const ball = {
  radius: 8,
  x: canvas.width / 2,
  y: 0,
  dx: 2,
  dy: -2,
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffffff';
    ctx.fill();
  },
  update() {
    this.x += this.dx;
    this.y += this.dy;
    if (this.x - this.radius < 0 || this.x + this.radius > canvas.width)
      this.dx *= -1;
    if (this.y - this.radius < 0) this.dy *= -1;
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
    }
    if (this.y - this.radius > canvas.height) {
      this.x = canvas.width / 2;
      this.y = paddle.y - this.radius - 2;
      this.dx = 3 * (Math.random() > 0.5 ? 1 : -1);
      this.dy = -3;
    }
  },
};

ball.y = paddle.y - ball.radius - 2;

// Bricks grid (2D array)
const brick = {
  rows: 5,
  cols: 9,
  width: 80,
  height: 40,
  padding: 10,
  offsetTop: 40,
  offsetLeft: 35,
};

// Random Japanese character (Katakana set)
function randomJapaneseChar() {
  const chars =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワンガギグゲゴザジズゼゾダヂヅデドパピプペポバビブベボ';
  return chars[Math.floor(Math.random() * chars.length)];
}

// Reverse-pyramid bricks: top row widest, centered, narrowing each row
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

const bricks = generateReversePyramidBricks();

// Using blocks with random Japanese characters; no texture image.

function keyDown(e) {
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
    paddle.dx = paddle.speed;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
    paddle.dx = -paddle.speed;
}

function keyUp(e) {
  if (['ArrowRight', 'ArrowLeft', 'a', 'd', 'A', 'D'].includes(e.key))
    paddle.dx = 0;
}

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

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

function update() {
  paddle.update();
  ball.update();
  checkBrickCollisions();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paddle.draw();
  drawBricks();
  ball.draw();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();

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
      return; // handle one brick per frame
    }
  }
}

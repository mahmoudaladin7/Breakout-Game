'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

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
    ctx.fillStyle = '#47045cff';
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
    ctx.fillStyle = '#222';
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

function update() {
  paddle.update();
  ball.update();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paddle.draw();
  ball.draw();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();

# Breakout Game

Vanilla JavaScript + HTML5 Canvas implementation of Breakout. Control the paddle, keep the ball in play, clear all bricks, and beat your high score.

## Preview
<img width="1919" height="1079" alt="Screenshot 2025-10-13 214057" src="https://github.com/user-attachments/assets/e1d47539-2679-4c29-b8d1-36dd95917b10" />

<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/0858dfd0-4d2e-475c-bdbf-78fe67399425" />


## Features

- Keyboard or mouse paddle control
- Ball collisions with walls, paddle, and bricks
- Particle effect on brick break
- Paddle glow on paddle hits
- Web Audio sounds (no audio files required)
- Multiple levels with increasing difficulty
- 3 lives, +10 points per brick
- High score saved in `localStorage`

## How to Play

- Open `game.html` in your browser.
- Move the paddle: `←`/`→` or `A`/`D`, or use the mouse.
- Start/serve: press `Space` or click inside the canvas.
- Don’t let the ball fall below the paddle.
- Clear all bricks to advance to the next level. Clear the final level to win.

## Levels & Difficulty

- Level 1: Reverse pyramid (centered)
- Level 2: Full grid
- Level 3: Hollow rectangle

Difficulty increases each level (ball speed up, paddle slightly narrower).

## Sounds

- Synthesized with the Web Audio API — no external assets.
- Feedback for paddle hits, wall bounces, brick breaks, life loss, level clear, win/lose.

## Tech Highlights

- Canvas rendering and sprite-less effects
- RequestAnimationFrame-driven game loop
- Collision detection (AABB vs circle approximation)
- LocalStorage high-score persistence

## File Overview

- `game.html` — HTML bootstrap
- `style.css` — Basic layout and canvas styling
- `script.js` — Game logic, audio, levels, and effects


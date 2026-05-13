const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const comboEl = document.querySelector("#combo");
const speedEl = document.querySelector("#speed");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const messageEl = document.querySelector("#message");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const soundButton = document.querySelector("#soundButton");
const flash = document.querySelector("#flash");
const playArea = document.querySelector(".play-area");
const directionButtons = document.querySelectorAll("[data-dir]");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const modeButtons = document.querySelectorAll("[data-mode]");

const gridSize = 24;
const cellSize = canvas.width / gridSize;
const difficulties = {
  easy: { label: "休闲", baseDelay: 138, minDelay: 78, step: 6 },
  normal: { label: "标准", baseDelay: 118, minDelay: 62, step: 7 },
  hard: { label: "高手", baseDelay: 98, minDelay: 46, step: 8 },
};
const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const colors = {
  boardA: "#121917",
  boardB: "#17211d",
  grid: "rgba(238, 244, 233, 0.05)",
  snake: "#70d767",
  snakeDark: "#42a75b",
  head: "#d6f264",
  eye: "#162018",
  food: "#ef6249",
  bonus: "#f2c35e",
  cyan: "#64c9d8",
};

let snake;
let food;
let particles;
let floaters;
let direction;
let directionQueue;
let score;
let combo;
let best;
let foodEaten;
let running = false;
let paused = false;
let gameOver = false;
let difficulty = localStorage.getItem("snake-difficulty") || "normal";
let mode = localStorage.getItem("snake-mode") || "wall";
let soundEnabled = localStorage.getItem("snake-sound") !== "off";
let tickTimer = 0;
let lastFrameTime = 0;
let frameId = 0;
let touchStart = null;
let audioContext = null;

if (!difficulties[difficulty]) {
  difficulty = "normal";
}
if (!["wall", "wrap"].includes(mode)) {
  mode = "wall";
}

const bestKey = () => `snake-best-${difficulty}-${mode}`;

const resizeCanvas = () => {
  const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = Math.floor(720 * ratio);
  canvas.height = Math.floor(720 * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
};

const readBest = () => Number(localStorage.getItem(bestKey()) || 0);

const startState = () => {
  snake = [
    { x: 11, y: 12 },
    { x: 10, y: 12 },
    { x: 9, y: 12 },
  ];
  particles = [];
  floaters = [];
  direction = directions.right;
  directionQueue = [];
  score = 0;
  combo = 0;
  foodEaten = 0;
  best = readBest();
  paused = false;
  gameOver = false;
  tickTimer = 0;
  lastFrameTime = 0;
  food = createFood("normal");
  updateHud();
  draw();
};

const updateHud = () => {
  const level = getLevel();
  scoreEl.textContent = score;
  bestEl.textContent = best;
  comboEl.textContent = combo > 0 ? `${combo}x` : "0";
  speedEl.textContent = `${level + 1}x`;
};

const getLevel = () => Math.min(9, Math.floor(foodEaten / 4));

const getDelay = () => {
  const config = difficulties[difficulty];
  return Math.max(config.minDelay, config.baseDelay - getLevel() * config.step);
};

const createFood = (type = "normal") => {
  let spot;
  do {
    spot = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
      type,
      bornAt: performance.now(),
      ttl: type === "bonus" ? 5200 : Infinity,
    };
  } while (snake.some((segment) => segment.x === spot.x && segment.y === spot.y));
  return spot;
};

const setActiveButtons = () => {
  difficultyButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === difficulty);
  });
  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  soundButton.classList.toggle("is-muted", !soundEnabled);
};

const setDirection = (newDirection) => {
  if (!newDirection) return;
  const lastDirection = directionQueue[directionQueue.length - 1] || direction;
  const isReverse =
    newDirection.x + lastDirection.x === 0 && newDirection.y + lastDirection.y === 0;
  const isSame =
    newDirection.x === lastDirection.x && newDirection.y === lastDirection.y;

  if (!isReverse && !isSame && directionQueue.length < 3) {
    directionQueue.push(newDirection);
  }
};

const showOverlay = (title, message, buttonText) => {
  overlayTitle.textContent = title;
  messageEl.textContent = message;
  startButton.textContent = buttonText;
  overlay.classList.add("is-visible");
};

const hideOverlay = () => {
  overlay.classList.remove("is-visible");
};

const startGame = () => {
  if (gameOver || !snake) {
    startState();
  }
  if (frameId) {
    cancelAnimationFrame(frameId);
  }
  running = true;
  paused = false;
  hideOverlay();
  frameId = requestAnimationFrame(loop);
};

const togglePause = () => {
  if (!running || gameOver) return;
  paused = !paused;
  if (paused) {
    showOverlay("已暂停", "按空格或点击继续", "继续");
  } else {
    hideOverlay();
    frameId = requestAnimationFrame(loop);
  }
};

const restartGame = () => {
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  startState();
  startGame();
};

const resetToMenu = (title, message) => {
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  running = false;
  startState();
  showOverlay(title, message, "开始游戏");
};

const endGame = () => {
  running = false;
  gameOver = true;
  frameId = 0;
  best = Math.max(best, score);
  localStorage.setItem(bestKey(), String(best));
  updateHud();
  playSound(120, 0.18, "sawtooth");
  showOverlay("游戏结束", `得分 ${score}，最佳 ${best}`, "再来一局");
};

const wrap = (value) => (value + gridSize) % gridSize;

const update = (now) => {
  direction = directionQueue.shift() || direction;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  if (mode === "wrap") {
    head.x = wrap(head.x);
    head.y = wrap(head.y);
  }

  const hitWall = mode === "wall" && (head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize);
  const hitSelf = snake
    .slice(0, -1)
    .some((segment) => segment.x === head.x && segment.y === head.y);
  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    const isBonus = food.type === "bonus";
    const points = isBonus ? 5 : 1;
    score += points;
    combo = isBonus ? combo + 2 : combo + 1;
    foodEaten += 1;
    burst(food.x, food.y, isBonus ? colors.bonus : colors.food, isBonus ? 12 : 7);
    addFloater(food.x, food.y, isBonus ? "+5" : "+1", isBonus ? colors.bonus : "#f2f7ed");
    pulseBoard(isBonus);
    playSound(isBonus ? 620 : 420, 0.08, "triangle");
    food = createFood(foodEaten % 6 === 0 ? "bonus" : "normal");
    updateHud();
  } else {
    snake.pop();
  }

  if (food.type === "bonus" && now - food.bornAt > food.ttl) {
    combo = 0;
    addFloater(food.x, food.y, "MISS", colors.cyan);
    food = createFood("normal");
    updateHud();
  }
};

const burst = (x, y, color, count) => {
  const centerX = x * cellSize + cellSize / 2;
  const centerY = y * cellSize + cellSize / 2;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 100;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.34 + Math.random() * 0.18,
      maxLife: 0.52,
      color,
    });
  }
};

const addFloater = (x, y, text, color) => {
  floaters.push({
    x: x * cellSize + cellSize / 2,
    y: y * cellSize + cellSize / 2,
    text,
    color,
    life: 0.72,
    maxLife: 0.72,
  });
};

const updateParticles = (delta) => {
  particles = particles.filter((particle) => {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    return particle.life > 0;
  });
};

const updateFloaters = (delta) => {
  floaters = floaters.filter((floater) => {
    floater.life -= delta;
    floater.y -= 28 * delta;
    return floater.life > 0;
  });
};

const pulseBoard = (strong = false) => {
  flash.classList.remove("is-active");
  flash.classList.toggle("is-strong", strong);
  void flash.offsetWidth;
  flash.classList.add("is-active");
};

const drawRoundedCell = (x, y, fill, inset = 2, radius = 8) => {
  const px = x * cellSize + inset;
  const py = y * cellSize + inset;
  const size = cellSize - inset * 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(px, py, size, size, radius);
  ctx.fill();
};

const drawBoard = () => {
  ctx.fillStyle = colors.boardA;
  ctx.fillRect(0, 0, 720, 720);

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = colors.boardB;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < gridSize; i += 1) {
    const line = i * cellSize;
    ctx.beginPath();
    ctx.moveTo(line, 0);
    ctx.lineTo(line, 720);
    ctx.moveTo(0, line);
    ctx.lineTo(720, line);
    ctx.stroke();
  }
};

const drawFood = (now) => {
  const centerX = food.x * cellSize + cellSize / 2;
  const centerY = food.y * cellSize + cellSize / 2;
  const pulse = 1 + Math.sin(now / 160) * 0.08;
  const color = food.type === "bonus" ? colors.bonus : colors.food;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = food.type === "bonus" ? "rgba(242, 195, 94, 0.22)" : "rgba(239, 98, 73, 0.22)";
  ctx.beginPath();
  ctx.arc(0, 0, cellSize * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, cellSize * 0.34, 0, Math.PI * 2);
  ctx.fill();

  if (food.type === "bonus") {
    const progress = Math.max(0, 1 - (now - food.bornAt) / food.ttl);
    ctx.strokeStyle = colors.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, cellSize * 0.52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }
  ctx.restore();
};

const drawSnake = () => {
  snake.forEach((segment, index) => {
    if (index === 0) return;
    const fade = 1 - index / (snake.length + 4);
    const gradient = ctx.createLinearGradient(
      segment.x * cellSize,
      segment.y * cellSize,
      segment.x * cellSize + cellSize,
      segment.y * cellSize + cellSize,
    );
    gradient.addColorStop(0, colors.snake);
    gradient.addColorStop(1, colors.snakeDark);
    ctx.globalAlpha = 0.66 + fade * 0.34;
    drawRoundedCell(segment.x, segment.y, gradient, 2.6, 7);
  });
  ctx.globalAlpha = 1;

  const head = snake[0];
  drawRoundedCell(head.x, head.y, colors.head, 1.8, 9);

  const eyeOffsetX = direction.x * 4;
  const eyeOffsetY = direction.y * 4;
  const perpendicular = { x: -direction.y, y: direction.x };
  ctx.fillStyle = colors.eye;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(
      head.x * cellSize + cellSize / 2 + eyeOffsetX + perpendicular.x * side * 5,
      head.y * cellSize + cellSize / 2 + eyeOffsetY + perpendicular.y * side * 5,
      2.8,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
};

const drawParticles = () => {
  particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
};

const drawFloaters = () => {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 18px Inter, system-ui, sans-serif";
  floaters.forEach((floater) => {
    const progress = floater.life / floater.maxLife;
    ctx.globalAlpha = Math.max(0, progress);
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  });
  ctx.globalAlpha = 1;
};

const draw = (now = performance.now()) => {
  drawBoard();
  drawFood(now);
  drawSnake();
  drawParticles();
  drawFloaters();
};

const loop = (time) => {
  if (!running || paused) return;
  const delta = lastFrameTime ? Math.min(0.05, (time - lastFrameTime) / 1000) : 0;
  lastFrameTime = time;
  updateParticles(delta);
  updateFloaters(delta);

  if (time - tickTimer >= getDelay()) {
    update(time);
    tickTimer = time;
  }

  draw(time);

  if (running) {
    frameId = requestAnimationFrame(loop);
  } else {
    frameId = 0;
  }
};

const keyMap = {
  ArrowUp: directions.up,
  KeyW: directions.up,
  ArrowDown: directions.down,
  KeyS: directions.down,
  ArrowLeft: directions.left,
  KeyA: directions.left,
  ArrowRight: directions.right,
  KeyD: directions.right,
};

const playSound = (frequency, duration, type = "sine") => {
  if (!soundEnabled) return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  audioContext ||= new AudioEngine();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.04, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
};

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (running && !gameOver) togglePause();
    else startGame();
    return;
  }

  if (event.code === "Enter" && !running) {
    event.preventDefault();
    startGame();
    return;
  }

  const mappedDirection = keyMap[event.code];
  if (mappedDirection) {
    event.preventDefault();
    setDirection(mappedDirection);
  }
});

directionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDirection(directions[button.dataset.dir]);
    if (!running) startGame();
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    difficulty = button.dataset.difficulty;
    localStorage.setItem("snake-difficulty", difficulty);
    setActiveButtons();
    resetToMenu("贪吃蛇", `${difficulties[difficulty].label}难度`);
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    localStorage.setItem("snake-mode", mode);
    setActiveButtons();
    resetToMenu("贪吃蛇", mode === "wrap" ? "穿墙模式" : "边界模式");
  });
});

playArea.addEventListener("pointerdown", (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
});

playArea.addEventListener("pointerup", (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? directions.right : directions.left);
  } else {
    setDirection(dy > 0 ? directions.down : directions.up);
  }
  if (!running) startGame();
});

playArea.addEventListener("pointercancel", () => {
  touchStart = null;
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", restartGame);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("snake-sound", soundEnabled ? "on" : "off");
  setActiveButtons();
  playSound(360, 0.06, "triangle");
});

window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});

resizeCanvas();
setActiveButtons();
startState();

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
const variantButtons = document.querySelectorAll("[data-variant]");
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
  boardA: "#111816",
  boardB: "#18231f",
  grid: "rgba(238, 244, 233, 0.06)",
  snake: "#70d767",
  snakeDark: "#42a75b",
  head: "#d6f264",
  eye: "#162018",
  food: "#ef6249",
  bonus: "#f2c35e",
  cyan: "#64c9d8",
  obstacle: "#31423c",
  portalA: "#9f8cff",
  portalB: "#64c9d8",
  shield: "#86e7ff",
  slow: "#b89cff",
};

let snake;
let food;
let obstacles;
let portals;
let particles;
let floaters;
let direction;
let directionQueue;
let score;
let combo;
let best;
let foodEaten;
let shield;
let slowUntil;
let running = false;
let paused = false;
let gameOver = false;
let difficulty = localStorage.getItem("snake-difficulty") || "normal";
let variant = localStorage.getItem("snake-variant") || "classic";
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
if (!["classic", "maze", "portal"].includes(variant)) {
  variant = "classic";
}
if (!["wall", "wrap"].includes(mode)) {
  mode = "wall";
}

const bestKey = () => `snake-best-${difficulty}-${variant}-${mode}`;

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
  obstacles = [];
  portals = [];
  particles = [];
  floaters = [];
  direction = directions.right;
  directionQueue = [];
  score = 0;
  combo = 0;
  foodEaten = 0;
  shield = 0;
  slowUntil = 0;
  best = readBest();
  paused = false;
  gameOver = false;
  tickTimer = 0;
  lastFrameTime = 0;
  setupVariantObjects();
  food = createFood("normal");
  updateHud();
  draw();
};

const updateHud = () => {
  const level = getLevel();
  scoreEl.textContent = score;
  bestEl.textContent = best;
  comboEl.textContent = shield > 0 ? `盾${shield}` : combo > 0 ? `${combo}x` : "0";
  speedEl.textContent = `${level + 1}x`;
};

const getLevel = () => Math.min(9, Math.floor(foodEaten / 4));

const getDelay = () => {
  const config = difficulties[difficulty];
  const baseDelay = Math.max(config.minDelay, config.baseDelay - getLevel() * config.step);
  return performance.now() < slowUntil ? baseDelay + 34 : baseDelay;
};

const sameCell = (a, b) => a.x === b.x && a.y === b.y;

const isSnakeCell = (cell) => snake.some((segment) => sameCell(segment, cell));

const isObstacleCell = (cell) => obstacles.some((obstacle) => sameCell(obstacle, cell));

const isPortalCell = (cell) => portals.some((portal) => sameCell(portal, cell));

const isFoodCell = (cell) => food && sameCell(food, cell);

const isBlockedCell = (cell) =>
  isSnakeCell(cell) || isObstacleCell(cell) || isPortalCell(cell) || isFoodCell(cell);

const createFood = (type = "normal") => {
  let spot;
  do {
    spot = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
      type,
      bornAt: performance.now(),
      ttl: type === "normal" ? Infinity : 5200,
    };
  } while (isBlockedCell(spot));
  return spot;
};

const getSpecialFoodType = () => {
  if (foodEaten > 0 && foodEaten % 9 === 0) return "shield";
  if (foodEaten > 0 && foodEaten % 7 === 0) return "slow";
  if (foodEaten > 0 && foodEaten % 6 === 0) return "bonus";
  return "normal";
};

const getRandomFreeCell = (padding = 1) => {
  let cell;
  let attempts = 0;
  do {
    cell = {
      x: padding + Math.floor(Math.random() * (gridSize - padding * 2)),
      y: padding + Math.floor(Math.random() * (gridSize - padding * 2)),
    };
    attempts += 1;
  } while (isBlockedCell(cell) && attempts < 500);
  return cell;
};

const setupVariantObjects = () => {
  if (variant === "maze") {
    generateObstacles();
  }
  if (variant === "portal") {
    generatePortals();
  }
};

const generateObstacles = () => {
  obstacles = [];
  const count = 8 + Math.min(10, getLevel() * 2);
  for (let i = 0; i < count; i += 1) {
    const cell = getRandomFreeCell(2);
    if (!isBlockedCell(cell)) {
      obstacles.push(cell);
    }
  }
};

const generatePortals = () => {
  portals = [];
  const first = getRandomFreeCell(3);
  portals.push(first);
  const second = getRandomFreeCell(3);
  if (!sameCell(first, second)) {
    portals.push(second);
  }
};

const setActiveButtons = () => {
  difficultyButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === difficulty);
  });
  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  variantButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.variant === variant);
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

  if (variant === "portal" && portals.length === 2) {
    if (sameCell(head, portals[0])) {
      head.x = portals[1].x;
      head.y = portals[1].y;
      addFloater(head.x, head.y, "WARP", colors.portalA);
      playSound(740, 0.06, "sine");
    } else if (sameCell(head, portals[1])) {
      head.x = portals[0].x;
      head.y = portals[0].y;
      addFloater(head.x, head.y, "WARP", colors.portalB);
      playSound(740, 0.06, "sine");
    }
  }

  const hitWall = mode === "wall" && (head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize);
  const hitSelf = snake
    .slice(0, -1)
    .some((segment) => segment.x === head.x && segment.y === head.y);
  const hitObstacle = isObstacleCell(head);
  if ((hitSelf || hitObstacle) && shield > 0) {
    shield -= 1;
    combo = 0;
    addFloater(snake[0].x, snake[0].y, "SHIELD", colors.shield);
    burst(snake[0].x, snake[0].y, colors.shield, 10);
    playSound(300, 0.09, "triangle");
    updateHud();
    return;
  }

  if (hitWall || hitSelf || hitObstacle) {
    endGame();
    return;
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    const foodType = food.type;
    const isBonus = foodType === "bonus";
    const isShield = foodType === "shield";
    const isSlow = foodType === "slow";
    const points = isBonus ? 5 : isShield || isSlow ? 3 : 1;
    score += points;
    combo = isBonus ? combo + 2 : combo + 1;
    foodEaten += 1;

    if (isShield) {
      shield = Math.min(3, shield + 1);
      addFloater(food.x, food.y, "盾+1", colors.shield);
    } else if (isSlow) {
      slowUntil = now + 5200;
      addFloater(food.x, food.y, "SLOW", colors.slow);
    } else {
      addFloater(food.x, food.y, isBonus ? "+5" : "+1", isBonus ? colors.bonus : "#f2f7ed");
    }

    const feedbackColor = isShield ? colors.shield : isSlow ? colors.slow : isBonus ? colors.bonus : colors.food;
    burst(food.x, food.y, feedbackColor, isBonus || isShield || isSlow ? 12 : 7);
    pulseBoard(isBonus || isShield || isSlow);
    playSound(isBonus ? 620 : isShield ? 520 : isSlow ? 360 : 420, 0.08, "triangle");

    if (variant === "maze" && foodEaten > 0 && foodEaten % 5 === 0) {
      generateObstacles();
      addFloater(head.x, head.y, "SHIFT", colors.obstacle);
    }
    if (variant === "portal" && foodEaten > 0 && foodEaten % 6 === 0) {
      generatePortals();
    }

    food = createFood(getSpecialFoodType());
    updateHud();
  } else {
    snake.pop();
  }

  if (food.type !== "normal" && now - food.bornAt > food.ttl) {
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
  const boardGradient = ctx.createLinearGradient(0, 0, 720, 720);
  boardGradient.addColorStop(0, "#111816");
  boardGradient.addColorStop(0.54, "#16201d");
  boardGradient.addColorStop(1, "#101513");
  ctx.fillStyle = boardGradient;
  ctx.fillRect(0, 0, 720, 720);

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = colors.boardB;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  const glow = ctx.createRadialGradient(360, 360, 60, 360, 360, 430);
  glow.addColorStop(0, "rgba(214, 242, 100, 0.035)");
  glow.addColorStop(0.68, "rgba(100, 201, 216, 0.028)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0.18)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 720, 720);

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
  const color =
    food.type === "bonus"
      ? colors.bonus
      : food.type === "shield"
        ? colors.shield
        : food.type === "slow"
          ? colors.slow
          : colors.food;
  const glowColor =
    food.type === "bonus"
      ? "rgba(242, 195, 94, 0.22)"
      : food.type === "shield"
        ? "rgba(134, 231, 255, 0.22)"
        : food.type === "slow"
          ? "rgba(184, 156, 255, 0.22)"
          : "rgba(239, 98, 73, 0.22)";

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.arc(0, 0, cellSize * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, cellSize * 0.34, 0, Math.PI * 2);
  ctx.fill();

  if (food.type === "shield") {
    ctx.strokeStyle = "#102026";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -cellSize * 0.2);
    ctx.lineTo(cellSize * 0.18, -cellSize * 0.03);
    ctx.lineTo(0, cellSize * 0.22);
    ctx.lineTo(-cellSize * 0.18, -cellSize * 0.03);
    ctx.closePath();
    ctx.stroke();
  }

  if (food.type === "bonus" || food.type === "shield" || food.type === "slow") {
    const progress = Math.max(0, 1 - (now - food.bornAt) / food.ttl);
    ctx.strokeStyle = food.type === "slow" ? colors.slow : colors.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, cellSize * 0.52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }
  ctx.restore();
};

const drawObstacles = () => {
  obstacles.forEach((obstacle) => {
    const x = obstacle.x * cellSize;
    const y = obstacle.y * cellSize;
    const gradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
    gradient.addColorStop(0, "#42564e");
    gradient.addColorStop(1, colors.obstacle);
    drawRoundedCell(obstacle.x, obstacle.y, gradient, 3, 6);
    ctx.strokeStyle = "rgba(214, 242, 100, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, y + 5, cellSize - 10, cellSize - 10);
  });
};

const drawPortals = (now) => {
  portals.forEach((portal, index) => {
    const centerX = portal.x * cellSize + cellSize / 2;
    const centerY = portal.y * cellSize + cellSize / 2;
    const color = index === 0 ? colors.portalA : colors.portalB;
    const spin = now / 380 + index * Math.PI;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(spin);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, cellSize * 0.34, cellSize * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, 0, cellSize * 0.3, cellSize * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  });
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
  drawObstacles();
  drawPortals(now);
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

variantButtons.forEach((button) => {
  button.addEventListener("click", () => {
    variant = button.dataset.variant;
    localStorage.setItem("snake-variant", variant);
    setActiveButtons();
    const names = {
      classic: "经典玩法",
      maze: "障碍玩法",
      portal: "传送玩法",
    };
    resetToMenu("贪吃蛇", names[variant]);
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

import {
  BOARD_SIZE,
  applyGravity,
  areAdjacent,
  findMatches,
  findLongMatchTypes,
  generateBoard,
  hasPossibleMoves,
  removeMatches,
  removeTilesByTypes,
  spawnTiles,
  swapTiles,
} from "./board.js";
import {
  chargeEnergyFromTiles,
  createCharacters,
  getCharacterById,
  resetCharacterEnergy,
} from "./characters.js";
import { activateSkill, getSkillName } from "./skills.js";
import {
  createScoreState,
  getComboMultiplier,
  resetCombo,
  updateScore as applyScore,
} from "./score.js";

const ANIMATION_MS = {
  swap: 170,
  remove: 130,
  specialRemove: 170,
  fall: 230,
  skillWindup: 150,
  invalidSwap: 190,
  reshuffle: 360,
};

const TUTORIAL_STORAGE_KEY = "match3_tutorial_seen_v1";
const HIT_FX_MAX_NODES = 70;
const HIT_FX_LOAD_SOFT = 38;
const HIT_FX_LOAD_HARD = 56;
const HIT_FX_LOAD_SKIP = 84;
const SCORE_POP_MAX_NODES = 14;

const HIT_FX_PRESETS = {
  normal: {
    ringClassName: "fx-ring",
    sparkCount: 3,
    shardCount: 0,
    sparkRadius: 20,
    shardRadius: 0,
    durationMs: 380,
  },
  combo: {
    ringClassName: "fx-ring",
    sparkCount: 5,
    shardCount: 1,
    sparkRadius: 24,
    shardRadius: 26,
    durationMs: 430,
  },
  special: {
    ringClassName: "fx-ring special",
    sparkCount: 8,
    shardCount: 4,
    sparkRadius: 32,
    shardRadius: 38,
    durationMs: 540,
  },
  skill: {
    ringClassName: "fx-ring special",
    sparkCount: 10,
    shardCount: 5,
    sparkRadius: 36,
    shardRadius: 42,
    durationMs: 620,
  },
  reshuffle: {
    ringClassName: "fx-ring special",
    sparkCount: 12,
    shardCount: 6,
    sparkRadius: 48,
    shardRadius: 56,
    durationMs: 700,
  },
};

const TILE_VISUALS = {
  A: { name: "草莓" },
  B: { name: "西瓜" },
  C: { name: "葡萄" },
  D: { name: "柠檬" },
};

const TILE_SVG_MARKUP = {
  A: `
    <svg class="tile-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 23c4-7 9-10 14-10s10 3 14 10c-4-2-9-3-14-3s-10 1-14 3Z" fill="#6ca84e" />
      <path d="M32 22c10 0 17 8 17 18 0 11-8 18-17 23-9-5-17-12-17-23 0-10 7-18 17-18Z" fill="#dc5b68" />
      <path d="M24 31c2-4 5-7 9-8" stroke="#ffd7dc" stroke-width="4" stroke-linecap="round" />
    </svg>
  `,
  B: `
    <svg class="tile-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 48c6-15 15-28 24-28s18 13 24 28H8Z" fill="#2f9958" />
      <path d="M13 48c5-12 12-22 19-22s14 10 19 22H13Z" fill="#f2fff5" />
      <path d="M18 48c4-9 9-16 14-16s10 7 14 16H18Z" fill="#f36e7e" />
      <path d="M24 40c2-3 5-6 9-8" stroke="#ffd7dd" stroke-width="4" stroke-linecap="round" />
    </svg>
  `,
  C: `
    <svg class="tile-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M33 15c3-5 7-7 11-6-2 4-5 7-10 9Z" fill="#6f9e4f" />
      <rect x="31" y="14" width="3" height="10" rx="2" fill="#5f8e42" />
      <circle cx="24" cy="26" r="8" fill="#8c79d2" />
      <circle cx="40" cy="26" r="8" fill="#8570ca" />
      <circle cx="19" cy="39" r="8" fill="#8069c6" />
      <circle cx="32" cy="39" r="9" fill="#755fbe" />
      <circle cx="45" cy="39" r="8" fill="#6d59b6" />
      <path d="M24 24c1-2 3-3 5-4" stroke="#d9d0ff" stroke-width="3" stroke-linecap="round" />
    </svg>
  `,
  D: `
    <svg class="tile-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M39 17c3-5 7-7 12-6-2 4-5 7-10 9Z" fill="#7caf56" />
      <path d="M10 32c4-10 12-16 22-16s18 6 22 16c-4 10-12 16-22 16s-18-6-22-16Z" fill="#efcf59" />
      <path d="M24 24c3-3 6-5 11-5" stroke="#fff4bf" stroke-width="4" stroke-linecap="round" />
    </svg>
  `,
  DEFAULT: `
    <svg class="tile-illustration" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="18" fill="#94a3b8" />
    </svg>
  `,
};

function createSvgTemplate(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template;
}

const TILE_SVG_TEMPLATES = {
  A: createSvgTemplate(TILE_SVG_MARKUP.A),
  B: createSvgTemplate(TILE_SVG_MARKUP.B),
  C: createSvgTemplate(TILE_SVG_MARKUP.C),
  D: createSvgTemplate(TILE_SVG_MARKUP.D),
  DEFAULT: createSvgTemplate(TILE_SVG_MARKUP.DEFAULT),
};

function createTileSvgNode(type) {
  const template = TILE_SVG_TEMPLATES[type] ?? TILE_SVG_TEMPLATES.DEFAULT;
  return template.content.firstElementChild.cloneNode(true);
}

const CHARACTER_VISUALS = {
  1: { icon: "🍓", role: "十字清扫", chargeIcon: "🍓", chargeName: "草莓" },
  2: { icon: "🍉", role: "行列清扫", chargeIcon: "🍉", chargeName: "西瓜" },
  3: { icon: "🍇", role: "范围清扫", chargeIcon: "🍇", chargeName: "葡萄" },
  4: { icon: "🍋", role: "随机摘果", chargeIcon: "🍋", chargeName: "柠檬" },
};

const DIFFICULTY_CONFIGS = {
  easy: {
    key: "easy",
    label: "轻松",
    energyPerTile: 5,
    antiComboLevel: 0,
    desc: "节奏更轻松，技能更容易触发。",
  },
  normal: {
    key: "normal",
    label: "标准",
    energyPerTile: 3,
    antiComboLevel: 1,
    desc: "节奏均衡，适合稳定冲分。",
  },
  hard: {
    key: "hard",
    label: "困难",
    energyPerTile: 1,
    antiComboLevel: 2,
    desc: "更考验规划，每一步都更关键。",
  },
};

const MODE_CONFIGS = {
  endless: {
    key: "endless",
    label: "无限模式",
    status: "无限模式：放开连消，尽情冲分。",
  },
  level: {
    key: "level",
    label: "关卡模式",
    status: "关卡模式：在步数耗尽前拿下目标分。",
  },
};

const LEVEL_TARGETS = {
  easy: { targetScore: 3600, moves: 30 },
  normal: { targetScore: 5200, moves: 24 },
  hard: { targetScore: 7000, moves: 20 },
};

const LEVEL_SCALING = {
  easy: { targetStep: 900, moveDropEvery: 2, minMoves: 18 },
  normal: { targetStep: 1200, moveDropEvery: 2, minMoves: 15 },
  hard: { targetStep: 1500, moveDropEvery: 3, minMoves: 12 },
};

const THEME_SEEDS = [
  {
    key: "orchard",
    label: "晨露绿",
    accentHue: 146,
    accentSaturation: 28,
    secondaryHue: 172,
    tertiaryHue: 34,
  },
  {
    key: "petal",
    label: "果花粉",
    accentHue: 8,
    accentSaturation: 38,
    secondaryHue: 148,
    tertiaryHue: 38,
  },
  {
    key: "lagoon",
    label: "湖风蓝",
    accentHue: 196,
    accentSaturation: 36,
    secondaryHue: 160,
    tertiaryHue: 20,
  },
  {
    key: "citrus",
    label: "柑橘金",
    accentHue: 38,
    accentSaturation: 50,
    secondaryHue: 118,
    tertiaryHue: 356,
  },
];

const boardElement = document.getElementById("board");
const fxLayerElement = document.getElementById("fx-layer");
const scorePopLayerElement = document.getElementById("score-pop-layer");
const charactersElement = document.getElementById("characters");
const scoreValueElement = document.getElementById("score-value");
const comboValueElement = document.getElementById("combo-value");
const targetValueElement = document.getElementById("target-value");
const movesValueElement = document.getElementById("moves-value");
const levelValueElement = document.getElementById("level-value");
const goalProgressFillElement = document.getElementById("goal-progress-fill");
const goalProgressTextElement = document.getElementById("goal-progress-text");
const modeStatusElement = document.getElementById("mode-status");
const comboBannerElement = document.getElementById("combo-banner");
const modeSelectElement = document.getElementById("mode-select");
const difficultySelectElement = document.getElementById("difficulty-select");
const difficultyDescElement = document.getElementById("difficulty-desc");
const restartButtonElement = document.getElementById("restart-button");
const nextLevelButtonElement = document.getElementById("next-level-button");
const soundButtonElement = document.getElementById("sound-button");
const tutorialButtonElement = document.getElementById("tutorial-button");
const tutorialOverlayElement = document.getElementById("tutorial-overlay");
const tutorialCloseButtonElement = document.getElementById(
  "tutorial-close-button",
);
const tutorialHideToggleElement = document.getElementById("tutorial-hide-toggle");
const hintElement = document.querySelector(".hint");
const themeNameElement = document.getElementById("theme-name");
const heroModeLabelElement = document.getElementById("hero-mode-label");
const heroDifficultyLabelElement = document.getElementById("hero-difficulty-label");
const boardThemeBadgeElement = document.getElementById("board-theme-badge");
const themeFabElement = document.getElementById("theme-fab");
const metaThemeColorElement = document.querySelector('meta[name="theme-color"]');

const state = {
  difficulty: "normal",
  mode: "endless",
  levelIndex: 1,
  board: generateBoard(),
  characters: createCharacters(),
  score: createScoreState(),
  selectedTile: null,
  isProcessing: false,
  autoSkillRunning: false,
  previousTilePositions: new Map(),
  tileElementsByPosition: new Map(),
  boardMetrics: null,
  movesLeft: null,
  targetScore: null,
  gameOver: false,
  gameResult: null,
  audioEnabled: true,
  audioContext: null,
  tutorialOpen: false,
  comboBannerTimer: null,
  hintTimer: null,
  transientHint: "",
  firstMoveGuide: shouldAutoShowTutorial(),
  openingHintTiles: [],
  hasSwappedOnce: false,
  skillHintShown: false,
  themeSeedIndex: 0,
};

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function tileClassName(type) {
  return `tile tile-${type.toLowerCase()}`;
}

function getPositionKey(row, col) {
  return `${row},${col}`;
}

function positionEquals(first, second) {
  return first.row === second.row && first.col === second.col;
}

function getBoardGapPx() {
  const styles = window.getComputedStyle(boardElement);
  const gapText = styles.rowGap || styles.gap || "0";
  const gap = Number.parseFloat(gapText);
  return Number.isFinite(gap) ? gap : 0;
}

function computeBoardMetrics(boardWidth = boardElement.clientWidth) {
  const styles = window.getComputedStyle(boardElement);
  const gap = getBoardGapPx();
  const paddingLeft = Number.parseFloat(styles.paddingLeft || "0");
  const paddingRight = Number.parseFloat(styles.paddingRight || "0");
  const contentWidth = Math.max(0, boardWidth - paddingLeft - paddingRight);
  const tileSize = Math.max(
    0,
    (contentWidth - gap * (BOARD_SIZE - 1)) / BOARD_SIZE,
  );

  return {
    tileSize,
    step: tileSize + gap,
    boardWidth,
  };
}

function isLevelMode() {
  return state.mode === MODE_CONFIGS.level.key;
}

function getDifficultyConfig() {
  return DIFFICULTY_CONFIGS[state.difficulty] ?? DIFFICULTY_CONFIGS.normal;
}

function getModeConfig() {
  return MODE_CONFIGS[state.mode] ?? MODE_CONFIGS.endless;
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(value) {
  return ((value % 360) + 360) % 360;
}

function toHsl(hue, saturation, lightness) {
  return `hsl(${normalizeHue(hue)}, ${clampValue(saturation, 0, 100)}%, ${clampValue(lightness, 0, 100)}%)`;
}

function toHsla(hue, saturation, lightness, alpha) {
  return `hsla(${normalizeHue(hue)}, ${clampValue(saturation, 0, 100)}%, ${clampValue(lightness, 0, 100)}%, ${alpha})`;
}

function getThemeSeed() {
  return THEME_SEEDS[state.themeSeedIndex] ?? THEME_SEEDS[0];
}

function getThemePalette() {
  const seed = getThemeSeed();
  const difficultyLightnessOffset =
    {
      easy: 4,
      normal: 0,
      hard: -6,
    }[state.difficulty] ?? 0;
  const modeHueOffset = isLevelMode() ? -8 : 6;
  const primaryHue = seed.accentHue + modeHueOffset;
  const primarySaturation = seed.accentSaturation + (isLevelMode() ? 4 : 0);
  const neutralHue = seed.accentHue - 12;
  const neutralSaturation = Math.max(10, seed.accentSaturation - 18);
  const secondaryHue = seed.secondaryHue + (isLevelMode() ? -6 : 0);
  const tertiaryHue = seed.tertiaryHue + (state.difficulty === "hard" ? -6 : 0);

  const palette = {
    "--bg-start": toHsl(neutralHue, neutralSaturation, 96 + difficultyLightnessOffset),
    "--bg-mid": toHsl(neutralHue, neutralSaturation + 2, 93 + difficultyLightnessOffset),
    "--bg-end": toHsl(neutralHue, neutralSaturation + 3, 89 + difficultyLightnessOffset),
    "--bg-spot-a": toHsla(primaryHue, primarySaturation + 16, 72 + difficultyLightnessOffset, 0.18),
    "--bg-spot-b": toHsla(tertiaryHue, 62, 72 + difficultyLightnessOffset, 0.18),
    "--bg-spot-c": toHsla(secondaryHue, 34, 70 + difficultyLightnessOffset, 0.16),
    "--shell-bg": toHsla(neutralHue, neutralSaturation + 2, 95 + difficultyLightnessOffset, 0.76),
    "--panel-bg": toHsla(neutralHue, neutralSaturation + 4, 97 + difficultyLightnessOffset, 0.82),
    "--panel-elevated": toHsla(neutralHue, neutralSaturation + 5, 99 + difficultyLightnessOffset, 0.92),
    "--surface-base": toHsla(neutralHue, neutralSaturation + 4, 98 + difficultyLightnessOffset, 0.94),
    "--surface-strong": toHsl(neutralHue, neutralSaturation + 4, 100),
    "--surface-container": toHsla(neutralHue, neutralSaturation + 5, 95 + difficultyLightnessOffset, 0.9),
    "--surface-container-high": toHsla(neutralHue, neutralSaturation + 5, 97 + difficultyLightnessOffset, 0.96),
    "--surface-tint": toHsla(primaryHue, primarySaturation + 10, 46, 0.08),
    "--surface-tint-strong": toHsla(primaryHue, primarySaturation + 10, 44, 0.14),
    "--border-soft": toHsla(neutralHue, neutralSaturation + 8, 32, 0.12),
    "--border-strong": toHsla(neutralHue, neutralSaturation + 12, 26, 0.24),
    "--text-strong": toHsl(neutralHue, neutralSaturation + 12, 18),
    "--text": toHsl(neutralHue, neutralSaturation + 10, 28),
    "--text-muted": toHsl(neutralHue, neutralSaturation + 8, 41),
    "--text-soft": toHsl(neutralHue, neutralSaturation + 8, 54),
    "--accent": toHsl(primaryHue, primarySaturation + 14, 45),
    "--accent-highlight": toHsl(primaryHue + 4, primarySaturation + 18, 58),
    "--accent-strong": toHsl(primaryHue - 4, primarySaturation + 16, 34),
    "--accent-soft": toHsla(primaryHue, primarySaturation + 14, 48, 0.14),
    "--accent-border": toHsla(primaryHue, primarySaturation + 14, 42, 0.24),
    "--accent-ring": toHsla(primaryHue, primarySaturation + 14, 48, 0.18),
    "--accent-ink": toHsl(primaryHue - 2, primarySaturation + 18, 28),
    "--accent-outline": toHsla(primaryHue, primarySaturation + 18, 48, 0.26),
    "--accent-shadow": toHsla(primaryHue - 4, primarySaturation + 18, 28, 0.34),
    "--accent-shadow-strong": toHsla(primaryHue - 4, primarySaturation + 20, 26, 0.48),
    "--secondary": toHsl(secondaryHue, 24, 46),
    "--secondary-strong": toHsl(secondaryHue - 6, 24, 34),
    "--secondary-soft": toHsla(secondaryHue, 24, 48, 0.16),
    "--success": toHsl(secondaryHue, 38, 46),
    "--success-strong": toHsl(secondaryHue - 8, 38, 30),
    "--success-soft": toHsla(secondaryHue, 38, 46, 0.16),
    "--warning": toHsl(tertiaryHue, 62, 50),
    "--warning-strong": toHsl(tertiaryHue - 4, 62, 34),
    "--warning-soft": toHsla(tertiaryHue, 62, 50, 0.18),
    "--warning-ink": toHsl(tertiaryHue - 4, 58, 28),
    "--danger": toHsl(primaryHue - 54, 28, 52),
    "--danger-soft": toHsla(primaryHue - 54, 28, 52, 0.18),
    "--board-shell-start": toHsl(primaryHue + 8, primarySaturation + 8, 72),
    "--board-shell-end": toHsl(primaryHue - 6, primarySaturation + 16, 38),
    "--board-grid": toHsla(neutralHue, neutralSaturation + 16, 100, 0.14),
  };

  return { seed, palette };
}

function updateHeroUI() {
  const seed = getThemeSeed();
  const difficultyConfig = getDifficultyConfig();
  const modeConfig = getModeConfig();

  if (themeNameElement) {
    themeNameElement.textContent = seed.label;
  }
  if (heroModeLabelElement) {
    heroModeLabelElement.textContent = modeConfig.label;
  }
  if (heroDifficultyLabelElement) {
    heroDifficultyLabelElement.textContent = difficultyConfig.label;
  }
  if (boardThemeBadgeElement) {
    boardThemeBadgeElement.textContent = `${seed.label} · ${modeConfig.label}`;
  }
  if (difficultyDescElement) {
    difficultyDescElement.textContent = `${difficultyConfig.desc} 色板会随模式与难度自动微调。`;
  }
  if (themeFabElement) {
    themeFabElement.setAttribute("aria-label", `切换动态色板，当前 ${seed.label}`);
  }
}

function applyDynamicTheme() {
  const { palette } = getThemePalette();

  for (const [name, value] of Object.entries(palette)) {
    document.documentElement.style.setProperty(name, value);
  }

  if (metaThemeColorElement) {
    metaThemeColorElement.setAttribute(
      "content",
      palette["--bg-mid"] ?? "#edf3eb",
    );
  }

  updateHeroUI();
}

function updateModeBodyClass() {
  document.body.classList.toggle("mode-level", isLevelMode());
  document.body.classList.toggle("mode-endless", !isLevelMode());
}

function getDefaultHintText() {
  if (isLevelMode()) {
    return "优先做稳妥连消，别让步数先耗尽。";
  }
  return "交换相邻水果，凑出 3 连就能消除。";
}

function updateHintText() {
  if (!hintElement) {
    return;
  }

  if (state.transientHint) {
    hintElement.textContent = state.transientHint;
    return;
  }

  if (
    state.firstMoveGuide &&
    !state.hasSwappedOnce &&
    !state.tutorialOpen &&
    state.openingHintTiles.length > 0
  ) {
    hintElement.textContent = "先试试发光的两格，快速完成第一步。";
    return;
  }

  hintElement.textContent = getDefaultHintText();
}

function showTransientHint(text, durationMs = 2000) {
  state.transientHint = text;
  updateHintText();

  if (state.hintTimer) {
    window.clearTimeout(state.hintTimer);
  }

  state.hintTimer = window.setTimeout(() => {
    state.transientHint = "";
    state.hintTimer = null;
    updateHintText();
  }, durationMs);
}

function findSuggestedSwapPair() {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const tile = state.board[row][col];
      if (!tile) {
        continue;
      }

      const neighbors = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.row < 0 ||
          neighbor.row >= BOARD_SIZE ||
          neighbor.col < 0 ||
          neighbor.col >= BOARD_SIZE ||
          !state.board[neighbor.row][neighbor.col]
        ) {
          continue;
        }

        const first = { row, col };
        const second = { row: neighbor.row, col: neighbor.col };

        swapTiles(state.board, first, second);
        const canMatch = findMatches(state.board).length > 0;
        swapTiles(state.board, first, second);

        if (canMatch) {
          return [first, second];
        }
      }
    }
  }

  return [];
}

function getLevelTarget() {
  const base = LEVEL_TARGETS[state.difficulty] ?? LEVEL_TARGETS.normal;
  const scaling = LEVEL_SCALING[state.difficulty] ?? LEVEL_SCALING.normal;
  const levelOffset = Math.max(0, state.levelIndex - 1);

  const targetScore = base.targetScore + levelOffset * scaling.targetStep;
  const movesDrop = Math.floor(levelOffset / scaling.moveDropEvery);
  const moves = Math.max(scaling.minMoves, base.moves - movesDrop);

  return {
    targetScore,
    moves,
  };
}

function shouldAutoShowTutorial() {
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

function setTutorialSeen() {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
  } catch {
    // Ignore storage failures in private mode.
  }
}

function getAudioContext() {
  if (!state.audioEnabled) {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
  }

  return state.audioContext;
}

async function unlockAudio() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function playTone({
  frequency = 440,
  duration = 0.08,
  type = "sine",
  gainValue = 0.03,
  slideTo = null,
  delay = 0,
} = {}) {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  const start = audioContext.currentTime + delay;
  const end = start + duration;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), end);
  }

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function playNoise({ duration = 0.05, gainValue = 0.015 } = {}) {
  const audioContext = getAudioContext();
  if (!audioContext) {
    return;
  }

  const sampleRate = audioContext.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channelData[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gainNode = audioContext.createGain();

  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = 900;

  const now = audioContext.currentTime;
  gainNode.gain.setValueAtTime(gainValue, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start(now);
}

function playSwapSfx(isValidSwap) {
  if (isValidSwap) {
    playTone({ frequency: 540, slideTo: 640, duration: 0.06, gainValue: 0.02 });
  } else {
    playTone({ frequency: 220, slideTo: 170, duration: 0.08, gainValue: 0.03, type: "sawtooth" });
    playNoise({ duration: 0.05, gainValue: 0.008 });
  }
}

function playHitSfx(removedCount, comboLevel, { special = false } = {}) {
  if (removedCount <= 0) {
    return;
  }

  const base = 360 + Math.min(removedCount, 12) * 18;
  const comboBoost = comboLevel >= 2 ? comboLevel * 28 : 0;
  const frequency = base + comboBoost;

  playTone({ frequency, slideTo: frequency + 80, duration: 0.08, gainValue: 0.03 });
  playTone({ frequency: frequency * 1.5, duration: 0.06, gainValue: 0.012, delay: 0.015 });

  if (comboLevel >= 2) {
    playTone({
      frequency: frequency + 160,
      slideTo: frequency + 260,
      duration: 0.07,
      gainValue: 0.012,
      delay: 0.04,
      type: "triangle",
    });
  }

  if (special) {
    playTone({
      frequency: 720,
      slideTo: 1150,
      duration: 0.18,
      gainValue: 0.02,
      type: "triangle",
    });
    playNoise({ duration: 0.08, gainValue: 0.012 });
  }
}

function playSkillSfx(characterId) {
  const tones = {
    1: [420, 650],
    2: [380, 560],
    3: [470, 710],
    4: [350, 520],
  };
  const [first, second] = tones[characterId] ?? [400, 600];

  playTone({ frequency: first, slideTo: second, duration: 0.14, gainValue: 0.02 });
  playTone({ frequency: second * 1.2, duration: 0.1, gainValue: 0.012, delay: 0.03 });
}

function playReshuffleSfx() {
  playNoise({ duration: 0.12, gainValue: 0.012 });
  playTone({ frequency: 320, slideTo: 740, duration: 0.2, gainValue: 0.018, type: "triangle" });
}

function playModeResultSfx(isWin) {
  if (isWin) {
    playTone({ frequency: 520, duration: 0.09, gainValue: 0.02 });
    playTone({ frequency: 660, duration: 0.09, gainValue: 0.02, delay: 0.08 });
    playTone({ frequency: 820, duration: 0.12, gainValue: 0.02, delay: 0.16 });
  } else {
    playTone({ frequency: 280, slideTo: 200, duration: 0.18, gainValue: 0.03, type: "sawtooth" });
  }
}

function updateSoundButton() {
  if (!soundButtonElement) {
    return;
  }

  soundButtonElement.textContent = `音效：${state.audioEnabled ? "开" : "关"}`;
}

function getBoardMetrics() {
  const boardWidth = boardElement.clientWidth;
  if (state.boardMetrics && state.boardMetrics.boardWidth === boardWidth) {
    return state.boardMetrics;
  }

  const metrics = computeBoardMetrics(boardWidth);
  state.boardMetrics = metrics;
  return metrics;
}

function getCenterPixelFromTiles(tiles) {
  if (tiles.length === 0) {
    return { x: 0, y: 0 };
  }

  const center = tiles.reduce(
    (sum, tile) => ({
      row: sum.row + tile.row,
      col: sum.col + tile.col,
    }),
    { row: 0, col: 0 },
  );

  const centerRow = center.row / tiles.length;
  const centerCol = center.col / tiles.length;
  const { tileSize, step } = getBoardMetrics();

  return {
    x: centerCol * step + tileSize / 2,
    y: centerRow * step + tileSize / 2,
  };
}

function clearScorePopups() {
  if (scorePopLayerElement) {
    scorePopLayerElement.innerHTML = "";
  }
}

function clearHitFx() {
  if (fxLayerElement) {
    fxLayerElement.innerHTML = "";
  }
}

function hideComboBanner() {
  if (!comboBannerElement) {
    return;
  }

  if (state.comboBannerTimer) {
    window.clearTimeout(state.comboBannerTimer);
    state.comboBannerTimer = null;
  }

  comboBannerElement.classList.remove("show");
  comboBannerElement.setAttribute("aria-hidden", "true");
}

function trimFxNodesIfNeeded(limit = HIT_FX_MAX_NODES) {
  if (!fxLayerElement) {
    return;
  }

  while (fxLayerElement.childElementCount > limit) {
    fxLayerElement.firstElementChild?.remove();
  }
}

function showHitEffect(tiles, { tier = "normal" } = {}) {
  if (!fxLayerElement || tiles.length === 0) {
    return;
  }

  const preset = HIT_FX_PRESETS[tier] ?? HIT_FX_PRESETS.normal;
  const { x, y } = getCenterPixelFromTiles(tiles);
  const tileCount = tiles.length;
  let intensity = 1;
  if (tileCount >= 16) {
    intensity = 1.35;
  } else if (tileCount >= 10) {
    intensity = 1.15;
  } else if (tileCount <= 3) {
    intensity = 0.95;
  }

  const activeFxLoad = fxLayerElement.childElementCount;
  const isPriorityTier = tier === "skill" || tier === "reshuffle";
  if (activeFxLoad >= HIT_FX_LOAD_SKIP && !isPriorityTier && tileCount <= 4) {
    return;
  }

  if (activeFxLoad > HIT_FX_LOAD_SOFT && !isPriorityTier) {
    intensity *= 0.72;
  }
  if (activeFxLoad > HIT_FX_LOAD_HARD && !isPriorityTier) {
    intensity *= 0.58;
  }

  const ring = document.createElement("div");
  ring.className = preset.ringClassName;
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  const fragment = document.createDocumentFragment();
  const createdNodes = [ring];
  fragment.append(ring);

  const sparkClass = tier === "normal" || tier === "combo" ? "fx-spark" : "fx-spark special";
  const sparkCount = Math.max(1, Math.round(preset.sparkCount * intensity));
  for (let index = 0; index < sparkCount; index += 1) {
    const angle = (Math.PI * 2 * index) / sparkCount;
    const radius = preset.sparkRadius + Math.random() * (tier === "normal" ? 8 : 14);

    const spark = document.createElement("div");
    spark.className = sparkClass;
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.setProperty("--dx", `${Math.cos(angle) * radius}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * radius}px`);
    fragment.append(spark);
    createdNodes.push(spark);
  }

  const shardClass = tier === "normal" || tier === "combo" ? "fx-shard" : "fx-shard special";
  const shardCount = Math.max(0, Math.round(preset.shardCount * intensity));
  for (let index = 0; index < shardCount; index += 1) {
    const angle = (Math.PI * 2 * index) / shardCount;
    const radius = preset.shardRadius + Math.random() * 12;
    const shard = document.createElement("div");
    shard.className = shardClass;
    shard.style.left = `${x}px`;
    shard.style.top = `${y}px`;
    shard.style.setProperty("--dx", `${Math.cos(angle) * radius}px`);
    shard.style.setProperty("--dy", `${Math.sin(angle) * radius}px`);
    shard.style.setProperty("--rot", `${Math.round(angle * (180 / Math.PI))}deg`);
    fragment.append(shard);
    createdNodes.push(shard);
  }

  fxLayerElement.append(fragment);
  const cleanupDelay = preset.durationMs + (shardCount > 0 ? 140 : 24);
  window.setTimeout(() => {
    for (const node of createdNodes) {
      node.remove();
    }
  }, cleanupDelay);
  trimFxNodesIfNeeded();
}

function setModeStatus(text, statusClass = "info") {
  if (!modeStatusElement) {
    return;
  }

  modeStatusElement.textContent = text;
  modeStatusElement.classList.remove("info", "success", "fail");
  modeStatusElement.classList.add(statusClass);
}

function updateDifficultyUI() {
  const config = getDifficultyConfig();

  if (difficultySelectElement) {
    difficultySelectElement.value = config.key;
  }
}

function updateModeUI() {
  if (modeSelectElement) {
    modeSelectElement.value = state.mode;
  }

  updateModeBodyClass();
  updateHintText();
  updateNextLevelButton();
}

function updateObjectiveDisplay() {
  if (!targetValueElement || !movesValueElement || !levelValueElement) {
    return;
  }

  if (isLevelMode()) {
    targetValueElement.textContent = String(state.targetScore);
    movesValueElement.textContent = String(state.movesLeft);
    levelValueElement.textContent = String(state.levelIndex);
  } else {
    targetValueElement.textContent = "∞";
    movesValueElement.textContent = "∞";
    levelValueElement.textContent = "-";
  }

  updateGoalProgressDisplay();
}

function updateGoalProgressDisplay() {
  if (!goalProgressFillElement || !goalProgressTextElement) {
    return;
  }

  if (!isLevelMode()) {
    goalProgressFillElement.style.width = "100%";
    goalProgressTextElement.textContent = "无限冲分";
    return;
  }

  const ratio =
    state.targetScore > 0 ? Math.min(1, state.score.score / state.targetScore) : 0;
  const percent = Math.round(ratio * 100);

  goalProgressFillElement.style.width = `${percent}%`;
  goalProgressTextElement.textContent = `进度 ${state.score.score} / ${state.targetScore}（${percent}%）`;
}

function updateModeStatus() {
  if (state.gameOver && isLevelMode()) {
    if (state.gameResult === "win") {
      setModeStatus(
        `第 ${state.levelIndex} 关通关！准备进入下一关。`,
        "success",
      );
      return;
    }

    setModeStatus(
      `第 ${state.levelIndex} 关未达成，得分 ${state.score.score} / ${state.targetScore}。`,
      "fail",
    );
    return;
  }

  if (isLevelMode()) {
    const scoreGap = Math.max(0, state.targetScore - state.score.score);
    setModeStatus(
      `第 ${state.levelIndex} 关：还差 ${scoreGap} 分，剩余 ${state.movesLeft} 步。`,
      "info",
    );
    return;
  }

  setModeStatus(getModeConfig().status, "info");
}

function updateNextLevelButton() {
  if (!nextLevelButtonElement) {
    return;
  }

  const visible = isLevelMode();
  nextLevelButtonElement.hidden = !visible;

  if (!visible) {
    return;
  }

  const canAdvance = state.gameOver && state.gameResult === "win";
  nextLevelButtonElement.disabled = !canAdvance;
  nextLevelButtonElement.classList.toggle("ready-next", canAdvance);
  nextLevelButtonElement.textContent = canAdvance
    ? `下一关（第 ${state.levelIndex + 1} 关）`
    : "下一关";
}

function openTutorial() {
  if (!tutorialOverlayElement) {
    return;
  }

  if (tutorialHideToggleElement) {
    tutorialHideToggleElement.checked = false;
  }

  state.tutorialOpen = true;
  tutorialOverlayElement.classList.remove("hidden");
  tutorialOverlayElement.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  updateEnergyBars();
  updateHintText();
}

function closeTutorial() {
  if (!tutorialOverlayElement) {
    return;
  }

  if (tutorialHideToggleElement?.checked) {
    setTutorialSeen();
    state.firstMoveGuide = false;
    state.openingHintTiles = [];
    renderBoard();
  }

  state.tutorialOpen = false;
  tutorialOverlayElement.classList.add("hidden");
  tutorialOverlayElement.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  updateEnergyBars();
  updateHintText();
}

function setCharacterCasting(characterId, isCasting) {
  const card = charactersElement.querySelector(
    `[data-character-id="${characterId}"]`,
  );
  if (!card) {
    return;
  }

  card.classList.toggle("casting", isCasting);
}

function setSelectedTile(tilePosition) {
  state.selectedTile = tilePosition;
  renderBoard();
}

function clearSelection() {
  state.selectedTile = null;
  renderBoard();
}

function isOpeningHintTile(row, col) {
  return state.openingHintTiles.some(
    (position) => position.row === row && position.col === col,
  );
}

function createPositionList(entries) {
  const unique = new Map();

  for (const entry of entries) {
    unique.set(getPositionKey(entry.row, entry.col), {
      row: entry.row,
      col: entry.col,
    });
  }

  return Array.from(unique.values());
}

function getTileElementAt(row, col) {
  const key = getPositionKey(row, col);
  return (
    state.tileElementsByPosition.get(key) ??
    boardElement.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`)
  );
}

function addRemovalClass(positions, className, { duration }) {
  const isMassRemoval = positions.length >= 10;
  const skipStagger = positions.length >= 24;
  const center = positions.reduce(
    (sum, position) => ({
      row: sum.row + position.row,
      col: sum.col + position.col,
    }),
    { row: 0, col: 0 },
  );
  const centerRow = center.row / positions.length;
  const centerCol = center.col / positions.length;
  let maxDelay = 0;

  for (const { row, col } of positions) {
    const tileElement = getTileElementAt(row, col);
    if (tileElement) {
      let delayMs = 0;
      if (isMassRemoval && !skipStagger) {
        const distance = Math.hypot(row - centerRow, col - centerCol);
        delayMs = Math.min(55, Math.round(distance * 12));
        tileElement.classList.add("mass-removing");
      } else if (isMassRemoval) {
        tileElement.classList.add("mass-removing");
      }
      tileElement.style.setProperty("--remove-delay", `${delayMs}ms`);
      tileElement.style.setProperty("--remove-duration", `${duration}ms`);
      tileElement.classList.add(className);
      maxDelay = Math.max(maxDelay, delayMs);
    }
  }

  return maxDelay;
}

async function animateRemoval(
  entries,
  { className = "removing", duration = ANIMATION_MS.remove } = {},
) {
  const positions = createPositionList(entries);
  if (positions.length === 0) {
    return;
  }

  const tunedDuration =
    positions.length >= 16
      ? Math.max(96, Math.round(duration * 0.78))
      : positions.length >= 10
        ? Math.max(104, Math.round(duration * 0.88))
        : duration;

  const maxDelay = addRemovalClass(positions, className, { duration: tunedDuration });
  await wait(tunedDuration + maxDelay);
}

function collectTilesByTypes(types) {
  const foundTiles = [];

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const tile = state.board[row][col];
      if (!tile || !types.has(tile.type)) {
        continue;
      }

      foundTiles.push(tile);
    }
  }

  return foundTiles;
}

async function animateTypeClear(entries) {
  if (entries.length === 0) {
    return;
  }

  boardElement.classList.add("super-clear");
  await animateRemoval(entries, {
    className: "special-removing",
    duration: ANIMATION_MS.specialRemove,
  });
  boardElement.classList.remove("super-clear");
}

async function animateInvalidSwap(first, second) {
  const firstTile = getTileElementAt(first.row, first.col);
  const secondTile = getTileElementAt(second.row, second.col);

  const targets = [firstTile, secondTile].filter(Boolean);
  if (targets.length === 0) {
    return;
  }

  for (const tile of targets) {
    tile.classList.add("invalid-swap");
  }

  await wait(ANIMATION_MS.invalidSwap);

  for (const tile of targets) {
    tile.classList.remove("invalid-swap");
  }
}

function ensureBoardNoInstantMatches() {
  while (findMatches(state.board).length > 0) {
    const matches = findMatches(state.board);
    removeMatches(state.board, matches);
    applyGravity(state.board);
    spawnTiles(state.board, {
      antiComboLevel: getDifficultyConfig().antiComboLevel,
    });
  }
}

function rebuildPlayableBoard() {
  let attempts = 0;

  do {
    state.board = generateBoard();
    ensureBoardNoInstantMatches();
    attempts += 1;
  } while (!hasPossibleMoves(state.board) && attempts < 120);
}

async function collapseAndRender() {
  applyGravity(state.board);
  spawnTiles(state.board, {
    antiComboLevel: getDifficultyConfig().antiComboLevel,
  });
  renderBoard({ animateMovement: true, motion: "fall" });
  await wait(ANIMATION_MS.fall);
}

async function reshuffleBoard() {
  if (state.gameOver) {
    return;
  }

  setModeStatus("没有可走步，果盘重排中...", "info");
  playReshuffleSfx();
  boardElement.classList.add("reshuffling");
  await wait(ANIMATION_MS.reshuffle);
  boardElement.classList.remove("reshuffling");

  rebuildPlayableBoard();
  state.previousTilePositions = new Map();
  clearScorePopups();
  clearHitFx();
  hideComboBanner();
  renderBoard({ animateMovement: true, motion: "fall" });

  const allTiles = state.board.flat().filter(Boolean);
  showHitEffect(allTiles, { tier: "reshuffle" });
  await wait(ANIMATION_MS.fall);
  if (!state.hasSwappedOnce && state.firstMoveGuide) {
    state.openingHintTiles = findSuggestedSwapPair();
    renderBoard();
  }
  showTransientHint("棋盘已重排，继续连消吧。", 1800);
  updateModeStatus();
}

async function resolveDeadlockIfNeeded() {
  if (state.gameOver) {
    return;
  }

  if (hasPossibleMoves(state.board)) {
    return;
  }

  await reshuffleBoard();
}

function findFirstReadyCharacter() {
  return state.characters.find((character) => character.skillReady);
}

function initializeModeState() {
  if (isLevelMode()) {
    const target = getLevelTarget();
    state.movesLeft = target.moves;
    state.targetScore = target.targetScore;
  } else {
    state.movesLeft = null;
    state.targetScore = null;
  }

  state.gameOver = false;
  state.gameResult = null;
}

function evaluateLevelProgress() {
  if (!isLevelMode()) {
    state.gameOver = false;
    state.gameResult = null;
    updateObjectiveDisplay();
    updateModeStatus();
    updateNextLevelButton();
    return;
  }

  const previousResult = state.gameResult;

  if (state.score.score >= state.targetScore) {
    state.gameOver = true;
    state.gameResult = "win";
  } else if (state.movesLeft <= 0) {
    state.gameOver = true;
    state.gameResult = "lose";
  } else {
    state.gameOver = false;
    state.gameResult = null;
  }

  if (state.gameResult && previousResult !== state.gameResult) {
    playModeResultSfx(state.gameResult === "win");
  }

  updateObjectiveDisplay();
  updateModeStatus();
  updateNextLevelButton();
}

function consumeMoveIfNeeded() {
  if (!isLevelMode() || state.gameOver) {
    return;
  }

  state.movesLeft = Math.max(0, state.movesLeft - 1);
  updateObjectiveDisplay();
}

export function renderBoard({ animateMovement = false, motion = "fall" } = {}) {
  boardElement.innerHTML = "";

  const currentPositions = new Map();
  const tileElementsByPosition = new Map();
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const tile = state.board[row][col];
      if (!tile) {
        continue;
      }

      const button = document.createElement("button");
      const tileVisual = TILE_VISUALS[tile.type] ?? { name: tile.type };
      const isSelected =
        state.selectedTile &&
        positionEquals(state.selectedTile, { row: tile.row, col: tile.col });

      button.type = "button";
      button.className = tileClassName(tile.type);
      const tileFace = document.createElement("span");
      tileFace.className = "tile-face";
      tileFace.setAttribute("aria-hidden", "true");
      tileFace.append(createTileSvgNode(tile.type));
      button.append(tileFace);
      button.dataset.row = String(tile.row);
      button.dataset.col = String(tile.col);
      button.dataset.tileId = String(tile.id);
      button.dataset.type = tile.type;
      button.ariaLabel = `${tileVisual.name}水果，第 ${tile.row + 1} 行，第 ${tile.col + 1} 列`;

      if (isSelected) {
        button.classList.add("selected");
      }
      if (
        state.firstMoveGuide &&
        !state.hasSwappedOnce &&
        !state.tutorialOpen &&
        isOpeningHintTile(tile.row, tile.col)
      ) {
        button.classList.add("tutorial-suggested");
      }

      fragment.append(button);
      currentPositions.set(tile.id, { row: tile.row, col: tile.col });
      tileElementsByPosition.set(getPositionKey(tile.row, tile.col), button);
    }
  }

  boardElement.append(fragment);
  state.tileElementsByPosition = tileElementsByPosition;

  const boardWidth = boardElement.clientWidth;
  if (boardWidth > 0) {
    if (!state.boardMetrics || state.boardMetrics.boardWidth !== boardWidth) {
      state.boardMetrics = computeBoardMetrics(boardWidth);
    }
  } else {
    state.boardMetrics = null;
  }

  if (animateMovement) {
    const { step } = getBoardMetrics();
    const isSwapMotion = motion === "swap";
    const duration = isSwapMotion ? ANIMATION_MS.swap : ANIMATION_MS.fall;
    const easing = "cubic-bezier(0.2, 0.8, 0.2, 1)";

    for (const button of tileElementsByPosition.values()) {
      const tileId = Number(button.dataset.tileId);
      const newRow = Number(button.dataset.row);
      const newCol = Number(button.dataset.col);
      const previousPosition = state.previousTilePositions.get(tileId);

      if (!previousPosition) {
        button.classList.add("spawning");
        continue;
      }

      const deltaX = (previousPosition.col - newCol) * step;
      const deltaY = (previousPosition.row - newRow) * step;

      if (deltaX === 0 && deltaY === 0) {
        continue;
      }

      const keyframes = [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: "translate(0, 0)" },
      ];

      button.animate(
        keyframes,
        {
          duration,
          easing,
        },
      );
    }
  }

  state.previousTilePositions = currentPositions;
}

export function renderCharacters() {
  charactersElement.innerHTML = "";

  for (const character of state.characters) {
    const characterVisual = CHARACTER_VISUALS[character.id] ?? {
      icon: String(character.id),
      role: "技能施放者",
      chargeIcon: "🍓",
      chargeName: "草莓",
    };
    const card = document.createElement("article");
    card.className = "character-card";
    card.dataset.characterId = String(character.id);
    card.innerHTML = `
      <div class="avatar" aria-hidden="true">${characterVisual.icon}</div>
      <div>
        <h2 class="character-name">${character.name}</h2>
        <p class="character-role">${characterVisual.role}</p>
        <p class="charge-source">
          <span class="charge-icon">${characterVisual.chargeIcon}</span>
          ${characterVisual.chargeName}消除可充能
        </p>
        <div class="energy-wrap">
          <div class="energy-bar">
            <div class="energy-fill" data-energy-fill="${character.id}"></div>
          </div>
          <div class="energy-label" data-energy-label="${character.id}">0 / ${character.maxEnergy}</div>
        </div>
        <button
          type="button"
          class="skill-button control-button control-button-skill"
          data-skill-button="${character.id}"
          data-character-id="${character.id}"
        >
          ${getSkillName(character.id)}
        </button>
      </div>
    `;

    charactersElement.append(card);
  }

  updateEnergyBars();
}

export function updateEnergyBars() {
  let hasReadySkill = false;

  for (const character of state.characters) {
    const fill = charactersElement.querySelector(
      `[data-energy-fill="${character.id}"]`,
    );
    const label = charactersElement.querySelector(
      `[data-energy-label="${character.id}"]`,
    );
    const button = charactersElement.querySelector(
      `[data-skill-button="${character.id}"]`,
    );
    const card = charactersElement.querySelector(
      `[data-character-id="${character.id}"]`,
    );
    const ratio = (character.energy / character.maxEnergy) * 100;
    const nearReady = ratio >= 75 && !character.skillReady;

    if (fill) {
      fill.style.width = `${ratio}%`;
    }
    if (label) {
      label.textContent = `${character.energy} / ${character.maxEnergy}`;
    }
    if (button) {
      const ready = character.skillReady;
      const blocked =
        state.isProcessing ||
        state.autoSkillRunning ||
        state.gameOver ||
        state.tutorialOpen;
      button.disabled = !ready || blocked;
      button.classList.toggle("ready", ready);
    }
    if (card) {
      card.classList.toggle("near-ready", nearReady);
      card.classList.toggle("ready-skill", character.skillReady);
    }
    if (character.skillReady) {
      hasReadySkill = true;
    }
  }

  if (hasReadySkill && !state.skillHintShown && !state.tutorialOpen) {
    state.skillHintShown = true;
    showTransientHint("技能已就绪，点左侧按钮即可释放。", 2200);
  }
}

export function updateScoreDisplay() {
  if (scoreValueElement) {
    scoreValueElement.textContent = String(state.score.score);
  }
  if (comboValueElement) {
    comboValueElement.textContent = String(state.score.combo);
  }
  updateGoalProgressDisplay();
}

export function updateEnergy(removedTiles, options = {}) {
  chargeEnergyFromTiles(state.characters, removedTiles, {
    energyPerTile: getDifficultyConfig().energyPerTile,
    ...options,
  });
  updateEnergyBars();
}

export function updateScore(removedTileCount, comboLevel) {
  const gained = applyScore(state.score, removedTileCount, comboLevel);
  updateScoreDisplay();
  return gained;
}

function shouldShowScorePopup(removedCount, comboLevel, { tag = "", force = false } = {}) {
  if (force) {
    return true;
  }

  if (tag) {
    return true;
  }

  if (comboLevel >= 3) {
    return true;
  }

  return removedCount >= 6;
}

function showScorePopup(removedTiles, gainedScore, comboLevel, { tag = "" } = {}) {
  if (!scorePopLayerElement || removedTiles.length === 0 || gainedScore <= 0) {
    return;
  }

  const activePopupLoad = scorePopLayerElement.childElementCount;
  if (activePopupLoad >= SCORE_POP_MAX_NODES && !tag && comboLevel < 4) {
    return;
  }

  const { x, y } = getCenterPixelFromTiles(removedTiles);
  const multiplier = getComboMultiplier(comboLevel);
  const multiplierText = comboLevel > 1 ? ` x${multiplier}` : "";

  const popup = document.createElement("div");
  popup.className = "score-pop";
  if (tag) {
    popup.classList.add("special");
  }
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.textContent = `${tag ? `${tag} ` : ""}+${gainedScore}${multiplierText}`;

  if (activePopupLoad >= SCORE_POP_MAX_NODES) {
    scorePopLayerElement.firstElementChild?.remove();
  }
  scorePopLayerElement.append(popup);
  while (scorePopLayerElement.childElementCount > SCORE_POP_MAX_NODES) {
    scorePopLayerElement.firstElementChild?.remove();
  }
  window.setTimeout(() => popup.remove(), 560);
}

function showComboBanner(comboLevel, gainedScore = 0) {
  if (!comboBannerElement || comboLevel < 3) {
    return;
  }

  const multiplier = getComboMultiplier(comboLevel);
  const comboText = comboLevel >= 5 ? `${comboLevel} 超连击!` : `${comboLevel} 连击!`;
  const scoreText = gainedScore > 0 ? ` +${gainedScore}` : "";
  comboBannerElement.textContent = `${comboText} x${multiplier}${scoreText}`;
  comboBannerElement.setAttribute("aria-hidden", "false");

  comboBannerElement.classList.remove("show");
  void comboBannerElement.offsetWidth;
  comboBannerElement.classList.add("show");

  if (state.comboBannerTimer) {
    window.clearTimeout(state.comboBannerTimer);
  }

  state.comboBannerTimer = window.setTimeout(() => {
    hideComboBanner();
  }, 520);
}

export async function processTurn(initialRemovedTiles = null, options = {}) {
  const { skipInitialHitEffect = false, ...energyOptions } = options;
  let comboLevel = 0;

  if (initialRemovedTiles && initialRemovedTiles.length > 0) {
    comboLevel = 1;
    await animateRemoval(initialRemovedTiles);
    const gained = updateScore(initialRemovedTiles.length, comboLevel);
    if (shouldShowScorePopup(initialRemovedTiles.length, comboLevel)) {
      showScorePopup(initialRemovedTiles, gained, comboLevel);
    }
    if (!skipInitialHitEffect) {
      const initialTier = initialRemovedTiles.length >= 5 ? "combo" : "normal";
      showHitEffect(initialRemovedTiles, { tier: initialTier });
    }
    playHitSfx(initialRemovedTiles.length, comboLevel);
    updateEnergy(initialRemovedTiles, energyOptions);
    await collapseAndRender();
  }

  while (true) {
    const matches = findMatches(state.board);
    if (matches.length === 0) {
      break;
    }

    comboLevel += 1;
    const longMatchTypes = findLongMatchTypes(state.board, 5);
    const matchedTiles = matches
      .map(({ row, col }) => state.board[row][col])
      .filter(Boolean);

    await animateRemoval(matches);

    const removedTiles = removeMatches(state.board, matches);
    const regularGained = updateScore(removedTiles.length, comboLevel);
    let chainGained = regularGained;
    if (shouldShowScorePopup(removedTiles.length, comboLevel)) {
      showScorePopup(matchedTiles, regularGained, comboLevel);
    }
    const regularTier = comboLevel >= 3 || removedTiles.length >= 5 ? "combo" : "normal";
    showHitEffect(removedTiles, { tier: regularTier });
    playHitSfx(removedTiles.length, comboLevel);

    if (longMatchTypes.size > 0) {
      const bonusTargets = collectTilesByTypes(longMatchTypes);
      await animateTypeClear(bonusTargets);
      const bonusRemoved = removeTilesByTypes(state.board, longMatchTypes);
      removedTiles.push(...bonusRemoved);

      if (bonusRemoved.length > 0) {
        const bonusGained = updateScore(bonusRemoved.length, comboLevel);
        chainGained += bonusGained;
        showScorePopup(bonusRemoved, bonusGained, comboLevel, {
          tag: "同色全清",
        });
        showHitEffect(bonusRemoved, { tier: "special" });
        playHitSfx(bonusRemoved.length, comboLevel, { special: true });
      }
    }

    if (comboLevel >= 3) {
      showComboBanner(comboLevel, chainGained);
    }

    updateEnergy(removedTiles);
    await collapseAndRender();
  }

  if (comboLevel === 0) {
    resetCombo(state.score);
    updateScoreDisplay();
    hideComboBanner();
  }

  return comboLevel > 0;
}

async function executeSkill(characterId) {
  if (state.gameOver) {
    return false;
  }

  const character = getCharacterById(state.characters, characterId);
  if (!character || !character.skillReady) {
    return false;
  }

  state.selectedTile = null;
  state.isProcessing = true;
  setCharacterCasting(characterId, true);
  updateEnergyBars();

  await wait(ANIMATION_MS.skillWindup);
  playSkillSfx(characterId);

  resetCharacterEnergy(state.characters, characterId);
  updateEnergyBars();

  const removedTiles = activateSkill(characterId, state.board);

  if (removedTiles.length > 0) {
    showHitEffect(removedTiles, { tier: "skill" });
    await processTurn(removedTiles, {
      skipCharacterId: characterId,
      skipInitialHitEffect: true,
    });
  } else {
    resetCombo(state.score);
    updateScoreDisplay();
    hideComboBanner();
  }

  await resolveDeadlockIfNeeded();

  setCharacterCasting(characterId, false);
  state.isProcessing = false;
  updateEnergyBars();

  return true;
}

async function resolveAutoSkills() {
  if (state.autoSkillRunning || state.gameOver) {
    return;
  }

  state.autoSkillRunning = true;
  updateEnergyBars();

  try {
    while (true) {
      const readyCharacter = findFirstReadyCharacter();
      if (!readyCharacter) {
        break;
      }

      await executeSkill(readyCharacter.id);
    }
  } finally {
    state.autoSkillRunning = false;
    updateEnergyBars();
  }
}

async function handleTileSelection(position) {
  if (
    state.isProcessing ||
    state.autoSkillRunning ||
    state.gameOver ||
    state.tutorialOpen
  ) {
    return;
  }

  if (
    state.firstMoveGuide &&
    !state.hasSwappedOnce &&
    state.openingHintTiles.length > 0
  ) {
    state.openingHintTiles = [];
    updateHintText();
  }

  if (!state.selectedTile) {
    setSelectedTile(position);
    return;
  }

  if (positionEquals(state.selectedTile, position)) {
    clearSelection();
    return;
  }

  if (!areAdjacent(state.selectedTile, position)) {
    setSelectedTile(position);
    return;
  }

  state.isProcessing = true;
  updateEnergyBars();

  const first = { ...state.selectedTile };
  const second = { ...position };

  swapTiles(state.board, first, second);
  state.selectedTile = null;
  renderBoard({ animateMovement: true, motion: "swap" });
  await wait(ANIMATION_MS.swap);

  const hasMatch = findMatches(state.board).length > 0;

  if (!hasMatch) {
    swapTiles(state.board, first, second);
    renderBoard({ animateMovement: true, motion: "swap" });
    await wait(ANIMATION_MS.swap);
    await animateInvalidSwap(first, second);

    playSwapSfx(false);
    resetCombo(state.score);
    updateScoreDisplay();
    hideComboBanner();

    state.isProcessing = false;
    updateEnergyBars();
    return;
  }

  playSwapSfx(true);
  if (!state.hasSwappedOnce) {
    state.hasSwappedOnce = true;
    updateHintText();
  }
  consumeMoveIfNeeded();
  await processTurn();
  await resolveDeadlockIfNeeded();

  const reachedTargetBeforeAuto =
    isLevelMode() && state.score.score >= state.targetScore;

  if (!reachedTargetBeforeAuto) {
    await resolveAutoSkills();
    await resolveDeadlockIfNeeded();
  }

  evaluateLevelProgress();
  state.isProcessing = false;
  updateEnergyBars();
  updateModeStatus();
}

function handleBoardClick(event) {
  if (
    state.isProcessing ||
    state.autoSkillRunning ||
    state.gameOver ||
    state.tutorialOpen
  ) {
    return;
  }

  const tileButton = event.target.closest(".tile");
  if (!tileButton) {
    return;
  }

  void unlockAudio();

  const row = Number(tileButton.dataset.row);
  const col = Number(tileButton.dataset.col);
  void handleTileSelection({ row, col });
}

function handleSkillClick(event) {
  const skillButton = event.target.closest(".skill-button");
  if (
    !skillButton ||
    state.isProcessing ||
    state.autoSkillRunning ||
    state.gameOver ||
    state.tutorialOpen
  ) {
    return;
  }

  const characterId = Number(skillButton.dataset.characterId);
  const character = getCharacterById(state.characters, characterId);

  if (!character || !character.skillReady) {
    return;
  }

  void unlockAudio();

  void (async () => {
    await executeSkill(characterId);
    await resolveAutoSkills();
    await resolveDeadlockIfNeeded();
    evaluateLevelProgress();
  })();
}

function resetGame({ keepLevel = false } = {}) {
  if (!keepLevel || !isLevelMode()) {
    state.levelIndex = 1;
  }

  state.characters = createCharacters();
  state.score = createScoreState();
  state.selectedTile = null;
  state.isProcessing = false;
  state.autoSkillRunning = false;
  state.previousTilePositions = new Map();
  state.tileElementsByPosition = new Map();
  state.boardMetrics = null;
  state.hasSwappedOnce = false;
  state.skillHintShown = false;
  state.transientHint = "";
  state.openingHintTiles = [];
  initializeModeState();

  if (state.hintTimer) {
    window.clearTimeout(state.hintTimer);
    state.hintTimer = null;
  }

  clearScorePopups();
  clearHitFx();
  hideComboBanner();
  rebuildPlayableBoard();
  applyDynamicTheme();
  if (state.firstMoveGuide) {
    state.openingHintTiles = findSuggestedSwapPair();
  }

  renderCharacters();
  renderBoard();
  updateScoreDisplay();
  updateDifficultyUI();
  updateModeUI();
  updateObjectiveDisplay();
  updateModeStatus();
  updateNextLevelButton();
  updateSoundButton();
  updateHintText();
}

function handleDifficultyChange(event) {
  if (state.isProcessing || state.autoSkillRunning) {
    updateDifficultyUI();
    return;
  }

  const selected = event.target.value;
  if (!DIFFICULTY_CONFIGS[selected]) {
    updateDifficultyUI();
    return;
  }

  state.difficulty = selected;
  resetGame();
}

function handleModeChange(event) {
  if (state.isProcessing || state.autoSkillRunning) {
    updateModeUI();
    return;
  }

  const selected = event.target.value;
  if (!MODE_CONFIGS[selected]) {
    updateModeUI();
    return;
  }

  state.mode = selected;
  resetGame();
}

function handleRestartClick() {
  if (state.isProcessing || state.autoSkillRunning) {
    return;
  }

  resetGame();
}

function handleNextLevelClick() {
  if (
    !isLevelMode() ||
    state.isProcessing ||
    state.autoSkillRunning ||
    !state.gameOver ||
    state.gameResult !== "win"
  ) {
    return;
  }

  state.levelIndex += 1;
  resetGame({ keepLevel: true });
  setModeStatus(`第 ${state.levelIndex} 关开始，冲击目标分！`, "info");
}

async function handleSoundToggle() {
  state.audioEnabled = !state.audioEnabled;
  updateSoundButton();

  if (state.audioEnabled) {
    await unlockAudio();
    playTone({ frequency: 560, duration: 0.06, gainValue: 0.02 });
  }
}

function handleThemeFabClick() {
  state.themeSeedIndex = (state.themeSeedIndex + 1) % THEME_SEEDS.length;
  applyDynamicTheme();
  showTransientHint(`已切换为 ${getThemeSeed().label} 动态色板。`, 1600);
}

function handleTutorialButtonClick() {
  openTutorial();
}

function handleTutorialCloseClick() {
  closeTutorial();
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && state.tutorialOpen) {
    closeTutorial();
  }
}

function handleTutorialOverlayClick(event) {
  if (event.target === tutorialOverlayElement) {
    closeTutorial();
  }
}

function renderGameToText() {
  const payload = {
    coordinateSystem: "origin=top-left,row increases downward,col increases rightward",
    mode: state.mode,
    difficulty: state.difficulty,
    level: state.levelIndex,
    score: state.score.score,
    combo: state.score.combo,
    movesLeft: state.movesLeft,
    targetScore: state.targetScore,
    gameOver: state.gameOver,
    gameResult: state.gameResult,
    tutorialOpen: state.tutorialOpen,
    hint: hintElement?.textContent ?? "",
    theme: getThemeSeed().label,
    selectedTile: state.selectedTile,
    readyCharacters: state.characters
      .filter((character) => character.skillReady)
      .map((character) => character.id),
    board: state.board.map((row) => row.map((tile) => tile?.type ?? null)),
  };

  return JSON.stringify(payload);
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms = 0) =>
  new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

function initializeGame() {
  resetGame();

  boardElement.addEventListener("click", handleBoardClick);
  charactersElement.addEventListener("click", handleSkillClick);
  difficultySelectElement?.addEventListener("change", handleDifficultyChange);
  modeSelectElement?.addEventListener("change", handleModeChange);
  restartButtonElement?.addEventListener("click", handleRestartClick);
  nextLevelButtonElement?.addEventListener("click", handleNextLevelClick);
  soundButtonElement?.addEventListener("click", () => {
    void handleSoundToggle();
  });
  tutorialButtonElement?.addEventListener("click", handleTutorialButtonClick);
  tutorialCloseButtonElement?.addEventListener("click", handleTutorialCloseClick);
  tutorialOverlayElement?.addEventListener("click", handleTutorialOverlayClick);
  themeFabElement?.addEventListener("click", handleThemeFabClick);
  window.addEventListener("keydown", handleGlobalKeydown);

  if (shouldAutoShowTutorial()) {
    openTutorial();
  }
}

initializeGame();

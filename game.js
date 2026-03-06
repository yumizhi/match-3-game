import {
  applyGravity,
  areAdjacent,
  findMatches,
  findLongMatchTypes,
  generateBoard,
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
  swap: 130,
  remove: 220,
  specialRemove: 300,
  fall: 260,
  skillWindup: 180,
  invalidSwap: 220,
};

const boardElement = document.getElementById("board");
const scorePopLayerElement = document.getElementById("score-pop-layer");
const charactersElement = document.getElementById("characters");
const scoreValueElement = document.getElementById("score-value");
const comboValueElement = document.getElementById("combo-value");
const difficultySelectElement = document.getElementById("difficulty-select");
const difficultyDescElement = document.getElementById("difficulty-desc");
const restartButtonElement = document.getElementById("restart-button");

const DIFFICULTY_CONFIGS = {
  easy: {
    key: "easy",
    label: "轻松",
    energyPerTile: 4,
    antiComboLevel: 0,
    desc: "充能偏快，随机连锁更多，适合爽快体验。",
  },
  normal: {
    key: "normal",
    label: "标准",
    energyPerTile: 3,
    antiComboLevel: 1,
    desc: "充能与连锁平衡，推荐日常游玩。",
  },
  hard: {
    key: "hard",
    label: "困难",
    energyPerTile: 2,
    antiComboLevel: 2,
    desc: "充能更慢，随机连锁压制更强，更考验规划。",
  },
};

const state = {
  difficulty: "normal",
  board: generateBoard(),
  characters: createCharacters(),
  score: createScoreState(),
  selectedTile: null,
  isProcessing: false,
  autoSkillRunning: false,
  previousTilePositions: new Map(),
};

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function tileClassName(type) {
  return `tile tile-${type.toLowerCase()}`;
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

function getDifficultyConfig() {
  return DIFFICULTY_CONFIGS[state.difficulty] ?? DIFFICULTY_CONFIGS.normal;
}

function updateDifficultyUI() {
  const config = getDifficultyConfig();
  if (difficultySelectElement) {
    difficultySelectElement.value = config.key;
  }
  if (difficultyDescElement) {
    difficultyDescElement.textContent = `${config.desc}（每块充能 +${config.energyPerTile}）`;
  }
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

function createPositionList(entries) {
  const unique = new Map();

  for (const entry of entries) {
    unique.set(`${entry.row},${entry.col}`, {
      row: entry.row,
      col: entry.col,
    });
  }

  return Array.from(unique.values());
}

function addRemovalClass(positions, className) {
  for (const { row, col } of positions) {
    const tileElement = boardElement.querySelector(
      `.tile[data-row="${row}"][data-col="${col}"]`,
    );
    if (tileElement) {
      tileElement.classList.add(className);
    }
  }
}

async function animateRemoval(
  entries,
  { className = "removing", duration = ANIMATION_MS.remove } = {},
) {
  const positions = createPositionList(entries);
  if (positions.length === 0) {
    return;
  }

  addRemovalClass(positions, className);
  await wait(duration);
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
  const firstTile = boardElement.querySelector(
    `.tile[data-row="${first.row}"][data-col="${first.col}"]`,
  );
  const secondTile = boardElement.querySelector(
    `.tile[data-row="${second.row}"][data-col="${second.col}"]`,
  );

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

async function collapseAndRender() {
  applyGravity(state.board);
  spawnTiles(state.board, {
    antiComboLevel: getDifficultyConfig().antiComboLevel,
  });
  renderBoard({ animateMovement: true });
  await wait(ANIMATION_MS.fall);
}

function findFirstReadyCharacter() {
  return state.characters.find((character) => character.skillReady);
}

export function renderBoard({ animateMovement = false } = {}) {
  boardElement.innerHTML = "";

  const currentPositions = new Map();

  for (let row = 0; row < state.board.length; row += 1) {
    for (let col = 0; col < state.board[row].length; col += 1) {
      const tile = state.board[row][col];
      if (!tile) {
        continue;
      }

      const button = document.createElement("button");
      const isSelected =
        state.selectedTile &&
        positionEquals(state.selectedTile, { row: tile.row, col: tile.col });

      button.type = "button";
      button.className = tileClassName(tile.type);
      button.textContent = tile.type;
      button.dataset.row = String(tile.row);
      button.dataset.col = String(tile.col);
      button.dataset.tileId = String(tile.id);
      button.ariaLabel = `方块 ${tile.type}，第 ${tile.row + 1} 行，第 ${tile.col + 1} 列`;

      if (isSelected) {
        button.classList.add("selected");
      }

      boardElement.append(button);
      currentPositions.set(tile.id, { row: tile.row, col: tile.col });
    }
  }

  if (animateMovement) {
    const firstTileElement = boardElement.querySelector(".tile");
    const tileSize = firstTileElement
      ? firstTileElement.getBoundingClientRect().height
      : 0;
    const step = tileSize + getBoardGapPx();

    for (const button of boardElement.querySelectorAll(".tile")) {
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

      button.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: ANIMATION_MS.fall,
          easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
        },
      );
    }
  }

  state.previousTilePositions = currentPositions;
}

export function renderCharacters() {
  charactersElement.innerHTML = "";

  for (const character of state.characters) {
    const card = document.createElement("article");
    card.className = "character-card";
    card.dataset.characterId = String(character.id);
    card.innerHTML = `
      <div class="avatar" aria-hidden="true">${character.id}</div>
      <div>
        <h2 class="character-name">${character.name}</h2>
        <div class="energy-wrap">
          <div class="energy-bar">
            <div class="energy-fill" data-energy-fill="${character.id}"></div>
          </div>
          <div class="energy-label" data-energy-label="${character.id}">0 / ${character.maxEnergy}</div>
        </div>
        <button
          type="button"
          class="skill-button"
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

    if (fill) {
      fill.style.width = `${ratio}%`;
    }
    if (label) {
      label.textContent = `${character.energy} / ${character.maxEnergy}`;
    }
    if (button) {
      const ready = character.skillReady;
      button.disabled = !ready || state.isProcessing;
      button.classList.toggle("ready", ready);
    }
    if (card) {
      card.classList.toggle("ready-skill", character.skillReady);
    }
  }
}

export function updateScoreDisplay() {
  scoreValueElement.textContent = String(state.score.score);
  comboValueElement.textContent = String(state.score.combo);
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

function clearScorePopups() {
  if (!scorePopLayerElement) {
    return;
  }
  scorePopLayerElement.innerHTML = "";
}

function showScorePopup(removedTiles, gainedScore, comboLevel, { tag = "" } = {}) {
  if (!scorePopLayerElement || removedTiles.length === 0 || gainedScore <= 0) {
    return;
  }

  const center = removedTiles.reduce(
    (sum, tile) => ({
      row: sum.row + tile.row,
      col: sum.col + tile.col,
    }),
    { row: 0, col: 0 },
  );
  const centerRow = center.row / removedTiles.length;
  const centerCol = center.col / removedTiles.length;

  const tileElement = boardElement.querySelector(".tile");
  const gap = getBoardGapPx();
  const tileSize =
    tileElement?.getBoundingClientRect().width ??
    (boardElement.getBoundingClientRect().width - gap * 7) / 8;
  const step = tileSize + gap;

  const x = centerCol * step + tileSize / 2;
  const y = centerRow * step + tileSize / 2;
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

  scorePopLayerElement.append(popup);
  window.setTimeout(() => popup.remove(), 950);
}

export async function processTurn(initialRemovedTiles = null, options = {}) {
  let comboLevel = 0;

  if (initialRemovedTiles && initialRemovedTiles.length > 0) {
    comboLevel = 1;
    await animateRemoval(initialRemovedTiles);
    const gained = updateScore(initialRemovedTiles.length, comboLevel);
    showScorePopup(initialRemovedTiles, gained, comboLevel);
    updateEnergy(initialRemovedTiles, options);
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
    showScorePopup(matchedTiles, regularGained, comboLevel);

    if (longMatchTypes.size > 0) {
      const bonusTargets = collectTilesByTypes(longMatchTypes);
      await animateTypeClear(bonusTargets);
      const bonusRemoved = removeTilesByTypes(state.board, longMatchTypes);
      removedTiles.push(...bonusRemoved);

      if (bonusRemoved.length > 0) {
        const bonusGained = updateScore(bonusRemoved.length, comboLevel);
        showScorePopup(bonusRemoved, bonusGained, comboLevel, {
          tag: "同色清场",
        });
      }
    }

    updateEnergy(removedTiles);
    await collapseAndRender();
  }

  if (comboLevel === 0) {
    resetCombo(state.score);
    updateScoreDisplay();
  }

  return comboLevel > 0;
}

async function executeSkill(characterId) {
  const character = getCharacterById(state.characters, characterId);
  if (!character || !character.skillReady) {
    return false;
  }

  state.selectedTile = null;
  state.isProcessing = true;
  setCharacterCasting(characterId, true);
  updateEnergyBars();

  await wait(ANIMATION_MS.skillWindup);

  // Requirement: skill usage resets the owner's energy immediately.
  resetCharacterEnergy(state.characters, characterId);
  updateEnergyBars();

  const removedTiles = activateSkill(characterId, state.board);

  if (removedTiles.length > 0) {
    await processTurn(removedTiles, { skipCharacterId: characterId });
  } else {
    resetCombo(state.score);
    updateScoreDisplay();
  }

  setCharacterCasting(characterId, false);
  state.isProcessing = false;
  updateEnergyBars();

  return true;
}

async function resolveAutoSkills() {
  if (state.autoSkillRunning) {
    return;
  }

  state.autoSkillRunning = true;

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
  }
}

async function handleTileSelection(position) {
  if (state.isProcessing) {
    return;
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
  renderBoard({ animateMovement: true });
  await wait(ANIMATION_MS.swap);

  const hasMatch = findMatches(state.board).length > 0;

  if (!hasMatch) {
    swapTiles(state.board, first, second);
    renderBoard({ animateMovement: true });
    await wait(ANIMATION_MS.swap);
    await animateInvalidSwap(first, second);

    resetCombo(state.score);
    updateScoreDisplay();

    state.isProcessing = false;
    updateEnergyBars();
    return;
  }

  await processTurn();

  state.isProcessing = false;
  updateEnergyBars();

  await resolveAutoSkills();
}

function handleBoardClick(event) {
  if (state.isProcessing) {
    return;
  }

  const tileButton = event.target.closest(".tile");
  if (!tileButton) {
    return;
  }

  const row = Number(tileButton.dataset.row);
  const col = Number(tileButton.dataset.col);

  void handleTileSelection({ row, col });
}

function handleSkillClick(event) {
  const skillButton = event.target.closest(".skill-button");
  if (!skillButton || state.isProcessing) {
    return;
  }

  const characterId = Number(skillButton.dataset.characterId);
  const character = getCharacterById(state.characters, characterId);

  if (!character || !character.skillReady) {
    return;
  }

  void (async () => {
    await executeSkill(characterId);
    await resolveAutoSkills();
  })();
}

function initializeBoardWithoutMatches() {
  // Keep rerolling until initial board is stable.
  while (findMatches(state.board).length > 0) {
    const matches = findMatches(state.board);
    removeMatches(state.board, matches);
    applyGravity(state.board);
    spawnTiles(state.board, {
      antiComboLevel: getDifficultyConfig().antiComboLevel,
    });
  }
}

function resetGame() {
  state.board = generateBoard();
  state.characters = createCharacters();
  state.score = createScoreState();
  state.selectedTile = null;
  state.isProcessing = false;
  state.autoSkillRunning = false;
  state.previousTilePositions = new Map();

  clearScorePopups();
  initializeBoardWithoutMatches();
  renderCharacters();
  renderBoard();
  updateScoreDisplay();
  updateDifficultyUI();
}

function handleDifficultyChange(event) {
  if (state.isProcessing) {
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

function handleRestartClick() {
  if (state.isProcessing) {
    return;
  }

  resetGame();
}

function initializeGame() {
  updateDifficultyUI();
  resetGame();

  boardElement.addEventListener("click", handleBoardClick);
  charactersElement.addEventListener("click", handleSkillClick);
  difficultySelectElement?.addEventListener("change", handleDifficultyChange);
  restartButtonElement?.addEventListener("click", handleRestartClick);
}

initializeGame();

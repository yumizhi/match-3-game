import { BOARD_SIZE } from "./board.js";

function randomIndex(max) {
  return Math.floor(Math.random() * max);
}

function clearPositions(board, positions) {
  const uniquePositions = new Map();
  const removedTiles = [];

  for (const { row, col } of positions) {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      continue;
    }
    uniquePositions.set(`${row},${col}`, { row, col });
  }

  for (const { row, col } of uniquePositions.values()) {
    const tile = board[row][col];
    if (!tile) {
      continue;
    }

    removedTiles.push(tile);
    board[row][col] = null;
  }

  return removedTiles;
}

export function applyCrossClear(board) {
  const row = randomIndex(BOARD_SIZE);
  const col = randomIndex(BOARD_SIZE);
  const positions = [];

  for (let index = 0; index < BOARD_SIZE; index += 1) {
    positions.push({ row, col: index });
    positions.push({ row: index, col });
  }

  return clearPositions(board, positions);
}

export function applyRowOrColumnClear(board) {
  const positions = [];
  const clearRow = Math.random() < 0.5;
  const fixedIndex = randomIndex(BOARD_SIZE);

  if (clearRow) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      positions.push({ row: fixedIndex, col });
    }
  } else {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      positions.push({ row, col: fixedIndex });
    }
  }

  return clearPositions(board, positions);
}

export function applyAreaClear(board) {
  const top = randomIndex(BOARD_SIZE - 2);
  const left = randomIndex(BOARD_SIZE - 2);
  const positions = [];

  for (let row = top; row < top + 3; row += 1) {
    for (let col = left; col < left + 3; col += 1) {
      positions.push({ row, col });
    }
  }

  return clearPositions(board, positions);
}

export function applyRandomClear(board) {
  const positions = [];

  for (let count = 0; count < 5; count += 1) {
    positions.push({
      row: randomIndex(BOARD_SIZE),
      col: randomIndex(BOARD_SIZE),
    });
  }

  return clearPositions(board, positions);
}

const SKILLS = {
  1: { name: "十字清扫", apply: applyCrossClear },
  2: { name: "行列清扫", apply: applyRowOrColumnClear },
  3: { name: "范围清扫", apply: applyAreaClear },
  4: { name: "随机摘果", apply: applyRandomClear },
};

export function getSkillName(characterId) {
  return SKILLS[characterId]?.name ?? "技能";
}

export function activateSkill(characterId, board) {
  const skill = SKILLS[characterId];
  if (!skill) {
    return [];
  }

  return skill.apply(board);
}

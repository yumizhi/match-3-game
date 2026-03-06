export const BOARD_SIZE = 8;
export const TILE_TYPES = ["A", "B", "C", "D"];
let nextTileId = 1;

function getRandomTileType() {
  return TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];
}

function getRandomFromList(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createTile(type, row, col) {
  return {
    id: nextTileId++,
    type,
    row,
    col,
  };
}

function syncTilePosition(tile, row, col) {
  if (!tile) {
    return;
  }

  tile.row = row;
  tile.col = col;
}

function markPosition(store, row, col) {
  store.set(`${row},${col}`, { row, col });
}

function isSameType(board, row, col, type) {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return false;
  }
  return board[row][col]?.type === type;
}

function wouldCreateImmediateMatch(board, row, col, type) {
  if (
    (isSameType(board, row, col - 1, type) &&
      isSameType(board, row, col - 2, type)) ||
    (isSameType(board, row, col + 1, type) &&
      isSameType(board, row, col + 2, type)) ||
    (isSameType(board, row, col - 1, type) &&
      isSameType(board, row, col + 1, type)) ||
    (isSameType(board, row - 1, col, type) &&
      isSameType(board, row - 2, col, type)) ||
    (isSameType(board, row + 1, col, type) &&
      isSameType(board, row + 2, col, type)) ||
    (isSameType(board, row - 1, col, type) &&
      isSameType(board, row + 1, col, type))
  ) {
    return true;
  }

  return false;
}

function wouldCreateNearMatch(board, row, col, type) {
  return (
    isSameType(board, row, col - 1, type) ||
    isSameType(board, row, col + 1, type) ||
    isSameType(board, row - 1, col, type) ||
    isSameType(board, row + 1, col, type)
  );
}

function pickSpawnType(board, row, col, antiComboLevel) {
  if (antiComboLevel <= 0) {
    return getRandomTileType();
  }

  const noMatchCandidates = TILE_TYPES.filter(
    (type) => !wouldCreateImmediateMatch(board, row, col, type),
  );
  if (noMatchCandidates.length === 0) {
    return getRandomTileType();
  }

  if (antiComboLevel === 1) {
    return getRandomFromList(noMatchCandidates);
  }

  const nearSafeCandidates = noMatchCandidates.filter(
    (type) => !wouldCreateNearMatch(board, row, col, type),
  );
  const pool =
    nearSafeCandidates.length > 0 ? nearSafeCandidates : noMatchCandidates;
  return getRandomFromList(pool);
}

export function generateBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(null),
  );

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      let type = getRandomTileType();

      // Prevent automatic 3-matches on spawn.
      while (
        (col >= 2 &&
          board[row][col - 1]?.type === type &&
          board[row][col - 2]?.type === type) ||
        (row >= 2 &&
          board[row - 1][col]?.type === type &&
          board[row - 2][col]?.type === type)
      ) {
        type = getRandomTileType();
      }

      board[row][col] = createTile(type, row, col);
    }
  }

  return board;
}

export function areAdjacent(first, second) {
  return (
    Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1
  );
}

export function swapTiles(board, first, second) {
  const tileA = board[first.row][first.col];
  const tileB = board[second.row][second.col];

  board[first.row][first.col] = tileB;
  board[second.row][second.col] = tileA;

  syncTilePosition(tileB, first.row, first.col);
  syncTilePosition(tileA, second.row, second.col);
}

export function findMatches(board) {
  const matchedPositions = new Map();

  // Horizontal scans.
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let col = 0;
    while (col < BOARD_SIZE) {
      const tile = board[row][col];
      if (!tile) {
        col += 1;
        continue;
      }

      let end = col + 1;
      while (end < BOARD_SIZE && board[row][end]?.type === tile.type) {
        end += 1;
      }

      if (end - col >= 3) {
        for (let index = col; index < end; index += 1) {
          markPosition(matchedPositions, row, index);
        }
      }

      col = end;
    }
  }

  // Vertical scans.
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let row = 0;
    while (row < BOARD_SIZE) {
      const tile = board[row][col];
      if (!tile) {
        row += 1;
        continue;
      }

      let end = row + 1;
      while (end < BOARD_SIZE && board[end][col]?.type === tile.type) {
        end += 1;
      }

      if (end - row >= 3) {
        for (let index = row; index < end; index += 1) {
          markPosition(matchedPositions, index, col);
        }
      }

      row = end;
    }
  }

  return Array.from(matchedPositions.values());
}

export function findLongMatchTypes(board, minRunLength = 5) {
  const longMatchTypes = new Set();

  // Horizontal scans.
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let col = 0;
    while (col < BOARD_SIZE) {
      const tile = board[row][col];
      if (!tile) {
        col += 1;
        continue;
      }

      let end = col + 1;
      while (end < BOARD_SIZE && board[row][end]?.type === tile.type) {
        end += 1;
      }

      if (end - col >= minRunLength) {
        longMatchTypes.add(tile.type);
      }

      col = end;
    }
  }

  // Vertical scans.
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let row = 0;
    while (row < BOARD_SIZE) {
      const tile = board[row][col];
      if (!tile) {
        row += 1;
        continue;
      }

      let end = row + 1;
      while (end < BOARD_SIZE && board[end][col]?.type === tile.type) {
        end += 1;
      }

      if (end - row >= minRunLength) {
        longMatchTypes.add(tile.type);
      }

      row = end;
    }
  }

  return longMatchTypes;
}

export function removeMatches(board, matches) {
  const removedTiles = [];

  for (const { row, col } of matches) {
    const tile = board[row][col];
    if (!tile) {
      continue;
    }

    removedTiles.push(tile);
    board[row][col] = null;
  }

  return removedTiles;
}

export function removeTilesByTypes(board, types) {
  const targetTypes = types instanceof Set ? types : new Set(types);
  const removedTiles = [];

  if (targetTypes.size === 0) {
    return removedTiles;
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const tile = board[row][col];
      if (!tile || !targetTypes.has(tile.type)) {
        continue;
      }

      removedTiles.push(tile);
      board[row][col] = null;
    }
  }

  return removedTiles;
}

export function applyGravity(board) {
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let writeRow = BOARD_SIZE - 1;

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const tile = board[row][col];
      if (!tile) {
        continue;
      }

      if (writeRow !== row) {
        board[writeRow][col] = tile;
        board[row][col] = null;
        syncTilePosition(tile, writeRow, col);
      }

      writeRow -= 1;
    }

    while (writeRow >= 0) {
      board[writeRow][col] = null;
      writeRow -= 1;
    }
  }
}

export function spawnTiles(board, { antiComboLevel = 0 } = {}) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col]) {
        continue;
      }

      board[row][col] = createTile(
        pickSpawnType(board, row, col, antiComboLevel),
        row,
        col,
      );
    }
  }
}

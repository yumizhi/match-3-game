const POINTS_PER_TILE = 10;

export function createScoreState() {
  return {
    score: 0,
    combo: 0,
  };
}

export function getComboMultiplier(comboLevel) {
  if (comboLevel <= 1) {
    return 1;
  }
  if (comboLevel === 2) {
    return 1.5;
  }
  return 2;
}

export function updateScore(scoreState, removedTileCount, comboLevel) {
  const multiplier = getComboMultiplier(comboLevel);
  const gained = Math.round(removedTileCount * POINTS_PER_TILE * multiplier);

  scoreState.score += gained;
  scoreState.combo = comboLevel;

  return gained;
}

export function resetCombo(scoreState) {
  scoreState.combo = 0;
}

export const ENERGY_PER_TILE = 5;

export const TILE_TO_CHARACTER_ID = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

const CHARACTER_BLUEPRINTS = [
  { id: 1, name: "战士" },
  { id: 2, name: "法师" },
  { id: 3, name: "游侠" },
  { id: 4, name: "刺客" },
];

export function createCharacters() {
  return CHARACTER_BLUEPRINTS.map((character) => ({
    ...character,
    energy: 0,
    maxEnergy: 100,
    skillReady: false,
  }));
}

export function getCharacterById(characters, characterId) {
  return characters.find((character) => character.id === characterId);
}

function refreshSkillReady(character) {
  character.skillReady = character.energy >= character.maxEnergy;
}

function addEnergy(character, amount) {
  if (amount <= 0) {
    return;
  }

  character.energy = Math.min(character.maxEnergy, character.energy + amount);
  refreshSkillReady(character);
}

export function chargeEnergyFromTiles(
  characters,
  removedTiles,
  { skipCharacterId = null, energyPerTile = ENERGY_PER_TILE } = {},
) {
  for (const tile of removedTiles) {
    const characterId = TILE_TO_CHARACTER_ID[tile.type];
    if (!characterId || characterId === skipCharacterId) {
      continue;
    }

    const target = getCharacterById(characters, characterId);
    if (!target) {
      continue;
    }

    addEnergy(target, energyPerTile);
  }
}

export function resetCharacterEnergy(characters, characterId) {
  const character = getCharacterById(characters, characterId);
  if (!character) {
    return;
  }

  character.energy = 0;
  character.skillReady = false;
}

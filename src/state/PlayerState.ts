export type EquipmentSlot =
  | 'helmet'
  | 'armor'
  | 'boots'
  | 'cape'
  | 'ring'
  | 'jewel'
  | 'mainHand'
  | 'offHand';

export type Rarity = 'common' | 'rare' | 'unique';
export type WeaponVisual = 'dagger' | 'sword' | 'axe';

export const RARITY_ORDER: Rarity[] = ['unique', 'rare', 'common'];
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Común', rare: 'Raro', unique: 'Único' };
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9a9284',
  rare: '#4f8fc4',
  unique: '#d1a237',
};

/** Rarer runes cool down faster. */
export const RARITY_COOLDOWN_MULT: Record<Rarity, number> = {
  common: 1,
  rare: 0.85,
  unique: 0.7,
};

export interface ItemDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  damageBonus?: number;
  hpBonus?: number;
  speedBonus?: number;
  color: string;
  weaponVisual?: WeaponVisual;
}

export type SkillTier = 'basic' | 'ulti';

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  tier: SkillTier;
}

// Skills only activate on the hotbar once a matching rune is equipped —
// this pool just defines what a rune of a given skillId does.
export const SKILL_POOL: SkillDef[] = [
  {
    id: 'power_strike',
    name: 'Golpe Poderoso',
    description: 'El próximo ataque inflige el doble de daño.',
    cooldown: 8,
    tier: 'basic',
  },
  {
    id: 'minor_heal',
    name: 'Curación Menor',
    description: 'Restaura una porción de tu vida al instante.',
    cooldown: 14,
    tier: 'basic',
  },
  {
    id: 'swift_step',
    name: 'Paso Veloz',
    description: 'Aumenta tu velocidad de movimiento por unos segundos.',
    cooldown: 12,
    tier: 'basic',
  },
  {
    id: 'ancestral_wrath',
    name: 'Ira Ancestral',
    description: 'Libera una onda devastadora que golpea a todo enemigo cercano.',
    cooldown: 30,
    tier: 'ulti',
  },
];

export function skillById(id: string): SkillDef | undefined {
  return SKILL_POOL.find((s) => s.id === id);
}

export interface RuneDef {
  id: string;
  name: string;
  skillId: string;
  tier: SkillTier;
  rarity: Rarity;
  description: string;
}

export type BackpackEntry = ItemDef | RuneDef | null;

export function isRuneDef(entry: ItemDef | RuneDef): entry is RuneDef {
  return (entry as RuneDef).skillId !== undefined;
}

let itemUid = 0;
function makeLootItem(base: Omit<ItemDef, 'id'>): ItemDef {
  itemUid += 1;
  return { ...base, id: `${base.name}_${itemUid}` };
}

let runeUid = 0;
function makeRune(skill: SkillDef, rarity: Rarity): RuneDef {
  runeUid += 1;
  return {
    id: `rune_${skill.id}_${runeUid}`,
    name: `Runa: ${skill.name}`,
    skillId: skill.id,
    tier: skill.tier,
    rarity,
    description: skill.description,
  };
}

type LootTemplate = Omit<ItemDef, 'id' | 'rarity'>;

const LOOT_TABLE: Record<Rarity, LootTemplate[]> = {
  common: [
    { name: 'Daga Oxidada', slot: 'mainHand', damageBonus: 3, color: '#8b2020', weaponVisual: 'dagger' },
    { name: 'Espada Mellada', slot: 'mainHand', damageBonus: 4, color: '#8b2020', weaponVisual: 'sword' },
    { name: 'Broquel Astillado', slot: 'offHand', hpBonus: 6, color: '#5a4a3a' },
    { name: 'Yelmo Abollado', slot: 'helmet', hpBonus: 8, color: '#4a4a4a' },
    { name: 'Peto Abollado', slot: 'armor', hpBonus: 12, color: '#4a4a4a' },
    { name: 'Botas Gastadas', slot: 'boots', speedBonus: 0.3, color: '#3a2f28' },
    { name: 'Capa Raída', slot: 'cape', hpBonus: 6, color: '#2d2d45' },
    { name: 'Anillo Desgastado', slot: 'ring', speedBonus: 0.3, color: '#2d6b3d' },
    { name: 'Joya Opaca', slot: 'jewel', damageBonus: 2, color: '#6b2d5f' },
  ],
  rare: [
    { name: 'Hacha de Verdugo', slot: 'mainHand', damageBonus: 8, color: '#8b2020', weaponVisual: 'axe' },
    { name: 'Espada Élfica', slot: 'mainHand', damageBonus: 9, color: '#8b2020', weaponVisual: 'sword' },
    { name: 'Escudo del Bastión', slot: 'offHand', hpBonus: 16, color: '#5a4a3a' },
    { name: 'Yelmo del Centinela', slot: 'helmet', hpBonus: 18, color: '#4a4a4a' },
    { name: 'Cota de Escamas', slot: 'armor', hpBonus: 26, speedBonus: 0.4, color: '#4a4a4a' },
    { name: 'Botas del Cazador', slot: 'boots', speedBonus: 0.9, color: '#3a2f28' },
    { name: 'Capa del Errante', slot: 'cape', hpBonus: 14, speedBonus: 0.3, color: '#2d2d45' },
    { name: 'Amuleto del Lobo', slot: 'ring', speedBonus: 1.1, color: '#2d6b3d' },
    { name: 'Joya del Vigor', slot: 'jewel', damageBonus: 5, hpBonus: 8, color: '#6b2d5f' },
  ],
  unique: [
    { name: 'Verdugo de Reyes', slot: 'mainHand', damageBonus: 16, color: '#8b2020', weaponVisual: 'axe' },
    { name: 'Colmillo de la Noche', slot: 'mainHand', damageBonus: 14, color: '#8b2020', weaponVisual: 'dagger' },
    { name: 'Aegis del Alba', slot: 'offHand', hpBonus: 30, damageBonus: 2, color: '#5a4a3a' },
    { name: 'Corona del Centinela Caído', slot: 'helmet', hpBonus: 34, color: '#4a4a4a' },
    { name: 'Armadura del Centinela Caído', slot: 'armor', hpBonus: 45, damageBonus: 4, color: '#4a4a4a' },
    { name: 'Botas del Viento Fantasma', slot: 'boots', speedBonus: 1.6, color: '#3a2f28' },
    { name: 'Capa de Cenizas', slot: 'cape', hpBonus: 24, damageBonus: 3, color: '#2d2d45' },
    { name: 'Corazón de Brasa', slot: 'ring', speedBonus: 1.5, hpBonus: 18, color: '#2d6b3d' },
    { name: 'Joya del Abismo', slot: 'jewel', damageBonus: 10, hpBonus: 10, color: '#6b2d5f' },
  ],
};

const RARITY_WEIGHTS: Array<{ rarity: Rarity; weight: number }> = [
  { rarity: 'common', weight: 60 },
  { rarity: 'rare', weight: 30 },
  { rarity: 'unique', weight: 10 },
];

function rollRarity(): Rarity {
  const totalWeight = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of RARITY_WEIGHTS) {
    if (roll < entry.weight) return entry.rarity;
    roll -= entry.weight;
  }
  return 'common';
}

/** Rolls a rarity tier, then a random equipment item template within it. */
export function rollLootItem(): ItemDef {
  const rarity = rollRarity();
  const templates = LOOT_TABLE[rarity];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return makeLootItem({ ...template, rarity });
}

/** Rolls a rarity tier, then a random skill rune (ulti runes are rarer to find). */
export function rollRuneDrop(): RuneDef {
  const rarity = rollRarity();
  const wantsUlti = Math.random() < 0.15;
  const candidates = SKILL_POOL.filter((s) => s.tier === (wantsUlti ? 'ulti' : 'basic'));
  const skill = candidates[Math.floor(Math.random() * candidates.length)];
  return makeRune(skill, rarity);
}

/** Loot roll used for treasure/boss rewards: mostly gear, sometimes a rune. */
export function rollAnyDrop(): ItemDef | RuneDef {
  return Math.random() < 0.3 ? rollRuneDrop() : rollLootItem();
}

export interface UpgradeDef {
  id: 'vitality' | 'power' | 'agility' | 'vigor';
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  { id: 'vitality', name: 'Vitalidad', description: '+15 vida máxima', baseCost: 20, costGrowth: 15 },
  { id: 'power', name: 'Poder', description: '+3 daño', baseCost: 25, costGrowth: 18 },
  { id: 'agility', name: 'Agilidad', description: '+0.4 velocidad', baseCost: 20, costGrowth: 15 },
  { id: 'vigor', name: 'Vigor', description: '+15 estamina máxima', baseCost: 20, costGrowth: 15 },
];

export interface BaseStats {
  maxHp: number;
  damage: number;
  speed: number;
  maxStamina: number;
}

const BASE_STATS: BaseStats = {
  maxHp: 100,
  damage: 12,
  speed: 6,
  maxStamina: 100,
};

const UPGRADE_EFFECT: Record<UpgradeDef['id'], number> = {
  vitality: 15,
  power: 3,
  agility: 0.4,
  vigor: 15,
};

const BACKPACK_COLS = 4;
const BACKPACK_MIN_ROWS = 4;
const BACKPACK_MAX_ROWS = 6;
const BANK_COLS = 6;
const BANK_ROWS = 6;

export class PlayerState {
  base: BaseStats = { ...BASE_STATS };
  equipped: Partial<Record<EquipmentSlot, ItemDef>> = {};
  equippedRunes: { basic: (RuneDef | null)[]; ulti: RuneDef | null } = {
    basic: [null, null, null],
    ulti: null,
  };

  backpackCols = BACKPACK_COLS;
  backpackRows = BACKPACK_MIN_ROWS;
  backpack: BackpackEntry[] = new Array(BACKPACK_COLS * BACKPACK_MIN_ROWS).fill(null);

  bankCols = BANK_COLS;
  bank: BackpackEntry[] = new Array(BANK_COLS * BANK_ROWS).fill(null);

  currentHp: number = BASE_STATS.maxHp;
  runLoot: (ItemDef | RuneDef)[] = [];

  /** Persistent currency: kept even on death, spent on permanent upgrades in the lobby. */
  souls = 0;
  upgrades: Record<UpgradeDef['id'], number> = { vitality: 0, power: 0, agility: 0, vigor: 0 };

  get maxHp(): number {
    let v = this.base.maxHp + this.upgrades.vitality * UPGRADE_EFFECT.vitality;
    for (const item of Object.values(this.equipped)) v += item?.hpBonus ?? 0;
    return v;
  }

  get damage(): number {
    let v = this.base.damage + this.upgrades.power * UPGRADE_EFFECT.power;
    for (const item of Object.values(this.equipped)) v += item?.damageBonus ?? 0;
    return v;
  }

  get speed(): number {
    let v = this.base.speed + this.upgrades.agility * UPGRADE_EFFECT.agility;
    for (const item of Object.values(this.equipped)) v += item?.speedBonus ?? 0;
    return v;
  }

  get maxStamina(): number {
    return this.base.maxStamina + this.upgrades.vigor * UPGRADE_EFFECT.vigor;
  }

  upgradeCost(id: UpgradeDef['id']): number {
    const def = UPGRADE_DEFS.find((d) => d.id === id)!;
    return Math.round(def.baseCost + this.upgrades[id] * def.costGrowth);
  }

  purchaseUpgrade(id: UpgradeDef['id']): boolean {
    const cost = this.upgradeCost(id);
    if (this.souls < cost) return false;
    this.souls -= cost;
    this.upgrades[id] += 1;
    return true;
  }

  // ---------- backpack helpers ----------

  private findEmptyBackpackSlot(): number {
    return this.backpack.findIndex((x) => x === null);
  }

  addToBackpack(entry: ItemDef | RuneDef): boolean {
    const idx = this.findEmptyBackpackSlot();
    if (idx === -1) return false;
    this.backpack[idx] = entry;
    return true;
  }

  addLoot(entry: ItemDef | RuneDef) {
    this.runLoot.push(entry);
  }

  commitRunLoot(): number {
    let lost = 0;
    for (const entry of this.runLoot) {
      if (!this.addToBackpack(entry)) lost += 1;
    }
    this.runLoot = [];
    return lost;
  }

  discardRunLoot() {
    this.runLoot = [];
  }

  // ---------- equipment ----------

  equipItem(backpackIndex: number, slot: EquipmentSlot): boolean {
    const entry = this.backpack[backpackIndex];
    if (!entry || isRuneDef(entry) || entry.slot !== slot) return false;
    const prev = this.equipped[slot] ?? null;
    this.equipped[slot] = entry;
    this.backpack[backpackIndex] = prev;
    return true;
  }

  unequipItem(slot: EquipmentSlot): boolean {
    const item = this.equipped[slot];
    if (!item) return false;
    const idx = this.findEmptyBackpackSlot();
    if (idx === -1) return false;
    this.backpack[idx] = item;
    delete this.equipped[slot];
    return true;
  }

  equipRune(backpackIndex: number, target: number | 'ulti'): boolean {
    const entry = this.backpack[backpackIndex];
    if (!entry || !isRuneDef(entry)) return false;
    if (target === 'ulti') {
      if (entry.tier !== 'ulti') return false;
      const prev = this.equippedRunes.ulti;
      this.equippedRunes.ulti = entry;
      this.backpack[backpackIndex] = prev;
    } else {
      if (entry.tier !== 'basic') return false;
      const prev = this.equippedRunes.basic[target] ?? null;
      this.equippedRunes.basic[target] = entry;
      this.backpack[backpackIndex] = prev;
    }
    return true;
  }

  unequipRune(target: number | 'ulti'): boolean {
    const idx = this.findEmptyBackpackSlot();
    if (idx === -1) return false;
    if (target === 'ulti') {
      if (!this.equippedRunes.ulti) return false;
      this.backpack[idx] = this.equippedRunes.ulti;
      this.equippedRunes.ulti = null;
    } else {
      const rune = this.equippedRunes.basic[target];
      if (!rune) return false;
      this.backpack[idx] = rune;
      this.equippedRunes.basic[target] = null;
    }
    return true;
  }

  // ---------- bank ----------

  moveToBank(backpackIndex: number): boolean {
    const entry = this.backpack[backpackIndex];
    if (!entry) return false;
    const bankIdx = this.bank.findIndex((x) => x === null);
    if (bankIdx === -1) return false;
    this.bank[bankIdx] = entry;
    this.backpack[backpackIndex] = null;
    return true;
  }

  moveToBackpack(bankIndex: number): boolean {
    const entry = this.bank[bankIndex];
    if (!entry) return false;
    const idx = this.findEmptyBackpackSlot();
    if (idx === -1) return false;
    this.backpack[idx] = entry;
    this.bank[bankIndex] = null;
    return true;
  }

  backpackExpandCost(): number {
    return 40 + (this.backpackRows - BACKPACK_MIN_ROWS) * 30;
  }

  canExpandBackpack(): boolean {
    return this.backpackRows < BACKPACK_MAX_ROWS;
  }

  expandBackpack(): boolean {
    if (!this.canExpandBackpack()) return false;
    const cost = this.backpackExpandCost();
    if (this.souls < cost) return false;
    this.souls -= cost;
    this.backpackRows += 1;
    const newSize = this.backpackRows * this.backpackCols;
    while (this.backpack.length < newSize) this.backpack.push(null);
    return true;
  }

  resetForLobby() {
    this.currentHp = this.maxHp;
  }
}

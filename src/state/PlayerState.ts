export type ItemSlot = 'weapon' | 'armor' | 'trinket';
export type Rarity = 'common' | 'rare' | 'unique';
export type WeaponVisual = 'dagger' | 'sword' | 'axe';

export const RARITY_ORDER: Rarity[] = ['unique', 'rare', 'common'];
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Común', rare: 'Raro', unique: 'Único' };
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9a9284',
  rare: '#4f8fc4',
  unique: '#d1a237',
};

export interface ItemDef {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: Rarity;
  damageBonus?: number;
  hpBonus?: number;
  speedBonus?: number;
  color: string;
  weaponVisual?: WeaponVisual;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  cooldown: number;
}

// The hotbar has exactly 3 slots (keys 1/2/3), so all 3 skills are always
// active at once — no separate equip step needed for a pool this small.
export const SKILL_POOL: SkillDef[] = [
  {
    id: 'power_strike',
    name: 'Golpe Poderoso',
    description: 'El próximo ataque inflige el doble de daño.',
    cooldown: 8,
  },
  {
    id: 'minor_heal',
    name: 'Curación Menor',
    description: 'Restaura una porción de tu vida al instante.',
    cooldown: 14,
  },
  {
    id: 'swift_step',
    name: 'Paso Veloz',
    description: 'Aumenta tu velocidad de movimiento por unos segundos.',
    cooldown: 12,
  },
];

let itemUid = 0;
function makeLootItem(base: Omit<ItemDef, 'id'>): ItemDef {
  itemUid += 1;
  return { ...base, id: `${base.name}_${itemUid}` };
}

type LootTemplate = Omit<ItemDef, 'id' | 'rarity'>;

const LOOT_TABLE: Record<Rarity, LootTemplate[]> = {
  common: [
    { name: 'Daga Oxidada', slot: 'weapon', damageBonus: 3, color: '#8b2020', weaponVisual: 'dagger' },
    { name: 'Espada Mellada', slot: 'weapon', damageBonus: 4, color: '#8b2020', weaponVisual: 'sword' },
    { name: 'Peto Abollado', slot: 'armor', hpBonus: 12, color: '#4a4a4a' },
    { name: 'Anillo Desgastado', slot: 'trinket', speedBonus: 0.3, color: '#2d6b3d' },
  ],
  rare: [
    { name: 'Hacha de Verdugo', slot: 'weapon', damageBonus: 8, color: '#8b2020', weaponVisual: 'axe' },
    { name: 'Espada Élfica', slot: 'weapon', damageBonus: 9, color: '#8b2020', weaponVisual: 'sword' },
    { name: 'Cota de Escamas', slot: 'armor', hpBonus: 26, speedBonus: 0.4, color: '#4a4a4a' },
    { name: 'Amuleto del Lobo', slot: 'trinket', speedBonus: 1.1, color: '#2d6b3d' },
  ],
  unique: [
    { name: 'Verdugo de Reyes', slot: 'weapon', damageBonus: 16, color: '#8b2020', weaponVisual: 'axe' },
    { name: 'Colmillo de la Noche', slot: 'weapon', damageBonus: 14, color: '#8b2020', weaponVisual: 'dagger' },
    { name: 'Armadura del Centinela Caído', slot: 'armor', hpBonus: 45, damageBonus: 4, color: '#4a4a4a' },
    { name: 'Corazón de Brasa', slot: 'trinket', speedBonus: 1.5, hpBonus: 18, color: '#2d6b3d' },
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

/** Rolls a rarity tier, then a random item template within it. */
export function rollLootItem(): ItemDef {
  const rarity = rollRarity();
  const templates = LOOT_TABLE[rarity];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return makeLootItem({ ...template, rarity });
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

export class PlayerState {
  base: BaseStats = { ...BASE_STATS };
  equipped: Partial<Record<ItemSlot, ItemDef>> = {};
  inventory: ItemDef[] = [];
  currentHp: number = BASE_STATS.maxHp;
  runLoot: ItemDef[] = [];

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

  equip(item: ItemDef) {
    this.equipped[item.slot] = item;
  }

  unequip(slot: ItemSlot) {
    delete this.equipped[slot];
  }

  addLoot(item: ItemDef) {
    this.runLoot.push(item);
  }

  commitRunLoot() {
    this.inventory.push(...this.runLoot);
    this.runLoot = [];
  }

  discardRunLoot() {
    this.runLoot = [];
  }

  resetForLobby() {
    this.currentHp = this.maxHp;
  }
}

export type ItemSlot = 'weapon' | 'armor' | 'trinket';

export interface ItemDef {
  id: string;
  name: string;
  slot: ItemSlot;
  damageBonus?: number;
  hpBonus?: number;
  speedBonus?: number;
  color: string;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  cooldown: number;
}

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
export function makeLootItem(base: Omit<ItemDef, 'id'>): ItemDef {
  itemUid += 1;
  return { ...base, id: `${base.name}_${itemUid}` };
}

export const LOOT_TABLE: Array<Omit<ItemDef, 'id'>> = [
  { name: 'Espada Mellada', slot: 'weapon', damageBonus: 4, color: '#8b2020' },
  { name: 'Hacha de Verdugo', slot: 'weapon', damageBonus: 7, color: '#8b2020' },
  { name: 'Armadura de Placas Rota', slot: 'armor', hpBonus: 25, color: '#4a4a4a' },
  { name: 'Cota de Malla Oxidada', slot: 'armor', hpBonus: 15, speedBonus: 0.3, color: '#4a4a4a' },
  { name: 'Amuleto del Cazador', slot: 'trinket', speedBonus: 0.8, color: '#2d6b3d' },
];

export interface BaseStats {
  maxHp: number;
  damage: number;
  speed: number;
}

const BASE_STATS: BaseStats = {
  maxHp: 100,
  damage: 12,
  speed: 6,
};

export class PlayerState {
  base: BaseStats = { ...BASE_STATS };
  equipped: Partial<Record<ItemSlot, ItemDef>> = {};
  inventory: ItemDef[] = [];
  equippedSkill: SkillDef = SKILL_POOL[0];
  currentHp: number = BASE_STATS.maxHp;
  runLoot: ItemDef[] = [];

  get maxHp(): number {
    let v = this.base.maxHp;
    for (const item of Object.values(this.equipped)) v += item?.hpBonus ?? 0;
    return v;
  }

  get damage(): number {
    let v = this.base.damage;
    for (const item of Object.values(this.equipped)) v += item?.damageBonus ?? 0;
    return v;
  }

  get speed(): number {
    let v = this.base.speed;
    for (const item of Object.values(this.equipped)) v += item?.speedBonus ?? 0;
    return v;
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

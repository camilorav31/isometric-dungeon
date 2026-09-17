import { UIManager } from './UIManager';
import {
  ItemDef,
  ItemSlot,
  PlayerState,
  RARITY_COLOR,
  RARITY_LABEL,
  RARITY_ORDER,
  SKILL_POOL,
  UPGRADE_DEFS,
} from '../state/PlayerState';
import { Player } from '../entities/Player';

const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  trinket: 'Amuleto',
};
const SLOT_ORDER: ItemSlot[] = ['weapon', 'armor', 'trinket'];

export function openCharacterPanel(ui: UIManager, state: PlayerState) {
  const equippedRows = (Object.keys(SLOT_LABELS) as ItemSlot[])
    .map((slot) => {
      const item = state.equipped[slot];
      const label = item ? `<span style="color:${RARITY_COLOR[item.rarity]}">${item.name}</span>` : '—';
      return `<div class="stat-row"><span>${SLOT_LABELS[slot]}</span><span>${label}</span></div>`;
    })
    .join('');

  const body = `
    <div class="stat-row"><span>Vida máxima</span><span>${state.maxHp}</span></div>
    <div class="stat-row"><span>Daño</span><span>${state.damage}</span></div>
    <div class="stat-row"><span>Velocidad</span><span>${state.speed.toFixed(1)}</span></div>
    <div class="stat-row"><span>Estamina máxima</span><span>${state.maxStamina}</span></div>
    <div class="stat-row"><span>Almas</span><span style="color:#d1a237">${state.souls}</span></div>
    <div style="margin-top:10px;font-size:12px;color:#a89a82;">Equipo</div>
    ${equippedRows}
  `;
  ui.showPanel('Personaje', body, () => {});
}

function itemBonusText(item: ItemDef): string {
  const parts: string[] = [];
  if (item.damageBonus) parts.push(`+${item.damageBonus} daño`);
  if (item.hpBonus) parts.push(`+${item.hpBonus} vida`);
  if (item.speedBonus) parts.push(`+${item.speedBonus} vel`);
  return parts.join(' / ');
}

export function openInventoryPanel(ui: UIManager, state: PlayerState, player: Player) {
  const render = () => {
    if (state.inventory.length === 0) {
      return '<div class="empty-note">No tienes objetos. Explora una mazmorra y recoge el loot de la sala del tesoro.</div>';
    }
    const sorted = [...state.inventory].sort((a, b) => {
      const slotDiff = SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
      if (slotDiff !== 0) return slotDiff;
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    });
    return sorted
      .map((item) => {
        const isEquipped = state.equipped[item.slot]?.id === item.id;
        const color = RARITY_COLOR[item.rarity];
        return `
          <div class="item-row" data-id="${item.id}">
            <span class="item-name" style="color:${color}">${item.name}
              <span style="color:#756a5c">(${SLOT_LABELS[item.slot]} · ${RARITY_LABEL[item.rarity]} · ${itemBonusText(item)})</span>
            </span>
            <button class="${isEquipped ? 'unequip' : ''}" data-action="${isEquipped ? 'unequip' : 'equip'}" data-id="${item.id}" data-slot="${item.slot}">
              ${isEquipped ? 'Quitar' : 'Equipar'}
            </button>
          </div>`;
      })
      .join('');
  };

  const open = () => {
    ui.showPanel('Inventario', render(), () => {}, (panelEl) => {
      panelEl.querySelectorAll('button[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          const slot = btn.getAttribute('data-slot') as ItemSlot;
          if (action === 'unequip') {
            state.unequip(slot);
          } else {
            const id = btn.getAttribute('data-id');
            const item = state.inventory.find((i) => i.id === id);
            if (item) state.equip(item);
          }
          if (slot === 'weapon') player.refreshWeaponVisual();
          open();
        });
      });
    });
  };
  open();
}

export function openSkillsPanel(ui: UIManager) {
  const body = SKILL_POOL.map(
    (skill, i) => `
        <div class="item-row">
          <span class="item-name equipped">[${i + 1}] ${skill.name} <span style="color:#756a5c">— ${skill.description}</span></span>
        </div>`,
  ).join('');
  ui.showPanel('Habilidades', body, () => {});
}

export function openUpgradesPanel(ui: UIManager, state: PlayerState, player: Player) {
  const render = () => {
    const rows = UPGRADE_DEFS.map((def) => {
      const level = state.upgrades[def.id];
      const cost = state.upgradeCost(def.id);
      const canAfford = state.souls >= cost;
      return `
        <div class="item-row" data-id="${def.id}">
          <span class="item-name">${def.name} <span style="color:#756a5c">Nv.${level} — ${def.description}</span></span>
          <button data-id="${def.id}" ${canAfford ? '' : 'disabled'}>${cost} almas</button>
        </div>`;
    }).join('');
    return `<div class="stat-row"><span>Almas disponibles</span><span style="color:#d1a237">${state.souls}</span></div>${rows}`;
  };

  const open = () => {
    ui.showPanel('Mejoras', render(), () => {}, (panelEl) => {
      panelEl.querySelectorAll('button[data-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id') as (typeof UPGRADE_DEFS)[number]['id'];
          if (state.purchaseUpgrade(id)) {
            player.syncStatsFromState();
            open();
          }
        });
      });
    });
  };
  open();
}

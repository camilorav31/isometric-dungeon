import { UIManager } from './UIManager';
import {
  BackpackEntry,
  EquipmentSlot,
  ItemDef,
  PlayerState,
  RARITY_COLOR,
  UPGRADE_DEFS,
  isRuneDef,
  skillById,
} from '../state/PlayerState';
import { Player } from '../entities/Player';
import { CharacterViewport } from './CharacterViewport';
import { renderGridHtml } from './inventoryGrid';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  helmet: 'Casco',
  armor: 'Armadura',
  boots: 'Botas',
  cape: 'Capa',
  ring: 'Anillo',
  jewel: 'Joya',
  mainHand: 'Mano Derecha',
  offHand: 'Mano Izquierda',
};
const LEFT_SLOTS: EquipmentSlot[] = ['helmet', 'armor', 'boots', 'cape'];
const RIGHT_SLOTS: EquipmentSlot[] = ['ring', 'jewel', 'mainHand', 'offHand'];

function itemBonusText(item: ItemDef): string {
  const parts: string[] = [];
  if (item.damageBonus) parts.push(`+${item.damageBonus} daño`);
  if (item.hpBonus) parts.push(`+${item.hpBonus} vida`);
  if (item.speedBonus) parts.push(`+${item.speedBonus} vel`);
  return parts.join(' / ');
}

function equipSlotHtml(state: PlayerState, slot: EquipmentSlot): string {
  const item = state.equipped[slot];
  const color = item ? RARITY_COLOR[item.rarity] : '#4a4a4a';
  const label = item ? item.name : '—';
  const sub = item ? itemBonusText(item) : '';
  return `
    <div class="equip-slot" data-slot="${slot}" style="border-color:${color}">
      <div class="equip-slot-label">${SLOT_LABELS[slot]}</div>
      <div class="equip-slot-item" style="color:${color}">${label}</div>
      <div class="equip-slot-sub">${sub}</div>
    </div>`;
}

function runeSlotHtml(label: string, key: string, name: string | null): string {
  return `
    <div class="equip-slot rune-slot" data-rune="${key}">
      <div class="equip-slot-label">${label}</div>
      <div class="equip-slot-item">${name ?? '—'}</div>
    </div>`;
}

/** Combined equipment + rune hotbar + backpack panel — the panel replaces the old
 * separate character/inventory/skills panels since equipping now happens through
 * the backpack grid instead of a flat equip/unequip list. */
export function openCharacterPanel(ui: UIManager, state: PlayerState, player: Player) {
  let selected: number | null = null;
  let viewport: CharacterViewport | null = null;

  const render = () => {
    const runeRow = `
      <div class="rune-row">
        ${state.equippedRunes.basic.map((r, i) => runeSlotHtml(`Runa ${i + 1}`, String(i), r ? skillById(r.skillId)?.name ?? r.name : null)).join('')}
        ${runeSlotHtml('Runa Ulti', 'ulti', state.equippedRunes.ulti ? skillById(state.equippedRunes.ulti.skillId)?.name ?? state.equippedRunes.ulti.name : null)}
      </div>`;

    const stats = `
      <div class="stat-row"><span>Vida máxima</span><span>${state.maxHp}</span></div>
      <div class="stat-row"><span>Daño</span><span>${state.damage}</span></div>
      <div class="stat-row"><span>Velocidad</span><span>${state.speed.toFixed(1)}</span></div>
      <div class="stat-row"><span>Estamina máxima</span><span>${state.maxStamina}</span></div>
      <div class="stat-row"><span>Almas</span><span style="color:#d1a237">${state.souls}</span></div>`;

    const expandCost = state.backpackExpandCost();
    const canExpand = state.canExpandBackpack();
    const expandBtn = canExpand
      ? `<button id="expand-backpack" ${state.souls >= expandCost ? '' : 'disabled'}>Ampliar mochila (${expandCost} almas)</button>`
      : `<div class="empty-note">Mochila al tamaño máximo (4×6)</div>`;

    return `
      <div class="equip-layout">
        <div class="equip-col">${LEFT_SLOTS.map((s) => equipSlotHtml(state, s)).join('')}</div>
        <div class="equip-center">
          <canvas id="char-viewport" width="180" height="220"></canvas>
          ${stats}
        </div>
        <div class="equip-col">${RIGHT_SLOTS.map((s) => equipSlotHtml(state, s)).join('')}</div>
      </div>
      ${runeRow}
      <div style="margin-top:12px;font-size:12px;color:#a89a82;">Mochila — selecciona un objeto y luego un slot para equiparlo</div>
      ${renderGridHtml(state.backpack, state.backpackCols, selected)}
      <div class="backpack-actions">${expandBtn}</div>
    `;
  };

  const open = () => {
    ui.showPanel(
      'Personaje',
      render(),
      () => {
        viewport?.dispose();
        viewport = null;
      },
      (panelEl) => {
        const canvas = panelEl.querySelector<HTMLCanvasElement>('#char-viewport');
        if (canvas) {
          viewport = new CharacterViewport(canvas);
          viewport.updateEquipment(state.equipped);
          viewport.start();
        }

        panelEl.querySelectorAll<HTMLElement>('.grid-cell').forEach((cell) => {
          cell.addEventListener('click', () => {
            const idx = Number(cell.getAttribute('data-index'));
            selected = selected === idx ? null : idx;
            open();
          });
        });

        panelEl.querySelectorAll<HTMLElement>('.equip-slot[data-slot]').forEach((el) => {
          el.addEventListener('click', () => {
            const slot = el.getAttribute('data-slot') as EquipmentSlot;
            if (selected !== null) {
              if (state.equipItem(selected, slot)) {
                selected = null;
                if (slot === 'mainHand') player.refreshWeaponVisual();
                open();
              }
            } else if (state.equipped[slot]) {
              state.unequipItem(slot);
              if (slot === 'mainHand') player.refreshWeaponVisual();
              open();
            }
          });
        });

        panelEl.querySelectorAll<HTMLElement>('.rune-slot').forEach((el) => {
          el.addEventListener('click', () => {
            const key = el.getAttribute('data-rune')!;
            const target: number | 'ulti' = key === 'ulti' ? 'ulti' : Number(key);
            if (selected !== null) {
              if (state.equipRune(selected, target)) {
                selected = null;
                open();
              }
            } else {
              const hasRune = target === 'ulti' ? !!state.equippedRunes.ulti : !!state.equippedRunes.basic[target];
              if (hasRune) {
                state.unequipRune(target);
                open();
              }
            }
          });
        });

        const expandBtn = panelEl.querySelector<HTMLButtonElement>('#expand-backpack');
        expandBtn?.addEventListener('click', () => {
          if (state.expandBackpack()) open();
        });
      },
    );
  };
  open();
}

export function openBankPanel(ui: UIManager, state: PlayerState) {
  const render = () => `
    <div style="font-size:12px;color:#a89a82;">Mochila — clic para depositar en el banco</div>
    ${renderGridHtml(state.backpack, state.backpackCols, null)}
    <div style="font-size:12px;color:#a89a82;margin-top:12px;">Banco — clic para retirar a la mochila</div>
    ${renderGridHtml(state.bank, state.bankCols, null)}
  `;

  const open = () => {
    ui.showPanel('Banco', render(), () => {}, (panelEl) => {
      const grids = panelEl.querySelectorAll<HTMLElement>('.item-grid');
      const backpackGrid = grids[0];
      const bankGrid = grids[1];
      backpackGrid?.querySelectorAll<HTMLElement>('.grid-cell').forEach((cell) => {
        cell.addEventListener('click', () => {
          const idx = Number(cell.getAttribute('data-index'));
          if (state.moveToBank(idx)) open();
        });
      });
      bankGrid?.querySelectorAll<HTMLElement>('.grid-cell').forEach((cell) => {
        cell.addEventListener('click', () => {
          const idx = Number(cell.getAttribute('data-index'));
          if (state.moveToBackpack(idx)) open();
        });
      });
    });
  };
  open();
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

// Re-exported so other modules can type backpack/bank entries without
// reaching into PlayerState directly.
export type { BackpackEntry };
export { isRuneDef };

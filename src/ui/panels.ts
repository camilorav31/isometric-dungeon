import { UIManager } from './UIManager';
import { ItemSlot, PlayerState, SKILL_POOL } from '../state/PlayerState';

const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  trinket: 'Amuleto',
};

export function openCharacterPanel(ui: UIManager, state: PlayerState) {
  const equippedRows = (Object.keys(SLOT_LABELS) as ItemSlot[])
    .map((slot) => {
      const item = state.equipped[slot];
      return `<div class="stat-row"><span>${SLOT_LABELS[slot]}</span><span>${item ? item.name : '—'}</span></div>`;
    })
    .join('');

  const body = `
    <div class="stat-row"><span>Vida máxima</span><span>${state.maxHp}</span></div>
    <div class="stat-row"><span>Daño</span><span>${state.damage}</span></div>
    <div class="stat-row"><span>Velocidad</span><span>${state.speed.toFixed(1)}</span></div>
    <div style="margin-top:10px;font-size:12px;color:#a89a82;">Equipo</div>
    ${equippedRows}
  `;
  ui.showPanel('Personaje', body, () => {});
}

export function openInventoryPanel(ui: UIManager, state: PlayerState) {
  const render = () => {
    if (state.inventory.length === 0) {
      return '<div class="empty-note">No tienes objetos. Explora una mazmorra y recoge el loot de la sala del tesoro.</div>';
    }
    return state.inventory
      .map((item) => {
        const isEquipped = state.equipped[item.slot]?.id === item.id;
        const bonus = item.damageBonus
          ? `+${item.damageBonus} daño`
          : item.hpBonus
            ? `+${item.hpBonus} vida${item.speedBonus ? ` / +${item.speedBonus} vel` : ''}`
            : item.speedBonus
              ? `+${item.speedBonus} vel`
              : '';
        return `
          <div class="item-row" data-id="${item.id}">
            <span class="item-name ${isEquipped ? 'equipped' : ''}">${item.name} <span style="color:#756a5c">(${SLOT_LABELS[item.slot]} · ${bonus})</span></span>
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

import { BackpackEntry, RARITY_COLOR, isRuneDef } from '../state/PlayerState';

function entryLabel(entry: NonNullable<BackpackEntry>): string {
  return isRuneDef(entry) ? '◈' : entry.name.slice(0, 2).toUpperCase();
}

function entryTitle(entry: NonNullable<BackpackEntry>): string {
  if (isRuneDef(entry)) return `${entry.name} (${entry.tier === 'ulti' ? 'Ulti' : 'Básica'})`;
  const parts: string[] = [];
  if (entry.damageBonus) parts.push(`+${entry.damageBonus} daño`);
  if (entry.hpBonus) parts.push(`+${entry.hpBonus} vida`);
  if (entry.speedBonus) parts.push(`+${entry.speedBonus} vel`);
  return `${entry.name} (${parts.join(' / ')})`;
}

/** Renders a 1-item-per-cell grid; cells carry data-index for click wiring. */
export function renderGridHtml(entries: BackpackEntry[], cols: number, selectedIndex: number | null): string {
  const cells = entries
    .map((entry, i) => {
      if (!entry) {
        return `<div class="grid-cell empty${i === selectedIndex ? ' selected' : ''}" data-index="${i}"></div>`;
      }
      const color = RARITY_COLOR[entry.rarity];
      return `<div class="grid-cell${i === selectedIndex ? ' selected' : ''}" data-index="${i}" style="border-color:${color}" title="${entryTitle(entry)}">
        <span style="color:${color}">${entryLabel(entry)}</span>
      </div>`;
    })
    .join('');
  return `<div class="item-grid" style="grid-template-columns: repeat(${cols}, 1fr);">${cells}</div>`;
}

import { Injectable, signal, computed } from '@angular/core';

const ACTIVE_KEY = 'todo-group-active';
const GROUPS_KEY = 'todo-groups';
const OLD_KEY    = 'todo-group-code';
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface SavedGroup { code: string; name: string; }

@Injectable({ providedIn: 'root' })
export class GroupService {
  readonly savedGroups = signal<SavedGroup[]>(this.init());
  readonly code        = signal<string | null>(localStorage.getItem(ACTIVE_KEY));
  readonly activeGroup = computed(() =>
    this.savedGroups().find(g => g.code === this.code()) ?? null
  );

  create(name: string): string {
    const code = Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    this.upsert(code, name || code);
    this.setActive(code);
    return code;
  }

  join(code: string, name?: string): void {
    const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!c) return;
    const existing = this.savedGroups().find(g => g.code === c);
    this.upsert(c, name ?? existing?.name ?? c);
    this.setActive(c);
  }

  leave(): void {
    localStorage.removeItem(ACTIVE_KEY);
    this.code.set(null);
  }

  rename(code: string, name: string): void {
    this.persistGroups(this.savedGroups().map(g => g.code === code ? { ...g, name } : g));
  }

  exportBackup(): void {
    const blob = new Blob([JSON.stringify(this.savedGroups(), null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'todo-groups-backup.json' });
    a.click();
    URL.revokeObjectURL(url);
  }

  importBackup(json: string): void {
    try {
      const incoming: SavedGroup[] = JSON.parse(json);
      if (!Array.isArray(incoming)) return;
      const merged = [...this.savedGroups()];
      for (const g of incoming) {
        if (g.code && g.name && !merged.find(m => m.code === g.code)) merged.push(g);
      }
      this.persistGroups(merged);
    } catch { /* invalid JSON */ }
  }

  private upsert(code: string, name: string): void {
    const groups  = this.savedGroups();
    const idx     = groups.findIndex(g => g.code === code);
    const updated = idx >= 0
      ? groups.map(g => g.code === code ? { code, name } : g)
      : [...groups, { code, name }];
    this.persistGroups(updated);
  }

  private setActive(code: string): void {
    localStorage.setItem(ACTIVE_KEY, code);
    this.code.set(code);
  }

  private persistGroups(groups: SavedGroup[]): void {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    this.savedGroups.set(groups);
  }

  private init(): SavedGroup[] {
    // migrate from old single-code storage
    const old = localStorage.getItem(OLD_KEY);
    if (old && !localStorage.getItem(GROUPS_KEY)) {
      const groups = [{ code: old, name: old }];
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
      localStorage.setItem(ACTIVE_KEY, old);
      localStorage.removeItem(OLD_KEY);
      return groups;
    }
    try { return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]'); } catch { return []; }
  }
}

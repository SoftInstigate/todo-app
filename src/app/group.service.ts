import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'todo-group-code';
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable({ providedIn: 'root' })
export class GroupService {
  readonly code = signal<string | null>(localStorage.getItem(STORAGE_KEY));

  create(): string {
    const code = Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    this.set(code);
    return code;
  }

  join(code: string): void {
    this.set(code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
  }

  leave(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.code.set(null);
  }

  private set(code: string): void {
    localStorage.setItem(STORAGE_KEY, code);
    this.code.set(code);
  }
}

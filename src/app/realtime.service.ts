import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../environments/environment';

export type ChangeTarget = 'todos' | 'swimlanes';
export type ChangeEvent =
  | { op: 'upsert'; target: ChangeTarget }
  | { op: 'delete'; target: 'todos'; id: string };

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private changes$ = new Subject<ChangeEvent>();
  readonly changes = this.changes$.asObservable();
  readonly connected = signal(false);

  private sockets: WebSocket[] = [];
  private active = false;

  connect(groupId: string) {
    this.disconnect();
    this.active = true;
    const wsBase = environment.restheartUrl.replace(/^http/, 'ws');
    const avars = encodeURIComponent(JSON.stringify({ groupId }));
    const qs = `groupId=${groupId}&avars=${avars}`;
    this.openSocket(`${wsBase}/todos/_streams/changes?${qs}`, 'todos');
    this.openSocket(`${wsBase}/swimlanes/_streams/changes?${qs}`, 'swimlanes');
  }

  disconnect() {
    this.active = false;
    this.sockets.forEach(ws => ws.close(1000));
    this.sockets = [];
    this.connected.set(false);
  }

  private openSocket(url: string, target: ChangeTarget) {
    if (!this.active) return;
    const ws = new WebSocket(url);
    this.sockets.push(ws);

    ws.onopen = () => {
      if (this.sockets.length === 2 && this.sockets.every(s => s.readyState === WebSocket.OPEN)) {
        this.connected.set(true);
      }
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (target === 'todos' && msg.operationType === 'delete') {
          const id = msg.documentKey?._id?.$oid;
          if (id) this.changes$.next({ op: 'delete', target: 'todos', id });
        } else {
          this.changes$.next({ op: 'upsert', target });
        }
      } catch {
        this.changes$.next({ op: 'upsert', target });
      }
    };
    ws.onerror = () => ws.close();
    ws.onclose = (e) => {
      this.sockets = this.sockets.filter(s => s !== ws);
      this.connected.set(false);
      if (this.active && e.code !== 1000) {
        setTimeout(() => this.openSocket(url, target), 3000);
      }
    };
  }
}

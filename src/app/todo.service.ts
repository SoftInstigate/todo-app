import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, expand, reduce, EMPTY } from 'rxjs';
import { GroupService } from './group.service';
import { environment } from '../environments/environment';

const BASE = `${environment.restheartUrl}/todos`;
const HEADERS = new HttpHeaders({ 'Content-Type': 'application/json' });

export type Status = 'open' | 'in-progress' | 'blocked' | 'closed' | 'closed_and_forgot';

export interface Todo {
  _id?: { $oid: string };
  title: string;
  status: Status;
  groupId?: string;
  swimlaneId?: string;
  assignees?: string[];
  notes?: string;
  tags?: string[];
  dependsOn?: string[];
  order?: number;
  createdAt: { $date: number };
  closedAt?: { $date: number };
}

@Injectable({ providedIn: 'root' })
export class TodoService {
  private http = inject(HttpClient);
  private groupSvc = inject(GroupService);

  private get groupId() {
    return this.groupSvc.code()!;
  }

  getAll(includeForgotten = false) {
    const params: Record<string, string> = { groupId: this.groupId };
    if (!includeForgotten) {
      params['filter'] = JSON.stringify({ status: { $ne: 'closed_and_forgot' } });
    }
    const fetchPage = (page: number) =>
      this.http.get<Todo[]>(BASE, { headers: HEADERS, params: { ...params, page: String(page) } });
    return fetchPage(1).pipe(
      expand((todos, index) => todos.length > 0 ? fetchPage(index + 2) : EMPTY),
      reduce((acc, todos) => [...acc, ...todos], [] as Todo[]),
    );
  }

  create(data: { title: string; notes?: string; tags?: string[]; swimlaneId?: string; assignees?: string[] }) {
    return this.http.post(BASE, {
      title: data.title,
      status: 'open',
      swimlaneId: data.swimlaneId,
      assignees: data.assignees ?? [],
      notes: data.notes ?? '',
      tags: data.tags ?? [],
      createdAt: { $date: Date.now() },
    }, { headers: HEADERS, params: { groupId: this.groupId } });
  }

  update(todo: Todo, patch: { title?: string; notes?: string; tags?: string[]; assignees?: string[]; status?: Status; swimlaneId?: string; dependsOn?: string[]; order?: number }) {
    const id = todo._id!.$oid;
    const $set: any = { ...patch };
    const body: any = { $set };
    if (patch.status === 'closed' && todo.status !== 'closed') {
      $set.closedAt = { $date: Date.now() };
    } else if (patch.status && patch.status !== 'closed' && todo.status === 'closed') {
      body.$unset = { closedAt: '' };
    }
    return this.http.patch(`${BASE}/${id}`, body, {
      headers: HEADERS,
      params: { groupId: this.groupId },
    });
  }

  hasBySwimlane(swimlaneId: string) {
    return this.http.get<Todo[]>(BASE, {
      headers: HEADERS,
      params: { groupId: this.groupId, filter: JSON.stringify({ swimlaneId }), pagesize: '1' },
    }).pipe(map(todos => todos.length > 0));
  }

  delete(todo: Todo) {
    return this.http.delete(`${BASE}/${todo._id!.$oid}`, {
      headers: HEADERS,
      params: { groupId: this.groupId },
    });
  }
}

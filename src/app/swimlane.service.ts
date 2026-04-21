import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { GroupService } from './group.service';

const BASE = 'https://acac36.eu-central-1-free-1.restheart.com/swimlanes';
const HEADERS = new HttpHeaders({ 'Content-Type': 'application/json' });

export interface Swimlane {
  _id?: { $oid: string };
  name: string;
  order: number;
  groupId?: string;
}

@Injectable({ providedIn: 'root' })
export class SwimlaneService {
  private http = inject(HttpClient);
  private groupSvc = inject(GroupService);

  private get groupId() {
    return this.groupSvc.code()!;
  }

  getAll() {
    return this.http.get<Swimlane[]>(BASE, {
      headers: HEADERS,
      params: { groupId: this.groupId, sort: '{"order":1}' },
    });
  }

  create(name: string, order: number) {
    return this.http.post(BASE, { name, order }, {
      headers: HEADERS,
      params: { groupId: this.groupId },
    });
  }

  rename(lane: Swimlane, name: string) {
    return this.http.patch(`${BASE}/${lane._id!.$oid}`, { name }, {
      headers: HEADERS,
      params: { groupId: this.groupId },
    });
  }

  reorder(swimlanes: Swimlane[]) {
    return forkJoin(
      swimlanes.map((lane, i) =>
        this.http.patch(`${BASE}/${lane._id!.$oid}`, { order: i }, {
          headers: HEADERS,
          params: { groupId: this.groupId },
        })
      )
    );
  }

  delete(lane: Swimlane) {
    return this.http.delete(`${BASE}/${lane._id!.$oid}`, {
      headers: HEADERS,
      params: { groupId: this.groupId },
    });
  }
}

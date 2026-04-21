import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { TodoService, Todo, Status } from './todo.service';
import { SwimlaneService, Swimlane } from './swimlane.service';
import { GroupService } from './group.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DragDropModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private todoSvc = inject(TodoService);
  private laneSvc = inject(SwimlaneService);
  readonly groupSvc = inject(GroupService);

  todos      = signal<Todo[]>([]);
  swimlanes  = signal<Swimlane[]>([]);
  showForm   = signal(false);
  showLaneForm  = false;
  confirmingId: string | null = null;
  renamingId:   string | null = null;
  renameValue = '';
  justCreatedCode: string | null = null;
  copied = false;

  // group screen
  newGroupName = '';
  newGroupCode = '';

  // group rename in header
  renamingGroup = false;
  renameGroupValue = '';

  // task detail panel
  selectedTodo = signal<Todo | null>(null);
  editForm = { title: '', notes: '', tags: '', swimlaneId: '', status: 'open' as Status };
  editAssignees: string[] = [];
  editPendingAssignee = '';

  readonly statuses: Status[] = ['open', 'in-progress', 'blocked', 'closed'];
  readonly statusLabels: Record<Status, string> = {
    'open': 'Open', 'in-progress': 'In Progress', 'blocked': 'Blocked', 'closed': 'Closed',
  };

  form = { title: '', notes: '', tags: '', swimlaneId: '' };
  formAssignees: string[] = [];
  pendingAssignee = '';
  newLaneName = '';

  allCardListIds = computed(() =>
    this.swimlanes().flatMap(lane =>
      this.statuses.map(s => `cell-${lane._id!.$oid}-${s}`)
    )
  );

  allAssignees = computed(() => {
    const names = new Set<string>();
    this.todos().forEach(t => t.assignees?.forEach(n => names.add(n)));
    return [...names].sort();
  });

  ngOnInit() {
    if (this.groupSvc.code()) this.loadAll();
  }

  loadAll() {
    this.todoSvc.getAll().subscribe(t => this.todos.set(t));
    this.laneSvc.getAll().subscribe(lanes => {
      if (lanes.length === 0) {
        this.laneSvc.create('Default', 0).subscribe(() =>
          this.laneSvc.getAll().subscribe(l => {
            this.swimlanes.set(l);
            this.form.swimlaneId = l[0]._id!.$oid;
          })
        );
      } else {
        this.swimlanes.set(lanes);
        if (!this.form.swimlaneId) this.form.swimlaneId = lanes[0]._id!.$oid;
      }
    });
  }

  // ── Group ────────────────────────────────────────────────────────────────────

  createGroup() {
    const name = this.newGroupName.trim() || 'New group';
    const code = this.groupSvc.create(name);
    this.newGroupName = '';
    this.justCreatedCode = code;
    this.loadAll();
  }

  joinGroup() {
    if (!this.newGroupCode.trim()) return;
    this.groupSvc.join(this.newGroupCode);
    this.newGroupCode = '';
    this.justCreatedCode = null;
    this.todos.set([]);
    this.swimlanes.set([]);
    this.form.swimlaneId = '';
    this.loadAll();
  }

  switchGroup(code: string) {
    this.groupSvc.join(code);
    this.justCreatedCode = null;
    this.todos.set([]);
    this.swimlanes.set([]);
    this.form.swimlaneId = '';
    this.loadAll();
  }

  leaveGroup() {
    this.groupSvc.leave();
    this.todos.set([]);
    this.swimlanes.set([]);
    this.justCreatedCode = null;
    this.form.swimlaneId = '';
    this.selectedTodo.set(null);
  }

  copyCode() {
    navigator.clipboard.writeText(this.groupSvc.code()!);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  startGroupRename() {
    this.renameGroupValue = this.groupSvc.activeGroup()?.name ?? '';
    this.renamingGroup = true;
  }

  commitGroupRename() {
    this.renamingGroup = false;
    const name = this.renameGroupValue.trim();
    if (name && this.groupSvc.code()) this.groupSvc.rename(this.groupSvc.code()!, name);
  }

  importBackup(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => this.groupSvc.importBackup(e.target?.result as string);
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }

  // ── Task panel ───────────────────────────────────────────────────────────────

  openTask(todo: Todo, event: MouseEvent) {
    event.stopPropagation();
    if (this.selectedTodo()?._id?.$oid === todo._id?.$oid) {
      this.selectedTodo.set(null);
      return;
    }
    this.editForm = {
      title:      todo.title,
      notes:      todo.notes ?? '',
      tags:       (todo.tags ?? []).join(', '),
      swimlaneId: todo.swimlaneId ?? this.swimlanes()[0]?._id?.$oid ?? '',
      status:     todo.status,
    };
    this.editAssignees = [...(todo.assignees ?? [])];
    this.editPendingAssignee = '';
    this.selectedTodo.set(todo);
  }

  closeTask() { this.selectedTodo.set(null); }

  saveTask() {
    const todo = this.selectedTodo();
    if (!todo || !this.editForm.title.trim()) return;
    if (this.editPendingAssignee.trim()) this.addEditAssignee(this.editPendingAssignee);
    const tags = this.editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
    this.todoSvc.update(todo, {
      title:      this.editForm.title.trim(),
      notes:      this.editForm.notes.trim(),
      tags,
      assignees:  [...this.editAssignees],
      status:     this.editForm.status,
      swimlaneId: this.editForm.swimlaneId,
    }).subscribe(() => {
      this.selectedTodo.set(null);
      this.todoSvc.getAll().subscribe(t => this.todos.set(t));
    });
  }

  addEditAssignee(name: string) {
    const n = name.trim();
    if (n && !this.editAssignees.includes(n)) this.editAssignees.push(n);
    this.editPendingAssignee = '';
  }

  onEditAssigneeKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addEditAssignee(this.editPendingAssignee);
    }
  }

  removeEditAssignee(name: string) {
    this.editAssignees = this.editAssignees.filter(a => a !== name);
  }

  // ── Board ────────────────────────────────────────────────────────────────────

  getCards(laneId: string, status: Status): Todo[] {
    const fallbackId = this.swimlanes()[0]?._id?.$oid;
    return this.todos().filter(t =>
      (t.swimlaneId ?? fallbackId) === laneId && t.status === status
    );
  }

  addAssignee(name: string) {
    const n = name.trim();
    if (n && !this.formAssignees.includes(n)) this.formAssignees.push(n);
    this.pendingAssignee = '';
  }

  onAssigneeKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addAssignee(this.pendingAssignee);
    }
  }

  removeAssignee(name: string) {
    this.formAssignees = this.formAssignees.filter(a => a !== name);
  }

  addTodo() {
    if (!this.form.title.trim()) return;
    if (this.pendingAssignee.trim()) this.addAssignee(this.pendingAssignee);
    const tags = this.form.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    this.todoSvc.create({
      title: this.form.title.trim(),
      notes: this.form.notes.trim(),
      tags,
      assignees: [...this.formAssignees],
      swimlaneId: this.form.swimlaneId || this.swimlanes()[0]?._id?.$oid,
    }).subscribe(() => {
      this.form = { ...this.form, title: '', notes: '', tags: '' };
      this.formAssignees = [];
      this.showForm.set(false);
      this.todoSvc.getAll().subscribe(t => this.todos.set(t));
    });
  }

  onCardDrop(event: CdkDragDrop<{ laneId: string; status: Status }>) {
    if (event.previousContainer === event.container) return;
    const todo: Todo = event.item.data;
    const { laneId, status } = event.container.data;
    this.todoSvc.update(todo, { status, swimlaneId: laneId }).subscribe(() =>
      this.todoSvc.getAll().subscribe(t => this.todos.set(t))
    );
  }

  onLaneDrop(event: CdkDragDrop<Swimlane[]>) {
    const lanes = [...this.swimlanes()];
    moveItemInArray(lanes, event.previousIndex, event.currentIndex);
    this.swimlanes.set(lanes);
    this.laneSvc.reorder(lanes).subscribe();
  }

  addLane() {
    if (!this.newLaneName.trim()) return;
    this.laneSvc.create(this.newLaneName.trim(), this.swimlanes().length).subscribe(() => {
      this.newLaneName = '';
      this.showLaneForm = false;
      this.laneSvc.getAll().subscribe(l => this.swimlanes.set(l));
    });
  }

  startRename(lane: Swimlane) { this.renamingId = lane._id!.$oid; this.renameValue = lane.name; }
  commitRename(lane: Swimlane) {
    const name = this.renameValue.trim();
    this.renamingId = null;
    if (!name || name === lane.name) return;
    this.laneSvc.rename(lane, name).subscribe(() =>
      this.laneSvc.getAll().subscribe(l => this.swimlanes.set(l))
    );
  }

  deleteLane(lane: Swimlane) {
    this.laneSvc.delete(lane).subscribe(() =>
      this.laneSvc.getAll().subscribe(l => this.swimlanes.set(l))
    );
  }

  askDelete(todo: Todo) { this.confirmingId = todo._id!.$oid; }
  cancelDelete() { this.confirmingId = null; }
  confirmDelete(todo: Todo) {
    this.confirmingId = null;
    if (this.selectedTodo()?._id?.$oid === todo._id?.$oid) this.selectedTodo.set(null);
    this.todoSvc.delete(todo).subscribe(() =>
      this.todoSvc.getAll().subscribe(t => this.todos.set(t))
    );
  }

  initials(name: string) {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
  }

  formatDate(d?: { $date: number }) {
    if (!d) return '';
    return new Date(d.$date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

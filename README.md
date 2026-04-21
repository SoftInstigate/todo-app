# Todo Board

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031?logo=angular)](https://angular.dev)
[![RESTHeart Cloud](https://img.shields.io/badge/RESTHeart-Cloud-7c6fff)](https://cloud.restheart.org)

> A collaborative Kanban board with zero backend code — powered by **RESTHeart Cloud**.

![Todo Board screenshot](https://todo.softinstigate.com/preview.png)

---

## Features

| | |
|---|---|
| 🗂 **Kanban board** | Swimlanes × status columns: Open · In Progress · Blocked · Closed |
| 🖱 **Drag & drop** | Move cards across columns and reorder swimlanes |
| 👥 **Group codes** | Share an 8-char code with your team — no login required |
| 🔒 **Server-side isolation** | RESTHeart ACL ensures each group sees only its own data |
| 🙋 **Assignees** | Autocomplete from names already used in the group |
| 🏷 **Tags & notes** | Attach metadata to every task |
| 💾 **Backup / restore** | Export and import your group codes as JSON |
| 📱 **Responsive** | Works on mobile — task panel slides up as a bottom sheet |
| 🌙 **Dark theme** | Easy on the eyes |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone components, signals) |
| Drag & drop | `@angular/cdk/drag-drop` |
| Backend | [RESTHeart Cloud](https://cloud.restheart.org) — managed REST API on MongoDB |
| Styling | CSS custom properties · Inter font |

---

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/SoftInstigate/todo-app.git
cd todo-app
npm install
```

### 2. Create a RESTHeart Cloud account

1. Sign up at [cloud.restheart.org](https://cloud.restheart.org) — the free tier is enough.
2. Create a new instance and wait for it to be provisioned.
3. Open the instance dashboard and copy the **Instance URL**:
   ```
   https://xxxx.eu-central-1-free-1.restheart.com
   ```
4. Note the **root password** you set during provisioning (also visible under *Credentials* in the dashboard).

### 3. Initialize the backend

The script requires [HTTPie](https://httpie.io) — install it with `brew install httpie` on macOS.

```bash
./scripts/init-backend.sh <instance-url> <root-user> <root-password>
```

```bash
# Example
./scripts/init-backend.sh https://xxxx.eu-central-1-free-1.restheart.com root mypassword
```

The script sets up:
- `todos` and `swimlanes` collections
- `_schemas` store + `todo` JSON Schema validation
- ACL rules for the `$unauthenticated` role (see [Security model](#security-model))

### 4. Configure the frontend

Create `src/environments/environment.prod.ts` with your instance URL:

```typescript
export const environment = {
  restheartUrl: 'https://xxxx.eu-central-1-free-1.restheart.com',
};
```

> This file is listed in `.gitignore` — your URL stays private.

For local development, edit `src/environments/environment.ts` instead.

### 5. Run

```bash
ng serve
```

Open **http://localhost:4200**.

On first visit, create a group (generates a shareable 8-character code) or join one with an existing code. Share the code with your team — anyone who has it can access the same board. Use **Export backup** on the home screen to save your group codes and restore them on another device.

---

## Security model

The app sends **no credentials**. Access control is enforced entirely on the server by RESTHeart ACL.

Every request includes `?groupId=<code>`. The ACL rules for both `/todos` and `/swimlanes` are:

| Property | Value |
|---|---|
| Role | `$unauthenticated` |
| Predicate | `path-prefix("/todos") and qparams-contain(groupId)` |
| `readFilter` | `{"groupId": "@qparams['groupId']"}` |
| `writeFilter` | `{"groupId": "@qparams['groupId']"}` |
| `mergeRequest` | `{"groupId": "@qparams['groupId']"}` |

- Requests **without** `groupId` are rejected (403).
- `readFilter` / `writeFilter` scope every read and write to the caller's group.
- `mergeRequest` auto-injects `groupId` into every new document — the client never sends it explicitly.

The group code is the shared secret. It is intentionally simple and suited for low-stakes team collaboration.

---

## Project structure

```
src/
  app/
    app.ts                 ← Kanban board component
    app.html               ← template
    app.css                ← dark theme styles
    todo.service.ts        ← CRUD for tasks
    swimlane.service.ts    ← CRUD for swimlanes
    group.service.ts       ← group code · backup · restore
  environments/
    environment.ts         ← dev (localhost)
    environment.prod.ts    ← production URL (git-ignored)
scripts/
  init-backend.sh          ← one-shot backend setup
```

---

## How it was built

This application was written entirely with **[Claude Code](https://claude.ai/code)** (Anthropic) — no code was written manually.

- The **Angular frontend** was scaffolded and developed through a conversation with Claude Code, which wrote all components, services, drag & drop logic, and styles.
- The **RESTHeart Cloud backend** was configured using the **Sophia MCP server** — an MCP tool that gives Claude Code direct access to the RESTHeart documentation. This allowed Claude to autonomously set up collections, JSON Schema validation, and ACL rules by querying the docs and running `httpie` commands.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

# Todo Board

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

A collaborative Kanban board backed by RESTHeart Cloud. Teams share a group code to access a shared board with swimlanes, drag-and-drop cards across Open / In Progress / Blocked / Closed columns, assignees, tags, and notes. No login required — RESTHeart ACL rules enforce data isolation via a `groupId` query parameter.

## What it does

- **Kanban board** with swimlanes (rows) and status columns: Open · In Progress · Blocked · Closed
- **Drag & drop** cards between columns (changes status) and between swimlanes
- **Swimlane reordering** via drag & drop on the row handle
- **Group codes** — generate a shareable code to collaborate with your team, no login required
- **Assignees** with autocomplete from names already used in the group
- **Tags** and **notes** on each task
- **Dark theme**
- Data persisted on **MongoDB** via RESTHeart Cloud REST API

## How it was created

This application was built entirely with **[Claude Code](https://claude.ai/code)** (Anthropic).

- The **Angular frontend** was scaffolded and iteratively developed through a conversation with Claude Code, which wrote all components, services, drag & drop logic, and styles.
- The **RESTHeart Cloud backend** was configured using the **Sophia MCP server** — an MCP tool that gives Claude Code access to the RESTHeart documentation knowledge base. This allowed Claude to autonomously set up collections, JSON Schema validation, ACL rules, and users by querying the docs and executing `httpie` commands directly.

No code was written manually.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone, signals) |
| Drag & drop | `@angular/cdk/drag-drop` |
| Backend | [RESTHeart Cloud](https://cloud.restheart.org) (managed REST API on MongoDB) |
| Styling | CSS custom properties, Inter font |

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/SoftInstigate/todo-app.git
cd todo-app
npm install
```

### 2. Create a RESTHeart Cloud account

1. Go to [cloud.restheart.org](https://cloud.restheart.org) and sign up for a free account.
2. Create a new instance. Once provisioned, open the instance dashboard.
3. Copy the **Instance URL** — it looks like `https://xxxx.eu-central-1-free-1.restheart.com`. You will need it in the next steps.
4. Note the **root password** you set during provisioning (or find it in the dashboard under *Credentials*).

### 3. Initialize the backend

Run the initialization script with your instance URL and root credentials. It requires [HTTPie](https://httpie.io) (`brew install httpie`).

```bash
./scripts/init-backend.sh <instance-url> <root-user> <root-password>
```

**Example:**
```bash
./scripts/init-backend.sh https://xxxx.eu-central-1-free-1.restheart.com root mypassword
```

The script creates:
- `todos` and `swimlanes` collections
- `_schemas` store with the `todo` JSON Schema
- ACL rules for the `$unauthenticated` role (see [Security model](#security-model))

### 4. Configure the frontend

Create the file `src/environments/environment.prod.ts` with your instance URL:

```typescript
export const environment = {
  restheartUrl: 'https://xxxx.eu-central-1-free-1.restheart.com',
};
```

> `environment.prod.ts` is excluded from git (`.gitignore`) so your URL stays private.

### 5. Run the app

```bash
ng serve
```

Open `http://localhost:4200`.

On first visit you will be prompted to **create a group** (generates a shareable 8-character code) or **join an existing group** by entering a code. Share the code with your team — anyone with it can access the same board. The code is stored in `localStorage`; use **Export backup** to save your group codes and restore them on another device.

## Security model

The app uses **no HTTP authentication**. Security is enforced entirely by RESTHeart's ACL on the server side, using the `groupId` query parameter as the access key.

### How it works

Every request from the Angular frontend includes `?groupId=<code>` (e.g. `GET /todos?groupId=AB3X9KQZ`). The RESTHeart ACL rules are configured as follows:

| Property | Value |
|---|---|
| Role | `$unauthenticated` (no login required) |
| Predicate | `path-prefix("/todos") and qparams-contain(groupId)` |
| `readFilter` | `{"groupId": "@qparams['groupId']"}` |
| `writeFilter` | `{"groupId": "@qparams['groupId']"}` |
| `mergeRequest` | `{"groupId": "@qparams['groupId']"}` |

- **`qparams-contain(groupId)`** — requests without a `groupId` param are rejected (403).
- **`readFilter`** — MongoDB filter automatically applied to every read; users can only see documents belonging to their group.
- **`writeFilter`** — same constraint applied to writes; users cannot modify documents from other groups.
- **`mergeRequest`** — the `groupId` field is automatically injected into every created document, so the client never needs to send it explicitly.

The group code is the shared secret. Anyone who knows it can read and write that group's data — it is intentionally simple and suitable for low-stakes collaboration.

## Project structure

```
src/app/
  group.service.ts      ← group code management (localStorage)
  todo.service.ts       ← CRUD for todos (RESTHeart REST API)
  swimlane.service.ts   ← CRUD for swimlanes
  app.ts                ← Kanban board component
  app.html              ← template
  app.css               ← dark theme styles
scripts/
  init-backend.sh       ← backend initialization script
```

## Development server

```bash
ng serve
```

## Build

```bash
ng build
```

## License

Apache 2.0 — see [LICENSE](LICENSE).

# SnowyOS ❄️

> A shimmering, glassy browser-native desktop OS concept with floating apps, playful motion, and a calm northlight palette.

**Version:** 2.0.0  
**Tech:** Vanilla HTML5, CSS3, ES5+ JavaScript  
**Dependencies:** Zero  
**Build:** None required — just open `index.html` in a browser

---

## 🖥️ Features

### Core System
- **Lock Screen** — Animated lock screen with live clock/date, click "Enter SnowyOS" to unlock
- **Top Bar** — Brand, live clock, session indicator, start menu, workspaces, control center, notifications, user chip
- **Start Menu** — Searchable app launcher with pinned apps grid and full app list
- **Workspaces** — Create and switch between multiple virtual workspaces
- **Notification Center** — Persistent notifications with unread badge, clear all
- **Control Center** — Quick toggles for brightness, volume, focus, snow mode, night shift, animations
- **Taskbar** — Shows all open windows, click to focus/minimize
- **Context Menu** — Right-click desktop for quick actions (refresh, settings, terminal, notes, about)
- **Keyboard Shortcuts** — `Ctrl+E` terminal, `Ctrl+N` notes, `Ctrl+S` settings, `Ctrl+Shift+L` lock, `Esc` close panels
- **Toast Notifications** — Animated toast messages for system events

### Window Management
- **Draggable Windows** — Drag by title bar
- **Close / Minimize / Maximize** — macOS-style traffic light dots
- **Pin Windows** — Keep windows on top
- **Z-Ordering** — Click to bring to front
- **Resizable** — Maximize fills viewport

### Built-in Apps (15 total)

#### Productivity
| App | Description |
|-----|-------------|
| **Files** | Virtual file system browser with directories and recent files |
| **Notes** | Text editor with auto-save to localStorage |
| **Browser** | Mock search UI with filterable results |
| **Terminal** | Full shell with 20+ commands (help, neofetch, cowsay, matrix, hack, etc.) |
| **Paint** | Drawing canvas with brush, eraser, line, rectangle, circle tools, color picker, size control, save/export |
| **Calculator** | Full calculator with +, −, ×, ÷, %, ±, backspace |
| **Calendar** | Monthly calendar view with navigation, today highlight |
| **Music** | Music player with playlist, play/pause, next/prev, progress bar, spinning album art |
| **System Monitor** | Live CPU, memory, disk, network stats with progress bars |
| **Settings** | Theme picker (6 themes), username, system info, data export/clear |

#### Games
| App | Description |
|-----|-------------|
| **Snake** | Classic snake game with score tracking, high score persistence, D-pad controls |
| **Tetris** | Full Tetris with piece preview, line clearing, levels, scoring, keyboard + pause |
| **2048** | Sliding tile puzzle with score, high score, D-pad controls |
| **Minesweeper** | 9×9 grid with 10 mines, safe first click, right-click flagging, flood-fill reveal |

#### Communication
| App | Description |
|-----|-------------|
| **Chat** | Chat bot with TEST placeholder — ready for API integration. Echoes messages back with randomized test responses |

---

## 🎨 Themes

Six built-in themes switchable via Settings:

| Theme | Accent Colors |
|-------|--------------|
| **Dark** | Default dark with cyan/purple |
| **Light** | Light background with dark text |
| **Aurora** | Blue accent tones |
| **Sunset** | Warm orange/yellow |
| **Forest** | Green tones |
| **Rose** | Pink/purple tones |

---

## 🏗️ Architecture

### Event Bus
Central pub/sub system for decoupled communication between modules:
```js
EventBus.on("unlock", callback);
EventBus.emit("unlock");
EventBus.off("unlock", callback);
```

### Virtual File System (VFS)
In-memory file system backed by localStorage:
```js
VFS.ls("/");           // List directory
VFS.read("/path");     // Read file
VFS.write("/path", c); // Write file
VFS.mkdir("/path");    // Create directory
```

### Settings Store
Persistent settings with defaults and change events:
```js
Settings.get("theme");
Settings.set("theme", "aurora");
Settings.getAll();
```

### Notification System
Persistent notifications with badge counting:
```js
Notifications.add("Title", "Body");
Notifications.clear();
```

### Window Manager (WM)
Centralized window lifecycle management:
```js
WM.create(app, title, content, opts);
WM.close(id);
WM.minimize(id);
WM.maximize(id);
WM.focus(id);
```

### App Renderer Pattern
Each app is a self-contained module with `title`, `window` config, `render()` returning HTML string, and optional `init(win)` for post-render setup:
```js
AppRenderers.myapp = {
  title: "My App",
  window: { width: 500, height: 400 },
  render: function() { return "<div>...</div>"; },
  init: function(win) { /* setup event listeners */ }
};
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + E` | Open Terminal |
| `Ctrl + N` | Open Notes |
| `Ctrl + S` | Open Settings |
| `Ctrl + Shift + L` | Lock Screen |
| `Esc` | Close all panels |

---

## 🐚 Terminal Commands

| Command | Description |
|---------|-------------|
| `help` | List all commands |
| `about` | About SnowyOS |
| `time` | Current time |
| `date` | Current date |
| `whoami` | Current user |
| `uname` | System info |
| `pwd` | Current directory |
| `uptime` | System uptime |
| `ls` | List files |
| `cat <file>` | Read file |
| `echo <msg>` | Print message |
| `clear` | Clear terminal |
| `neofetch` | System info display |
| `fortune` | Random fortune |
| `cowsay <msg>` | ASCII cow |
| `calc <expr>` | Evaluate math |
| `matrix` | Matrix rain effect |
| `hack` | Fake hack sequence |
| `color` | Show color palette |

---

## 📁 File Structure

```
SnowyOS/
├── index.html    # HTML structure, templates, panels
├── style.css     # All styles, themes, animations, responsive
└── app.js        # All JS: architecture, apps, games, features
```

---

## 💾 Data Persistence

All data stored in `localStorage`:
- `snowy-settings` — User preferences
- `snowy-notes` — Notes content
- `snowy-vfs` — Virtual file system
- `snowy-notifications` — Notification history
- `snowy-snake-best` — Snake high score
- `snowy-2048-best` — 2048 high score

Export all data via Settings → Export Data (downloads JSON).

---

## 🚀 Getting Started

1. Clone or download the repository
2. Open `index.html` in any modern browser
3. Click "Enter SnowyOS" on the lock screen
4. Use the dock, start menu, or right-click to launch apps

No build step, no dependencies, no server required.

---

## 🎮 Games Controls

### Snake
- **Start/Pause** buttons or arrow keys
- **D-pad** for touch/mobile

### Tetris
- **← →** Move piece
- **↑** Rotate
- **↓** Soft drop
- **Space** Hard drop

### 2048
- **Arrow keys** or **D-pad** to slide tiles

### Minesweeper
- **Left click** to reveal
- **Right click** to flag

---

## 🧩 Extending SnowyOS

Add a new app by registering a renderer:

```js
AppRenderers.myapp = {
  title: "My App",
  window: { width: 500, height: 400 },
  render: function() {
    return '<div class="my-app">Hello World</div>';
  },
  init: function(win) {
    // Set up event listeners on win.body
  }
};
```

Then add a dock icon in `index.html`:
```html
<button class="dock-icon" data-app="myapp">🚀<span>MyApp</span></button>
```

---

## 📝 License

Creative concept project — use freely.

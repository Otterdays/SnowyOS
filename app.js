(function() {
  "use strict";

  var EventBus = {
    _listeners: {},
    on: function(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
      var self = this;
      return function() { self.off(event, fn); };
    },
    off: function(event, fn) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(function(f) { return f !== fn; });
    },
    emit: function(event, data) {
      if (!this._listeners[event]) return;
      this._listeners[event].forEach(function(fn) { fn(data); });
    }
  };

  var VFS = {
    _data: JSON.parse(localStorage.getItem("snowy-vfs") || "null") || {
      "/": { type: "dir", children: ["Documents", "Music", "Pictures", "Projects", "Logs"] },
      "/Documents": { type: "dir", children: ["readme.txt", "notes.md"] },
      "/Documents/readme.txt": { type: "file", content: "Welcome to SnowyOS!" },
      "/Documents/notes.md": { type: "file", content: "# Notes" },
      "/Music": { type: "dir", children: ["glacier-glow.mp3", "aurora-drift.mp3", "frost-beat.mp3"] },
      "/Pictures": { type: "dir", children: ["snowscape.png", "aurora.jpg", "frost.png"] },
      "/Projects": { type: "dir", children: ["snowy-os", "aurora-kit"] },
      "/Logs": { type: "dir", children: ["system.log"] }
    },
    save: function() { localStorage.setItem("snowy-vfs", JSON.stringify(this._data)); },
    ls: function(p) { var n = this._data[p]; return n && n.type === "dir" ? n.children : []; },
    read: function(p) { var n = this._data[p]; return n && n.type === "file" ? n.content : null; },
    write: function(p, content) { this._data[p] = { type: "file", content: content }; this.save(); },
    mkdir: function(p) { if (this._data[p]) return; this._data[p] = { type: "dir", children: [] }; this.save(); },
    exists: function(p) { return !!this._data[p]; }
  };

  var Settings = {
    _defaults: { theme: "dark", username: "Guest", brightness: 80, volume: 50, focus: false, snow: true, night: false, animations: true, autoLaunch: ["files", "notes"] },
    get: function(key) { var s = JSON.parse(localStorage.getItem("snowy-settings") || "{}"); return s[key] !== undefined ? s[key] : this._defaults[key]; },
    set: function(key, val) { var s = JSON.parse(localStorage.getItem("snowy-settings") || "{}"); s[key] = val; localStorage.setItem("snowy-settings", JSON.stringify(s)); EventBus.emit("setting-change", { key: key, val: val }); },
    getAll: function() { var d = JSON.parse(JSON.stringify(this._defaults)); var s = JSON.parse(localStorage.getItem("snowy-settings") || "{}"); for (var k in s) d[k] = s[k]; return d; }
  };

  var Notifications = {
    _items: JSON.parse(localStorage.getItem("snowy-notifications") || "[]"),
    add: function(title, body) {
      var item = { id: Date.now(), title: title, body: body, time: new Date().toLocaleTimeString(), read: false };
      this._items.unshift(item);
      if (this._items.length > 50) this._items.pop();
      this.save(); this.render();
      EventBus.emit("notification", item);
    },
    clear: function() { this._items = []; this.save(); this.render(); },
    save: function() { localStorage.setItem("snowy-notifications", JSON.stringify(this._items)); },
    getUnread: function() { return this._items.filter(function(i) { return !i.read; }).length; },
    render: function() {
      var badge = document.getElementById("notif-badge");
      var unread = this.getUnread();
      if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? "grid" : "none"; }
      var list = document.getElementById("nc-list");
      if (!list) return;
      if (this._items.length === 0) { list.innerHTML = '<div class="muted" style="text-align:center;padding:24px">No notifications</div>'; return; }
      list.innerHTML = this._items.map(function(n) {
        return '<div class="notif-item"><div class="notif-title">' + n.title + '</div><div class="notif-body">' + n.body + '</div><div class="notif-time">' + n.time + '</div></div>';
      }).join("");
    }
  };

  var WM = {
    zIndex: 100, windows: new Map(), activeWindow: null,
    create: function(appName, title, content, opts) {
      opts = opts || {};
      var tpl = document.getElementById("window-template");
      var win = tpl.content.firstElementChild.cloneNode(true);
      var id = "win-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      win.id = id; win.dataset.app = appName;
      win.querySelector(".window-title").textContent = title;
      var body = win.querySelector(".window-body");
      if (typeof content === "string") body.innerHTML = content;
      else if (content instanceof HTMLElement) body.appendChild(content);
      var w = opts.width || 520, h = opts.height || 400;
      win.style.width = w + "px"; win.style.height = h + "px";
      win.style.left = (80 + Math.random() * (window.innerWidth - w - 160)) + "px";
      win.style.top = (60 + Math.random() * (window.innerHeight - h - 200)) + "px";
      win.style.zIndex = ++this.zIndex;
      this.wireControls(win, id); this.makeDraggable(win);
      document.getElementById("windows").appendChild(win);
      this.windows.set(id, { el: win, app: appName, title: title, pinned: false, minimized: false });
      this.updateTaskbar(); EventBus.emit("window-open", { id: id, app: appName, title: title });
      return { id: id, el: win, body: body };
    },
    close: function(id) { var w = this.windows.get(id); if (!w) return; w.el.remove(); this.windows.delete(id); this.updateTaskbar(); },
    minimize: function(id) { var w = this.windows.get(id); if (!w) return; w.minimized = !w.minimized; w.el.classList.toggle("minimized", w.minimized); this.updateTaskbar(); },
    maximize: function(id) { var w = this.windows.get(id); if (!w) return; w.el.classList.toggle("maximized"); },
    focus: function(id) { var w = this.windows.get(id); if (!w) return; w.el.style.zIndex = ++this.zIndex; this.activeWindow = id; if (w.minimized) this.minimize(id); this.updateTaskbar(); },
    wireControls: function(win, id) {
      win.querySelector(".close").onclick = function() { WM.close(id); };
      win.querySelector(".min").onclick = function() { WM.minimize(id); };
      win.querySelector(".max").onclick = function() { WM.maximize(id); };
      win.querySelector(".window-pin").onclick = function() {
        var w = WM.windows.get(id);
        if (w) { w.pinned = !w.pinned; win.querySelector(".window-pin").textContent = w.pinned ? "Unpin" : "Pin"; }
      };
      win.onmousedown = function() { WM.focus(id); };
    },
    makeDraggable: function(win) {
      var bar = win.querySelector(".window-bar");
      var dragging = false, startX, startY, origX, origY;
      bar.onmousedown = function(e) {
        if (e.target.closest(".dot, .window-pin")) return;
        dragging = true; startX = e.clientX; startY = e.clientY;
        origX = win.offsetLeft; origY = win.offsetTop; bar.style.cursor = "grabbing";
      };
      document.addEventListener("mousemove", function(e) {
        if (!dragging) return;
        win.style.left = (origX + e.clientX - startX) + "px";
        win.style.top = (origY + e.clientY - startY) + "px";
      });
      document.addEventListener("mouseup", function() { dragging = false; bar.style.cursor = "grab"; });
    },
    updateTaskbar: function() {
      var tb = document.getElementById("taskbar");
      if (!tb) return;
      if (this.windows.size === 0) { tb.classList.remove("visible"); return; }
      tb.classList.add("visible"); tb.innerHTML = "";
      var self = this;
      this.windows.forEach(function(w, id) {
        var btn = document.createElement("button");
        btn.className = "taskbar-item" + (id === self.activeWindow ? " active" : "");
        btn.innerHTML = "<span>" + w.title + "</span>";
        btn.onclick = function() { if (w.minimized) self.minimize(id); self.focus(id); };
        tb.appendChild(btn);
      });
    }
  };

  function toast(msg, duration) {
    duration = duration || 4800;
    var container = document.querySelector(".toast-container");
    if (!container) { container = document.createElement("div"); container.className = "toast-container"; document.body.appendChild(container); }
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    container.appendChild(t);
    setTimeout(function() { t.classList.add("removing"); setTimeout(function() { t.remove(); }, 300); }, duration);
  }

  function updateClock() {
    var now = new Date();
    var clock = document.getElementById("clock");
    if (clock) clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    var lockTime = document.getElementById("lock-time");
    if (lockTime) lockTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    var lockDate = document.getElementById("lock-date");
    if (lockDate) lockDate.textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }
  setInterval(updateClock, 1000); updateClock();

  var lockScreen = document.getElementById("lock-screen");
  document.getElementById("btn-unlock").onclick = function() {
    lockScreen.classList.add("hidden");
    setTimeout(function() { lockScreen.style.display = "none"; }, 500);
    EventBus.emit("unlock");
    Notifications.add("Welcome back", "SnowyOS session started");
  };
  document.getElementById("btn-lock").onclick = function() {
    closeAllPanels(); lockScreen.style.display = "grid"; lockScreen.classList.remove("hidden");
  };

  function closeAllPanels() {
    var sm = document.getElementById("start-menu"); if (sm) sm.classList.remove("open");
    var wp = document.getElementById("workspaces-panel"); if (wp) wp.classList.remove("open");
    var nc = document.getElementById("notification-center"); if (nc) nc.classList.remove("open");
    var cc = document.getElementById("control-center"); if (cc) cc.classList.remove("open");
    var cm = document.getElementById("context-menu"); if (cm) cm.classList.remove("visible");
  }

  document.getElementById("btn-start").onclick = function(e) {
    e.stopPropagation(); var sm = document.getElementById("start-menu"); var was = sm.classList.contains("open");
    closeAllPanels(); if (!was) { sm.classList.add("open"); populateStartMenu(); }
  };
  document.getElementById("btn-workspaces").onclick = function(e) {
    e.stopPropagation(); var wp = document.getElementById("workspaces-panel"); var was = wp.classList.contains("open");
    closeAllPanels(); if (!was) { wp.classList.add("open"); renderWorkspaces(); }
  };
  document.getElementById("btn-notify").onclick = function(e) {
    e.stopPropagation(); var nc = document.getElementById("notification-center"); var was = nc.classList.contains("open");
    closeAllPanels(); if (!was) { nc.classList.add("open"); Notifications.render(); }
  };
  document.getElementById("btn-control").onclick = function(e) {
    e.stopPropagation(); document.getElementById("control-center").classList.toggle("open");
  };
  document.getElementById("btn-close-cc").onclick = function() { document.getElementById("control-center").classList.remove("open"); };
  document.getElementById("btn-clear-notifs").onclick = function() { Notifications.clear(); };

  document.addEventListener("click", function(e) {
    if (!e.target.closest(".start-menu") && !e.target.closest("#btn-start")) { var sm = document.getElementById("start-menu"); if (sm) sm.classList.remove("open"); }
    if (!e.target.closest(".workspaces-panel") && !e.target.closest("#btn-workspaces")) { var wp = document.getElementById("workspaces-panel"); if (wp) wp.classList.remove("open"); }
    if (!e.target.closest(".notification-center") && !e.target.closest("#btn-notify")) { var nc = document.getElementById("notification-center"); if (nc) nc.classList.remove("open"); }
    var cm = document.getElementById("context-menu"); if (cm) cm.classList.remove("visible");
  });

  var allApps = [
    { id: "files", name: "Files", emoji: "📁" }, { id: "notes", name: "Notes", emoji: "📝" },
    { id: "browser", name: "Browser", emoji: "🌐" }, { id: "terminal", name: "Terminal", emoji: "⌘" },
    { id: "sketch", name: "Paint", emoji: "🎨" }, { id: "settings", name: "Settings", emoji: "⚙" },
    { id: "chat", name: "Chat", emoji: "💬" }, { id: "calculator", name: "Calculator", emoji: "🧮" },
    { id: "music", name: "Music", emoji: "🎵" }, { id: "calendar", name: "Calendar", emoji: "📅" },
    { id: "sysmon", name: "Monitor", emoji: "📊" }, { id: "snake", name: "Snake", emoji: "🐍" },
    { id: "tetris", name: "Tetris", emoji: "🧱" }, { id: "game2048", name: "2048", emoji: "🔢" },
    { id: "minesweeper", name: "Minesweeper", emoji: "💣" }
  ];

  function populateStartMenu(filter) {
    filter = filter || "";
    var pinned = allApps.slice(0, 8);
    var filtered = allApps.filter(function(a) { return a.name.toLowerCase().includes(filter.toLowerCase()); });
    var pinnedEl = document.getElementById("start-pinned");
    var allEl = document.getElementById("start-all");
    if (pinnedEl) {
      pinnedEl.innerHTML = pinned.map(function(a) { return '<button class="start-grid-item" data-app="' + a.id + '">' + a.emoji + '<span>' + a.name + '</span></button>'; }).join("");
      pinnedEl.querySelectorAll(".start-grid-item").forEach(function(btn) { btn.onclick = function() { openApp(btn.dataset.app); closeAllPanels(); }; });
    }
    if (allEl) {
      allEl.innerHTML = filtered.map(function(a) { return '<button class="start-list-item" data-app="' + a.id + '"><span class="emoji">' + a.emoji + '</span>' + a.name + '</button>'; }).join("");
      allEl.querySelectorAll(".start-list-item").forEach(function(btn) { btn.onclick = function() { openApp(btn.dataset.app); closeAllPanels(); }; });
    }
  }
  document.getElementById("start-search-input").oninput = function(e) { populateStartMenu(e.target.value); };

  var workspaces = [{ name: "Workspace 1", active: true }]; var wsCount = 1;
  function renderWorkspaces() {
    var grid = document.getElementById("workspaces-grid"); if (!grid) return;
    grid.innerHTML = workspaces.map(function(ws, i) { return '<div class="workspace-card ' + (ws.active ? 'active' : '') + '" data-ws="' + i + '">' + ws.name + '</div>'; }).join("");
    grid.querySelectorAll(".workspace-card").forEach(function(card) {
      card.onclick = function() { var idx = parseInt(card.dataset.ws); workspaces.forEach(function(w) { w.active = false; }); workspaces[idx].active = true; renderWorkspaces(); toast("Switched to " + workspaces[idx].name); };
    });
  }
  document.getElementById("btn-add-workspace").onclick = function() {
    wsCount++; workspaces.push({ name: "Workspace " + wsCount, active: true });
    workspaces.forEach(function(w, i) { if (i !== workspaces.length - 1) w.active = false; });
    renderWorkspaces(); toast("Created " + workspaces[workspaces.length - 1].name);
  };

  document.getElementById("range-brightness").oninput = function(e) {
    document.body.style.filter = "brightness(" + (e.target.value / 100) + ")"; Settings.set("brightness", e.target.value);
  };
  document.getElementById("range-volume").oninput = function(e) { Settings.set("volume", e.target.value); };

  document.querySelectorAll(".pill.toggle").forEach(function(pill) {
    pill.onclick = function() {
      var key = pill.dataset.toggle;
      var isOn = pill.textContent !== "Off" && pill.textContent !== "Disabled";
      pill.textContent = isOn ? "Off" : "Enabled"; pill.classList.toggle("active", !isOn);
      Settings.set(key, !isOn);
      if (key === "night") document.documentElement.dataset.night = !isOn ? "true" : "";
      if (key === "anim") document.documentElement.dataset.animations = isOn ? "false" : "";
    };
  });

  function createSnowflakes() {
    var container = document.createElement("div");
    container.id = "snow-container";
    container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden;";
    document.body.appendChild(container);
    for (var i = 0; i < 50; i++) {
      var flake = document.createElement("div");
      flake.textContent = "❄";
      flake.style.cssText = "position:absolute;left:" + (Math.random()*100) + "vw;font-size:" + (0.5+Math.random()*1.5) + "rem;opacity:" + (0.4+Math.random()*0.6) + ";animation:snowfall " + (5+Math.random()*10) + "s linear infinite;animation-delay:-" + (Math.random()*10) + "s;";
      container.appendChild(flake);
    }
    var style = document.createElement("style");
    style.textContent = "@keyframes snowfall{0%{transform:translateY(-10vh) rotate(0deg)}100%{transform:translateY(110vh) rotate(360deg)}}";
    document.head.appendChild(style);
  }
  createSnowflakes();

  document.getElementById("desktop").addEventListener("contextmenu", function(e) {
    e.preventDefault();
    var menu = document.getElementById("context-menu");
    menu.innerHTML = '<button class="context-menu-item" data-action="refresh">↻ Refresh</button><button class="context-menu-item" data-action="settings">⚙ Settings</button><div class="context-menu-sep"></div><button class="context-menu-item" data-action="terminal">⌘ Open Terminal</button><button class="context-menu-item" data-action="notes">📝 New Note</button><div class="context-menu-sep"></div><button class="context-menu-item" data-action="about">◆ About SnowyOS</button>';
    menu.style.left = e.clientX + "px"; menu.style.top = e.clientY + "px"; menu.classList.add("visible");
    menu.querySelectorAll(".context-menu-item").forEach(function(item) {
      item.onclick = function() {
        var action = item.dataset.action;
        if (action === "refresh") location.reload();
        else if (action === "settings") openApp("settings");
        else if (action === "terminal") openApp("terminal");
        else if (action === "notes") openApp("notes");
        else if (action === "about") toast("SnowyOS v2.0 — Browser-native OS concept");
        menu.classList.remove("visible");
      };
    });
  });

  document.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.key === "e") { e.preventDefault(); openApp("terminal"); }
    if (e.ctrlKey && e.key === "n") { e.preventDefault(); openApp("notes"); }
    if (e.ctrlKey && e.key === "s") { e.preventDefault(); openApp("settings"); }
    if (e.key === "Escape") closeAllPanels();
    if (e.ctrlKey && e.shiftKey && e.key === "L") { e.preventDefault(); document.getElementById("btn-lock").click(); }
  });

  document.querySelectorAll(".dock-icon").forEach(function(icon) {
    icon.onclick = function() { openApp(icon.dataset.app); };
  });

  document.getElementById("btn-launch").onclick = function() {
    document.querySelector(".hero").style.display = "none";
    document.querySelector(".widget-grid").style.display = "none";
    toast("Desktop mode activated"); EventBus.emit("desktop-mode");
  };
  document.getElementById("btn-tour").onclick = function() {
    toast("Welcome to SnowyOS! Click dock icons or press ❄ for the start menu.");
    setTimeout(function() { toast("Right-click desktop for options. Ctrl+E for terminal, Ctrl+N for notes."); }, 2000);
    setTimeout(function() { toast("Try the games: Snake, Tetris, 2048, Minesweeper!"); }, 4000);
  };

  function openApp(name) {
    if (AppRenderers[name]) {
      var cfg = AppRenderers[name];
      var win = WM.create(name, cfg.title, cfg.render(), cfg.window || {});
      if (cfg.init) cfg.init(win);
    } else { toast('App "' + name + '" not found'); }
  }

  var AppRenderers = {};

  AppRenderers.files = {
    title: "Files", window: { width: 560, height: 420 },
    render: function() {
      var dirs = VFS.ls("/");
      var html = '<div class="app-grid">';
      dirs.forEach(function(d) { html += '<div class="app-card" data-path="/' + d + '">📁 ' + d + '</div>'; });
      html += '</div><div style="margin-top:16px"><div class="muted" style="margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em">Recent</div>';
      html += '<ul class="file-list"><li>📄 readme.txt — Documents</li><li>🎵 glacier-glow.mp3 — Music</li><li>🖼️ snowscape.png — Pictures</li><li>📝 notes.md — Documents</li></ul></div>';
      return html;
    },
    init: function(win) {
      win.body.querySelectorAll(".app-card").forEach(function(card) {
        card.onclick = function() { var p = card.dataset.path; var ch = VFS.ls(p); if (ch.length) toast(p + ": " + ch.join(", ")); };
      });
    }
  };

  AppRenderers.notes = {
    title: "Notes", window: { width: 480, height: 360 },
    render: function() { return '<textarea class="note-input" id="note-editor" placeholder="Start typing...">' + (localStorage.getItem("snowy-notes") || "") + '</textarea>'; },
    init: function(win) {
      var editor = win.body.querySelector("#note-editor"); var saveTimer;
      editor.oninput = function() { clearTimeout(saveTimer); saveTimer = setTimeout(function() { localStorage.setItem("snowy-notes", editor.value); toast("Note saved", 1500); }, 800); };
    }
  };

  AppRenderers.browser = {
    title: "Browser", window: { width: 520, height: 400 },
    render: function() {
      var results = [
        { title: "Aurora Kit", url: "aurora.dev/kit", desc: "Design system for glassmorphic interfaces" },
        { title: "Fjord Layouts", url: "fjord.css/layouts", desc: "CSS Grid patterns inspired by Nordic landscapes" },
        { title: "Polar Type", url: "polar.type/fonts", desc: "Minimal typefaces for cold climates" },
        { title: "SnowyOS Docs", url: "snowy.os/docs", desc: "Official documentation and API reference" },
        { title: "Glacier UI", url: "glacier.ui/components", desc: "Component library for frozen interfaces" }
      ];
      var html = '<div class="browser-app"><div class="url-bar"><input type="text" id="browser-search" placeholder="Search or enter URL..."></div>';
      html += '<div class="browser-results" id="browser-results">';
      results.forEach(function(r) { html += '<div class="browser-result"><div class="result-title">' + r.title + '</div><div class="result-url">' + r.url + '</div><div class="result-desc">' + r.desc + '</div></div>'; });
      html += '</div></div>'; return html;
    },
    init: function(win) {
      var input = win.body.querySelector("#browser-search"); var results = win.body.querySelector("#browser-results");
      input.oninput = function() { var q = input.value.toLowerCase(); results.querySelectorAll(".browser-result").forEach(function(r) { r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none"; }); };
    }
  };

  AppRenderers.terminal = {
    title: "Terminal", window: { width: 540, height: 380 },
    render: function() {
      return '<div class="terminal"><div class="terminal-output" id="term-output"><span style="color:var(--accent)">Welcome to SnowyOS Terminal</span>\nType <span style="color:var(--warning)">help</span> for commands.\n\n</div><input class="terminal-input" id="term-input" placeholder="Enter command..." autofocus></div>';
    },
    init: function(win) {
      var output = win.body.querySelector("#term-output"); var input = win.body.querySelector("#term-input");
      var history = []; var histIdx = -1;
      function print(text, color) { output.innerHTML += color ? '<span style="color:' + color + '">' + text + '</span>\n' : text + "\n"; output.scrollTop = output.scrollHeight; }
      input.onkeydown = function(e) {
        if (e.key === "Enter") {
          var cmd = input.value.trim(); if (cmd) { history.unshift(cmd); histIdx = -1; }
          print("guest@snowy:~$ " + cmd, "var(--accent)"); input.value = "";
          var parts = cmd.split(" "); var co = parts[0].toLowerCase(); var args = parts.slice(1);
          switch (co) {
            case "": break;
            case "help": print("Commands: help, about, time, date, ls, cat, echo, clear, neofetch, uptime, whoami, uname, pwd, calc, fortune, cowsay, matrix, hack, color", "var(--warning)"); break;
            case "about": print("SnowyOS v2.0 — Browser-native OS concept\nBuilt with vanilla HTML, CSS, JS\nZero dependencies. Pure frost.", "var(--accent-2)"); break;
            case "time": print(new Date().toLocaleTimeString()); break;
            case "date": print(new Date().toLocaleDateString()); break;
            case "whoami": print("guest"); break;
            case "uname": print("SnowyOS 2.0.0 browser x86_64"); break;
            case "pwd": print("/home/guest"); break;
            case "uptime": print("up " + Math.floor(Math.random() * 24) + " hours, " + Math.floor(Math.random() * 60) + " minutes"); break;
            case "ls": print(VFS.ls("/").map(function(d) { return "📁 " + d; }).join("  ")); break;
            case "cat": if (args[0]) { var content = VFS.read("/Documents/" + args[0]); print(content || "cat: " + args[0] + ": No such file"); } else print("cat: missing operand"); break;
            case "echo": print(args.join(" ")); break;
            case "clear": output.innerHTML = ""; break;
            case "neofetch": print("   ◆◆◆   guest@snowy\n  ◆   ◆  ──────────\n ◆ ◆◆◆ ◆ OS: SnowyOS 2.0\n  ◆   ◆  Host: Browser\n   ◆◆◆   Kernel: Vanilla JS\n             Shell: SnowyTerm\n             Resolution: " + window.innerWidth + "x" + window.innerHeight + "\n             Theme: " + Settings.get("theme") + "\n             Windows: " + WM.windows.size, "var(--accent)"); break;
            case "fortune": var fortunes = ["A beautiful, smart, and loving person will be coming into your life.", "A dubious friend may be an enemy in camouflage.", "A faithful friend is a strong defense.", "A fresh start will put you on your way."]; print(fortunes[Math.floor(Math.random() * fortunes.length)]); break;
            case "cowsay": var msg = args.join(" ") || "Moo!"; var line = "─".repeat(msg.length + 2); print(" ┌" + line + "┐\n │ " + msg + " │\n └" + line + "┘\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||"); break;
            case "calc": try { print("= " + eval(args.join(""))); } catch(ex) { print("Invalid expression"); } break;
            case "matrix": for (var i = 0; i < 5; i++) { var row = ""; for (var j = 0; j < 40; j++) row += String.fromCharCode(0x30A0 + Math.random() * 96); print(row, "#0f0"); } break;
            case "hack": print("Initializing hack sequence...", "var(--danger)"); setTimeout(function() { print("Bypassing firewall...", "var(--warning)"); }, 500); setTimeout(function() { print("Accessing mainframe...", "var(--warning)"); }, 1000); setTimeout(function() { print("Downloading all the cookies...", "var(--accent)"); }, 1500); setTimeout(function() { print("Just kidding. This is a sandbox.", "var(--success)"); }, 2000); break;
            case "color": var colors = ["#ff7b7b", "#ffd97b", "#7bfd7b", "#7bf1ff", "#c7a7ff", "#ff7bc6"]; print(colors.map(function(c2) { return '<span style="color:' + c2 + '">████</span>'; }).join(" ")); break;
            default: print("Command not found: " + co + ". Type 'help' for available commands.", "var(--danger)");
          }
          input.scrollIntoView();
        } else if (e.key === "ArrowUp") { e.preventDefault(); if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; } }
        else if (e.key === "ArrowDown") { e.preventDefault(); if (histIdx > 0) { histIdx--; input.value = history[histIdx]; } else { histIdx = -1; input.value = ""; } }
      };
      setTimeout(function() { input.focus(); }, 100);
    }
  };

  AppRenderers.sketch = {
    title: "Paint", window: { width: 600, height: 480 },
    render: function() {
      return '<div class="paint-toolbar"><button class="active" data-tool="brush" title="Brush">✏</button><button data-tool="eraser" title="Eraser">🧹</button><button data-tool="line" title="Line">╱</button><button data-tool="rect" title="Rectangle">▭</button><button data-tool="circle" title="Circle">○</button><input type="color" id="paint-color" value="#7bf1ff" title="Color"><input type="range" id="paint-size" min="1" max="20" value="3" title="Size"><button data-action="clear" title="Clear">🗑</button><button data-action="save" title="Save">💾</button></div><canvas class="game-canvas" id="paint-canvas" width="560" height="380" style="cursor:crosshair"></canvas>';
    },
    init: function(win) {
      var canvas = win.body.querySelector("#paint-canvas"); var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#05070d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      var tool = "brush", color = "#7bf1ff", size = 3, drawing = false, startX, startY, lastX, lastY;
      var toolbar = win.body.querySelector(".paint-toolbar");
      toolbar.querySelectorAll("[data-tool]").forEach(function(btn) {
        btn.onclick = function() { toolbar.querySelectorAll("[data-tool]").forEach(function(b) { b.classList.remove("active"); }); btn.classList.add("active"); tool = btn.dataset.tool; };
      });
      win.body.querySelector("#paint-color").oninput = function(e) { color = e.target.value; };
      win.body.querySelector("#paint-size").oninput = function(e) { size = parseInt(e.target.value); };
      toolbar.querySelector("[data-action=clear]").onclick = function() { ctx.fillStyle = "#05070d"; ctx.fillRect(0, 0, canvas.width, canvas.height); };
      toolbar.querySelector("[data-action=save]").onclick = function() { var link = document.createElement("a"); link.download = "snowy-painting.png"; link.href = canvas.toDataURL(); link.click(); toast("Painting saved!"); };
      canvas.onmousedown = function(e) { drawing = true; var rect = canvas.getBoundingClientRect(); startX = lastX = e.clientX - rect.left; startY = lastY = e.clientY - rect.top; };
      canvas.onmousemove = function(e) {
        if (!drawing) return; var rect = canvas.getBoundingClientRect(); var x = e.clientX - rect.left; var y = e.clientY - rect.top;
        if (tool === "brush" || tool === "eraser") { ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.strokeStyle = tool === "eraser" ? "#05070d" : color; ctx.lineWidth = tool === "eraser" ? size * 3 : size; ctx.lineCap = "round"; ctx.stroke(); lastX = x; lastY = y; }
      };
      canvas.onmouseup = function(e) {
        if (!drawing) return; drawing = false; var rect = canvas.getBoundingClientRect(); var x = e.clientX - rect.left; var y = e.clientY - rect.top;
        ctx.strokeStyle = color; ctx.lineWidth = size;
        if (tool === "line") { ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke(); }
        else if (tool === "rect") { ctx.strokeRect(startX, startY, x - startX, y - startY); }
        else if (tool === "circle") { var rx = Math.abs(x - startX) / 2, ry = Math.abs(y - startY) / 2; ctx.beginPath(); ctx.ellipse(startX + (x - startX) / 2, startY + (y - startY) / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); }
      };
    }
  };

  AppRenderers.settings = {
    title: "Settings", window: { width: 520, height: 500 },
    render: function() {
      var s = Settings.getAll();
      var themes = [
        { id: "dark", name: "Dark", color: "#0a0f16" }, { id: "light", name: "Light", color: "#e8edf3" },
        { id: "aurora", name: "Aurora", color: "#58a6ff" }, { id: "sunset", name: "Sunset", color: "#ff9a76" },
        { id: "forest", name: "Forest", color: "#7bffb5" }, { id: "rose", name: "Rose", color: "#ff7bc6" }
      ];
      var html = '<div class="settings-section"><h3>Appearance</h3><div class="theme-grid">';
      themes.forEach(function(t) { html += '<button class="theme-option ' + (s.theme === t.id ? 'active' : '') + '" data-theme="' + t.id + '"><div class="theme-swatch" style="background:' + t.color + '"></div>' + t.name + '</button>'; });
      html += '</div></div>';
      html += '<div class="settings-section"><h3>Profile</h3><div class="settings-row"><label>Username</label><input type="text" id="setting-username" value="' + s.username + '" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:var(--panel);color:var(--text);font-family:inherit;width:120px"></div></div>';
      html += '<div class="settings-section"><h3>System</h3>';
      html += '<div class="settings-row"><label>Version</label><span class="muted">SnowyOS 2.0.0</span></div>';
      html += '<div class="settings-row"><label>Build</label><span class="muted">' + new Date().toISOString().slice(0, 10) + '</span></div>';
      html += '<div class="settings-row"><label>Engine</label><span class="muted">Vanilla JS</span></div>';
      html += '<div class="settings-row"><label>Windows Open</label><span class="muted" id="setting-win-count">' + WM.windows.size + '</span></div>';
      html += '<div class="settings-row"><label>Storage Used</label><span class="muted">' + (new Blob([JSON.stringify(localStorage)]).size / 1024).toFixed(1) + ' KB</span></div></div>';
      html += '<div class="settings-section"><h3>Data</h3><div style="display:flex;gap:8px"><button class="game-btn" id="btn-export-data">Export Data</button><button class="game-btn" id="btn-clear-data" style="color:var(--danger)">Clear All Data</button></div></div>';
      return html;
    },
    init: function(win) {
      win.body.querySelectorAll(".theme-option").forEach(function(btn) {
        btn.onclick = function() {
          win.body.querySelectorAll(".theme-option").forEach(function(b) { b.classList.remove("active"); });
          btn.classList.add("active"); var theme = btn.dataset.theme;
          Settings.set("theme", theme);
          if (theme === "dark") delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = theme;
          toast("Theme: " + btn.textContent.trim());
        };
      });
      var usernameInput = win.body.querySelector("#setting-username"); var nameTimer;
      usernameInput.oninput = function() { clearTimeout(nameTimer); nameTimer = setTimeout(function() { Settings.set("username", usernameInput.value); document.querySelectorAll(".user-name").forEach(function(el) { el.textContent = usernameInput.value || "Guest"; }); }, 500); };
      win.body.querySelector("#btn-export-data").onclick = function() {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); data[key] = localStorage.getItem(key); }
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var link = document.createElement("a"); link.download = "snowyos-data.json"; link.href = URL.createObjectURL(blob); link.click(); toast("Data exported!");
      };
      win.body.querySelector("#btn-clear-data").onclick = function() {
        if (confirm("Clear all SnowyOS data? This cannot be undone.")) { localStorage.clear(); toast("All data cleared. Reloading..."); setTimeout(function() { location.reload(); }, 1500); }
      };
    }
  };

  AppRenderers.chat = {
    title: "Chat", window: { width: 420, height: 460 },
    render: function() {
      return '<div class="chat-container"><div class="chat-messages" id="chat-messages"><div class="chat-msg system">SnowyOS Chat — API TEST MODE</div><div class="chat-msg bot">Hello! I am a test chatbot. Send me a message and I will echo it back. When an API is connected, I will use that instead.</div></div><div class="chat-input-row"><input class="chat-input" id="chat-input" placeholder="Type a message..."><button class="chat-send" id="chat-send">Send</button></div></div>';
    },
    init: function(win) {
      var messages = win.body.querySelector("#chat-messages"); var input = win.body.querySelector("#chat-input"); var sendBtn = win.body.querySelector("#chat-send");
      function addMsg(text, type) { var div = document.createElement("div"); div.className = "chat-msg " + type; div.textContent = text; messages.appendChild(div); messages.scrollTop = messages.scrollHeight; }
      function send() {
        var text = input.value.trim(); if (!text) return;
        addMsg(text, "user"); input.value = "";
        setTimeout(function() {
          var responses = ['TEST ECHO: "' + text + '"', 'TEST: You said "' + text + '" — API slot is ready', 'TEST MODE: Message received. Connect an API to enable real responses.', 'TEST: "' + text + '" — This is a placeholder response', 'API TEST: "' + text + '" — Replace this with your LLM endpoint'];
          addMsg(responses[Math.floor(Math.random() * responses.length)], "bot");
        }, 500 + Math.random() * 1000);
      }
      sendBtn.onclick = send;
      input.onkeydown = function(e) { if (e.key === "Enter") send(); };
    }
  };

  AppRenderers.calculator = {
    title: "Calculator", window: { width: 320, height: 460 },
    render: function() {
      var buttons = [["C","±","%","÷"],["7","8","9","×"],["4","5","6","−"],["1","2","3","+"],["0",".","⌫","="]];
      var html = '<div class="calc-display"><div class="calc-expr" id="calc-expr"></div><div class="calc-result" id="calc-result">0</div></div><div class="calc-grid">';
      buttons.flat().forEach(function(b) {
        var cls = "calc-btn"; if (["÷","×","−","+"].indexOf(b) >= 0) cls += " op"; if (b === "=") cls += " eq"; if (b === "C") cls += " clear";
        html += '<button class="' + cls + '" data-btn="' + b + '">' + b + '</button>';
      });
      html += '</div>'; return html;
    },
    init: function(win) {
      var current = "0", expression = "", operator = null, waitingForOperand = false;
      var display = win.body.querySelector("#calc-result"); var expr = win.body.querySelector("#calc-expr");
      function update() { display.textContent = current; expr.textContent = expression; }
      win.body.querySelectorAll(".calc-btn").forEach(function(btn) {
        btn.onclick = function() {
          var b = btn.dataset.btn;
          if (b >= "0" && b <= "9") { if (waitingForOperand) { current = b; waitingForOperand = false; } else current = current === "0" ? b : current + b; }
          else if (b === ".") { if (current.indexOf(".") < 0) current += "."; }
          else if (b === "C") { current = "0"; expression = ""; operator = null; waitingForOperand = false; }
          else if (b === "⌫") { current = current.length > 1 ? current.slice(0, -1) : "0"; }
          else if (b === "±") { current = String(-parseFloat(current)); }
          else if (b === "%") { current = String(parseFloat(current) / 100); }
          else if (["+","−","×","÷"].indexOf(b) >= 0) {
            if (operator && !waitingForOperand) { var prev = parseFloat(expression); var curr = parseFloat(current); var result; if (operator === "+") result = prev + curr; else if (operator === "−") result = prev - curr; else if (operator === "×") result = prev * curr; else if (operator === "÷") result = curr !== 0 ? prev / curr : "Error"; current = String(result); }
            expression = current + " " + b; operator = b; waitingForOperand = true;
          } else if (b === "=") {
            if (operator) { var p = parseFloat(expression); var cc = parseFloat(current); var r; if (operator === "+") r = p + cc; else if (operator === "−") r = p - cc; else if (operator === "×") r = p * cc; else if (operator === "÷") r = cc !== 0 ? p / cc : "Error"; expression = p + " " + operator + " " + cc + " ="; current = String(r); operator = null; waitingForOperand = true; }
          }
          update();
        };
      });
    }
  };

  AppRenderers.snake = {
    title: "Snake", window: { width: 420, height: 480 },
    render: function() {
      return '<div class="game-info"><span>Score: <strong id="snake-score">0</strong></span><span>Best: <strong id="snake-best">' + (localStorage.getItem("snowy-snake-best") || 0) + '</strong></span></div><canvas class="game-canvas" id="snake-canvas" width="380" height="380"></canvas><div class="game-controls"><button class="game-btn" id="snake-start">Start</button><button class="game-btn" id="snake-pause">Pause</button></div><div class="dpad"><div></div><button class="dpad-btn" data-dir="up">▲</button><div></div><button class="dpad-btn" data-dir="left">◀</button><div class="dpad-center"></div><button class="dpad-btn" data-dir="right">▶</button><div></div><button class="dpad-btn" data-dir="down">▼</button><div></div></div>';
    },
    init: function(win) {
      var canvas = win.body.querySelector("#snake-canvas"); var ctx = canvas.getContext("2d");
      var size = 20, cols = 19, rows = 19;
      var snake, dir, nextDir, food, score, running, interval, paused;
      var scoreEl = win.body.querySelector("#snake-score"); var bestEl = win.body.querySelector("#snake-best");
      function init() { snake = [{ x: 9, y: 9 }]; dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 }; score = 0; paused = false; scoreEl.textContent = "0"; placeFood(); draw(); }
      function placeFood() { do { food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }; } while (snake.some(function(s) { return s.x === food.x && s.y === food.y; })); }
      function draw() {
        ctx.fillStyle = "#05070d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        for (var i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * size, 0); ctx.lineTo(i * size, rows * size); ctx.stroke(); }
        for (var i = 0; i <= rows; i++) { ctx.beginPath(); ctx.moveTo(0, i * size); ctx.lineTo(cols * size, i * size); ctx.stroke(); }
        ctx.fillStyle = "#ff7b7b"; ctx.beginPath(); ctx.arc(food.x * size + size / 2, food.y * size + size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.fill();
        snake.forEach(function(s, idx) { var brightness = 1 - (idx / snake.length) * 0.5; ctx.fillStyle = "rgba(123, 241, 255, " + brightness + ")"; ctx.fillRect(s.x * size + 1, s.y * size + 1, size - 2, size - 2); });
      }
      function step() {
        if (paused) return; dir = { x: nextDir.x, y: nextDir.y };
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows || snake.some(function(s) { return s.x === head.x && s.y === head.y; })) {
          clearInterval(interval); running = false;
          var best = parseInt(localStorage.getItem("snowy-snake-best") || "0");
          if (score > best) { localStorage.setItem("snowy-snake-best", score); bestEl.textContent = score; }
          ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#ff7b7b"; ctx.font = "24px Space Grotesk"; ctx.textAlign = "center"; ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2 - 10);
          ctx.fillStyle = "#a2b3c7"; ctx.font = "16px Space Grotesk"; ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2 + 20);
          return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) { score++; scoreEl.textContent = score; placeFood(); } else snake.pop();
        draw();
      }
      function setDir(x, y) { if (dir.x !== -x || dir.y !== -y) nextDir = { x: x, y: y }; }
      win.body.querySelector("#snake-start").onclick = function() { if (running) return; running = true; init(); interval = setInterval(step, 120); };
      win.body.querySelector("#snake-pause").onclick = function() { paused = !paused; };
      win.body.querySelectorAll(".dpad-btn").forEach(function(btn) {
        btn.onclick = function() { var d = btn.dataset.dir; if (d === "up") setDir(0, -1); if (d === "down") setDir(0, 1); if (d === "left") setDir(-1, 0); if (d === "right") setDir(1, 0); };
      });
      init();
    }
  };

  AppRenderers.tetris = {
    title: "Tetris", window: { width: 400, height: 500 },
    render: function() {
      return '<div class="game-info"><span>Score: <strong id="tetris-score">0</strong></span><span>Lines: <strong id="tetris-lines">0</strong></span><span>Level: <strong id="tetris-level">1</strong></span></div><div style="display:flex;justify-content:center"><canvas class="game-canvas" id="tetris-canvas" width="250" height="500"></canvas><div class="tetris-side"><div class="muted" style="font-size:12px">Next</div><canvas id="tetris-next" width="100" height="100" style="border-radius:8px;background:#05070d"></canvas><div class="game-controls" style="flex-direction:column"><button class="game-btn" id="tetris-start">Start</button><button class="game-btn" id="tetris-pause">Pause</button></div></div></div>';
    },
    init: function(win) {
      var canvas = win.body.querySelector("#tetris-canvas"); var ctx = canvas.getContext("2d");
      var nextCanvas = win.body.querySelector("#tetris-next"); var nextCtx = nextCanvas.getContext("2d");
      var COLS = 10, ROWS = 20, SIZE = 25;
      var SHAPES = [[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
      var COLORS = ["#7bf1ff","#ffd97b","#c7a7ff","#7bfd7b","#ff7b7b","#ff7bc6","#7bffb5"];
      var board, piece, nextPiece, score, lines, level, running, paused, interval;
      function createPiece() { var idx = Math.floor(Math.random() * SHAPES.length); return { shape: SHAPES[idx].map(function(r) { return r.slice(); }), color: COLORS[idx], x: 3, y: 0 }; }
      function init() { board = Array.from({ length: ROWS }, function() { return Array(COLS).fill(0); }); score = 0; lines = 0; level = 1; paused = false; piece = createPiece(); nextPiece = createPiece(); updateUI(); draw(); drawNext(); }
      function updateUI() { win.body.querySelector("#tetris-score").textContent = score; win.body.querySelector("#tetris-lines").textContent = lines; win.body.querySelector("#tetris-level").textContent = level; }
      function draw() {
        ctx.fillStyle = "#05070d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) { ctx.strokeRect(cc * SIZE, r * SIZE, SIZE, SIZE); if (board[r][cc]) { ctx.fillStyle = board[r][cc]; ctx.fillRect(cc * SIZE + 1, r * SIZE + 1, SIZE - 2, SIZE - 2); } }
        if (piece) { ctx.fillStyle = piece.color; piece.shape.forEach(function(row, r) { row.forEach(function(v, cc) { if (v) ctx.fillRect((piece.x + cc) * SIZE + 1, (piece.y + r) * SIZE + 1, SIZE - 2, SIZE - 2); }); }); }
      }
      function drawNext() {
        nextCtx.fillStyle = "#05070d"; nextCtx.fillRect(0, 0, 100, 100);
        if (!nextPiece) return;
        var s = 20, ox = (100 - nextPiece.shape[0].length * s) / 2, oy = (100 - nextPiece.shape.length * s) / 2;
        nextCtx.fillStyle = nextPiece.color;
        nextPiece.shape.forEach(function(row, r) { row.forEach(function(v, cc) { if (v) nextCtx.fillRect(ox + cc * s + 1, oy + r * s + 1, s - 2, s - 2); }); });
      }
      function collides(shape, ox, oy) {
        return shape.some(function(row, r) { return row.some(function(v, cc) {
          if (!v) return false; var nx = ox + cc, ny = oy + r;
          return nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx]);
        }); });
      }
      function merge() { piece.shape.forEach(function(row, r) { row.forEach(function(v, cc) { if (v && piece.y + r >= 0) board[piece.y + r][piece.x + cc] = piece.color; }); }); }
      function clearLines() {
        var cleared = 0;
        for (var r = ROWS - 1; r >= 0; r--) { if (board[r].every(function(x) { return x; })) { board.splice(r, 1); board.unshift(Array(COLS).fill(0)); cleared++; r++; } }
        if (cleared) { lines += cleared; score += [0, 100, 300, 500, 800][cleared] * level; level = Math.floor(lines / 10) + 1; updateUI(); }
      }
      function drop() {
        if (paused) return;
        if (!collides(piece.shape, piece.x, piece.y + 1)) { piece.y++; }
        else {
          merge(); clearLines(); piece = nextPiece; nextPiece = createPiece(); drawNext();
          if (collides(piece.shape, piece.x, piece.y)) {
            clearInterval(interval); running = false;
            ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ff7b7b"; ctx.font = "24px Space Grotesk"; ctx.textAlign = "center"; ctx.fillText("Game Over!", canvas.width / 2, canvas.height / 2);
            return;
          }
        }
        draw();
      }
      function rotate() { var rotated = piece.shape[0].map(function(_, i) { return piece.shape.map(function(row) { return row[i]; }).reverse(); }); if (!collides(rotated, piece.x, piece.y)) piece.shape = rotated; }
      win.body.querySelector("#tetris-start").onclick = function() { if (running) return; running = true; init(); interval = setInterval(drop, 500); };
      win.body.querySelector("#tetris-pause").onclick = function() { paused = !paused; };
      document.addEventListener("keydown", function(e) {
        if (!running) return;
        if (e.key === "ArrowLeft" && !collides(piece.shape, piece.x - 1, piece.y)) piece.x--;
        if (e.key === "ArrowRight" && !collides(piece.shape, piece.x + 1, piece.y)) piece.x++;
        if (e.key === "ArrowDown" && !collides(piece.shape, piece.x, piece.y + 1)) piece.y++;
        if (e.key === "ArrowUp") rotate();
        if (e.key === " ") { while (!collides(piece.shape, piece.x, piece.y + 1)) piece.y++; }
        draw();
      });
      init();
    }
  };

  AppRenderers.game2048 = {
    title: "2048", window: { width: 380, height: 480 },
    render: function() {
      return '<div class="game-info"><span>Score: <strong id="g2048-score">0</strong></span><span>Best: <strong id="g2048-best">' + (localStorage.getItem("snowy-2048-best") || 0) + '</strong></span></div><div class="grid-2048" id="g2048-grid"></div><div class="game-controls"><button class="game-btn" id="g2048-new">New Game</button></div><div class="dpad"><div></div><button class="dpad-btn" data-dir="up">▲</button><div></div><button class="dpad-btn" data-dir="left">◀</button><div class="dpad-center"></div><button class="dpad-btn" data-dir="right">▶</button><div></div><button class="dpad-btn" data-dir="down">▼</button><div></div></div>';
    },
    init: function(win) {
      var grid = win.body.querySelector("#g2048-grid"); var scoreEl = win.body.querySelector("#g2048-score"); var bestEl = win.body.querySelector("#g2048-best");
      var board, score;
      var TILE_COLORS = { 0:"rgba(255,255,255,0.03)", 2:"#3a4a5c", 4:"#4a5a6c", 8:"#ff9a76", 16:"#ff7b7b", 32:"#ff5c5c", 64:"#ff3c3c", 128:"#ffd97b", 256:"#ffcc00", 512:"#ffb800", 1024:"#7bf1ff", 2048:"#c7a7ff" };
      function init() { board = Array.from({ length: 4 }, function() { return Array(4).fill(0); }); score = 0; addTile(); addTile(); render(); }
      function addTile() { var empty = []; for (var r = 0; r < 4; r++) for (var cc = 0; cc < 4; cc++) if (!board[r][cc]) empty.push([r, cc]); if (!empty.length) return; var rc = empty[Math.floor(Math.random() * empty.length)]; board[rc[0]][rc[1]] = Math.random() < 0.9 ? 2 : 4; }
      function render() {
        scoreEl.textContent = score; grid.innerHTML = "";
        for (var r = 0; r < 4; r++) for (var cc = 0; cc < 4; cc++) {
          var tile = document.createElement("div"); tile.className = "tile-2048"; var v = board[r][cc];
          tile.textContent = v || ""; tile.style.background = TILE_COLORS[v] || "#7bffb5";
          if (v >= 128) tile.style.color = "#0a0f16"; grid.appendChild(tile);
        }
      }
      function slide(row) { var arr = row.filter(function(v) { return v; }); for (var i = 0; i < arr.length - 1; i++) { if (arr[i] === arr[i + 1]) { arr[i] *= 2; score += arr[i]; arr.splice(i + 1, 1); } } while (arr.length < 4) arr.push(0); return arr; }
      function move(dir) {
        var old = JSON.stringify(board);
        if (dir === "left") { for (var r = 0; r < 4; r++) board[r] = slide(board[r]); }
        else if (dir === "right") { for (var r = 0; r < 4; r++) board[r] = slide(board[r].reverse()).reverse(); }
        else if (dir === "up") { for (var cc = 0; cc < 4; cc++) { var col = [board[0][cc], board[1][cc], board[2][cc], board[3][cc]]; col = slide(col); for (var r = 0; r < 4; r++) board[r][cc] = col[r]; } }
        else if (dir === "down") { for (var cc = 0; cc < 4; cc++) { var col = [board[3][cc], board[2][cc], board[1][cc], board[0][cc]]; col = slide(col); for (var r = 0; r < 4; r++) board[3 - r][cc] = col[r]; } }
        if (JSON.stringify(board) !== old) {
          addTile(); var best = parseInt(localStorage.getItem("snowy-2048-best") || "0");
          if (score > best) { localStorage.setItem("snowy-2048-best", score); bestEl.textContent = score; }
          render();
        }
      }
      win.body.querySelector("#g2048-new").onclick = init;
      win.body.querySelectorAll(".dpad-btn").forEach(function(btn) { btn.onclick = function() { move(btn.dataset.dir); }; });
      init();
    }
  };

  AppRenderers.minesweeper = {
    title: "Minesweeper", window: { width: 400, height: 460 },
    render: function() { return '<div class="game-info"><span>💣 <strong id="mine-count">10</strong></span><span id="mine-status">Click to start</span></div><div class="mines-grid" id="mines-grid"></div><div class="game-controls"><button class="game-btn" id="mine-new">New Game</button></div>'; },
    init: function(win) {
      var gridEl = win.body.querySelector("#mines-grid"); var statusEl = win.body.querySelector("#mine-status"); var countEl = win.body.querySelector("#mine-count");
      var ROWS = 9, COLS = 9, MINES = 10;
      var board, revealed, flagged, gameOver, firstClick;
      var NUM_COLORS = ["", "#7bf1ff", "#7bfd7b", "#ff7b7b", "#c7a7ff", "#ffd97b", "#7bffb5", "#ff7bc6", "#a2b3c7"];
      function init() { board = Array.from({ length: ROWS }, function() { return Array(COLS).fill(0); }); revealed = Array.from({ length: ROWS }, function() { return Array(COLS).fill(false); }); flagged = Array.from({ length: ROWS }, function() { return Array(COLS).fill(false); }); gameOver = false; firstClick = true; statusEl.textContent = "Click to start"; countEl.textContent = MINES; render(); }
      function placeMines(safeR, safeC) {
        var placed = 0;
        while (placed < MINES) { var r = Math.floor(Math.random() * ROWS), cc = Math.floor(Math.random() * COLS); if (board[r][cc] === -1 || (Math.abs(r - safeR) <= 1 && Math.abs(cc - safeC) <= 1)) continue; board[r][cc] = -1; placed++; }
        for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) {
          if (board[r][cc] === -1) continue; var count = 0;
          for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) { var nr = r + dr, nc = cc + dc; if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === -1) count++; }
          board[r][cc] = count;
        }
      }
      function reveal(r, cc) {
        if (r < 0 || r >= ROWS || cc < 0 || cc >= COLS || revealed[r][cc] || flagged[r][cc]) return;
        revealed[r][cc] = true;
        if (board[r][cc] === 0) { for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) reveal(r + dr, cc + dc); }
      }
      function checkWin() { var unrevealed = 0; for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) if (!revealed[r][cc]) unrevealed++; if (unrevealed === MINES) { gameOver = true; statusEl.textContent = "You win!"; } }
      function render() {
        gridEl.style.gridTemplateColumns = "repeat(" + COLS + ", 28px)"; gridEl.innerHTML = "";
        for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) {
          var cell = document.createElement("button"); cell.className = "mines-cell";
          if (revealed[r][cc]) { cell.classList.add("revealed"); if (board[r][cc] === -1) { cell.classList.add("mine"); cell.textContent = "💣"; } else if (board[r][cc] > 0) { cell.textContent = board[r][cc]; cell.style.color = NUM_COLORS[board[r][cc]]; } }
          else if (flagged[r][cc]) { cell.classList.add("flagged"); cell.textContent = "🚩"; }
          (function(rr, ccc) {
            cell.onclick = function() {
              if (gameOver || flagged[rr][ccc]) return;
              if (firstClick) { placeMines(rr, ccc); firstClick = false; statusEl.textContent = "Playing..."; }
              if (board[rr][ccc] === -1) { gameOver = true; for (var ri = 0; ri < ROWS; ri++) for (var ci = 0; ci < COLS; ci++) if (board[ri][ci] === -1) revealed[ri][ci] = true; statusEl.textContent = "Game Over!"; render(); return; }
              reveal(rr, ccc); checkWin(); render();
            };
            cell.oncontextmenu = function(e) { e.preventDefault(); if (gameOver || revealed[rr][ccc]) return; flagged[rr][ccc] = !flagged[rr][ccc]; countEl.textContent = MINES - flagged.flat().filter(Boolean).length; render(); };
          })(r, cc);
          gridEl.appendChild(cell);
        }
      }
      win.body.querySelector("#mine-new").onclick = init; init();
    }
  };

  AppRenderers.music = {
    title: "Music", window: { width: 360, height: 500 },
    render: function() {
      var playlist = [
        { title: "Glacier Glow", artist: "Polar Echoes", dur: "3:42" },
        { title: "Aurora Drift", artist: "Northern Lights", dur: "4:15" },
        { title: "Frost Beat", artist: "Ice Crystal", dur: "3:08" },
        { title: "Snowfall", artist: "Winter Haze", dur: "5:22" },
        { title: "Ice Palace", artist: "Frozen Lake", dur: "4:50" },
        { title: "Blizzard", artist: "Storm Front", dur: "3:33" }
      ];
      var html = '<div class="music-player" id="music-player"><div class="album-art">🎵</div><div class="track-title" id="mp-title">Glacier Glow</div><div class="track-artist" id="mp-artist">Polar Echoes</div>';
      html += '<div class="progress"><div class="progress-bar" id="mp-progress" style="width:0%"></div></div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin:4px 20px 12px"><span id="mp-current">0:00</span><span id="mp-dur">3:42</span></div>';
      html += '<div class="transport"><button id="mp-prev">⏮</button><button class="play-btn" id="mp-play">▶</button><button id="mp-next">⏭</button></div>';
      html += '<div class="playlist">';
      playlist.forEach(function(t, i) { html += '<div class="playlist-item ' + (i === 0 ? 'active' : '') + '" data-idx="' + i + '"><div class="pl-title">' + t.title + ' — ' + t.artist + '</div><div class="pl-dur">' + t.dur + '</div></div>'; });
      html += '</div></div>'; return html;
    },
    init: function(win) {
      var playlist = [
        { title: "Glacier Glow", artist: "Polar Echoes", dur: "3:42", seconds: 222 },
        { title: "Aurora Drift", artist: "Northern Lights", dur: "4:15", seconds: 255 },
        { title: "Frost Beat", artist: "Ice Crystal", dur: "3:08", seconds: 188 },
        { title: "Snowfall", artist: "Winter Haze", dur: "5:22", seconds: 322 },
        { title: "Ice Palace", artist: "Frozen Lake", dur: "4:50", seconds: 290 },
        { title: "Blizzard", artist: "Storm Front", dur: "3:33", seconds: 213 }
      ];
      var current = 0, playing = false, elapsed = 0, interval;
      var player = win.body.querySelector("#music-player");
      var titleEl = win.body.querySelector("#mp-title"); var artistEl = win.body.querySelector("#mp-artist");
      var progressEl = win.body.querySelector("#mp-progress"); var currentEl = win.body.querySelector("#mp-current"); var durEl = win.body.querySelector("#mp-dur"); var playBtn = win.body.querySelector("#mp-play");
      function loadTrack(idx) { current = idx; elapsed = 0; titleEl.textContent = playlist[idx].title; artistEl.textContent = playlist[idx].artist; durEl.textContent = playlist[idx].dur; progressEl.style.width = "0%"; currentEl.textContent = "0:00"; win.body.querySelectorAll(".playlist-item").forEach(function(item, i) { item.classList.toggle("active", i === idx); }); }
      function toggle() {
        playing = !playing; playBtn.textContent = playing ? "⏸" : "▶"; player.classList.toggle("playing", playing);
        if (playing) {
          interval = setInterval(function() {
            elapsed++; if (elapsed >= playlist[current].seconds) { next(); return; }
            progressEl.style.width = (elapsed / playlist[current].seconds) * 100 + "%";
            var m = Math.floor(elapsed / 60), s = elapsed % 60; currentEl.textContent = m + ":" + (s < 10 ? "0" : "") + s;
          }, 1000);
        } else clearInterval(interval);
      }
      function next() { loadTrack((current + 1) % playlist.length); if (playing) { clearInterval(interval); elapsed = 0; toggle(); toggle(); } }
      function prev() { loadTrack((current - 1 + playlist.length) % playlist.length); }
      playBtn.onclick = toggle; win.body.querySelector("#mp-next").onclick = next; win.body.querySelector("#mp-prev").onclick = prev;
      win.body.querySelectorAll(".playlist-item").forEach(function(item) { item.onclick = function() { loadTrack(parseInt(item.dataset.idx)); if (!playing) toggle(); }; });
    }
  };

  AppRenderers.calendar = {
    title: "Calendar", window: { width: 360, height: 380 },
    render: function() { return '<div class="cal-header"><button id="cal-prev">◀</button><strong id="cal-month-year"></strong><button id="cal-next">▶</button></div><div class="calendar-grid" id="cal-grid"></div>'; },
    init: function(win) {
      var viewDate = new Date(); var grid = win.body.querySelector("#cal-grid"); var monthYear = win.body.querySelector("#cal-month-year");
      var dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      function render() {
        var year = viewDate.getFullYear(), month = viewDate.getMonth();
        monthYear.textContent = viewDate.toLocaleDateString([], { month: "long", year: "numeric" });
        var firstDay = new Date(year, month, 1).getDay(); var daysInMonth = new Date(year, month + 1, 0).getDate(); var today = new Date();
        var html = dayNames.map(function(d) { return '<div class="cal-day-name">' + d + '</div>'; }).join("");
        for (var i = 0; i < firstDay; i++) html += '<div class="cal-day other-month">' + new Date(year, month, 1 - (firstDay - i)).getDate() + '</div>';
        for (var d = 1; d <= daysInMonth; d++) { var isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear(); html += '<div class="cal-day' + (isToday ? ' today' : '') + '">' + d + '</div>'; }
        var remaining = 42 - (firstDay + daysInMonth); for (var d = 1; d <= remaining; d++) html += '<div class="cal-day other-month">' + d + '</div>';
        grid.innerHTML = html;
      }
      win.body.querySelector("#cal-prev").onclick = function() { viewDate.setMonth(viewDate.getMonth() - 1); render(); };
      win.body.querySelector("#cal-next").onclick = function() { viewDate.setMonth(viewDate.getMonth() + 1); render(); };
      render();
    }
  };

  AppRenderers.sysmon = {
    title: "System Monitor", window: { width: 440, height: 380 },
    render: function() {
      return '<div class="sysmon-grid"><div class="sysmon-card"><div class="label">CPU</div><div class="value" id="sm-cpu">0%</div><div class="bar"><div class="bar-fill" id="sm-cpu-bar" style="width:0%;background:var(--accent)"></div></div></div><div class="sysmon-card"><div class="label">Memory</div><div class="value" id="sm-mem">0%</div><div class="bar"><div class="bar-fill" id="sm-mem-bar" style="width:0%;background:var(--accent-2)"></div></div></div><div class="sysmon-card"><div class="label">Disk</div><div class="value" id="sm-disk">0%</div><div class="bar"><div class="bar-fill" id="sm-disk-bar" style="width:0%;background:var(--success)"></div></div></div><div class="sysmon-card"><div class="label">Network</div><div class="value" id="sm-net">0 KB/s</div><div class="bar"><div class="bar-fill" id="sm-net-bar" style="width:0%;background:var(--warning)"></div></div></div><div class="sysmon-card"><div class="label">Windows</div><div class="value" id="sm-wins">0</div></div><div class="sysmon-card"><div class="label">Uptime</div><div class="value" id="sm-uptime">0s</div></div></div>';
    },
    init: function(win) {
      var start = Date.now();
      var intv = setInterval(function() {
        if (!document.body.contains(win.el)) { clearInterval(intv); return; }
        var cpu = Math.floor(15 + Math.random() * 50), mem = Math.floor(30 + Math.random() * 35), disk = Math.floor(20 + Math.random() * 15), net = Math.floor(Math.random() * 500);
        var uptime = Math.floor((Date.now() - start) / 1000), mins = Math.floor(uptime / 60), secs = uptime % 60;
        win.body.querySelector("#sm-cpu").textContent = cpu + "%"; win.body.querySelector("#sm-cpu-bar").style.width = cpu + "%";
        win.body.querySelector("#sm-mem").textContent = mem + "%"; win.body.querySelector("#sm-mem-bar").style.width = mem + "%";
        win.body.querySelector("#sm-disk").textContent = disk + "%"; win.body.querySelector("#sm-disk-bar").style.width = disk + "%";
        win.body.querySelector("#sm-net").textContent = net + " KB/s"; win.body.querySelector("#sm-net-bar").style.width = Math.min(net / 5, 100) + "%";
        win.body.querySelector("#sm-wins").textContent = WM.windows.size;
        win.body.querySelector("#sm-uptime").textContent = mins + "m " + secs + "s";
      }, 1000);
    }
  };

  setInterval(function() {
    var cpu = Math.floor(24 + Math.random() * 40);
    var cpuEl = document.getElementById("cpu"); if (cpuEl) cpuEl.textContent = cpu + "%";
    var sparkline = document.getElementById("sparkline"); if (sparkline) sparkline.style.background = "linear-gradient(180deg, rgba(123,241,255," + (cpu / 100 * 0.4) + "), transparent)";
    var progress = document.getElementById("music-progress"); if (progress) progress.style.width = (30 + Math.random() * 50) + "%";
  }, 2600);

  EventBus.on("unlock", function() {
    var autoLaunch = Settings.get("autoLaunch") || [];
    setTimeout(function() { autoLaunch.forEach(function(app) { openApp(app); }); }, 500);
  });

  Notifications.render(); populateStartMenu();

  var savedBrightness = Settings.get("brightness");
  if (savedBrightness) { document.body.style.filter = "brightness(" + (savedBrightness / 100) + ")"; var br = document.getElementById("range-brightness"); if (br) br.value = savedBrightness; }

  var savedTheme = Settings.get("theme");
  if (savedTheme && savedTheme !== "dark") document.documentElement.dataset.theme = savedTheme;

  var savedUsername = Settings.get("username");
  if (savedUsername) document.querySelectorAll(".user-name").forEach(function(el) { el.textContent = savedUsername; });

  if (!Settings.get("snow")) { var sc = document.getElementById("snow-container"); if (sc) sc.style.display = "none"; }

})();

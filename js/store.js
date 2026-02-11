const STORAGE_KEY = 'life-dashboard-data';

const DEFAULT_DATA = {
  meta: {
    version: 1,
    lastModified: null,
    created: null
  },
  tasks: [],
  finances: [],
  health: [],
  notes: [],
  dumpbox_history: []
};

export const Store = {
  _data: null,
  _listeners: new Map(),

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this._data = JSON.parse(raw);
        // Ensure all expected categories exist
        for (const key of Object.keys(DEFAULT_DATA)) {
          if (key !== 'meta' && !this._data[key]) {
            this._data[key] = [];
          }
        }
      } catch {
        this._data = structuredClone(DEFAULT_DATA);
        this._data.meta.created = new Date().toISOString();
      }
    } else {
      this._data = structuredClone(DEFAULT_DATA);
      this._data.meta.created = new Date().toISOString();
    }
    this.save();
    return this._data;
  },

  save() {
    this._data.meta.lastModified = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
  },

  getCategory(category) {
    return this._data[category] || [];
  },

  addItem(category, item) {
    if (!this._data[category]) {
      this._data[category] = [];
    }
    item.id = crypto.randomUUID();
    item.createdAt = new Date().toISOString();
    item.updatedAt = null;
    this._data[category].unshift(item);
    this.save();
    this._notify(category);
    return item;
  },

  updateItem(category, id, updates) {
    const list = this._data[category];
    if (!list) return null;
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return null;
    Object.assign(list[idx], updates, { updatedAt: new Date().toISOString() });
    this.save();
    this._notify(category);
    return list[idx];
  },

  deleteItem(category, id) {
    if (!this._data[category]) return;
    this._data[category] = this._data[category].filter(i => i.id !== id);
    this.save();
    this._notify(category);
  },

  getAll() {
    return this._data;
  },

  // Ensure a category array exists in the data
  ensureCategory(category) {
    if (!this._data[category]) {
      this._data[category] = [];
      this.save();
    }
  },

  // Event system for reactivity
  on(category, callback) {
    if (!this._listeners.has(category)) {
      this._listeners.set(category, new Set());
    }
    this._listeners.get(category).add(callback);
    return () => this._listeners.get(category)?.delete(callback);
  },

  _notify(category) {
    const listeners = this._listeners.get(category);
    if (listeners) {
      for (const cb of listeners) {
        cb(this.getCategory(category));
      }
    }
    // Also notify '*' listeners (for home overview)
    const globalListeners = this._listeners.get('*');
    if (globalListeners) {
      for (const cb of globalListeners) {
        cb(category, this.getCategory(category));
      }
    }
  },

  // Export
  exportToJSON() {
    const blob = new Blob(
      [JSON.stringify(this._data, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Import
  async importFromJSON(file, mode = 'replace') {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.meta || !data.meta.version) {
      throw new Error('Invalid dashboard data file');
    }

    if (mode === 'replace') {
      this._data = data;
    } else if (mode === 'merge') {
      this._merge(data);
    }

    this.save();
    // Notify all categories
    for (const key of Object.keys(this._data)) {
      if (key !== 'meta') this._notify(key);
    }
    return true;
  },

  _merge(imported) {
    for (const category of Object.keys(imported)) {
      if (category === 'meta') continue;
      if (!Array.isArray(imported[category])) continue;

      this.ensureCategory(category);
      const localMap = new Map(this._data[category].map(i => [i.id, i]));

      for (const item of imported[category]) {
        const existing = localMap.get(item.id);
        if (!existing) {
          this._data[category].push(item);
        } else {
          const localTime = existing.updatedAt || existing.createdAt || '';
          const importTime = item.updatedAt || item.createdAt || '';
          if (importTime > localTime) {
            const idx = this._data[category].findIndex(i => i.id === item.id);
            this._data[category][idx] = item;
          }
        }
      }
    }
  }
};

const GameStorage = {
  _k: k => `archerlegend2_${k}`,

  get(k, def) {
    try { const v = localStorage.getItem(this._k(k)); return v !== null ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(k, v) { try { localStorage.setItem(this._k(k), JSON.stringify(v)); } catch {} },

  getBestStage()       { return this.get('bestStage', 1); },
  updateBestStage(s)   { if (s > this.getBestStage()) this.set('bestStage', s); },

  getTotalKills()      { return this.get('totalKills', 0); },
  addKills(n)          { this.set('totalKills', this.getTotalKills() + n); },

  getTotalRuns()       { return this.get('totalRuns', 0); },
  incrementRuns()      { this.set('totalRuns', this.getTotalRuns() + 1); },

  getSettings()        { return this.get('settings', { sfx: true, bgm: true, haptics: true }); },
  setSettings(s)       { this.set('settings', s); }
};

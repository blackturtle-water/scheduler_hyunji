/**
 * GitHub Gist Sync Module - scheduler_hyunji SAFE VERSION
 * - App-specific localStorage keys
 * - App-specific Gist file name
 * - Manual upload/download friendly
 */
window.GS_APP_ID = window.GS_APP_ID || 'scheduler_hyunji';

const GithubSync = {
  APP_ID: window.GS_APP_ID,
  KEYS: {
    PAT: `${window.GS_APP_ID}__gs_github_pat`,
    GIST_ID: `${window.GS_APP_ID}__gs_github_gist_id`,
    LAST_SYNC: `${window.GS_APP_ID}__gs_last_sync_time`
  },
  FILE_NAME: `${window.GS_APP_ID}-scheduler-data.json`,
  LEGACY_FILE_NAMES: [
    'scheduler-data.json',
    'g-scheduler-data.json',
    'gscheduler-data.json'
  ],
  GIST_DESCRIPTION: `G-Scheduler Sync Data - ${window.GS_APP_ID}`,

  getSettings() {
    return {
      pat: localStorage.getItem(this.KEYS.PAT) || '',
      gistId: localStorage.getItem(this.KEYS.GIST_ID) || '',
      lastSync: localStorage.getItem(this.KEYS.LAST_SYNC) || ''
    };
  },

  saveSettings(pat, gistId = '') {
    if (pat && String(pat).trim()) localStorage.setItem(this.KEYS.PAT, String(pat).trim());
    if (gistId && String(gistId).trim()) localStorage.setItem(this.KEYS.GIST_ID, String(gistId).trim());
  },

  clearSettings() {
    localStorage.removeItem(this.KEYS.PAT);
    localStorage.removeItem(this.KEYS.GIST_ID);
    localStorage.removeItem(this.KEYS.LAST_SYNC);
  },

  isConfigured() {
    return !!this.getSettings().pat;
  },

  async request(url, options = {}) {
    const { pat } = this.getSettings();
    if (!pat) throw new Error('PAT가 저장되지 않았습니다.');

    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      const msg = data && data.message ? data.message : `HTTP ${res.status}`;
      if (res.status === 401) throw new Error('401 인증 실패: PAT 오류 또는 만료');
      if (res.status === 403) throw new Error('403 권한 오류: PAT gist 권한 확인 필요');
      if (res.status === 404) throw new Error('404 Gist 오류: Gist ID 확인 필요');
      throw new Error(`GitHub API 오류: ${msg}`);
    }
    return data;
  },

  findDataFile(gist) {
    if (!gist || !gist.files) return null;
    if (gist.files[this.FILE_NAME]) return gist.files[this.FILE_NAME];
    for (const name of this.LEGACY_FILE_NAMES) {
      if (gist.files[name]) return gist.files[name];
    }
    return Object.values(gist.files).find(f => f.filename && f.filename.toLowerCase().endsWith('.json')) || null;
  },

  async getGist() {
    const { gistId } = this.getSettings();
    if (!gistId) return null;
    return await this.request(`https://api.github.com/gists/${gistId}`, { method: 'GET' });
  },

  async findExistingGist() {
    const gists = await this.request('https://api.github.com/gists', { method: 'GET' });
    const found = gists.find(g => (g.description === this.GIST_DESCRIPTION) || (g.files && g.files[this.FILE_NAME]));
    if (found && found.id) {
      localStorage.setItem(this.KEYS.GIST_ID, found.id);
      return found.id;
    }
    return '';
  },

  async createGist(data) {
    const body = {
      description: this.GIST_DESCRIPTION,
      public: false,
      files: {
        [this.FILE_NAME]: { content: JSON.stringify(data || {}, null, 2) }
      }
    };
    const gist = await this.request('https://api.github.com/gists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (gist && gist.id) localStorage.setItem(this.KEYS.GIST_ID, gist.id);
    return gist;
  },

  async downloadData() {
    let { gistId } = this.getSettings();
    if (!gistId) gistId = await this.findExistingGist();
    if (!gistId) return null;

    const gist = await this.getGist();
    const file = this.findDataFile(gist);
    if (!file || !file.content) return null;

    try {
      return JSON.parse(file.content);
    } catch {
      throw new Error('Gist 데이터 JSON 파싱 실패');
    }
  },

  async uploadData(data) {
    let { gistId } = this.getSettings();
    if (!gistId) gistId = await this.findExistingGist();
    if (!gistId) return await this.createGist(data);

    const body = {
      description: this.GIST_DESCRIPTION,
      files: {
        [this.FILE_NAME]: { content: JSON.stringify(data || {}, null, 2) }
      }
    };
    return await this.request(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
};

const AutoSync = {
  uploadTimer: null,
  debounceMs: 2000,
  syncing: false,
  scheduleUpload() {
    // Safe sync version: automatic cloud upload is disabled intentionally.
    // Use [클라우드 업로드] manually to prevent different devices from overwriting each other.
  }
};

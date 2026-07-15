/**
 * G-Scheduler GitHub Gist Sync - scheduler_hyunji final
 * Uses app-specific localStorage keys and app-specific Gist file name.
 */

window.GS_APP_ID = window.GS_APP_ID || 'scheduler_hyunji';

const GithubSync = {
  KEYS: {
    PAT: `${window.GS_APP_ID}__gs_github_pat`,
    GIST_ID: `${window.GS_APP_ID}__gs_github_gist_id`,
    LAST_SYNC: `${window.GS_APP_ID}__gs_last_sync_time`
  },

  FILE_NAME: `${window.GS_APP_ID}-scheduler-data.json`,
  GIST_DESCRIPTION: `G-Scheduler Sync Data - ${window.GS_APP_ID}`,

  getSettings() {
    return {
      pat: localStorage.getItem(this.KEYS.PAT) || '',
      gistId: localStorage.getItem(this.KEYS.GIST_ID) || '',
      lastSync: localStorage.getItem(this.KEYS.LAST_SYNC) || ''
    };
  },

  saveSettings(pat, gistId = '') {
    if (pat) localStorage.setItem(this.KEYS.PAT, pat.trim());
    else localStorage.removeItem(this.KEYS.PAT);

    if (gistId) localStorage.setItem(this.KEYS.GIST_ID, gistId.trim());
    else localStorage.removeItem(this.KEYS.GIST_ID);
  },

  isConfigured() {
    return !!this.getSettings().pat;
  },

  getHeaders(pat) {
    return {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  },

  async request(url, options = {}) {
    const { pat } = this.getSettings();
    if (!pat) throw new Error('GitHub PAT가 설정되지 않았습니다.');
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(pat),
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('401 인증 실패: PAT 오류 또는 만료');
      if (res.status === 403) throw new Error('403 권한 오류: PAT gist 권한 확인 필요');
      if (res.status === 404) throw new Error('404 Gist 오류: Gist ID 확인 필요');
      throw new Error(err.message || `GitHub API 오류: ${res.status}`);
    }
    return await res.json();
  },

  async findExistingGist() {
    const gists = await this.request('https://api.github.com/gists', { method: 'GET' });
    const found = gists.find(g => {
      const hasFile = g.files && g.files[this.FILE_NAME];
      const sameDescription = g.description === this.GIST_DESCRIPTION;
      return hasFile || sameDescription;
    });
    if (found) {
      localStorage.setItem(this.KEYS.GIST_ID, found.id);
      return found.id;
    }
    return '';
  },

  async uploadData(data) {
    let { gistId } = this.getSettings();
    if (!gistId) gistId = await this.findExistingGist();

    const body = {
      description: this.GIST_DESCRIPTION,
      public: false,
      files: {
        [this.FILE_NAME]: {
          content: JSON.stringify({
            app: 'G-Scheduler',
            appId: window.GS_APP_ID,
            updatedAt: new Date().toISOString(),
            data
          }, null, 2)
        }
      }
    };

    const result = await this.request(
      gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists',
      { method: gistId ? 'PATCH' : 'POST', body: JSON.stringify(body) }
    );

    localStorage.setItem(this.KEYS.GIST_ID, result.id);
    const now = new Date().toISOString();
    localStorage.setItem(this.KEYS.LAST_SYNC, now);
    return { success: true, gistId: result.id, updatedAt: now };
  },

  async downloadData() {
    let { gistId } = this.getSettings();
    if (!gistId) gistId = await this.findExistingGist();
    if (!gistId) return { success: false, data: null, message: '동기화용 Gist가 없습니다.' };

    const gist = await this.request(`https://api.github.com/gists/${gistId}`, { method: 'GET' });
    localStorage.setItem(this.KEYS.GIST_ID, gist.id);

    const file = gist.files && gist.files[this.FILE_NAME];
    if (!file || !file.content) return { success: false, data: null, message: 'Gist에 현지 사이트 데이터 파일이 없습니다.' };

    const parsed = JSON.parse(file.content);
    const data = parsed && parsed.data ? parsed.data : parsed;
    const now = new Date().toISOString();
    localStorage.setItem(this.KEYS.LAST_SYNC, now);
    return { success: true, data, updatedAt: now, remoteUpdatedAt: parsed.updatedAt || gist.updated_at || '' };
  }
};

const AutoSync = {
  uploadTimer: null,
  debounceMs: 2000,
  syncing: false,

  scheduleUpload(data) {
    if (!GithubSync.isConfigured()) return;
    clearTimeout(this.uploadTimer);
    this.uploadTimer = setTimeout(async () => {
      if (this.syncing) return;
      this.syncing = true;
      try {
        if (typeof setMobileSyncStatus === 'function') setMobileSyncStatus('자동 업로드 중...', 'syncing');
        await GithubSync.uploadData(data);
        if (typeof setMobileSyncStatus === 'function') setMobileSyncStatus('자동 업로드 완료', 'online');
        if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
        if (typeof renderSyncLogBox === 'function') renderSyncLogBox();
      } catch (e) {
        console.warn('자동 업로드 실패:', e.message);
        if (typeof setMobileSyncStatus === 'function') setMobileSyncStatus(`자동 업로드 실패: ${e.message}`, 'error');
      } finally {
        this.syncing = false;
      }
    }, this.debounceMs);
  }
};

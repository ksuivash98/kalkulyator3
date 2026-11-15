'use strict';

/** Supabase REST auth; only public project configuration is shipped to the browser. */
class SalaryCloudApi {
  constructor(config) {
    this.url = (config.url || '').replace(/\/$/, '');
    this.key = config.publishableKey || '';
  }
  get configured() {
    if (this.key.startsWith('sb_secret_')) return false;
    if (this.key.startsWith('eyJ')) {
      try { if (JSON.parse(atob(this.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') return false; }
      catch { return false; }
    }
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(this.url) && Boolean(this.key);
  }
  async request(path, { token, body, method = 'GET' } = {}) {
    const response = await fetch(this.url + path, {
      method, headers: { apikey: this.key, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Сессия истекла. Войдите снова.' : response.status === 429 ? 'Слишком много попыток. Попробуйте позже.' : 'Не удалось выполнить запрос. Проверьте подключение и настройки аккаунта.');
      error.status = response.status;
      error.conflict = data?.code === '40001';
      throw error;
    }
    return data;
  }
  login(email, password) { return this.request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }); }
  register(email, password) { return this.request('/auth/v1/signup', { method: 'POST', body: { email, password } }); }
  refresh(token) { return this.request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: token } }); }
  async read(token, userId) {
    const rows = await this.request(`/rest/v1/salary_snapshots?user_id=eq.${encodeURIComponent(userId)}&select=payload,revision`, { token });
    return rows[0] || null;
  }
  save(token, payload, revision) { return this.request('/rest/v1/rpc/save_salary_snapshot', { token, method: 'POST', body: { payload, expected_revision: revision } }); }
}

class SalaryCloudController {
  constructor(app, config = window.SALARY_CLOUD_CONFIG || {}) {
    this.app = app;
    this.storage = app.storage;
    this.api = new SalaryCloudApi(config);
    this.session = null;
    this.epoch = 0;
    this.busy = false;
    this.conflict = false;
    this.timer = null;
    this.authKey = `salary_cloud_session:${this.api.url}`;
  }
  status(message) { document.querySelector('#cloud-status').textContent = message; }
  meta() { return this.storage.get('cloud_meta', { revision: 0, dirty: false, version: 0 }); }
  start() {
    // Email confirmation may return tokens in the fragment. Login is explicit here;
    // do not retain credentials in the browser address or import a URL session.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (fragment.has('access_token') || fragment.has('refresh_token')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    document.querySelector('#cloud-auth-form').addEventListener('submit', e => { e.preventDefault(); this.authenticate(e.submitter?.value || 'login'); });
    document.querySelector('#cloud-logout').addEventListener('click', () => this.logout());
    document.querySelector('#cloud-sync').addEventListener('click', () => this.sync());
    document.querySelector('#cloud-import-local').addEventListener('click', () => this.importGuest());
    document.querySelector('#cloud-use-server').addEventListener('click', () => this.resolveConflict('server'));
    document.querySelector('#cloud-use-local').addEventListener('click', () => this.resolveConflict('local'));
    window.addEventListener('salary-data-changed', e => {
      if (e.detail.accountId === this.session?.user.id) {
        clearTimeout(this.timer);
        this.status(this.conflict ? 'Есть разные версии данных. Выберите, какую сохранить.' : 'Изменения сохранены на устройстве. Ожидается синхронизация…');
        this.timer = setTimeout(() => this.sync(), 1000);
      }
    });
    window.addEventListener('online', () => this.sync());
    window.addEventListener('focus', () => this.sync());
    // Re-enter on another tab's login/logout; never keep showing the previous account.
    window.addEventListener('storage', e => {
      if (this.session && e.key === this.storage.scopedKey(STORAGE_KEYS.EMPLOYEES)) {
        const pending = this.app.autoSave.pending();
        if (pending) this.storage.createBackup(this.app.employees.map(employee => employee.toJSON()));
        this.reloadApp();
        this.status(pending ? 'Другая вкладка обновила данные. Ваш черновик сохранён в локальной резервной копии.' : 'Данные обновлены другой вкладкой.');
      }
      if (e.key === this.authKey) {
        const session = this.readSession();
        this.switchSession(session);
        this.sync();
      }
    });
    this.poll = setInterval(() => this.sync(), 30000);
    this.switchSession(this.api.configured ? this.readSession() : null);
    this.sync();
  }
  readSession() {
    try {
      const session = JSON.parse(localStorage.getItem(this.authKey));
      return session?.user?.id && session.access_token && session.refresh_token ? session : null;
    } catch { return null; }
  }
  keepSession(session) {
    const value = { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in, user: { id: session.user.id, email: session.user.email } };
    localStorage.setItem(this.authKey, JSON.stringify(value));
    return value;
  }
  switchSession(session) {
    // Cancel delayed saves before changing the namespace; flush current form data first.
    this.app.autoSave.flush();
    this.epoch += 1;
    this.session = session;
    this.conflict = false;
    clearTimeout(this.timer);
    this.storage.accountId = session?.user.id || null;
    this.reloadApp();
    document.querySelector('#cloud-auth-form').hidden = Boolean(session) || !this.api.configured;
    document.querySelector('#cloud-account').hidden = !session;
    document.querySelector('#cloud-conflict').hidden = true;
    document.querySelector('#cloud-email-label').textContent = session?.user.email || '';
    this.status(!this.api.configured ? 'Облачный вход ещё не подключён. Данные сохраняются только в этом браузере.' : session ? 'Данные аккаунта открыты. Подключение к облаку…' : 'Войдите, чтобы открыть свои данные на другом устройстве.');
  }
  reloadApp() {
    this.app.autoSave.cancel();
    this.storage.suppressCloud = true;
    try {
      this.app.closeDayModal();
      this.app.employeeSearch = '';
      document.querySelector('#employee-search').value = '';
      this.app.loadEmployeesFromStorage();
      this.app.applyTheme(this.storage.getTheme());
      this.app.renderAll();
    } finally { this.storage.suppressCloud = false; }
  }
  async authenticate(action) {
    if (this.busy || this.authPending || !this.api.configured) return;
    const email = document.querySelector('#cloud-email').value.trim();
    const input = document.querySelector('#cloud-password');
    const password = input.value;
    this.authPending = true;
    this.authBusy(true);
    this.status(action === 'register' ? 'Создание аккаунта…' : 'Вход…');
    try {
      const data = action === 'register' ? await this.api.register(email, password) : await this.api.login(email, password);
      if (!data.access_token) { this.status('Проверьте почту и подтвердите адрес. После подтверждения войдите здесь.'); return; }
      this.switchSession(this.keepSession(data));
      await this.sync();
    } catch (error) {
      this.status(error.status === 400 ? 'Не удалось войти или зарегистрироваться. Проверьте email, пароль и подтверждение почты.' : error.message);
    } finally { input.value = ''; this.authPending = false; this.authBusy(false); }
  }
  authBusy(value) { document.querySelectorAll('#cloud-auth-form button').forEach(button => { button.disabled = value; }); }
  async token(epoch) {
    if (this.session.expires_at > Date.now() / 1000 + 60) return this.session.access_token;
    const session = await this.api.refresh(this.session.refresh_token);
    if (epoch !== this.epoch) throw new Error('Аккаунт изменён.');
    this.session = this.keepSession(session);
    return this.session.access_token;
  }
  validPayload(payload) {
    return payload?.version === 1 && Array.isArray(payload.employees) && payload.employees.every(employee => employee && typeof employee.id === 'string' && typeof employee.name === 'string' && employee.periods && typeof employee.periods === 'object' && !Array.isArray(employee.periods));
  }
  applySnapshot(row) {
    if (!this.validPayload(row.payload)) throw new Error('Облачные данные имеют неизвестный формат. Локальная копия сохранена.');
    // Validate model hydration before replacing the cached data.
    row.payload.employees.forEach(employee => Employee.fromJSON(employee));
    const storage = this.storage;
    storage.suppressCloud = true;
    try {
      if (!storage.saveEmployees(row.payload.employees, true)) throw new Error('Не удалось сохранить данные на устройстве. Освободите место.');
      storage.set('cloud_meta', { revision: row.revision, dirty: false, version: (this.meta().version || 0) + 1 });
    } finally { storage.suppressCloud = false; }
    this.reloadApp();
  }
  async sync() {
    if (!this.api.configured || !this.session || this.busy || this.conflict) return;
    if (!navigator.onLine) { this.status('Нет сети. Изменения сохранены на устройстве и отправятся при подключении.'); return; }
    this.busy = true;
    const epoch = this.epoch;
    const accountId = this.session.user.id;
    try {
      // Flush pending UI edits before deciding whether the cloud may replace local data.
      this.app.autoSave.flush();
      if (this.storage.saveFailed) throw new Error('Не удалось сохранить изменения на устройстве. Освободите место.');
      const token = await this.token(epoch);
      const remote = await this.api.read(token, accountId);
      if (epoch !== this.epoch) return;
      // User may have edited while the request was in flight. Flush again, then read metadata.
      this.app.autoSave.flush();
      if (this.storage.saveFailed) throw new Error('Не удалось сохранить изменения на устройстве. Освободите место.');
      const meta = this.meta();
      if (meta.dirty) {
        if ((remote?.revision || 0) !== meta.revision) { this.showConflict(); return; }
        const payload = { version: 1, employees: this.storage.loadEmployees() };
        const saved = await this.api.save(token, payload, meta.revision);
        if (epoch !== this.epoch) return;
        const latest = this.meta();
        this.storage.set('cloud_meta', { ...latest, revision: saved.revision, dirty: latest.version !== meta.version });
        this.status(latest.version === meta.version ? 'Синхронизировано. Данные доступны на других устройствах.' : 'Есть новые локальные изменения. Ожидается синхронизация…');
      } else if (remote) {
        if (remote.revision !== meta.revision) this.applySnapshot(remote);
        this.status('Синхронизировано. Данные доступны на других устройствах.');
      } else {
        this.status('В облаке пока нет данных. Добавьте сотрудника или перенесите данные этого браузера.');
      }
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error.conflict) this.showConflict();
      else this.status(error.status === 401 ? 'Сессия истекла. Выйдите и войдите снова; локальные изменения сохранены.' : 'Не удалось синхронизировать. Локальные данные сохранены. ' + error.message);
    } finally { this.busy = false; }
  }
  showConflict() {
    this.conflict = true;
    document.querySelector('#cloud-conflict').hidden = false;
    this.status('Данные изменились на другом устройстве. Автоматическая замена приостановлена.');
  }
  async resolveConflict(choice) {
    if (this.busy || !this.session) return;
    if (!window.confirm(choice === 'server' ? 'Загрузить облачную версию? Текущая версия останется в резервной копии этого аккаунта на устройстве.' : 'Заменить данные в облаке текущей версией этого устройства? Изменения другого устройства будут заменены.')) return;
    this.busy = true;
    const epoch = this.epoch;
    try {
      const token = await this.token(epoch);
      const remote = await this.api.read(token, this.session.user.id);
      if (epoch !== this.epoch) return;
      this.app.autoSave.flush();
      if (choice === 'server' && remote) this.applySnapshot(remote);
      else {
        const meta = this.meta();
        this.storage.set('cloud_meta', { ...meta, revision: remote?.revision || 0, dirty: true });
      }
      this.conflict = false;
      document.querySelector('#cloud-conflict').hidden = true;
    } catch (error) { this.status(error.message); }
    finally { this.busy = false; }
    if (!this.conflict) this.sync();
  }
  importGuest() {
    if (!this.session || this.busy || this.conflict) return;
    const guest = new StorageService().loadEmployees();
    if (!guest.length) { this.status('В этом браузере нет данных для переноса.'); return; }
    if (!window.confirm('Добавить сотрудников из локального режима в этот аккаунт? Сотрудники будут скопированы с новыми идентификаторами, существующие данные аккаунта сохранятся.')) return;
    this.app.autoSave.flush();
    const imported = guest.map(employee => ({ ...employee, id: Utils.generateId() }));
    this.storage.saveEmployees([...this.storage.loadEmployees(), ...imported], true);
    this.reloadApp(); this.sync();
  }
  logout() {
    if (!this.session) return;
    if ((this.meta().dirty || this.app.autoSave.pending()) && !window.confirm('Есть неотправленные изменения. Они останутся на этом устройстве и будут доступны после входа в тот же аккаунт. Выйти?')) return;
    const token = this.session.access_token;
    localStorage.removeItem(this.authKey);
    this.switchSession(null);
    // Local logout always succeeds, even offline. Cached records stay in their account namespace.
    this.api.request('/auth/v1/logout?scope=local', { method: 'POST', token }).catch(() => {});
  }
}

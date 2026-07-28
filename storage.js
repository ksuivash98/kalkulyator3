/**
 * @file storage.js
 * @description Сервис LocalStorage: сотрудники, состояние UI, резервные копии.
 */

'use strict';

/**
 * Сервис постоянного хранения данных приложения.
 * Обеспечивает автосохранение и ротацию резервных копий.
 */
class StorageService {
  /**
   * @param {string} [employeesKey]
   * @param {string} [backupsKey]
   */
  constructor(
    employeesKey = STORAGE_KEYS.EMPLOYEES,
    backupsKey = STORAGE_KEYS.BACKUPS
  ) {
    this.employeesKey = employeesKey;
    this.backupsKey = backupsKey;
  }

  /**
   * Чтение JSON из LocalStorage.
   * @param {string} key
   * @param {*} [fallback=null]
   * @returns {*}
   */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      console.error('StorageService.get error:', key, error);
      return fallback;
    }
  }

  /**
   * Запись JSON в LocalStorage.
   * @param {string} key
   * @param {*} value
   * @returns {boolean}
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('StorageService.set error:', key, error);
      return false;
    }
  }

  /**
   * Удаление ключа.
   * @param {string} key
   */
  remove(key) {
    localStorage.removeItem(key);
  }

  /* ------------------------------------------------------------------------
   * Сотрудники
   * ---------------------------------------------------------------------- */

  /**
   * Загружает всех сотрудников.
   * @returns {Object[]}
   */
  loadEmployees() {
    const data = this.get(this.employeesKey, []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Сохраняет список сотрудников и создаёт резервную копию.
   * @param {Object[]} employees
   * @param {boolean} [createBackup=true]
   */
  saveEmployees(employees, createBackup = true) {
    if (createBackup) {
      this.createBackup(employees);
    }
    this.set(this.employeesKey, employees);
  }

  /**
   * Сохраняет одного сотрудника в общем списке.
   * @param {Object} employeeData
   */
  saveEmployee(employeeData) {
    const employees = this.loadEmployees();
    const index = employees.findIndex((item) => item.id === employeeData.id);
    if (index >= 0) {
      employees[index] = employeeData;
    } else {
      employees.push(employeeData);
    }
    this.saveEmployees(employees, true);
  }

  /**
   * Удаляет сотрудника по id.
   * @param {string} employeeId
   */
  deleteEmployee(employeeId) {
    const employees = this.loadEmployees().filter((item) => item.id !== employeeId);
    this.saveEmployees(employees, true);
  }

  /* ------------------------------------------------------------------------
   * Активное состояние
   * ---------------------------------------------------------------------- */

  /**
   * Возвращает id активного сотрудника.
   * @returns {string|null}
   */
  getActiveEmployeeId() {
    return this.get(STORAGE_KEYS.ACTIVE_EMPLOYEE, null);
  }

  /**
   * Сохраняет id активного сотрудника.
   * @param {string|null} employeeId
   */
  setActiveEmployeeId(employeeId) {
    this.set(STORAGE_KEYS.ACTIVE_EMPLOYEE, employeeId);
  }

  /**
   * Возвращает ключ активного периода.
   * @returns {string|null}
   */
  getActivePeriodKey() {
    return this.get(STORAGE_KEYS.ACTIVE_PERIOD, null);
  }

  /**
   * Сохраняет ключ активного периода.
   * @param {string|null} periodKey
   */
  setActivePeriodKey(periodKey) {
    this.set(STORAGE_KEYS.ACTIVE_PERIOD, periodKey);
  }

  /**
   * Тема интерфейса.
   * @returns {'light'|'dark'}
   */
  getTheme() {
    const theme = this.get(STORAGE_KEYS.THEME, 'light');
    return theme === 'dark' ? 'dark' : 'light';
  }

  /**
   * Сохраняет тему.
   * @param {'light'|'dark'} theme
   */
  setTheme(theme) {
    this.set(STORAGE_KEYS.THEME, theme);
  }

  /**
   * Дополнительное UI-состояние (вкладки и т.п.).
   * @returns {Object}
   */
  getUiState() {
    return this.get(STORAGE_KEYS.UI_STATE, { view: 'days' }) || { view: 'days' };
  }

  /**
   * Сохраняет UI-состояние.
   * @param {Object} state
   */
  setUiState(state) {
    this.set(STORAGE_KEYS.UI_STATE, state);
  }

  /* ------------------------------------------------------------------------
   * Резервные копии
   * ---------------------------------------------------------------------- */

  /**
   * Создаёт резервную копию текущего снимка сотрудников.
   * Хранит последние MAX_BACKUPS копий.
   * @param {Object[]} employees
   */
  createBackup(employees) {
    try {
      const backups = this.getBackups();
      const snapshot = {
        id: Utils.generateId(),
        createdAt: Date.now(),
        employees: Utils.deepClone(employees)
      };
      backups.unshift(snapshot);
      while (backups.length > MAX_BACKUPS) {
        backups.pop();
      }
      this.set(this.backupsKey, backups);
    } catch (error) {
      console.error('StorageService.createBackup error:', error);
    }
  }

  /**
   * Возвращает список резервных копий (метаданные + данные).
   * @returns {Array<{id: string, createdAt: number, employees: Object[]}>}
   */
  getBackups() {
    const data = this.get(this.backupsKey, []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Восстанавливает сотрудников из резервной копии.
   * @param {string} backupId
   * @returns {Object[]|null}
   */
  restoreBackup(backupId) {
    const backups = this.getBackups();
    const backup = backups.find((item) => item.id === backupId);
    if (!backup) return null;
    this.saveEmployees(backup.employees, false);
    return backup.employees;
  }

  /**
   * Полный экспорт всех данных приложения.
   * @returns {Object}
   */
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      employees: this.loadEmployees(),
      activeEmployeeId: this.getActiveEmployeeId(),
      activePeriodKey: this.getActivePeriodKey(),
      theme: this.getTheme(),
      uiState: this.getUiState()
    };
  }

  /**
   * Импорт полного снимка данных.
   * @param {Object} payload
   * @returns {boolean}
   */
  importAll(payload) {
    if (!payload || !Array.isArray(payload.employees)) {
      return false;
    }
    this.saveEmployees(payload.employees, true);
    if (payload.activeEmployeeId) {
      this.setActiveEmployeeId(payload.activeEmployeeId);
    }
    if (payload.activePeriodKey) {
      this.setActivePeriodKey(payload.activePeriodKey);
    }
    if (payload.theme) {
      this.setTheme(payload.theme);
    }
    if (payload.uiState) {
      this.setUiState(payload.uiState);
    }
    return true;
  }
}

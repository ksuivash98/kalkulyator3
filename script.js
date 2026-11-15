/**
 * @file script.js
 * @description UIController — управление интерфейсом, сотрудниками, периодами и автосохранением.
 */

'use strict';

/**
 * Главный контроллер пользовательского интерфейса.
 */
class UIController {
  constructor() {
    /** @type {StorageService} */
    this.storage = new StorageService();
    /** @type {ExportService} */
    this.exportService = new ExportService(this.storage);
    /** @type {Employee[]} */
    this.employees = [];
    /** @type {Employee|null} */
    this.activeEmployee = null;
    /** @type {EmployeePeriod|null} */
    this.activePeriod = null;
    /** @type {Object|null} */
    this.calculation = null;
    /** @type {number|null} */
    this.selectedDay = null;
    /** @type {string} */
    this.currentView = 'days';
    /** @type {string} */
    this.employeeSearch = '';
    /** @type {boolean} */
    this._suppressSave = false;

    this.autoSave = Utils.debounce(() => this.saveState(true), 400);
  }

  /* ========================================================================
   * Инициализация
   * ====================================================================== */

  /**
   * Точка входа приложения.
   */
  init() {
    this.applyTheme(this.storage.getTheme());
    this.loadEmployeesFromStorage();
    this.bindGlobalEvents();
    this.renderAll();
  }

  /**
   * Загрузка сотрудников из LocalStorage; при первом запуске — создание по умолчанию.
   */
  loadEmployeesFromStorage() {
    const raw = this.storage.loadEmployees();
    this.employees = raw.map((item) => Employee.fromJSON(item));

    if (this.employees.length === 0) {
      const employee = Employee.createDefault(DEFAULT_EMPLOYEE_NAME);
      this.employees.push(employee);
      this.storage.saveEmployees(this.employees.map((e) => e.toJSON()), false);
      this.storage.setActiveEmployeeId(employee.id);
    }

    const savedId = this.storage.getActiveEmployeeId();
    this.activeEmployee =
      this.employees.find((e) => e.id === savedId) || this.employees[0];

    const { year, month } = Utils.getCurrentYearMonth();
    const savedPeriod = this.storage.getActivePeriodKey();
    let periodYear = year;
    let periodMonth = month;

    if (savedPeriod) {
      const parsed = DataService.parsePeriodKey(savedPeriod);
      if (parsed.year && parsed.month) {
        periodYear = parsed.year;
        periodMonth = parsed.month;
      }
    }

    this.activePeriod = this.activeEmployee.getOrCreatePeriod(periodYear, periodMonth);
    this.storage.setActiveEmployeeId(this.activeEmployee.id);
    this.storage.setActivePeriodKey(this.activePeriod.key);

    const uiState = this.storage.getUiState();
    this.currentView = uiState.view || 'days';
  }

  /**
   * Сохранение текущего состояния.
   * @param {boolean} [withBackup=true]
   */
  saveState(withBackup = true) {
    if (this._suppressSave) return;
    if (this.activeEmployee) {
      this.activeEmployee.touch();
      const index = this.employees.findIndex((e) => e.id === this.activeEmployee.id);
      if (index >= 0) {
        this.employees[index] = this.activeEmployee;
      }
    }
    this.storage.saveEmployees(
      this.employees.map((e) => e.toJSON()),
      withBackup
    );
    if (this.activeEmployee) {
      this.storage.setActiveEmployeeId(this.activeEmployee.id);
    }
    if (this.activePeriod) {
      this.storage.setActivePeriodKey(this.activePeriod.key);
    }
    this.storage.setUiState({ view: this.currentView });
  }

  /**
   * Пересчёт и обновление зависимых блоков UI.
   */
  recalculateAndRefresh() {
    if (!this.activePeriod) return;

    try {
      this.syncPeriodFromInputs();
      this.syncKpiFromInputs();
      this.calculation = SalaryCalculator.calculatePeriod(this.activePeriod);
      this.renderHeader();
      this.renderCitySelect();
      this.renderWorkInfo();
      this.renderSeasonality();
      this.renderKpi();
      this.renderMonthTotals();
      this.renderStats();
      this.renderDaysList();
      this.renderCalendar();
      this.renderDayModalIfOpen();
    } catch (error) {
      console.error('recalculateAndRefresh', error);
      Utils.showToast('Не удалось обновить расчёт на экране', 'error');
    } finally {
      this.autoSave();
    }
  }

  /**
   * Считывает город, рабочие дни и часы из формы в модель периода.
   */
  syncPeriodFromInputs() {
    if (!this.activePeriod) return;

    const citySelect = Utils.$('#city-select');
    if (citySelect && citySelect.value) {
      this.activePeriod.cityId = EmployeePeriod.normalizeCityId(citySelect.value);
    }

    const workDays = Utils.$('#work-days');
    if (workDays) {
      this.activePeriod.workDays = Utils.toNumber(workDays.value, 0);
    }

    const workHours = Utils.$('#work-hours');
    if (workHours) {
      this.activePeriod.workHours = Utils.toNumber(workHours.value, 0);
    }
  }

  /**
   * Считывает KPI из полей ввода в модель периода.
   * Гарантирует, что расчёт видит актуальные значения с экрана.
   */
  syncKpiFromInputs() {
    if (!this.activePeriod) return;
    if (!this.activePeriod.kpi) {
      this.activePeriod.kpi = EmployeePeriod.normalizeKpi();
    }

    const fields = [
      ['#kpi-sim', 'sim'],
      ['#kpi-conversion', 'conversion'],
      ['#kpi-focus-spd', 'focusSpd'],
      ['#kpi-focus-cs', 'focusCs'],
      ['#kpi-focus-mnp', 'focusMnp'],
      ['#kpi-credits', 'credits'],
      ['#kpi-accessories', 'accessories'],
      ['#kpi-insurance', 'insurance']
    ];

    fields.forEach(([selector, key]) => {
      const el = Utils.$(selector);
      if (!el) return;
      const raw = String(el.value).trim();
      if (raw === '') return;
      this.activePeriod.kpi[key] = Utils.toNumber(raw, 0);
    });

    const planMet = Utils.$('#kpi-credits-plan-met');
    if (planMet) {
      this.activePeriod.kpi.applicationsPlanMet = Boolean(planMet.checked);
    }

    this.activePeriod.kpi = EmployeePeriod.normalizeKpi(this.activePeriod.kpi);
  }

  /* ========================================================================
   * События
   * ====================================================================== */

  /**
   * Глобальные обработчики DOM.
   */
  /**
   * Безопасная привязка обработчика к элементу.
   * @param {string} selector
   * @param {string} eventName
   * @param {Function} handler
   */
  bindEvent(selector, eventName, handler) {
    const el = Utils.$(selector);
    if (!el) {
      console.warn(`UIController: элемент не найден — ${selector}`);
      return;
    }
    el.addEventListener(eventName, handler);
  }

  bindGlobalEvents() {
    // Тема
    this.bindEvent('#btn-theme', 'click', () => this.toggleTheme());

    // Сотрудники
    this.bindEvent('#btn-employee-add', 'click', () => this.createEmployee());
    this.bindEvent('#btn-employee-rename', 'click', () => this.renameEmployee());
    this.bindEvent('#btn-employee-duplicate', 'click', () => this.duplicateEmployee());
    this.bindEvent('#btn-employee-delete', 'click', () => this.deleteEmployee());
    this.bindEvent('#employee-search', 'input', (e) => {
      this.employeeSearch = e.target.value.trim().toLowerCase();
      this.renderEmployeeList();
    });

    // Период
    this.bindEvent('#period-month', 'change', () => this.onPeriodChange());
    this.bindEvent('#period-year', 'change', () => this.onPeriodChange());

    // Город и рабочее время
    this.bindEvent('#city-select', 'change', () => this.recalculateAndRefresh());
    this.bindEvent('#work-days', 'input', () => this.recalculateAndRefresh());
    this.bindEvent('#work-hours', 'input', () => this.recalculateAndRefresh());

    this.bindEvent('#goal-mode', 'change', e => {
      this.activePeriod.salaryGoal.mode = e.target.value;
      this.renderSalaryGoal(true); this.autoSave();
    });
    Utils.$('#goal-auto')?.addEventListener('input', e => {
      const field = e.target.dataset.planField;
      const rate = e.target.dataset.planRate;
      if (!field && !rate) return;
      const goal = this.activePeriod.salaryGoal;
      if (field) goal.realistic[field] = e.target.value === '' && ['hours', 'shifts'].includes(field) ? null : Number(e.target.value);
      if (rate) goal.rates[rate] = e.target.value === '' ? null : Number(e.target.value) / (e.target.dataset.percent === 'true' ? 100 : 1);
      this.renderSalaryGoal(); this.autoSave();
    });

    this.bindEvent('#goal-desired', 'input', () => {
      if (!this.activePeriod) return;
      this.activePeriod.salaryGoal.desired = Math.max(0, Utils.toNumber(Utils.$('#goal-desired').value, 0));
      this.renderSalaryGoal();
      this.autoSave();
    });
    this.bindEvent('#goal-add-line', 'click', () => {
      if (!this.activePeriod) return;
      this.activePeriod.salaryGoal.lines.push(new DayLineItem({ block: BLOCKS.SALES, indicatorId: 'accessories' }).toJSON());
      this.renderSalaryGoal(true);
      this.autoSave();
    });

    // KPI — делегирование на панель, чтобы не терять обработчики
    const kpiPanel = Utils.$('#kpi-panel');
    if (kpiPanel) {
      kpiPanel.addEventListener('input', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
          return;
        }
        if (!target.id || !target.id.startsWith('kpi-')) return;
        this.syncKpiFromInputs();
        this.recalculateAndRefresh();
      });
      kpiPanel.addEventListener('change', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
          return;
        }
        if (!target.id || !target.id.startsWith('kpi-')) return;
        this.syncKpiFromInputs();
        this.recalculateAndRefresh();
      });
    }

    // Вкладки
    Utils.$$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        this.renderTabs();
        this.saveState(false);
      });
    });

    // Экспорт
    this.bindEvent('#btn-export-pdf', 'click', () => this.handleExportPdf());
    this.bindEvent('#btn-export-excel', 'click', () => this.handleExportExcel());
    this.bindEvent('#btn-export-json', 'click', () => this.handleExportJson());
    this.bindEvent('#btn-import-json', 'click', () => {
      const input = Utils.$('#import-file');
      if (input) input.click();
    });
    this.bindEvent('#import-file', 'change', (e) => this.handleImportFile(e));

    // Модальное окно дня
    this.bindEvent('#day-modal-close', 'click', () => this.closeDayModal());
    this.bindEvent('#day-modal-backdrop', 'click', () => this.closeDayModal());
    this.bindEvent('#day-hours', 'input', (e) => this.onDayFieldChange('hours', e.target.value));
    this.bindEvent('#day-comment', 'input', (e) => this.onDayFieldChange('comment', e.target.value));
    this.bindEvent('#btn-add-sales-line', 'click', () => this.addDayLine(BLOCKS.SALES));
    this.bindEvent('#btn-add-admin-line', 'click', () => this.addDayLine(BLOCKS.ADMIN));
    this.bindEvent('#btn-add-operator-line', 'click', () => this.addDayLine(BLOCKS.OPERATOR));

    // FAB меню
    this.bindEvent('#fab-main', 'click', () => {
      Utils.$('#fab-menu')?.classList.toggle('fab-menu--open');
    });
    this.bindEvent('#fab-add-employee', 'click', () => {
      this.createEmployee();
      Utils.$('#fab-menu')?.classList.remove('fab-menu--open');
    });
    this.bindEvent('#fab-export', 'click', () => {
      Utils.$('#export-panel')?.scrollIntoView({ behavior: 'smooth' });
      Utils.$('#fab-menu')?.classList.remove('fab-menu--open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeDayModal();
    });
  }

  /* ========================================================================
   * Тема
   * ====================================================================== */

  /**
   * @param {'light'|'dark'} theme
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.storage.setTheme(theme);
    const btn = Utils.$('#btn-theme');
    if (btn) {
      btn.innerHTML = theme === 'dark'
        ? '<span aria-hidden="true">☀️</span><span>Светлая</span>'
        : '<span aria-hidden="true">🌙</span><span>Тёмная</span>';
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light';
    this.applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ========================================================================
   * Сотрудники
   * ====================================================================== */

  createEmployee() {
    const name = Utils.prompt('ФИО нового сотрудника:', 'Новый сотрудник');
    if (name === null) return;
    const employee = Employee.createDefault(name.trim() || DEFAULT_EMPLOYEE_NAME);
    this.employees.push(employee);
    this.selectEmployee(employee.id);
    Utils.showToast('Сотрудник создан', 'success');
  }

  renameEmployee() {
    if (!this.activeEmployee) return;
    const name = Utils.prompt('Новое ФИО:', this.activeEmployee.name);
    if (name === null) return;
    this.activeEmployee.rename(name);
    this.saveState(true);
    this.renderEmployeeList();
    this.renderHeader();
    Utils.showToast('Сотрудник переименован', 'success');
  }

  duplicateEmployee() {
    if (!this.activeEmployee) return;
    const copy = this.activeEmployee.duplicate();
    this.employees.push(copy);
    this.selectEmployee(copy.id);
    Utils.showToast('Сотрудник скопирован', 'success');
  }

  deleteEmployee() {
    if (!this.activeEmployee) return;
    if (this.employees.length <= 1) {
      Utils.showToast('Нельзя удалить единственного сотрудника', 'error');
      return;
    }
    if (!Utils.confirm(`Удалить сотрудника «${this.activeEmployee.name}»?`)) return;
    const id = this.activeEmployee.id;
    this.employees = this.employees.filter((e) => e.id !== id);
    this.storage.deleteEmployee(id);
    this.selectEmployee(this.employees[0].id);
    Utils.showToast('Сотрудник удалён', 'info');
  }

  /**
   * @param {string} employeeId
   */
  selectEmployee(employeeId) {
    const employee = this.employees.find((e) => e.id === employeeId);
    if (!employee) return;

    this.activeEmployee = employee;
    const { year, month } = this.activePeriod
      ? { year: this.activePeriod.year, month: this.activePeriod.month }
      : Utils.getCurrentYearMonth();

    this.activePeriod = this.activeEmployee.getOrCreatePeriod(year, month);
    this.selectedDay = null;
    this.closeDayModal();
    this.saveState(true);
    this.renderAll();
  }

  /* ========================================================================
   * Периоды
   * ====================================================================== */

  onPeriodChange() {
    const month = Utils.toNumber(Utils.$('#period-month').value, 1);
    const year = Utils.toNumber(Utils.$('#period-year').value, Utils.getCurrentYearMonth().year);
    this.activePeriod = this.activeEmployee.getOrCreatePeriod(year, month);
    this.selectedDay = null;
    this.closeDayModal();
    this.saveState(true);
    this.renderAll();
  }

  /* ========================================================================
   * День
   * ====================================================================== */

  /**
   * @param {number} day
   */
  openDay(day) {
    this.selectedDay = day;
    const modal = Utils.$('#day-modal');
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
    this.renderDayModal();
  }

  closeDayModal() {
    const modal = Utils.$('#day-modal');
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');
    this.selectedDay = null;
  }

  /**
   * @param {'hours'|'comment'} field
   * @param {*} value
   */
  onDayFieldChange(field, value) {
    const day = this.getSelectedDayData();
    if (!day) return;
    if (field === 'hours') {
      day.hours = Utils.toNumber(value, 0);
    } else {
      day.comment = String(value);
    }
    this.recalculateAndRefresh();
  }

  /**
   * @returns {DayData|null}
   */
  getSelectedDayData() {
    if (!this.activePeriod || !this.selectedDay) return null;
    return this.activePeriod.getDay(this.selectedDay);
  }

  /**
   * Возвращает ключ категории активного периода через выбранный город.
   * @returns {string}
   */
  getActiveCategoryKey() {
    if (!this.activePeriod) {
      return EMPLOYEE_CATEGORIES.STANDARD;
    }
    return DataService.getCityCategoryKey(this.activePeriod.cityId);
  }

  /**
   * @param {string} block
   */
  addDayLine(block) {
    const day = this.getSelectedDayData();
    if (!day) return;
    const defaults = block === BLOCKS.SALES
      ? DataService.getEconomicIndicators()[0]
      : block === BLOCKS.ADMIN ? administrativeIndicators[0] : DataService.getOperatorIndicators()[0];
    day.addItem(block, defaults ? defaults.id : '', 0);
    this.recalculateAndRefresh();
  }

  /**
   * @param {string} itemId
   */
  removeDayLine(itemId) {
    const day = this.getSelectedDayData();
    if (!day) return;
    day.removeItem(itemId);
    this.recalculateAndRefresh();
  }

  /**
   * @param {string} itemId
   * @param {string} indicatorId
   */
  changeLineIndicator(itemId, indicatorId) {
    const day = this.getSelectedDayData();
    if (!day) return;
    const item = day.items.find((i) => i.id === itemId);
    if (!item) return;
    item.indicatorId = indicatorId;
    this.recalculateAndRefresh();
  }

  /**
   * @param {string} itemId
   * @param {*} value
   */
  changeLineValue(itemId, value) {
    const day = this.getSelectedDayData();
    if (!day) return;
    const item = day.items.find((i) => i.id === itemId);
    if (!item) return;
    // Сохраняем как число, но пустую строку не превращаем в 0 во время набора —
    // иначе мешает вводу. Для расчёта 0 при пустом значении.
    const raw = String(value).trim();
    item.value = raw === '' ? 0 : Utils.toNumber(raw, 0);
    this.recalculateAndRefresh();
  }

  /**
   * Редактируется ли сейчас поле внутри списка показателей дня.
   * @returns {boolean}
   */
  isEditingDayLineField() {
    const active = document.activeElement;
    if (!active || !active.closest) return false;
    return Boolean(active.closest('#sales-lines, #operator-lines, #admin-lines'));
  }

  /* ========================================================================
   * Экспорт / импорт
   * ====================================================================== */

  handleExportPdf() {
    if (!this.activeEmployee || !this.calculation) return;
    this.exportService.exportPdf(this.activeEmployee, this.calculation);
    Utils.showToast('Открыта форма для PDF', 'success');
  }

  handleExportExcel() {
    if (!this.activeEmployee || !this.calculation) return;
    this.exportService.exportExcel(this.activeEmployee, this.calculation);
    Utils.showToast('Excel-файл скачан', 'success');
  }

  handleExportJson() {
    if (!this.activeEmployee || !this.activePeriod || !this.calculation) return;
    this.exportService.exportJson(
      this.activeEmployee,
      this.activePeriod,
      this.calculation,
      'all'
    );
    Utils.showToast('JSON экспортирован', 'success');
  }

  /**
   * @param {Event} event
   */
  async handleImportFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;

    try {
      const text = await Utils.readFileAsText(file);
      const result = this.exportService.importJson(text, (employeeId, periodData, employeeName) => {
        let employee = this.employees.find((e) => e.id === employeeId);
        if (!employee) {
          employee = Employee.createDefault(employeeName || DEFAULT_EMPLOYEE_NAME);
          employee.id = employeeId;
          this.employees.push(employee);
        }
        const period = EmployeePeriod.fromJSON(periodData);
        employee.periods[period.key] = period;
        employee.touch();
        this.activeEmployee = employee;
        this.activePeriod = period;
        this.saveState(true);
      });

      if (!result.ok) {
        Utils.showToast(result.message, 'error');
        return;
      }

      // Перечитываем актуальное состояние из хранилища
      const raw = this.storage.loadEmployees();
      this.employees = raw.map((item) => Employee.fromJSON(item));

      if (result.type === 'period') {
        this.activeEmployee =
          this.employees.find((e) => e.id === this.activeEmployee.id) || this.employees[0];
        this.activePeriod = this.activeEmployee.getOrCreatePeriod(
          this.activePeriod.year,
          this.activePeriod.month
        );
      } else {
        const savedId = this.storage.getActiveEmployeeId();
        this.activeEmployee =
          this.employees.find((e) => e.id === savedId) || this.employees[0];
        const periodKey = this.storage.getActivePeriodKey();
        if (periodKey) {
          const { year, month } = DataService.parsePeriodKey(periodKey);
          this.activePeriod = this.activeEmployee.getOrCreatePeriod(year, month);
        } else {
          const cur = Utils.getCurrentYearMonth();
          this.activePeriod = this.activeEmployee.getOrCreatePeriod(cur.year, cur.month);
        }
      }

      this.storage.setActiveEmployeeId(this.activeEmployee.id);
      this.storage.setActivePeriodKey(this.activePeriod.key);
      this.renderAll();
      Utils.showToast(result.message, 'success');
    } catch (error) {
      console.error(error);
      Utils.showToast('Ошибка чтения файла', 'error');
    }
  }

  /* ========================================================================
   * Рендер
   * ====================================================================== */

  renderAll() {
    this._suppressSave = true;
    this.calculation = this.activePeriod
      ? SalaryCalculator.calculatePeriod(this.activePeriod)
      : null;
    this.renderHeader();
    this.renderEmployeeList();
    this.renderPeriodControls();
    this.renderCitySelect();
    this.renderSeasonality();
    this.renderWorkInfo();
    this.renderKpi();
    this.renderMonthTotals();
    this.renderStats();
    this.renderTabs();
    this.renderDaysList();
    this.renderCalendar();
    this._suppressSave = false;
  }

  renderHeader() {
    const title = Utils.$('#active-employee-name');
    const period = Utils.$('#active-period-label');
    if (title) title.textContent = this.activeEmployee ? this.activeEmployee.name : '—';
    if (period) period.textContent = this.activePeriod ? this.activePeriod.title : '—';
  }

  renderEmployeeList() {
    const list = Utils.$('#employee-list');
    if (!list) return;
    list.innerHTML = '';

    const filtered = this.employees.filter((e) =>
      e.name.toLowerCase().includes(this.employeeSearch)
    );

    if (filtered.length === 0) {
      list.innerHTML = '<li class="empty-hint">Никого не найдено</li>';
      return;
    }

    filtered.forEach((employee) => {
      const li = Utils.createElement('li', {
        className: `employee-item${employee.id === this.activeEmployee.id ? ' employee-item--active' : ''}`,
        dataset: { id: employee.id }
      });
      li.innerHTML = `
        <span class="employee-item__avatar">${Utils.escapeHtml(employee.name.charAt(0).toUpperCase())}</span>
        <span class="employee-item__name">${Utils.escapeHtml(employee.name)}</span>
      `;
      li.addEventListener('click', () => this.selectEmployee(employee.id));
      list.appendChild(li);
    });
  }

  renderPeriodControls() {
    const monthSelect = Utils.$('#period-month');
    const yearSelect = Utils.$('#period-year');
    if (!monthSelect || !yearSelect || !this.activePeriod) return;

    if (!monthSelect.options.length) {
      for (let m = 1; m <= 12; m += 1) {
        const opt = document.createElement('option');
        opt.value = String(m);
        opt.textContent = MONTH_NAMES[m];
        monthSelect.appendChild(opt);
      }
    }

    if (!yearSelect.options.length) {
      const currentYear = Utils.getCurrentYearMonth().year;
      for (let y = currentYear - 3; y <= currentYear + 2; y += 1) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = String(y);
        yearSelect.appendChild(opt);
      }
    }

    monthSelect.value = String(this.activePeriod.month);
    yearSelect.value = String(this.activePeriod.year);
  }

  renderCitySelect() {
    const select = Utils.$('#city-select');
    if (!select || !this.activePeriod) return;

    if (!select.options.length) {
      DataService.getCities().forEach((city) => {
        const opt = document.createElement('option');
        opt.value = city.id;
        opt.textContent = city.name;
        select.appendChild(opt);
      });
    }

    select.value = this.activePeriod.cityId;
    const city = DataService.getCity(this.activePeriod.cityId);
    Utils.setText('#city-category', city ? city.categoryLabel : '—');
    Utils.setText('#city-rate', city ? Utils.formatMoney(city.hourlyRate) : '—');

    this.renderSeasonality();
  }

  /**
   * Отображение коэффициента сезонности по текущему месяцу периода.
   * Июль–декабрь: −10%, январь–июнь: +10%.
   */
  renderSeasonality() {
    if (!this.activePeriod) return;

    // Берём месяц из периода; для страховки сверяем с селектом
    let month = Number(this.activePeriod.month);
    const monthSelect = Utils.$('#period-month');
    if (monthSelect && monthSelect.value !== '') {
      const selectedMonth = Number(monthSelect.value);
      if (Number.isFinite(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12) {
        month = selectedMonth;
      }
    }

    const percent = this.calculation && Number.isFinite(this.calculation.seasonalityPercent)
      ? this.calculation.seasonalityPercent
      : DataService.getSeasonalityPercent(month);

    const label = this.calculation && this.calculation.seasonalityLabel
      ? this.calculation.seasonalityLabel
      : Utils.formatSeasonality(percent, 'percent');

    const targets = ['#period-seasonality', '#total-seasonality', '#stat-seasonality'];
    targets.forEach((selector) => {
      const el = Utils.$(selector);
      if (!el) return;
      el.textContent = label;
      el.classList.remove('is-positive', 'is-negative', 'is-neutral');
      if (percent > 0) el.classList.add('is-positive');
      else if (percent < 0) el.classList.add('is-negative');
      else el.classList.add('is-neutral');
    });
  }

  renderWorkInfo() {
    if (!this.activePeriod || !this.calculation) return;
    const workDays = Utils.$('#work-days');
    const workHours = Utils.$('#work-hours');
    if (workDays && document.activeElement !== workDays) {
      workDays.value = this.activePeriod.workDays || '';
    }
    if (workHours && document.activeElement !== workHours) {
      workHours.value = this.activePeriod.workHours || '';
    }
    Utils.setText('#avg-hours', Utils.formatNumber(this.calculation.avgHoursPerDay));
    Utils.setText('#salary-value', Utils.formatMoney(this.calculation.salary));
    Utils.setText('#avg-salary-day', Utils.formatMoney(this.calculation.avgSalaryPerDay));
  }

  /**
   * Рендер блока мультипликатора KPI, потерь и аналитики.
   */
  renderKpi() {
    if (!this.activePeriod || !this.calculation) return;
    const kpi = this.activePeriod.kpi;

    const setIfNotFocused = (selector, value) => {
      const el = Utils.$(selector);
      if (!el) return;
      if (document.activeElement !== el) {
        el.value = value;
      }
    };

    setIfNotFocused('#kpi-sim', kpi.sim);
    setIfNotFocused('#kpi-conversion', kpi.conversion);
    setIfNotFocused('#kpi-focus-spd', kpi.focusSpd);
    setIfNotFocused('#kpi-focus-cs', kpi.focusCs);
    setIfNotFocused('#kpi-focus-mnp', kpi.focusMnp);
    setIfNotFocused('#kpi-credits', kpi.credits);
    setIfNotFocused('#kpi-accessories', kpi.accessories);
    setIfNotFocused('#kpi-insurance', kpi.insurance);

    const planMet = Utils.$('#kpi-credits-plan-met');
    if (planMet && document.activeElement !== planMet) {
      planMet.checked = Boolean(kpi.applicationsPlanMet);
    }

    this.renderFocusBlock();

    const list = Utils.$('#kpi-breakdown-list');
    if (list) {
      list.innerHTML = this.calculation.kpi.items.map((item) => `
        <div class="kpi-line kpi-line--${item.status}">
          <span>${Utils.escapeHtml(item.fullName)}</span>
          <strong>${Utils.escapeHtml(item.labelText)}</strong>
        </div>
      `).join('');
    }

    const totalEl = Utils.$('#kpi-total-multiplier');
    if (totalEl) {
      totalEl.textContent = this.calculation.kpi.labelText;
      totalEl.classList.toggle('is-positive', this.calculation.kpi.totalAdjustment > 0);
      totalEl.classList.toggle('is-negative', this.calculation.kpi.totalAdjustment < 0);
      totalEl.classList.toggle('is-neutral', this.calculation.kpi.totalAdjustment === 0);
    }

    Utils.setText('#kpi-premium-before', Utils.formatMoney(this.calculation.premiumAfterSeasonality));
    Utils.setText('#kpi-premium-after', Utils.formatMoney(this.calculation.finalPremium));
    Utils.setText('#kpi-payout', Utils.formatMoney(this.calculation.payout));

    this.renderKpiOpportunities();
    this.renderKpiAnalytics();
  }

  /**
   * Статусы и итог блока «Фокусные KPI».
   */
  renderFocusBlock() {
    if (!this.activePeriod) return;

    // Всегда считаем заново по актуальным значениям модели
    const focus = DataService.evaluateFocusGroup(this.activePeriod.kpi);
    if (this.calculation && this.calculation.kpi) {
      this.calculation.kpi.focus = focus;
    }

    const statusMap = {
      focusSpd: '#focus-status-spd',
      focusCs: '#focus-status-cs',
      focusMnp: '#focus-status-mnp'
    };
    const fieldMap = {
      focusSpd: '#focus-field-spd',
      focusCs: '#focus-field-cs',
      focusMnp: '#focus-field-mnp'
    };

    focus.metrics.forEach((metric) => {
      const statusEl = Utils.$(statusMap[metric.id]);
      const fieldEl = Utils.$(fieldMap[metric.id]);
      if (statusEl) {
        statusEl.textContent = metric.passed
          ? '🟢 Выполнен'
          : '🔴 Не выполнен';
        statusEl.classList.toggle('is-passed', metric.passed);
        statusEl.classList.toggle('is-failed', !metric.passed);
      }
      if (fieldEl) {
        fieldEl.classList.toggle('field--passed', metric.passed);
        fieldEl.classList.toggle('field--failed', !metric.passed);
      }
    });

    const passedEl = Utils.$('#focus-passed');
    const failedEl = Utils.$('#focus-failed');
    if (passedEl) passedEl.textContent = `${focus.passedCount} из ${focus.total}`;
    if (failedEl) failedEl.textContent = `${focus.failedCount} из ${focus.total}`;

    const mult = Utils.$('#focus-multiplier');
    if (mult) {
      mult.textContent = focus.labelText;
      mult.classList.remove('is-negative', 'is-neutral', 'is-positive');
      if (focus.adjustment < 0) mult.classList.add('is-negative');
      else if (focus.adjustment > 0) mult.classList.add('is-positive');
      else mult.classList.add('is-neutral');
    }
  }

  /**
   * Карточки «Потери и возможности».
   */
  renderKpiOpportunities() {
    const container = Utils.$('#kpi-opportunities');
    if (!container || !this.calculation || !this.calculation.kpi) return;
    const opportunities = Array.isArray(this.calculation.kpi.opportunities)
      ? this.calculation.kpi.opportunities
      : [];

    container.innerHTML = opportunities.map((item) => {
      const statusClass = `opportunity-card--${item.status}`;
      const statusIcon = item.status === 'bonus' ? '🟢' : item.status === 'penalty' ? '🔴' : '🟡';
      const statusText = item.status === 'bonus'
        ? 'Бонус'
        : item.status === 'penalty'
          ? 'Штраф'
          : 'Без изменений';

      if (item.inputType === 'focus_group' && item.focus) {
        const metricsHtml = item.focus.metrics.map((metric) => `
          <div class="opportunity-metric">
            <span>${Utils.escapeHtml(metric.label)}</span>
            <strong class="${metric.passed ? 'is-positive' : 'is-negative'}">
              ${Utils.formatNumber(metric.percent, 1)}% · ${metric.passed ? '🟢 Выполнен' : '🔴 Не выполнен'}
            </strong>
          </div>
        `).join('');

        const nextBlock = item.atMax
          ? '<p class="opportunity-card__done">Все фокусные KPI выполнены</p>'
          : `
            <div class="opportunity-metric">
              <span>${Utils.escapeHtml(item.nextHint || 'Закрыть ещё 1 KPI')}</span>
              <strong class="is-positive">${Utils.formatMoney(item.recoverToNext)}</strong>
            </div>
            <div class="opportunity-metric">
              <span>До нулевого штрафа (закрыть все)</span>
              <strong class="is-positive">${Utils.formatMoney(item.gainToMax)}</strong>
            </div>
          `;

        return `
          <article class="opportunity-card ${statusClass}">
            <div class="opportunity-card__head">
              <h3>${Utils.escapeHtml(item.fullName)}</h3>
              <span class="opportunity-card__badge">${statusIcon} ${statusText}</span>
            </div>
            <div class="opportunity-metric">
              <span>Выполнено</span>
              <strong>${item.focus.passedCount} из ${item.focus.total}</strong>
            </div>
            <div class="opportunity-metric">
              <span>Не выполнено</span>
              <strong>${item.focus.failedCount} из ${item.focus.total}</strong>
            </div>
            <div class="opportunity-metric">
              <span>Мультипликатор блока</span>
              <strong class="kpi-tone">${Utils.escapeHtml(item.currentLabel)}</strong>
            </div>
            ${item.loss < 0
            ? `<div class="opportunity-metric"><span>Потеря</span><strong class="is-negative">${Utils.formatMoney(item.loss)}</strong></div>`
            : ''}
            ${metricsHtml}
            ${nextBlock}
          </article>
        `;
      }

      let nextBlock = '<p class="opportunity-card__done">Достигнут максимальный уровень</p>';
      if (!item.atMax && item.nextAdjustment !== null) {
        const nextTitle = item.nextHint
          ? item.nextHint
          : `До следующего уровня (${item.nextThreshold}%)`;
        nextBlock = `
          <div class="opportunity-metric">
            <span>${Utils.escapeHtml(nextTitle)}</span>
            <strong>${item.nextHint ? Utils.escapeHtml(item.nextLabel) : `осталось ${Utils.formatNumber(item.remainingToNext, 1)}%`}</strong>
          </div>
          <div class="opportunity-metric">
            <span>${item.recoverToNext >= 0 ? 'Вернете / получите' : 'Изменение'}</span>
            <strong class="${item.recoverToNext >= 0 ? 'is-positive' : 'is-negative'}">${Utils.formatMoney(item.recoverToNext)}</strong>
          </div>
        `;
      }

      let maxBlock = '';
      if (!item.atMax) {
        maxBlock = `
          <div class="opportunity-metric">
            <span>До максимального уровня (${item.maxLabel})</span>
            <strong>осталось ${Utils.formatNumber(item.remainingToMax, 1)}%</strong>
          </div>
          <div class="opportunity-metric">
            <span>Дополнительно получите</span>
            <strong class="is-positive">${Utils.formatMoney(item.gainToMax)}</strong>
          </div>
        `;
      }

      const lossBlock = item.loss < 0
        ? `<div class="opportunity-metric"><span>Потеря</span><strong class="is-negative">${Utils.formatMoney(item.loss)}</strong></div>`
        : item.currentMoney > 0
          ? `<div class="opportunity-metric"><span>Текущий бонус</span><strong class="is-positive">${Utils.formatMoney(item.currentMoney)}</strong></div>`
          : `<div class="opportunity-metric"><span>Влияние на премию</span><strong>0,00 ₽</strong></div>`;

      return `
        <article class="opportunity-card ${statusClass}">
          <div class="opportunity-card__head">
            <h3>${Utils.escapeHtml(item.fullName)}</h3>
            <span class="opportunity-card__badge">${statusIcon} ${statusText}</span>
          </div>
          <div class="opportunity-metric">
            <span>Выполнение</span>
            <strong>${Utils.formatNumber(item.percent, 1)}%</strong>
          </div>
          <div class="opportunity-metric">
            <span>Текущий коэффициент</span>
            <strong class="kpi-tone">${Utils.escapeHtml(item.currentLabel)}</strong>
          </div>
          ${lossBlock}
          ${nextBlock}
          ${maxBlock}
        </article>
      `;
    }).join('');
  }

  /**
   * Итоговая аналитическая карточка.
   */
  renderKpiAnalytics() {
    if (!this.calculation || !this.calculation.kpi || !this.calculation.kpi.analytics) return;
    const a = this.calculation.kpi.analytics;

    Utils.setText('#analytics-premium-before', Utils.formatMoney(a.premiumBeforeKpi));
    Utils.setText('#analytics-seasonality-effect', Utils.formatMoney(a.seasonalityEffect));
    Utils.setText('#analytics-final-premium', Utils.formatMoney(a.finalPremium));
    Utils.setText('#analytics-losses', Utils.formatMoney(a.lossesTotal));
    Utils.setText('#analytics-next-goals', Utils.formatMoney(a.nextGoalsGain));
    Utils.setText('#analytics-max-premium', Utils.formatMoney(a.maxPremium));
    Utils.setText('#analytics-payout-gap', Utils.formatMoney(a.payoutGap));

    const seasonEl = Utils.$('#analytics-seasonality-effect');
    if (seasonEl) {
      seasonEl.classList.toggle('is-positive', a.seasonalityEffect > 0);
      seasonEl.classList.toggle('is-negative', a.seasonalityEffect < 0);
    }
  }

  renderRealisticPlan() {
    const goal = this.activePeriod.salaryGoal;
    const result = SalaryCalculator.calculateRealisticPlan(this.activePeriod);
    const main = Utils.$('#goal-auto-main');
    const settings = Utils.$('#goal-auto-settings');
    if (!main.children.length) {
      const groups = {};
      REALISTIC_PLAN_FIELDS.forEach(([key, label, , group]) => {
        let container = main;
        if (group !== 'Основные данные') {
          if (!groups[group]) {
            const title = document.createElement('h3'); title.textContent = group; settings.appendChild(title);
            groups[group] = document.createElement('div'); groups[group].className = 'form-grid form-grid--2'; settings.appendChild(groups[group]);
          }
          container = groups[group];
        }
        const field = document.createElement('label'); field.className = 'field';
        const caption = document.createElement('span'); caption.className = 'field__label'; caption.textContent = label;
        const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.dataset.planField = key;
        if (key !== 'admin') input.min = '0';
        field.append(caption, input); container.appendChild(field);
      });
      const title = document.createElement('h3'); title.textContent = 'Ставки плана'; settings.appendChild(title);
      const rates = document.createElement('div'); rates.className = 'form-grid form-grid--2'; settings.appendChild(rates);
      REALISTIC_PLAN_PRODUCTS.forEach(([key, name, , , unit]) => {
        const field = document.createElement('label'); field.className = 'field';
        const caption = document.createElement('span'); caption.className = 'field__label'; caption.textContent = `${name}: ${unit === '₽' ? '% от суммы' : '₽ за штуку'}`;
        const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = 'any'; input.dataset.planRate = key; input.dataset.percent = String(unit === '₽');
        field.append(caption, input); rates.appendChild(field);
      });
    }
    main.parentElement.querySelectorAll('[data-plan-field]').forEach(input => {
      const key = input.dataset.planField;
      if (document.activeElement !== input) input.value = goal.realistic[key] ?? '';
      if (key === 'hours') input.placeholder = `Из рабочего времени: ${this.activePeriod.workHours}`;
      if (key === 'shifts') input.placeholder = `Из рабочих дней: ${this.activePeriod.workDays}`;
    });
    settings.querySelectorAll('[data-plan-rate]').forEach(input => {
      const key = input.dataset.planRate; const scale = input.dataset.percent === 'true' ? 100 : 1;
      if (document.activeElement !== input) input.value = goal.rates[key] == null ? '' : goal.rates[key] * scale;
      input.placeholder = `По категории: ${Utils.formatNumber(result.rates[key] * scale)}`;
    });
    Utils.setText('#goal-auto-status', result.errors.length ? result.errors.join(' ') : result.remaining > 0 ? 'Цель выше реалистичного плана — есть недобор.' : 'Цель покрыта планом.');
    const totals = Utils.$('#goal-auto-totals'); totals.innerHTML = '';
    Utils.$('#goal-auto-rows').innerHTML = '';
    Utils.setText('#goal-auto-credit', '');
    if (result.errors.length) return;
    [['Оклад', result.salary], ['Нужен торговый бонус', result.neededBonus], ['Премия по плану', result.bonus], ['Прогноз зарплаты', result.projected], ['Не хватает до цели', result.remaining]].forEach(([label, value]) => {
      const card = document.createElement('div'); card.className = 'analytics-card';
      const caption = document.createElement('span'); caption.textContent = label;
      const amount = document.createElement('strong'); amount.textContent = Utils.formatMoney(value);
      card.append(caption, amount); totals.appendChild(card);
    });
    result.lines.forEach(line => {
      const row = document.createElement('tr');
      [line.name + (line.capped ? ' — предел' : ''), `${Utils.formatNumber(line.quantity)} ${line.unit}`, `${Utils.formatNumber(line.perShift)} ${line.unit}`, Utils.formatMoney(line.bonus)].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
      Utils.$('#goal-auto-rows').appendChild(row);
    });
    Utils.setText('#goal-auto-credit', `Кредитный оборот: ${Utils.formatMoney(result.credit)} за месяц / ${Utils.formatMoney(result.creditPerShift)} за смену. Сезонность × мультипликатор: ${Utils.formatNumber(result.factor)}. Объёмы на смену округлены вверх, заявки — до сотых, как в Excel.`);
  }

  renderSalaryGoal(force = false) {
    if (!this.activePeriod || !this.calculation) return;
    const goal = this.activePeriod.salaryGoal;
    const desired = Utils.$('#goal-desired');
    if (document.activeElement !== desired) desired.value = goal.desired || '';
    const automatic = goal.mode !== 'manual';
    Utils.$('#goal-mode').value = automatic ? 'auto' : 'manual';
    Utils.$('#goal-auto').hidden = !automatic;
    Utils.$('#goal-manual').hidden = automatic;
    if (automatic) { this.renderRealisticPlan(); return; }
    const estimate = SalaryCalculator.calculateSalaryGoal(this.activePeriod, this.calculation);
    const container = Utils.$('#goal-lines');
    if (force || !container.contains(document.activeElement)) {
      container.innerHTML = '';
      goal.lines.forEach((line, index) => {
        const row = document.createElement('div');
        row.className = 'goal-plan-row';
        const indicator = DataService.getIndicator(line.block, line.indicatorId);
        row.innerHTML = `<label class="field"><span class="field__label">Показатель</span><select data-goal="indicator"></select></label>
          <label class="field"><span class="field__label">${indicator?.rateType === RATE_TYPES.FIXED ? 'Количество, шт.' : 'Сумма, ₽'}</span><input data-goal="value" type="number" min="0" step="any" value="${line.value}"/></label>
          <label class="field"><span class="field__label">Оплата товаров</span><select data-goal="payment"><option value="qr_credit">QR / кредит ×1</option><option value="card">Карта ×0,75</option><option value="cash">Наличные ×1,25</option></select></label>
          <div><span class="field__label">Примерное начисление</span><strong data-goal="bonus"></strong></div>
          <button type="button" class="btn btn--ghost" data-goal="remove" aria-label="Удалить показатель из плана">✕</button>`;
        const select = row.querySelector('[data-goal="indicator"]');
        [[BLOCKS.SALES, 'Экономический блок', DataService.getEconomicIndicators()], [BLOCKS.OPERATOR, 'Операторский блок', DataService.getOperatorIndicators()], [BLOCKS.ADMIN, 'Административный блок', administrativeIndicators]].forEach(([block, name, indicators]) => {
          const group = document.createElement('optgroup'); group.label = name;
          indicators.forEach(item => group.appendChild(new Option(item.name, `${block}:${item.id}`, false, line.block === block && line.indicatorId === item.id)));
          select.appendChild(group);
        });
        select.addEventListener('change', () => {
          [line.block, line.indicatorId] = select.value.split(':');
          line.value = 0;
          this.renderSalaryGoal(true); this.autoSave();
        });
        row.querySelector('[data-goal="value"]').addEventListener('input', e => {
          line.value = Math.max(0, Utils.toNumber(e.target.value, 0));
          this.renderSalaryGoal(); this.autoSave();
        });
        const payment = row.querySelector('[data-goal="payment"]');
        payment.value = line.paymentMethod;
        payment.disabled = line.block !== BLOCKS.SALES || !['smart_red_apple_obmen', 'smart_standart_tablet', 'smart_green', 'smart_sellout_dead', 'feature_phones', 'trade_in', 'buyout'].includes(line.indicatorId);
        payment.addEventListener('change', () => { line.paymentMethod = payment.value; this.renderSalaryGoal(); this.autoSave(); });
        row.querySelector('[data-goal="remove"]').addEventListener('click', () => { goal.lines.splice(index, 1); this.renderSalaryGoal(true); this.autoSave(); });
        container.appendChild(row);
      });
      if (!goal.lines.length) container.textContent = 'Добавьте товары, услуги или операции в план.';
    }
    container.querySelectorAll('[data-goal="bonus"]').forEach((el, index) => { el.textContent = Utils.formatMoney(estimate.lines[index].bonus); });
    Utils.setText('#goal-gap', goal.desired > 0 ? Utils.formatMoney(estimate.gap) : 'Укажите цель');
    Utils.setText('#goal-required', goal.desired > 0 ? `${Utils.formatNumber(estimate.coverage)}%` : 'Укажите цель');
    Utils.setText('#goal-bonus', Utils.formatMoney(estimate.bonus));
    Utils.setText('#goal-projected', Utils.formatMoney(estimate.projected));
    Utils.setText('#goal-remaining', goal.desired > 0 ? Utils.formatMoney(estimate.remaining) : 'Укажите цель');
    Utils.setText('#goal-rate', 'Добавьте несколько показателей: суммы продаж для процентных ставок, количество для фиксированных выплат. Начисление показано отдельно для каждой строки.');
  }

  renderMonthTotals() {
    this.renderSalaryGoal();
    if (!this.calculation) return;
    const c = this.calculation;
    const map = {
      '#total-work-days': c.workDays,
      '#total-hours': Utils.formatNumber(c.workHours),
      '#total-avg-hours': Utils.formatNumber(c.avgHoursPerDay),
      '#total-salary': Utils.formatMoney(c.salary),
      '#total-admin': Utils.formatMoney(c.administrativePremium),
      '#total-sales': Utils.formatMoney(c.totalSales),
      '#total-premium': Utils.formatMoney(c.totalPremium),
      '#total-seasonality': c.seasonalityLabel,
      '#total-adjusted-premium': Utils.formatMoney(c.premiumAfterSeasonality),
      '#total-kpi-multiplier': c.kpi.labelText,
      '#total-final-premium': Utils.formatMoney(c.finalPremium),
      '#total-avg-premium': Utils.formatMoney(c.avgPremiumPerDay),
      '#total-avg-sales': Utils.formatMoney(c.avgSalesPerDay),
      '#total-ops-count': c.operatorCount,
      '#total-sales-count': c.salesCount,
      '#total-payout': Utils.formatMoney(c.payout)
    };
    Object.entries(map).forEach(([selector, value]) => {
      const el = Utils.$(selector);
      if (el) el.textContent = String(value);
    });

    this.renderSeasonality();

    const kpiEl = Utils.$('#total-kpi-multiplier');
    if (kpiEl) {
      kpiEl.classList.toggle('is-positive', c.kpi.totalAdjustment > 0);
      kpiEl.classList.toggle('is-negative', c.kpi.totalAdjustment < 0);
    }
  }

  renderStats() {
    if (!this.calculation) return;
    const s = this.calculation.stats;
    const kpiAnalytics = this.calculation.kpi?.analytics || {};
    const fmtDay = (dayResult, field) => {
      if (!dayResult) return 'Нет данных';
      const date = Utils.formatDate(dayResult.day, this.calculation.month, this.calculation.year);
      return `${date} · ${Utils.formatMoney(dayResult[field])}`;
    };

    Utils.setText('#stat-best-sales', fmtDay(s.bestSalesDay, 'salesTotal'));
    Utils.setText('#stat-best-premium', fmtDay(s.bestPremiumDay, 'premium'));
    Utils.setText(
      '#stat-best-indicator',
      s.bestIndicator
        ? `${s.bestIndicator.name} · ${Utils.formatMoney(s.bestIndicator.accrual)}`
        : 'Нет данных'
    );
    Utils.setText('#stat-volume', Utils.formatMoney(s.totalSales));
    Utils.setText('#stat-avg-sales', Utils.formatMoney(this.calculation.avgSalesPerDay));
    Utils.setText('#stat-avg-premium', Utils.formatMoney(this.calculation.avgPremiumPerDay));
    Utils.setText('#stat-premium', Utils.formatMoney(s.totalPremium));
    Utils.setText('#stat-seasonality', s.seasonalityLabel);
    Utils.setText('#stat-adjusted-premium', Utils.formatMoney(s.premiumAfterSeasonality));
    Utils.setText('#stat-kpi', s.kpiLabel);
    Utils.setText('#stat-final-premium', Utils.formatMoney(s.finalPremium));
    Utils.setText('#stat-salary', Utils.formatMoney(s.salary));
    Utils.setText('#stat-kpi-losses', Utils.formatMoney(kpiAnalytics.lossesTotal || 0));
    Utils.setText('#stat-kpi-gap', Utils.formatMoney(kpiAnalytics.premiumGap || 0));
    Utils.setText('#stat-total', Utils.formatMoney(s.payout));
  }

  renderTabs() {
    Utils.$$('.tab-btn').forEach((btn) => {
      btn.classList.toggle('tab-btn--active', btn.dataset.view === this.currentView);
    });
    Utils.$('#view-days').hidden = this.currentView !== 'days';
    Utils.$('#view-calendar').hidden = this.currentView !== 'calendar';
    Utils.$('#view-stats').hidden = this.currentView !== 'stats';
  }

  renderDaysList() {
    const container = Utils.$('#days-list');
    if (!container || !this.calculation) return;
    container.innerHTML = '';

    this.calculation.days.forEach((day) => {
      const dateLabel = Utils.formatDate(day.day, this.calculation.month, this.calculation.year);
      const weekday = WEEKDAY_NAMES[
        Utils.getWeekday(this.calculation.year, this.calculation.month, day.day)
      ];
      const level = SalaryCalculator.getDayColorLevel(day);

      const card = Utils.createElement('article', {
        className: `day-card day-card--${level}`,
        dataset: { day: day.day },
        role: 'button',
        tabindex: '0'
      });

      card.innerHTML = `
        <div class="day-card__header">
          <div>
            <div class="day-card__date">${dateLabel}</div>
            <div class="day-card__weekday">${weekday}</div>
          </div>
          <div class="day-card__badge">${day.hasData ? Utils.formatMoney(day.total) : 'Нет данных'}</div>
        </div>
        <div class="day-card__grid">
          <div><span>Часы</span><strong>${Utils.formatNumber(day.hours)}</strong></div>
          <div><span>Оклад</span><strong>${Utils.formatMoney(day.daySalary)}</strong></div>
        <div><span>Экономический блок</span><strong>${Utils.formatMoney(day.salesTotal)}</strong></div>
          <div><span>Премия</span><strong>${Utils.formatMoney(day.premium)}</strong></div>
        </div>
        ${day.comment ? `<p class="day-card__comment">${Utils.escapeHtml(day.comment)}</p>` : ''}
      `;

      const open = () => this.openDay(day.day);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
      container.appendChild(card);
    });
  }

  renderCalendar() {
    const container = Utils.$('#calendar-grid');
    if (!container || !this.calculation) return;
    container.innerHTML = '';

    const firstWeekday = Utils.getWeekday(
      this.calculation.year,
      this.calculation.month,
      1
    );
    // Сетка начинается с понедельника
    const offset = (firstWeekday + 6) % 7;

    for (let i = 0; i < offset; i += 1) {
      container.appendChild(Utils.createElement('div', { className: 'cal-cell cal-cell--empty' }));
    }

    this.calculation.days.forEach((day) => {
      const level = SalaryCalculator.getDayColorLevel(day);
      const cell = Utils.createElement('button', {
        className: `cal-cell cal-cell--${level}`,
        type: 'button',
        dataset: { day: day.day }
      });
      cell.innerHTML = `
        <span class="cal-cell__day">${String(day.day).padStart(2, '0')}</span>
        <span class="cal-cell__hours">${day.hours ? `${Utils.formatNumber(day.hours, 1)} ч` : '—'}</span>
        <span class="cal-cell__salary">${day.hasData ? Utils.formatMoney(day.daySalary, false) : ''}</span>
        <span class="cal-cell__sales">${day.hasData ? Utils.formatMoney(day.salesTotal, false) : ''}</span>
        <span class="cal-cell__premium">${day.hasData ? Utils.formatMoney(day.premium, false) : ''}</span>
        <span class="cal-cell__total">${day.hasData ? Utils.formatMoney(day.total) : 'Нет данных'}</span>
      `;
      cell.addEventListener('click', () => this.openDay(day.day));
      container.appendChild(cell);
    });
  }

  renderDayModalIfOpen() {
    if (this.selectedDay !== null) {
      this.renderDayModal();
    }
  }

  renderDayModal() {
    const dayData = this.getSelectedDayData();
    if (!dayData || !this.calculation) return;

    const dayResult = this.calculation.days.find((d) => d.day === this.selectedDay);
    if (!dayResult) return;

    const dateLabel = Utils.formatDate(
      this.selectedDay,
      this.calculation.month,
      this.calculation.year
    );

    Utils.setText('#day-modal-title', dateLabel);

    const hoursInput = Utils.$('#day-hours');
    const commentInput = Utils.$('#day-comment');
    if (hoursInput && document.activeElement !== hoursInput) {
      hoursInput.value = dayData.hours || '';
    }
    if (commentInput && document.activeElement !== commentInput) {
      commentInput.value = dayData.comment || '';
    }

    Utils.setText('#day-summary-salary', Utils.formatMoney(dayResult.daySalary));
    Utils.setText('#day-summary-sales', Utils.formatMoney(dayResult.salesTotal));
    Utils.setText('#day-summary-premium', Utils.formatMoney(dayResult.premium));
    Utils.setText(
      '#day-summary-total',
      dayResult.hasData ? Utils.formatMoney(dayResult.total) : 'Нет данных'
    );

    // Не пересоздаём строки, если пользователь печатает в поле суммы/количества —
    // иначе фокус теряется после каждой цифры.
    if (this.isEditingDayLineField()) {
      this.updateLineRowsMeta();
    } else {
      this.renderLinesList(BLOCKS.SALES, '#sales-lines', DataService.getEconomicIndicators());
      this.renderLinesList(BLOCKS.OPERATOR, '#operator-lines', DataService.getOperatorIndicators());
      this.renderLinesList(BLOCKS.ADMIN, '#admin-lines', administrativeIndicators);
    }
  }

  /**
   * Обновляет ставку и начисление в уже отрисованных строках без потери фокуса.
   */
  updateLineRowsMeta() {
    const day = this.getSelectedDayData();
    if (!day) return;

    Utils.$$('#sales-lines .line-row, #operator-lines .line-row, #admin-lines .line-row').forEach((row) => {
      const itemId = row.dataset.itemId;
      if (!itemId) return;
      const item = day.items.find((i) => i.id === itemId);
      if (!item) return;

      const calc = SalaryCalculator.calculateLine(item, this.getActiveCategoryKey(), this.activePeriod);
      const rateEl = row.querySelector('[data-role="rate"]');
      const accrualEl = row.querySelector('[data-role="accrual"]');
      const labelEl = row.querySelector('[data-role="value-label"]');

      if (rateEl) rateEl.textContent = Utils.formatRate(calc.rate, calc.rateType);
      if (accrualEl) accrualEl.textContent = Utils.formatMoney(calc.accrual);

      if (labelEl) {
        const indicator = DataService.getIndicator(item.block, item.indicatorId);
        labelEl.textContent = indicator && indicator.rateType === RATE_TYPES.FIXED
          ? 'Количество'
          : 'Сумма';
      }
    });
  }

  /**
   * @param {string} block
   * @param {string} containerSelector
   * @param {ReadonlyArray<Object>} indicators
   */
  renderLinesList(block, containerSelector, indicators) {
    const container = Utils.$(containerSelector);
    const day = this.getSelectedDayData();
    if (!container || !day) return;

    const items = day.items.filter((item) => item.block === block);
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-hint">Нет строк. Нажмите «Добавить показатель».</p>';
      return;
    }

    items.forEach((item) => {
      const calc = SalaryCalculator.calculateLine(item, this.getActiveCategoryKey(), this.activePeriod);
      const indicator = DataService.getIndicator(block, item.indicatorId);
      const valueLabel = indicator && indicator.rateType === RATE_TYPES.FIXED
        ? 'Количество'
        : 'Сумма';

      const row = Utils.createElement('div', {
        className: 'line-row',
        dataset: { itemId: item.id }
      });
      row.innerHTML = `
        <div class="line-row__field">
          <label>Показатель</label>
          <select data-role="indicator"></select>
        </div>
        <div class="line-row__field">
          <label data-role="value-label">${valueLabel}</label>
          <input type="number" step="any" min="0" data-role="value" value="${item.value || ''}" placeholder="0"/>
        </div>
        <div class="line-row__meta">
          <div><span>Ставка</span><strong data-role="rate">${Utils.formatRate(calc.rate, calc.rateType)}</strong></div>
          <div><span>Начисление</span><strong data-role="accrual">${Utils.formatMoney(calc.accrual)}</strong></div>
        </div>
        <button type="button" class="btn btn--ghost btn--icon" data-role="remove" title="Удалить строку">🗑</button>
      `;

      if (block === BLOCKS.SALES) {
        const label = document.createElement('label');
        label.textContent = 'Оплата товаров';
        const payment = document.createElement('select');
        payment.dataset.role = 'payment';
        [['qr_credit', 'QR / кредит ×1'], ['card', 'Карта ×0,75'], ['cash', 'Наличные ×1,25']].forEach(([value, text]) => payment.add(new Option(text, value, false, item.paymentMethod === value)));
        payment.addEventListener('change', () => { item.paymentMethod = payment.value; this.recalculateAndRefresh(); });
        label.appendChild(payment);
        row.appendChild(label);
      }
      const select = row.querySelector('[data-role="indicator"]');
      indicators.forEach((ind) => {
        const opt = document.createElement('option');
        opt.value = ind.id;
        opt.textContent = ind.name;
        if (ind.id === item.indicatorId) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        this.changeLineIndicator(item.id, e.target.value);
      });

      const valueInput = row.querySelector('[data-role="value"]');
      valueInput.addEventListener('input', (e) => {
        this.changeLineValue(item.id, e.target.value);
      });

      row.querySelector('[data-role="remove"]').addEventListener('click', () => {
        this.removeDayLine(item.id);
      });

      container.appendChild(row);
    });
  }
}

/* ============================================================================
 * Запуск
 * ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const app = new UIController();
  app.init();
  window.__salaryApp = app;
});

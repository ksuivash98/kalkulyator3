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
    this.calculation = SalaryCalculator.calculatePeriod(this.activePeriod);
    this.renderWorkInfo();
    this.renderMonthTotals();
    this.renderStats();
    this.renderDaysList();
    this.renderCalendar();
    this.renderDayModalIfOpen();
    this.autoSave();
  }

  /* ========================================================================
   * События
   * ====================================================================== */

  /**
   * Глобальные обработчики DOM.
   */
  bindGlobalEvents() {
    // Тема
    Utils.$('#btn-theme').addEventListener('click', () => this.toggleTheme());

    // Сотрудники
    Utils.$('#btn-employee-add').addEventListener('click', () => this.createEmployee());
    Utils.$('#btn-employee-rename').addEventListener('click', () => this.renameEmployee());
    Utils.$('#btn-employee-duplicate').addEventListener('click', () => this.duplicateEmployee());
    Utils.$('#btn-employee-delete').addEventListener('click', () => this.deleteEmployee());
    Utils.$('#employee-search').addEventListener('input', (e) => {
      this.employeeSearch = e.target.value.trim().toLowerCase();
      this.renderEmployeeList();
    });

    // Период
    Utils.$('#period-month').addEventListener('change', () => this.onPeriodChange());
    Utils.$('#period-year').addEventListener('change', () => this.onPeriodChange());

    // Город и рабочее время
    Utils.$('#city-select').addEventListener('change', (e) => {
      this.activePeriod.cityId = e.target.value;
      this.recalculateAndRefresh();
    });
    Utils.$('#work-days').addEventListener('input', (e) => {
      this.activePeriod.workDays = Utils.toNumber(e.target.value, 0);
      this.recalculateAndRefresh();
    });
    Utils.$('#work-hours').addEventListener('input', (e) => {
      this.activePeriod.workHours = Utils.toNumber(e.target.value, 0);
      this.recalculateAndRefresh();
    });

    // Вкладки
    Utils.$$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        this.renderTabs();
        this.saveState(false);
      });
    });

    // Экспорт
    Utils.$('#btn-export-pdf').addEventListener('click', () => this.handleExportPdf());
    Utils.$('#btn-export-excel').addEventListener('click', () => this.handleExportExcel());
    Utils.$('#btn-export-json').addEventListener('click', () => this.handleExportJson());
    Utils.$('#btn-import-json').addEventListener('click', () => {
      Utils.$('#import-file').click();
    });
    Utils.$('#import-file').addEventListener('change', (e) => this.handleImportFile(e));

    // Модальное окно дня
    Utils.$('#day-modal-close').addEventListener('click', () => this.closeDayModal());
    Utils.$('#day-modal-backdrop').addEventListener('click', () => this.closeDayModal());
    Utils.$('#day-hours').addEventListener('input', (e) => this.onDayFieldChange('hours', e.target.value));
    Utils.$('#day-comment').addEventListener('input', (e) => this.onDayFieldChange('comment', e.target.value));
    Utils.$('#btn-add-sales-line').addEventListener('click', () => this.addDayLine(BLOCKS.SALES));
    Utils.$('#btn-add-operator-line').addEventListener('click', () => this.addDayLine(BLOCKS.OPERATOR));

    // FAB меню
    Utils.$('#fab-main').addEventListener('click', () => {
      Utils.$('#fab-menu').classList.toggle('fab-menu--open');
    });
    Utils.$('#fab-add-employee').addEventListener('click', () => {
      this.createEmployee();
      Utils.$('#fab-menu').classList.remove('fab-menu--open');
    });
    Utils.$('#fab-export').addEventListener('click', () => {
      Utils.$('#export-panel').scrollIntoView({ behavior: 'smooth' });
      Utils.$('#fab-menu').classList.remove('fab-menu--open');
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
   * @param {string} block
   */
  addDayLine(block) {
    const day = this.getSelectedDayData();
    if (!day) return;
    const defaults = block === BLOCKS.SALES
      ? DataService.getSalesIndicators()[0]
      : DataService.getOperatorIndicators()[0];
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
    item.value = Utils.toNumber(value, 0);
    this.recalculateAndRefresh();
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
    this.renderWorkInfo();
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
    Utils.$('#city-category').textContent = city ? city.category : '—';
    Utils.$('#city-rate').textContent = city
      ? Utils.formatMoney(city.hourlyRate)
      : '—';
  }

  renderWorkInfo() {
    if (!this.activePeriod || !this.calculation) return;
    const workDays = Utils.$('#work-days');
    const workHours = Utils.$('#work-hours');
    if (document.activeElement !== workDays) {
      workDays.value = this.activePeriod.workDays || '';
    }
    if (document.activeElement !== workHours) {
      workHours.value = this.activePeriod.workHours || '';
    }
    Utils.$('#avg-hours').textContent = Utils.formatNumber(this.calculation.avgHoursPerDay);
    Utils.$('#salary-value').textContent = Utils.formatMoney(this.calculation.salary);
    Utils.$('#avg-salary-day').textContent = Utils.formatMoney(this.calculation.avgSalaryPerDay);
  }

  renderMonthTotals() {
    if (!this.calculation) return;
    const c = this.calculation;
    const map = {
      '#total-work-days': c.workDays,
      '#total-hours': Utils.formatNumber(c.workHours),
      '#total-avg-hours': Utils.formatNumber(c.avgHoursPerDay),
      '#total-salary': Utils.formatMoney(c.salary),
      '#total-sales': Utils.formatMoney(c.totalSales),
      '#total-premium': Utils.formatMoney(c.totalPremium),
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
  }

  renderStats() {
    if (!this.calculation) return;
    const s = this.calculation.stats;
    const fmtDay = (dayResult, field) => {
      if (!dayResult) return 'Нет данных';
      const date = Utils.formatDate(dayResult.day, this.calculation.month, this.calculation.year);
      return `${date} · ${Utils.formatMoney(dayResult[field])}`;
    };

    Utils.$('#stat-best-sales').textContent = fmtDay(s.bestSalesDay, 'salesTotal');
    Utils.$('#stat-best-premium').textContent = fmtDay(s.bestPremiumDay, 'premium');
    Utils.$('#stat-best-indicator').textContent = s.bestIndicator
      ? `${s.bestIndicator.name} · ${Utils.formatMoney(s.bestIndicator.accrual)}`
      : 'Нет данных';
    Utils.$('#stat-volume').textContent = Utils.formatMoney(s.totalSales);
    Utils.$('#stat-avg-check').textContent = Utils.formatMoney(s.avgCheck);
    Utils.$('#stat-premium').textContent = Utils.formatMoney(s.totalPremium);
    Utils.$('#stat-salary').textContent = Utils.formatMoney(s.salary);
    Utils.$('#stat-total').textContent = Utils.formatMoney(s.payout);
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
          <div><span>Продажи</span><strong>${Utils.formatMoney(day.salesTotal)}</strong></div>
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
    const dateLabel = Utils.formatDate(
      this.selectedDay,
      this.calculation.month,
      this.calculation.year
    );

    Utils.$('#day-modal-title').textContent = dateLabel;

    const hoursInput = Utils.$('#day-hours');
    const commentInput = Utils.$('#day-comment');
    if (document.activeElement !== hoursInput) {
      hoursInput.value = dayData.hours || '';
    }
    if (document.activeElement !== commentInput) {
      commentInput.value = dayData.comment || '';
    }

    Utils.$('#day-summary-salary').textContent = Utils.formatMoney(dayResult.daySalary);
    Utils.$('#day-summary-sales').textContent = Utils.formatMoney(dayResult.salesTotal);
    Utils.$('#day-summary-premium').textContent = Utils.formatMoney(dayResult.premium);
    Utils.$('#day-summary-total').textContent = dayResult.hasData
      ? Utils.formatMoney(dayResult.total)
      : 'Нет данных';

    this.renderLinesList(BLOCKS.SALES, '#sales-lines', DataService.getSalesIndicators());
    this.renderLinesList(BLOCKS.OPERATOR, '#operator-lines', DataService.getOperatorIndicators());
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
      const calc = SalaryCalculator.calculateLine(item);
      const indicator = DataService.getIndicator(block, item.indicatorId);
      const valueLabel = indicator && indicator.rateType === RATE_TYPES.FIXED
        ? 'Количество'
        : 'Сумма';

      const row = Utils.createElement('div', { className: 'line-row' });
      row.innerHTML = `
        <div class="line-row__field">
          <label>Показатель</label>
          <select data-role="indicator"></select>
        </div>
        <div class="line-row__field">
          <label>${valueLabel}</label>
          <input type="number" step="any" min="0" data-role="value" value="${item.value || ''}" placeholder="0"/>
        </div>
        <div class="line-row__meta">
          <div><span>Ставка</span><strong>${Utils.formatRate(calc.rate, calc.rateType)}</strong></div>
          <div><span>Начисление</span><strong>${Utils.formatMoney(calc.accrual)}</strong></div>
        </div>
        <button type="button" class="btn btn--ghost btn--icon" data-role="remove" title="Удалить строку">🗑</button>
      `;

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

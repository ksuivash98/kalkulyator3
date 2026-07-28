/**
 * @file employee.js
 * @description Модели Employee и EmployeePeriod — сотрудники и месячные расчёты.
 */

'use strict';

/**
 * Одна строка показателя внутри дня (продажа или операторская операция).
 */
class DayLineItem {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    /** @type {string} */
    this.id = data.id || Utils.generateId();
    /** @type {string} sales | operator */
    this.block = data.block || BLOCKS.SALES;
    /** @type {string} */
    this.indicatorId = data.indicatorId || '';
    /**
     * Для продаж и percent — сумма; для fixed — количество.
     * @type {number}
     */
    this.value = Utils.toNumber(data.value, 0);
  }

  /**
   * Сериализация.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      block: this.block,
      indicatorId: this.indicatorId,
      value: this.value
    };
  }

  /**
   * Создание из объекта.
   * @param {Object} data
   * @returns {DayLineItem}
   */
  static fromJSON(data) {
    return new DayLineItem(data);
  }
}

/**
 * Данные одного календарного дня.
 */
class DayData {
  /**
   * @param {number} day - число месяца (1–31)
   * @param {Object} [data={}]
   */
  constructor(day, data = {}) {
    /** @type {number} */
    this.day = day;
    /** @type {number} */
    this.hours = Utils.toNumber(data.hours, 0);
    /** @type {string} */
    this.comment = data.comment || '';
    /** @type {DayLineItem[]} */
    this.items = Array.isArray(data.items)
      ? data.items.map((item) => DayLineItem.fromJSON(item))
      : [];
  }

  /**
   * Строки блока «Продажи».
   * @returns {DayLineItem[]}
   */
  getSalesItems() {
    return this.items.filter((item) => item.block === BLOCKS.SALES);
  }

  /**
   * Строки операторского блока.
   * @returns {DayLineItem[]}
   */
  getOperatorItems() {
    return this.items.filter((item) => item.block === BLOCKS.OPERATOR);
  }

  /**
   * Добавляет строку показателя.
   * @param {string} block
   * @param {string} [indicatorId='']
   * @param {number} [value=0]
   * @returns {DayLineItem}
   */
  addItem(block, indicatorId = '', value = 0) {
    const item = new DayLineItem({ block, indicatorId, value });
    this.items.push(item);
    return item;
  }

  /**
   * Удаляет строку по id.
   * @param {string} itemId
   * @returns {boolean}
   */
  removeItem(itemId) {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index < 0) return false;
    this.items.splice(index, 1);
    return true;
  }

  /**
   * Есть ли осмысленные данные за день.
   * @returns {boolean}
   */
  hasData() {
    return (
      this.hours > 0 ||
      Boolean(this.comment && this.comment.trim()) ||
      this.items.some((item) => item.indicatorId && item.value !== 0)
    );
  }

  /**
   * Сериализация.
   * @returns {Object}
   */
  toJSON() {
    return {
      day: this.day,
      hours: this.hours,
      comment: this.comment,
      items: this.items.map((item) => item.toJSON())
    };
  }

  /**
   * @param {number} day
   * @param {Object} data
   * @returns {DayData}
   */
  static fromJSON(day, data) {
    return new DayData(day, data);
  }
}

/**
 * Месячный период расчёта сотрудника.
 */
class EmployeePeriod {
  /**
   * @param {number} year
   * @param {number} month
   * @param {Object} [data={}]
   */
  constructor(year, month, data = {}) {
    /** @type {number} */
    this.year = year;
    /** @type {number} */
    this.month = month;
    /** @type {string} */
    this.cityId = data.cityId || DEFAULT_CITY_ID;
    /** @type {number} */
    this.workDays = Utils.toNumber(data.workDays, 0);
    /** @type {number} */
    this.workHours = Utils.toNumber(data.workHours, 0);
    /** @type {Object<string, DayData>} */
    this.days = {};

    const daysInMonth = DataService.getDaysInMonth(year, month);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = String(d);
      const daySource = data.days && data.days[key] ? data.days[key] : {};
      this.days[key] = DayData.fromJSON(d, daySource);
    }
  }

  /**
   * Ключ периода YYYY-MM.
   * @returns {string}
   */
  get key() {
    return DataService.makePeriodKey(this.year, this.month);
  }

  /**
   * Название периода, например «Июль 2026».
   * @returns {string}
   */
  get title() {
    return `${DataService.getMonthName(this.month)} ${this.year}`;
  }

  /**
   * Количество дней в месяце.
   * @returns {number}
   */
  get daysInMonth() {
    return DataService.getDaysInMonth(this.year, this.month);
  }

  /**
   * Возвращает день.
   * @param {number} day
   * @returns {DayData|null}
   */
  getDay(day) {
    return this.days[String(day)] || null;
  }

  /**
   * Обеспечивает наличие всех дней месяца (после смены месяца/года).
   */
  ensureDays() {
    const daysInMonth = this.daysInMonth;
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = String(d);
      if (!this.days[key]) {
        this.days[key] = new DayData(d);
      }
    }
    Object.keys(this.days).forEach((key) => {
      if (Number(key) > daysInMonth) {
        delete this.days[key];
      }
    });
  }

  /**
   * Сериализация.
   * @returns {Object}
   */
  toJSON() {
    const days = {};
    Object.keys(this.days).forEach((key) => {
      days[key] = this.days[key].toJSON();
    });
    return {
      year: this.year,
      month: this.month,
      cityId: this.cityId,
      workDays: this.workDays,
      workHours: this.workHours,
      days
    };
  }

  /**
   * @param {Object} data
   * @returns {EmployeePeriod}
   */
  static fromJSON(data) {
    return new EmployeePeriod(data.year, data.month, data);
  }

  /**
   * Создаёт пустой период.
   * @param {number} year
   * @param {number} month
   * @returns {EmployeePeriod}
   */
  static createEmpty(year, month) {
    return new EmployeePeriod(year, month);
  }
}

/**
 * Сотрудник салона связи с набором месячных периодов.
 */
class Employee {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    /** @type {string} */
    this.id = data.id || Utils.generateId();
    /** @type {string} */
    this.name = data.name || DEFAULT_EMPLOYEE_NAME;
    /** @type {number} */
    this.createdAt = data.createdAt || Date.now();
    /** @type {number} */
    this.updatedAt = data.updatedAt || Date.now();
    /** @type {Object<string, EmployeePeriod>} */
    this.periods = {};

    if (data.periods && typeof data.periods === 'object') {
      Object.keys(data.periods).forEach((key) => {
        this.periods[key] = EmployeePeriod.fromJSON(data.periods[key]);
      });
    }
  }

  /**
   * Получает или создаёт период.
   * @param {number} year
   * @param {number} month
   * @returns {EmployeePeriod}
   */
  getOrCreatePeriod(year, month) {
    const key = DataService.makePeriodKey(year, month);
    if (!this.periods[key]) {
      this.periods[key] = EmployeePeriod.createEmpty(year, month);
      this.touch();
    } else {
      this.periods[key].ensureDays();
    }
    return this.periods[key];
  }

  /**
   * Возвращает период по ключу или null.
   * @param {string} periodKey
   * @returns {EmployeePeriod|null}
   */
  getPeriod(periodKey) {
    return this.periods[periodKey] || null;
  }

  /**
   * Список ключей периодов, отсортированный по убыванию.
   * @returns {string[]}
   */
  getPeriodKeys() {
    return Object.keys(this.periods).sort().reverse();
  }

  /**
   * Переименование.
   * @param {string} name
   */
  rename(name) {
    this.name = String(name || '').trim() || DEFAULT_EMPLOYEE_NAME;
    this.touch();
  }

  /**
   * Дублирование сотрудника (новый id, копия данных).
   * @param {string} [newName]
   * @returns {Employee}
   */
  duplicate(newName) {
    const cloneData = this.toJSON();
    cloneData.id = Utils.generateId();
    cloneData.name = newName || `${this.name} (копия)`;
    cloneData.createdAt = Date.now();
    cloneData.updatedAt = Date.now();
    return Employee.fromJSON(cloneData);
  }

  /**
   * Обновляет метку изменения.
   */
  touch() {
    this.updatedAt = Date.now();
  }

  /**
   * Сериализация.
   * @returns {Object}
   */
  toJSON() {
    const periods = {};
    Object.keys(this.periods).forEach((key) => {
      periods[key] = this.periods[key].toJSON();
    });
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      periods
    };
  }

  /**
   * @param {Object} data
   * @returns {Employee}
   */
  static fromJSON(data) {
    return new Employee(data);
  }

  /**
   * Создаёт сотрудника по умолчанию с текущим месяцем.
   * @param {string} [name]
   * @returns {Employee}
   */
  static createDefault(name = DEFAULT_EMPLOYEE_NAME) {
    const employee = new Employee({ name });
    const { year, month } = Utils.getCurrentYearMonth();
    employee.getOrCreatePeriod(year, month);
    return employee;
  }
}

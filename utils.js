/**
 * @file utils.js
 * @description Вспомогательные функции: форматирование, идентификаторы, DOM, даты.
 */

'use strict';

/**
 * Набор утилит общего назначения.
 */
class Utils {
  /**
   * Генерирует уникальный идентификатор.
   * @returns {string}
   */
  static generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Безопасное преобразование в число.
   * @param {*} value
   * @param {number} [fallback=0]
   * @returns {number}
   */
  static toNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  /**
   * Округление до копеек (2 знака).
   * @param {number} value
   * @returns {number}
   */
  static roundMoney(value) {
    return Math.round((Utils.toNumber(value) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Форматирование суммы в рублях.
   * @param {number} value
   * @param {boolean} [withCurrency=true]
   * @returns {string}
   */
  static formatMoney(value, withCurrency = true) {
    const num = Utils.roundMoney(value);
    const formatted = num.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return withCurrency ? `${formatted} ₽` : formatted;
  }

  /**
   * Форматирование процента для отображения.
   * @param {number} rate - доля (0.05 = 5%)
   * @returns {string}
   */
  static formatPercent(rate) {
    const pct = Utils.toNumber(rate) * 100;
    const decimals = Number.isInteger(pct) ? 0 : 2;
    return `${pct.toFixed(decimals)}%`;
  }

  /**
   * Форматирование ставки (фиксированной или процентной).
   * @param {number} rate
   * @param {string} rateType
   * @returns {string}
   */
  static formatRate(rate, rateType) {
    if (rateType === RATE_TYPES.PERCENT) {
      return Utils.formatPercent(rate);
    }
    return Utils.formatMoney(rate);
  }

  /**
   * Форматирование коэффициента сезонности для UI (+10% / −10%).
   * @param {number} coefficient - например 1.10 или 0.90
   * @returns {string}
   */
  static formatSeasonality(coefficient) {
    const coef = Utils.toNumber(coefficient, 1);
    const deltaPercent = Utils.roundMoney((coef - 1) * 100);
    return Utils.formatSignedPercent(deltaPercent);
  }

  /**
   * Форматирование процентных пунктов со знаком (+10% / −2,5% / 0%).
   * @param {number} points
   * @returns {string}
   */
  static formatSignedPercent(points) {
    const value = Utils.roundMoney(Utils.toNumber(points, 0));
    const abs = Math.abs(value);
    const formatted = Number.isInteger(abs)
      ? String(abs)
      : abs.toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    if (value > 0) return `+${formatted}%`;
    if (value < 0) return `−${formatted}%`;
    return '0%';
  }

  /**
   * Форматирование числа с разделителями.
   * @param {number} value
   * @param {number} [decimals=2]
   * @returns {string}
   */
  static formatNumber(value, decimals = 2) {
    return Utils.toNumber(value).toLocaleString('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Форматирование даты ДД.ММ.ГГГГ.
   * @param {number} day
   * @param {number} month
   * @param {number} year
   * @returns {string}
   */
  static formatDate(day, month, year) {
    const d = String(day).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    return `${d}.${m}.${year}`;
  }

  /**
   * Экранирование HTML.
   * @param {string} text
   * @returns {string}
   */
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
  }

  /**
   * Debounce-обёртка.
   * @param {Function} fn
   * @param {number} delay
   * @returns {Function}
   */
  static debounce(fn, delay) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Глубокое клонирование через JSON.
   * @template T
   * @param {T} obj
   * @returns {T}
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Скачивание файла из Blob.
   * @param {Blob} blob
   * @param {string} filename
   */
  static downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Скачивание текстового содержимого.
   * @param {string} content
   * @param {string} filename
   * @param {string} [mimeType='application/json']
   */
  static downloadText(content, filename, mimeType = 'application/json') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    Utils.downloadBlob(blob, filename);
  }

  /**
   * Чтение файла как текста.
   * @param {File} file
   * @returns {Promise<string>}
   */
  static readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Текущие год и месяц.
   * @returns {{year: number, month: number}}
   */
  static getCurrentYearMonth() {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  }

  /**
   * День недели для даты (0 = вс).
   * @param {number} year
   * @param {number} month
   * @param {number} day
   * @returns {number}
   */
  static getWeekday(year, month, day) {
    return new Date(year, month - 1, day).getDay();
  }

  /**
   * Показывает уведомление (toast).
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=2800]
   */
  static showToast(message, type = 'info', duration = 2800) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Подтверждение действия.
   * @param {string} message
   * @returns {boolean}
   */
  static confirm(message) {
    return window.confirm(message);
  }

  /**
   * Запрос строки у пользователя.
   * @param {string} message
   * @param {string} [defaultValue='']
   * @returns {string|null}
   */
  static prompt(message, defaultValue = '') {
    return window.prompt(message, defaultValue);
  }

  /**
   * Безопасный querySelector.
   * @param {string} selector
   * @param {ParentNode} [root=document]
   * @returns {Element|null}
   */
  static $(selector, root = document) {
    return root.querySelector(selector);
  }

  /**
   * querySelectorAll как массив.
   * @param {string} selector
   * @param {ParentNode} [root=document]
   * @returns {Element[]}
   */
  static $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  /**
   * Создание элемента с атрибутами и детьми.
   * @param {string} tag
   * @param {Object} [attrs={}]
   * @param {...(Node|string)} children
   * @returns {HTMLElement}
   */
  static createElement(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'dataset' && value && typeof value === 'object') {
        Object.entries(value).forEach(([dk, dv]) => {
          el.dataset[dk] = String(dv);
        });
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value !== null && value !== undefined && value !== false) {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    });
    children.forEach((child) => {
      if (child === null || child === undefined) return;
      if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(String(child)));
      } else {
        el.appendChild(child);
      }
    });
    return el;
  }
}

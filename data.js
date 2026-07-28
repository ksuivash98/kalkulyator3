/**
 * @file data.js
 * @description Константы, ставки, показатели и сервис справочных данных.
 * Все числовые ставки и проценты хранятся здесь — без «магических чисел» в логике.
 */

'use strict';

/* ============================================================================
 * Константы приложения
 * ========================================================================== */

/** Ключ хранилища сотрудников в LocalStorage */
const STORAGE_KEYS = Object.freeze({
  EMPLOYEES: 'salary_calc_employees',
  ACTIVE_EMPLOYEE: 'salary_calc_active_employee',
  ACTIVE_PERIOD: 'salary_calc_active_period',
  THEME: 'salary_calc_theme',
  BACKUPS: 'salary_calc_backups',
  UI_STATE: 'salary_calc_ui_state'
});

/** Максимальное количество резервных копий */
const MAX_BACKUPS = 10;

/** Имя сотрудника по умолчанию при первом запуске */
const DEFAULT_EMPLOYEE_NAME = 'Новый сотрудник';

/** Категория городов по умолчанию */
const CITY_CATEGORY_STANDARD = 'Стандарт';

/** Типы начисления */
const RATE_TYPES = Object.freeze({
  PERCENT: 'percent',
  FIXED: 'fixed'
});

/** Блоки показателей */
const BLOCKS = Object.freeze({
  SALES: 'sales',
  OPERATOR: 'operator'
});

/** Названия месяцев (1–12) */
const MONTH_NAMES = Object.freeze([
  '',
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]);

/** Короткие названия месяцев */
const MONTH_NAMES_SHORT = Object.freeze([
  '',
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
]);

/** Названия дней недели (0 = воскресенье) */
const WEEKDAY_NAMES = Object.freeze([
  'Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'
]);

/* ============================================================================
 * Города и ставки часа
 * ========================================================================== */

/**
 * Справочник городов салонов связи.
 * @type {Readonly<Object<string, {id: string, name: string, category: string, hourlyRate: number}>>}
 */
const CITIES = Object.freeze({
  berezniki: Object.freeze({
    id: 'berezniki',
    name: 'Березники',
    category: CITY_CATEGORY_STANDARD,
    hourlyRate: 100
  }),
  solikamsk: Object.freeze({
    id: 'solikamsk',
    name: 'Соликамск',
    category: CITY_CATEGORY_STANDARD,
    hourlyRate: 110
  }),
  kungur: Object.freeze({
    id: 'kungur',
    name: 'Кунгур',
    category: CITY_CATEGORY_STANDARD,
    hourlyRate: 100
  })
});

/** Город по умолчанию */
const DEFAULT_CITY_ID = 'berezniki';

/* ============================================================================
 * Показатели блока «Продажи» (процент от суммы продажи)
 * ========================================================================== */

/**
 * Показатели продаж.
 * rate — доля (например 0.005 = 0.5%).
 * @type {ReadonlyArray<{id: string, name: string, rate: number, rateType: string}>}
 */
const SALES_INDICATORS = Object.freeze([
  Object.freeze({
    id: 'smart_red_apple_obmen',
    name: 'Смартфоны Red, Apple и «Обмен минут»',
    rate: 0.005,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'smart_standart_tablet',
    name: 'Смартфоны Standart и планшеты',
    rate: 0.01,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'smart_green',
    name: 'Смартфоны категории Green',
    rate: 0.02,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'smart_sellout_dead',
    name: 'Смартфоны Sell Out / Dead',
    rate: 0.03,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'feature_phones',
    name: 'Кнопочные телефоны',
    rate: 0.05,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'trade_in',
    name: 'Трейд-ин',
    rate: 0.04,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'buyout',
    name: 'Выкуп',
    rate: 0.015,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'accessories',
    name: 'Аксессуары и носимая электроника',
    rate: 0.10,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'wearable_premium',
    name: 'Носимая электроника Premium',
    rate: 0.04,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'services_settings',
    name: 'Услуги / Настройки',
    rate: 0.20,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'kaspersky',
    name: 'Подписка Kaspersky',
    rate: 0.30,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'insurance_mmb',
    name: 'Страхование ММБ Ренессанс без Комбо',
    rate: 0.12,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'insurance_other',
    name: 'Страхование остальное / КСЖ',
    rate: 0.08,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'repair_accept',
    name: 'Прием в ремонт',
    rate: 0.08,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'stoloto_tickets',
    name: 'Потерянные билеты Столото',
    rate: 0.04,
    rateType: RATE_TYPES.PERCENT
  })
]);

/* ============================================================================
 * Показатели операторского блока
 * ========================================================================== */

/**
 * Операторские показатели.
 * Для fixed: rate — сумма в рублях за единицу.
 * Для percent: rate — доля от введённой суммы.
 * @type {ReadonlyArray<{id: string, name: string, rate: number, rateType: string}>}
 */
const OPERATOR_INDICATORS = Object.freeze([
  Object.freeze({
    id: 'extra_sim',
    name: 'Экстра-Sim',
    rate: -40,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'extra_sim_overlimit',
    name: 'Экстра-Sim (при превышении лимита)',
    rate: -80,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'base_tp',
    name: 'Базовые ТП',
    rate: 40,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'bundle_base_tp',
    name: 'Bundle Базовые ТП',
    rate: 70,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'high_bundle_tp',
    name: 'High Bundle ТП',
    rate: 120,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'high_bundle_plus_tp',
    name: 'High Bundle + ТП',
    rate: 180,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'high_bundle_plusplus_tp',
    name: 'High Bundle ++ ТП',
    rate: 250,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'premium_tp',
    name: 'Premium ТП',
    rate: 350,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'promo_sim_booster',
    name: 'Промо Sim / Бустер',
    rate: 40,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'abon_sim_3m',
    name: 'Абон SIM 3 месяца',
    rate: 150,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'gold_combo_sim_3m',
    name: 'Золото / Комбо SIM 3 месяца',
    rate: 250,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'gold_abon_combo_sim_6m',
    name: 'Золото / Абон / Комбо SIM 6 месяцев',
    rate: 350,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'gold_abon_combo_sim_12m',
    name: 'Золото / Абон / Комбо SIM 12 месяцев',
    rate: 450,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'legal_entity',
    name: 'Подключение юрлица',
    rate: 300,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'mnp',
    name: 'MNP',
    rate: 250,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'broadband_tv',
    name: 'Подключение ШПД / ТВ',
    rate: 400,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'service_ops',
    name: 'Сервисные операции Т2 и МТС',
    rate: 10,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'cs_rtk_t2',
    name: 'ЦС (оборудование РТК) и подписки Т2',
    rate: 0.08,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'yandex_adapter',
    name: 'Яндекс Адаптер',
    rate: 40,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'modem',
    name: 'Модем',
    rate: 0,
    rateType: RATE_TYPES.PERCENT
  }),
  Object.freeze({
    id: 'installment_card',
    name: 'Карта рассрочки без продажи по КР',
    rate: 500,
    rateType: RATE_TYPES.FIXED
  }),
  Object.freeze({
    id: 'financing',
    name: 'Финансирование',
    rate: 0.003,
    rateType: RATE_TYPES.PERCENT
  })
]);

/* ============================================================================
 * Пороги цвета карточек календаря
 * ========================================================================== */

/** Пороги итога за день для цветовой индикации (руб.) */
const CALENDAR_THRESHOLDS = Object.freeze({
  EMPTY: 0,
  LOW: 500,
  MEDIUM: 2000,
  HIGH: 5000
});

/* ============================================================================
 * DataService — доступ к справочникам
 * ========================================================================== */

/**
 * Сервис справочных данных приложения.
 * Предоставляет города, показатели продаж и операторского блока.
 */
class DataService {
  /**
   * Возвращает список городов.
   * @returns {Array<{id: string, name: string, category: string, hourlyRate: number}>}
   */
  static getCities() {
    return Object.values(CITIES);
  }

  /**
   * Возвращает город по идентификатору.
   * @param {string} cityId
   * @returns {{id: string, name: string, category: string, hourlyRate: number}|null}
   */
  static getCity(cityId) {
    return CITIES[cityId] || null;
  }

  /**
   * Возвращает ставку часа для города.
   * @param {string} cityId
   * @returns {number}
   */
  static getHourlyRate(cityId) {
    const city = DataService.getCity(cityId);
    return city ? city.hourlyRate : CITIES[DEFAULT_CITY_ID].hourlyRate;
  }

  /**
   * Возвращает категорию города.
   * @param {string} cityId
   * @returns {string}
   */
  static getCityCategory(cityId) {
    const city = DataService.getCity(cityId);
    return city ? city.category : CITY_CATEGORY_STANDARD;
  }

  /**
   * Возвращает все показатели продаж.
   * @returns {ReadonlyArray<{id: string, name: string, rate: number, rateType: string}>}
   */
  static getSalesIndicators() {
    return SALES_INDICATORS;
  }

  /**
   * Возвращает показатель продаж по id.
   * @param {string} indicatorId
   * @returns {{id: string, name: string, rate: number, rateType: string}|null}
   */
  static getSalesIndicator(indicatorId) {
    return SALES_INDICATORS.find((item) => item.id === indicatorId) || null;
  }

  /**
   * Возвращает все операторские показатели.
   * @returns {ReadonlyArray<{id: string, name: string, rate: number, rateType: string}>}
   */
  static getOperatorIndicators() {
    return OPERATOR_INDICATORS;
  }

  /**
   * Возвращает операторский показатель по id.
   * @param {string} indicatorId
   * @returns {{id: string, name: string, rate: number, rateType: string}|null}
   */
  static getOperatorIndicator(indicatorId) {
    return OPERATOR_INDICATORS.find((item) => item.id === indicatorId) || null;
  }

  /**
   * Возвращает показатель по блоку и id.
   * @param {string} block - 'sales' | 'operator'
   * @param {string} indicatorId
   * @returns {{id: string, name: string, rate: number, rateType: string}|null}
   */
  static getIndicator(block, indicatorId) {
    if (block === BLOCKS.SALES) {
      return DataService.getSalesIndicator(indicatorId);
    }
    if (block === BLOCKS.OPERATOR) {
      return DataService.getOperatorIndicator(indicatorId);
    }
    return null;
  }

  /**
   * Возвращает название месяца.
   * @param {number} month - 1–12
   * @returns {string}
   */
  static getMonthName(month) {
    return MONTH_NAMES[month] || '';
  }

  /**
   * Формирует ключ периода «YYYY-MM».
   * @param {number} year
   * @param {number} month
   * @returns {string}
   */
  static makePeriodKey(year, month) {
    const m = String(month).padStart(2, '0');
    return `${year}-${m}`;
  }

  /**
   * Разбирает ключ периода.
   * @param {string} periodKey
   * @returns {{year: number, month: number}}
   */
  static parsePeriodKey(periodKey) {
    const [yearStr, monthStr] = String(periodKey).split('-');
    return {
      year: Number(yearStr),
      month: Number(monthStr)
    };
  }

  /**
   * Количество дней в месяце.
   * @param {number} year
   * @param {number} month - 1–12
   * @returns {number}
   */
  static getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }
}

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

/**
 * Коэффициент сезонности по месяцам (1–12).
 * Применяется ТОЛЬКО к премии, никогда к окладу.
 * Январь–июнь: +10% (1.10), июль–декабрь: −10% (0.90).
 * @type {Readonly<Object<number, number>>}
 */
const seasonality = Object.freeze({
  1: 1.10,
  2: 1.10,
  3: 1.10,
  4: 1.10,
  5: 1.10,
  6: 1.10,
  7: 0.90,
  8: 0.90,
  9: 0.90,
  10: 0.90,
  11: 0.90,
  12: 0.90
});

/** Коэффициент сезонности по умолчанию */
const DEFAULT_SEASONALITY = 1.0;

/**
 * Порог выполнения фокусного KPI (>= = выполнен).
 */
const KPI_FOCUS_PASS_THRESHOLD = 100;

/**
 * Штраф блока «Фокусные KPI» по числу невыполненных показателей.
 * Ключ — количество непройденных KPI (0–3).
 * @type {Readonly<Object<number, number>>}
 */
const KPI_FOCUS_FAIL_ADJUSTMENTS = Object.freeze({
  0: 0,
  1: -2.5,
  2: -5,
  3: -10
});

/**
 * Показатели внутри блока «Фокусные KPI».
 * @type {ReadonlyArray<{id: string, label: string, valueKey: string}>}
 */
const KPI_FOCUS_METRICS = Object.freeze([
  Object.freeze({ id: 'focusSpd', label: 'ШПД', valueKey: 'focusSpd' }),
  Object.freeze({ id: 'focusCs', label: 'ЦС и Подписки', valueKey: 'focusCs' }),
  Object.freeze({ id: 'focusMnp', label: 'MNP и ПА', valueKey: 'focusMnp' })
]);

/**
 * Правила мультипликатора KPI.
 * Для percent-KPI: ranges с порогом min (включительно), проверка сверху вниз.
 * adjustment — процентные пункты (+10 = +10%).
 * @type {Readonly<Object>}
 */
const kpiMultipliers = Object.freeze({
  sim: Object.freeze({
    id: 'sim',
    label: 'SIM',
    fullName: 'Личный план SIM',
    group: 'KPI 1',
    inputType: 'percent',
    valueKey: 'sim',
    ranges: Object.freeze([
      Object.freeze({ min: 120, adjustment: 10 }),
      Object.freeze({ min: 110, adjustment: 5 }),
      Object.freeze({ min: 100, adjustment: 0 }),
      Object.freeze({ min: 90, adjustment: -5 }),
      Object.freeze({ min: 75, adjustment: -10 }),
      Object.freeze({ min: Number.NEGATIVE_INFINITY, adjustment: -20 })
    ])
  }),
  conversion: Object.freeze({
    id: 'conversion',
    label: 'Конверсия',
    fullName: 'Конверсия салона',
    group: 'KPI 2',
    inputType: 'percent',
    valueKey: 'conversion',
    ranges: Object.freeze([
      Object.freeze({ min: 110, adjustment: 5 }),
      Object.freeze({ min: 100, adjustment: 0 }),
      Object.freeze({ min: 85, adjustment: -5 }),
      Object.freeze({ min: Number.NEGATIVE_INFINITY, adjustment: -10 })
    ])
  }),
  focus: Object.freeze({
    id: 'focus',
    label: 'Фокусные KPI',
    fullName: 'Фокусные KPI операторов',
    group: 'KPI 3',
    inputType: 'focus_group',
    metrics: KPI_FOCUS_METRICS,
    passThreshold: KPI_FOCUS_PASS_THRESHOLD,
    failAdjustments: KPI_FOCUS_FAIL_ADJUSTMENTS
  }),
  credits: Object.freeze({
    id: 'credits',
    label: 'Кредиты',
    fullName: 'Кредиты',
    group: 'KPI 4',
    inputType: 'percent_with_flag',
    valueKey: 'credits',
    flagKey: 'applicationsPlanMet',
    flagLabel: 'План по заявкам выполнен',
    ranges: Object.freeze([
      Object.freeze({ min: 120, adjustment: 10 }),
      Object.freeze({ min: 100, adjustment: 0 }),
      Object.freeze({ min: 85, adjustment: -2.5 }),
      Object.freeze({ min: 70, adjustment: -5 })
    ]),
    /** <70% и план по заявкам не выполнен */
    below70PlanFailedAdjustment: -10,
    /** <70% и план по заявкам выполнен */
    below70PlanMetAdjustment: -5
  }),
  accessories: Object.freeze({
    id: 'accessories',
    label: 'Аксессуары + Услуги',
    fullName: 'Аксессуары + Услуги',
    group: 'KPI 5',
    inputType: 'percent',
    valueKey: 'accessories',
    ranges: Object.freeze([
      Object.freeze({ min: 120, adjustment: 10 }),
      Object.freeze({ min: 100, adjustment: 5 }),
      Object.freeze({ min: 85, adjustment: 0 }),
      Object.freeze({ min: 70, adjustment: -10 }),
      Object.freeze({ min: Number.NEGATIVE_INFINITY, adjustment: -20 })
    ])
  }),
  insurance: Object.freeze({
    id: 'insurance',
    label: 'Страхование',
    fullName: 'Страхование (доля)',
    group: 'KPI 6',
    inputType: 'percent',
    valueKey: 'insurance',
    ranges: Object.freeze([
      Object.freeze({ min: 100, adjustment: 5 }),
      Object.freeze({ min: 85, adjustment: 0 }),
      Object.freeze({ min: 70, adjustment: -10 }),
      Object.freeze({ min: Number.NEGATIVE_INFINITY, adjustment: -20 })
    ])
  })
});

/** Значения KPI по умолчанию (нейтральные) */
const DEFAULT_KPI_VALUES = Object.freeze({
  sim: 100,
  conversion: 100,
  focusSpd: 100,
  focusCs: 100,
  focusMnp: 100,
  credits: 100,
  applicationsPlanMet: false,
  accessories: 100,
  insurance: 100
});

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

  /**
   * Коэффициент сезонности для месяца (только для премии).
   * @param {number} month - 1–12
   * @returns {number}
   */
  static getSeasonality(month) {
    const value = seasonality[month];
    return typeof value === 'number' ? value : DEFAULT_SEASONALITY;
  }

  /**
   * Объект коэффициентов сезонности (для расширения и отладки).
   * @returns {Readonly<Object<number, number>>}
   */
  static getSeasonalityMap() {
    return seasonality;
  }

  /**
   * Правила мультипликатора KPI.
   * @returns {Readonly<Object>}
   */
  static getKpiMultipliers() {
    return kpiMultipliers;
  }

  /**
   * Список KPI в порядке отображения.
   * @returns {Array<Object>}
   */
  static getKpiRuleList() {
    return Object.values(kpiMultipliers);
  }

  /**
   * Правило одного KPI по ключу.
   * @param {string} kpiKey
   * @returns {Object|null}
   */
  static getKpiRule(kpiKey) {
    return kpiMultipliers[kpiKey] || null;
  }

  /**
   * Значения KPI по умолчанию.
   * @returns {Object}
   */
  static getDefaultKpiValues() {
    return { ...DEFAULT_KPI_VALUES };
  }

  /**
   * Подбор корректировки по диапазонам процента (сверху вниз по min).
   * @param {ReadonlyArray<{min: number, adjustment: number}>} ranges
   * @param {number} percent
   * @returns {number}
   */
  static matchPercentAdjustment(ranges, percent) {
    const value = Utils.toNumber(percent, 0);
    const sorted = [...ranges].sort((a, b) => b.min - a.min);
    for (let i = 0; i < sorted.length; i += 1) {
      if (value >= sorted[i].min) {
        return sorted[i].adjustment;
      }
    }
    return 0;
  }

  /**
   * Оценка фокусного блока: статусы метрик и один штраф за число провалов.
   * @param {Object} kpiValues
   * @returns {{metrics: Array, passedCount: number, failedCount: number, total: number, adjustment: number}}
   */
  static evaluateFocusGroup(kpiValues) {
    const rule = DataService.getKpiRule('focus');
    const threshold = rule.passThreshold;
    const metrics = rule.metrics.map((metric) => {
      const percent = Utils.toNumber(kpiValues[metric.valueKey], 0);
      const passed = percent >= threshold;
      return {
        id: metric.id,
        label: metric.label,
        valueKey: metric.valueKey,
        percent,
        passed,
        status: passed ? 'passed' : 'failed',
        statusLabel: passed ? 'Выполнен' : 'Не выполнен'
      };
    });
    const total = metrics.length;
    const passedCount = metrics.filter((m) => m.passed).length;
    const failedCount = total - passedCount;
    const adjustment = rule.failAdjustments[failedCount] ?? rule.failAdjustments[3];
    return {
      metrics,
      passedCount,
      failedCount,
      total,
      adjustment,
      labelText: Utils.formatSignedPercent(adjustment)
    };
  }

  /**
   * Корректировка одного KPI в процентных пунктах.
   * @param {string} kpiKey
   * @param {Object} kpiValues
   * @returns {number}
   */
  static resolveKpiAdjustment(kpiKey, kpiValues) {
    const rule = DataService.getKpiRule(kpiKey);
    if (!rule) return 0;

    if (rule.inputType === 'focus_group') {
      return DataService.evaluateFocusGroup(kpiValues).adjustment;
    }

    if (kpiKey === 'credits') {
      const percent = Utils.toNumber(kpiValues.credits, 0);
      if (percent >= 70) {
        return DataService.matchPercentAdjustment(rule.ranges, percent);
      }
      return kpiValues.applicationsPlanMet
        ? rule.below70PlanMetAdjustment
        : rule.below70PlanFailedAdjustment;
    }

    const percent = Utils.toNumber(kpiValues[rule.valueKey], 0);
    return DataService.matchPercentAdjustment(rule.ranges, percent);
  }

  /**
   * Рублёвый эффект корректировки относительно премии после сезонности.
   * @param {number} premiumAfterSeasonality
   * @param {number} adjustment
   * @returns {number}
   */
  static moneyFromAdjustment(premiumAfterSeasonality, adjustment) {
    return Utils.roundMoney(
      Utils.toNumber(premiumAfterSeasonality, 0) * Utils.toNumber(adjustment, 0) / 100
    );
  }

  /**
   * Статус KPI для цветовой индикации.
   * @param {number} adjustment
   * @returns {'bonus'|'neutral'|'penalty'}
   */
  static getKpiStatus(adjustment) {
    if (adjustment > 0) return 'bonus';
    if (adjustment < 0) return 'penalty';
    return 'neutral';
  }

  /**
   * Уровни KPI, отсортированные по порогу возрастания (без -Infinity в UI).
   * @param {Object} rule
   * @returns {Array<{min: number, adjustment: number}>}
   */
  static getKpiLevels(rule) {
    if (rule.inputType === 'focus_group') {
      return Object.keys(rule.failAdjustments)
        .map((failed) => ({
          min: Number(failed),
          adjustment: rule.failAdjustments[failed]
        }))
        .sort((a, b) => a.min - b.min);
    }
    return [...rule.ranges]
      .filter((r) => Number.isFinite(r.min))
      .sort((a, b) => a.min - b.min);
  }

  /**
   * Максимальная корректировка по правилу.
   * @param {Object} rule
   * @returns {number}
   */
  static getMaxKpiAdjustment(rule) {
    if (rule.inputType === 'focus_group') {
      return Math.max(...Object.values(rule.failAdjustments));
    }
    if (rule.id === 'credits') {
      return Math.max(
        ...rule.ranges.map((r) => r.adjustment),
        rule.below70PlanMetAdjustment,
        rule.below70PlanFailedAdjustment
      );
    }
    return Math.max(...rule.ranges.map((r) => r.adjustment));
  }

  /**
   * Следующий улучшающий уровень относительно текущего процента/корректировки.
   * @param {Object} rule
   * @param {number} percent
   * @param {number} currentAdjustment
   * @param {Object} kpiValues
   * @returns {{threshold: number, adjustment: number, kind?: string, hint?: string}|null}
   */
  static getNextKpiLevel(rule, percent, currentAdjustment, kpiValues) {
    if (rule.inputType === 'focus_group') {
      const focus = DataService.evaluateFocusGroup(kpiValues);
      if (focus.failedCount <= 0) return null;
      const nextFailed = focus.failedCount - 1;
      return {
        threshold: nextFailed,
        adjustment: rule.failAdjustments[nextFailed],
        kind: 'focus',
        hint: `Закрыть ещё 1 KPI (${nextFailed} провалов)`
      };
    }

    const levels = DataService.getKpiLevels(rule);

    if (rule.id === 'credits' && percent < 70) {
      if (!kpiValues.applicationsPlanMet
        && currentAdjustment < rule.below70PlanMetAdjustment) {
        return {
          threshold: percent,
          adjustment: rule.below70PlanMetAdjustment,
          kind: 'flag',
          hint: 'Выполнить план по заявкам'
        };
      }
      const level70 = levels.find((l) => l.min === 70);
      if (level70 && level70.adjustment > currentAdjustment) {
        return { threshold: 70, adjustment: level70.adjustment, kind: 'percent' };
      }
    }

    for (let i = 0; i < levels.length; i += 1) {
      const level = levels[i];
      if (level.min > percent && level.adjustment > currentAdjustment) {
        return { threshold: level.min, adjustment: level.adjustment, kind: 'percent' };
      }
    }

    for (let i = 0; i < levels.length; i += 1) {
      const level = levels[i];
      if (level.adjustment > currentAdjustment) {
        return {
          threshold: Math.max(level.min, percent),
          adjustment: level.adjustment,
          kind: 'percent'
        };
      }
    }

    return null;
  }

  /**
   * Анализ потерь и возможностей по одному KPI.
   * @param {Object} rule
   * @param {Object} kpiValues
   * @param {number} premiumAfterSeasonality
   * @returns {Object}
   */
  static analyzeKpiOpportunity(rule, kpiValues, premiumAfterSeasonality) {
    if (rule.inputType === 'focus_group') {
      const focus = DataService.evaluateFocusGroup(kpiValues);
      const currentAdjustment = focus.adjustment;
      const currentMoney = DataService.moneyFromAdjustment(
        premiumAfterSeasonality,
        currentAdjustment
      );
      const maxAdjustment = DataService.getMaxKpiAdjustment(rule);
      const maxMoney = DataService.moneyFromAdjustment(
        premiumAfterSeasonality,
        maxAdjustment
      );
      const next = DataService.getNextKpiLevel(
        rule,
        0,
        currentAdjustment,
        kpiValues
      );
      const recoverToNext = next
        ? Utils.roundMoney(
          DataService.moneyFromAdjustment(premiumAfterSeasonality, next.adjustment)
          - currentMoney
        )
        : 0;

      return {
        id: rule.id,
        label: rule.label,
        fullName: rule.fullName,
        group: rule.group,
        inputType: 'focus_group',
        focus,
        percent: null,
        currentAdjustment,
        currentLabel: Utils.formatSignedPercent(currentAdjustment),
        status: DataService.getKpiStatus(currentAdjustment),
        currentMoney,
        loss: currentAdjustment < 0 ? currentMoney : 0,
        nextThreshold: next ? next.threshold : null,
        nextAdjustment: next ? next.adjustment : null,
        nextLabel: next ? Utils.formatSignedPercent(next.adjustment) : null,
        remainingToNext: next ? 1 : 0,
        recoverToNext,
        nextHint: next ? next.hint : '',
        maxAdjustment,
        maxLabel: Utils.formatSignedPercent(maxAdjustment),
        remainingToMax: focus.failedCount,
        gainToMax: Utils.roundMoney(maxMoney - currentMoney),
        recoverToZero: currentAdjustment < 0
          ? Utils.roundMoney(0 - currentMoney)
          : 0,
        atMax: focus.failedCount === 0
      };
    }

    const percent = Utils.toNumber(kpiValues[rule.valueKey], 0);
    const currentAdjustment = DataService.resolveKpiAdjustment(rule.id, kpiValues);
    const currentMoney = DataService.moneyFromAdjustment(
      premiumAfterSeasonality,
      currentAdjustment
    );
    const status = DataService.getKpiStatus(currentAdjustment);
    const maxAdjustment = DataService.getMaxKpiAdjustment(rule);
    const maxMoney = DataService.moneyFromAdjustment(
      premiumAfterSeasonality,
      maxAdjustment
    );
    const loss = currentAdjustment < 0 ? currentMoney : 0;
    const next = DataService.getNextKpiLevel(
      rule,
      percent,
      currentAdjustment,
      kpiValues
    );

    let nextThreshold = null;
    let nextAdjustment = null;
    let remainingToNext = 0;
    let recoverToNext = 0;
    let nextHint = '';

    if (next) {
      nextThreshold = next.threshold;
      nextAdjustment = next.adjustment;
      remainingToNext = next.kind === 'flag'
        ? 0
        : Utils.roundMoney(Math.max(0, next.threshold - percent));
      recoverToNext = Utils.roundMoney(
        DataService.moneyFromAdjustment(premiumAfterSeasonality, next.adjustment)
        - currentMoney
      );
      nextHint = next.hint || '';
    }

    const remainingToMaxLevels = DataService.getKpiLevels(rule);
    const maxLevel = remainingToMaxLevels.reduce(
      (best, level) => (!best || level.adjustment > best.adjustment ? level : best),
      null
    );
    const remainingToMax = maxLevel
      ? Utils.roundMoney(Math.max(0, maxLevel.min - percent))
      : 0;
    const gainToMax = Utils.roundMoney(maxMoney - currentMoney);

    return {
      id: rule.id,
      label: rule.label,
      fullName: rule.fullName,
      group: rule.group,
      inputType: rule.inputType,
      percent,
      currentAdjustment,
      currentLabel: Utils.formatSignedPercent(currentAdjustment),
      status,
      currentMoney,
      loss,
      nextThreshold,
      nextAdjustment,
      nextLabel: nextAdjustment === null
        ? null
        : Utils.formatSignedPercent(nextAdjustment),
      remainingToNext,
      recoverToNext,
      nextHint,
      maxAdjustment,
      maxLabel: Utils.formatSignedPercent(maxAdjustment),
      remainingToMax,
      gainToMax,
      recoverToZero: currentAdjustment < 0
        ? Utils.roundMoney(0 - currentMoney)
        : 0,
      atMax: currentAdjustment >= maxAdjustment
    };
  }

  /**
   * Полный расчёт мультипликатора KPI + аналитика.
   * @param {Object} kpiValues
   * @param {number} [premiumAfterSeasonality=0]
   * @returns {Object}
   */
  static calculateKpiMultiplier(kpiValues, premiumAfterSeasonality = 0) {
    const rules = DataService.getKpiRuleList();
    const focusDetails = DataService.evaluateFocusGroup(kpiValues);

    const items = rules.map((rule) => {
      const adjustment = DataService.resolveKpiAdjustment(rule.id, kpiValues);
      const money = DataService.moneyFromAdjustment(
        premiumAfterSeasonality,
        adjustment
      );
      const base = {
        id: rule.id,
        label: rule.label,
        fullName: rule.fullName,
        group: rule.group,
        adjustment,
        labelText: Utils.formatSignedPercent(adjustment),
        status: DataService.getKpiStatus(adjustment),
        money,
        inputType: rule.inputType
      };

      if (rule.inputType === 'focus_group') {
        return {
          ...base,
          percent: null,
          focus: focusDetails
        };
      }

      return {
        ...base,
        percent: Utils.toNumber(kpiValues[rule.valueKey], 0)
      };
    });

    const totalAdjustment = Utils.roundMoney(
      items.reduce((sum, item) => sum + item.adjustment, 0)
    );

    const opportunities = rules.map((rule) =>
      DataService.analyzeKpiOpportunity(rule, kpiValues, premiumAfterSeasonality)
    );

    const lossesTotal = Utils.roundMoney(
      opportunities.reduce((sum, item) => sum + (item.loss < 0 ? item.loss : 0), 0)
    );
    const nextGoalsGain = Utils.roundMoney(
      opportunities.reduce(
        (sum, item) => sum + (item.recoverToNext > 0 ? item.recoverToNext : 0),
        0
      )
    );
    const maxTotalAdjustment = Utils.roundMoney(
      rules.reduce((sum, rule) => sum + DataService.getMaxKpiAdjustment(rule), 0)
    );
    const maxPremium = Utils.roundMoney(
      premiumAfterSeasonality * (1 + maxTotalAdjustment / 100)
    );
    const currentPremium = Utils.roundMoney(
      premiumAfterSeasonality * (1 + totalAdjustment / 100)
    );

    return {
      items,
      focus: focusDetails,
      totalAdjustment,
      factor: 1 + totalAdjustment / 100,
      labelText: Utils.formatSignedPercent(totalAdjustment),
      opportunities,
      analytics: {
        lossesTotal,
        nextGoalsGain,
        maxTotalAdjustment,
        maxTotalLabel: Utils.formatSignedPercent(maxTotalAdjustment),
        maxPremium,
        currentPremium,
        premiumGap: Utils.roundMoney(maxPremium - currentPremium)
      }
    };
  }
}

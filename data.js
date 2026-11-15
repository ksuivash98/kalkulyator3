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

/** Ключи категорий сотрудников */
const EMPLOYEE_CATEGORIES = Object.freeze({
  STANDARD: 'standard',
  DOTA1: 'dota1',
  DOTA2: 'dota2'
});

/** Человекочитаемые названия категорий */
const EMPLOYEE_CATEGORY_LABELS = Object.freeze({
  [EMPLOYEE_CATEGORIES.STANDARD]: 'Стандарт',
  [EMPLOYEE_CATEGORIES.DOTA1]: 'Дота 1',
  [EMPLOYEE_CATEGORIES.DOTA2]: 'Дота 2'
});

/** Категория города по умолчанию */
const CITY_CATEGORY_STANDARD = EMPLOYEE_CATEGORIES.STANDARD;

/** Типы начисления */
const RATE_TYPES = Object.freeze({
  PERCENT: 'percent',
  FIXED: 'fixed'
});

/** Блоки показателей */
const BLOCKS = Object.freeze({
  SALES: 'sales',
  OPERATOR: 'operator',
  ADMIN: 'admin'
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
 * Корректировка сезонности в процентных пунктах (только к премии).
 * Январь–июнь: +10%, июль–декабрь: −10%.
 * Оклад (часы × ставка) никогда не изменяется.
 */
const SEASONALITY_BONUS_PERCENT = 10;
const SEASONALITY_PENALTY_PERCENT = -10;

/**
 * Граница сезонов: месяцы 1..SEASONALITY_BONUS_UNTIL_MONTH — бонус,
 * остальные до 12 — штраф.
 */
const SEASONALITY_BONUS_UNTIL_MONTH = 6;

/**
 * Коэффициент сезонности по месяцам (1–12) — процентные пункты к бонусной части.
 * Дублирует правило для явного просмотра и расширения.
 * @type {Readonly<Object<number, number>>}
 */
const seasonality = Object.freeze({
  1: SEASONALITY_BONUS_PERCENT,
  2: SEASONALITY_BONUS_PERCENT,
  3: SEASONALITY_BONUS_PERCENT,
  4: SEASONALITY_BONUS_PERCENT,
  5: SEASONALITY_BONUS_PERCENT,
  6: SEASONALITY_BONUS_PERCENT,
  7: SEASONALITY_PENALTY_PERCENT,
  8: SEASONALITY_PENALTY_PERCENT,
  9: SEASONALITY_PENALTY_PERCENT,
  10: SEASONALITY_PENALTY_PERCENT,
  11: SEASONALITY_PENALTY_PERCENT,
  12: SEASONALITY_PENALTY_PERCENT
});

/** Сезонность по умолчанию (0% — без изменения премии) */
const DEFAULT_SEASONALITY_PERCENT = 0;

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
      Object.freeze({ min: 100, adjustment: 5 }),
      Object.freeze({ min: 85, adjustment: 0 }),
      Object.freeze({ min: 70, adjustment: -2.5 })
    ]),
    /** <70% и план по заявкам не выполнен */
    below70PlanFailedAdjustment: -5,
    /** <70% и план по заявкам выполнен */
    below70PlanMetAdjustment: -2.5
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
      Object.freeze({ min: 70, adjustment: -5 }),
      Object.freeze({ min: Number.NEGATIVE_INFINITY, adjustment: -10 })
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
      Object.freeze({ min: 70, adjustment: -5 }),
      Object.freeze({ min: Number.NEGATIVE_INFINITY, adjustment: -10 })
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
 * categoryKey — ключ категории для выбора ставок показателей.
 * categoryLabel — русское название для UI.
 * @type {Readonly<Object<string, {id: string, name: string, categoryKey: string, categoryLabel: string, hourlyRate: number}>>}
 */
const CITIES = Object.freeze({
  berezniki: Object.freeze({
    id: 'berezniki',
    name: 'Березники',
    categoryKey: EMPLOYEE_CATEGORIES.STANDARD,
    categoryLabel: EMPLOYEE_CATEGORY_LABELS[EMPLOYEE_CATEGORIES.STANDARD],
    hourlyRate: 100
  }),
  solikamsk: Object.freeze({
    id: 'solikamsk',
    name: 'Соликамск',
    categoryKey: EMPLOYEE_CATEGORIES.STANDARD,
    categoryLabel: EMPLOYEE_CATEGORY_LABELS[EMPLOYEE_CATEGORIES.STANDARD],
    hourlyRate: 110
  }),
  kungur: Object.freeze({
    id: 'kungur',
    name: 'Кунгур',
    categoryKey: EMPLOYEE_CATEGORIES.STANDARD,
    categoryLabel: EMPLOYEE_CATEGORY_LABELS[EMPLOYEE_CATEGORIES.STANDARD],
    hourlyRate: 100
  }),
  perm: Object.freeze({
    id: 'perm',
    name: 'Пермь',
    categoryKey: EMPLOYEE_CATEGORIES.DOTA1,
    categoryLabel: EMPLOYEE_CATEGORY_LABELS[EMPLOYEE_CATEGORIES.DOTA1],
    hourlyRate: 130
  })
});

/** Город по умолчанию */
const DEFAULT_CITY_ID = 'berezniki';

/* ============================================================================
 * Показатели блока «Продажи» (процент от суммы продажи)
 * ========================================================================== */

/**
 * Показатели экономического блока.
 * rates хранят ставки сразу для категорий standard / dota1 / dota2.
 * Все значения percent хранятся как доли: 0.005 = 0,5%.
 * @type {ReadonlyArray<{id: string, name: string, block: string, rateType: string, rates: Object}>}
 */
const economicIndicators = Object.freeze([
  Object.freeze({ id: 'credit_application_nov26', name: 'Заявка на кредит / рассрочку / спецрассрочку Халва (ноябрь 2026)', block: BLOCKS.SALES, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 100, dota1: 125, dota2: 150 }) }),
  Object.freeze({
    id: 'smart_red_apple_obmen',
    name: 'Смартфоны категории Red, Apple и по акции «Обмен минут»',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.005, dota1: 0.005, dota2: 0.005 })
  }),
  Object.freeze({
    id: 'smart_standart_tablet',
    name: 'Смартфоны категории Standart и планшеты',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.01, dota1: 0.01, dota2: 0.01 })
  }),
  Object.freeze({
    id: 'smart_green',
    name: 'Смартфоны категории Green',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.02, dota1: 0.025, dota2: 0.03 })
  }),
  Object.freeze({
    id: 'smart_sellout_dead',
    name: 'Смартфоны категории Sell Out / Dead',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.03, dota1: 0.035, dota2: 0.04 })
  }),
  Object.freeze({
    id: 'feature_phones',
    name: 'Кнопочные телефоны',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.05, dota1: 0.075, dota2: 0.10 })
  }),
  Object.freeze({
    id: 'trade_in',
    name: 'Трейд-ин',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.04, dota1: 0.05, dota2: 0.06 })
  }),
  Object.freeze({
    id: 'buyout',
    name: 'Выкуп',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.015, dota1: 0.015, dota2: 0.015 })
  }),
  Object.freeze({
    id: 'accessories',
    name: 'Аксессуары и носимая электроника',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.10, dota1: 0.125, dota2: 0.15 })
  }),
  Object.freeze({
    id: 'wearable_premium',
    name: 'Носимая электроника Premium',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.04, dota1: 0.05, dota2: 0.06 })
  }),
  Object.freeze({
    id: 'services_settings',
    name: 'Услуги | Настройки',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.20, dota1: 0.25, dota2: 0.30 })
  }),
  Object.freeze({
    id: 'kaspersky',
    name: 'Подписка на Антивирус Kaspersky (299 руб, 1 месяц бесплатно)',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.FIXED,
    rates: Object.freeze({ standard: 100, dota1: 100, dota2: 100 })
  }),
  Object.freeze({
    id: 'insurance_mmb',
    name: 'Страхование ММБ Ренессанс без Комбо',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.12, dota1: 0.15, dota2: 0.18 })
  }),
  Object.freeze({
    id: 'insurance_other',
    name: 'Страхование остальное / КСЖ',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.08, dota1: 0.10, dota2: 0.12 })
  }),
  Object.freeze({
    id: 'repair_accept',
    name: 'Прием в ремонт',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.08, dota1: 0.10, dota2: 0.12 })
  }),
  Object.freeze({
    id: 'stoloto_tickets',
    name: 'Лотерейные билеты «Столото»',
    block: BLOCKS.SALES,
    rateType: RATE_TYPES.PERCENT,
    rates: Object.freeze({ standard: 0.04, dota1: 0.05, dota2: 0.06 })
  })
]);

/* ============================================================================
 * Показатели операторского блока
 * ========================================================================== */

/**
 * Показатели операторского блока.
 * Для fixed ставка выражена в рублях за 1 операцию.
 * Для percent ставка хранится как доля: 0.08 = 8%.
 * @type {ReadonlyArray<{id: string, name: string, block: string, rateType: string, rates: Object}>}
 */
const operatorIndicators = Object.freeze([
  Object.freeze({ id: 'abon_24m', name: 'Абон 24 мес.', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 400, dota1: 500, dota2: 600 }) }),
  Object.freeze({ id: 'broadband_tv_application', name: 'Заявка на 1 услугу ШПД или ТВ', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 200, dota1: 250, dota2: 300 }) }),
  Object.freeze({ id: 'clean_number', name: 'Подключение платного «Чистого номера»', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 40, dota1: 50, dota2: 60 }) }),
  Object.freeze({ id: 'mixx', name: 'Подключение Абонемента Mixx (3/6/12 мес.)', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 80, dota1: 100, dota2: 120 }) }),
  Object.freeze({ id: 'extra_sim', name: 'Экстра-Sim', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: -40, dota1: -40, dota2: -40 }) }),
  Object.freeze({ id: 'extra_sim_overlimit', name: 'Экстра-Sim (при превышении лимита)', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: -80, dota1: -80, dota2: -80 }) }),
  Object.freeze({ id: 'base_tp', name: 'Базовые ТП', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 40, dota1: 50, dota2: 60 }) }),
  Object.freeze({ id: 'bundle_base_tp', name: 'Bundle Базовые ТП', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 70, dota1: 90, dota2: 110 }) }),
  Object.freeze({ id: 'high_bundle_tp', name: 'High Bundle ТП', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 120, dota1: 150, dota2: 180 }) }),
  Object.freeze({ id: 'high_bundle_plus_tp', name: 'High Bundle + ТП', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 160, dota1: 200, dota2: 240 }) }),
  Object.freeze({ id: 'high_bundle_plusplus_tp', name: 'High Bundle ++ ТП', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 280, dota1: 350, dota2: 420 }) }),
  Object.freeze({ id: 'premium_tp', name: 'Premium ТП', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 350, dota1: 450, dota2: 550 }) }),
  Object.freeze({ id: 'promo_sim_booster', name: 'Промо Sim от оператора / Акция «Бустер»', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 40, dota1: 50, dota2: 60 }) }),
  Object.freeze({ id: 'abon_sim_3m', name: 'Абон SIM 3 мес. (доп. к оплате за ТП Sim)', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 150, dota1: 200, dota2: 250 }) }),
  Object.freeze({ id: 'gold_combo_sim_3m', name: 'Золото / Комбо SIM 3 мес. / Абон МТС для устройств 12 мес.', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 250, dota1: 300, dota2: 350 }) }),
  Object.freeze({ id: 'gold_abon_combo_sim_6m', name: 'Золото / Абон / Комбо SIM 6 мес. / Абон МТС для устройств 36 мес.', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 350, dota1: 450, dota2: 550 }) }),
  Object.freeze({ id: 'gold_abon_combo_sim_12m', name: 'Золото / Абон / Комбо SIM 12 мес. (доп. к оплате за ТП Sim)', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 350, dota1: 450, dota2: 550 }) }),
  Object.freeze({ id: 'legal_entity', name: 'Подключение юр.лица (доп. к оплате за ТП Sim)', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 300, dota1: 350, dota2: 400 }) }),
  Object.freeze({ id: 'mnp', name: 'MNP (доп. к оплате за ТП Sim), кроме МТС', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 250, dota1: 300, dota2: 350 }) }),
  Object.freeze({ id: 'broadband_tv', name: 'Подключение 1 услуги ШПД или ТВ', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 200, dota1: 250, dota2: 300 }) }),
  Object.freeze({ id: 'service_ops', name: 'Сервисные операции Т2 и МТС', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 10, dota1: 12.5, dota2: 15 }) }),
  Object.freeze({ id: 'yandex_adapter', name: 'Яндекс адаптер', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 40, dota1: 50, dota2: 60 }) }),
  Object.freeze({ id: 'installment_card', name: 'Карта рассрочки без продажи по КР', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 500, dota1: 500, dota2: 500 }) }),
  Object.freeze({ id: 'cs_rtk_t2', name: 'ЦС (оборудование РТК) и подписки от Т2', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.PERCENT, rates: Object.freeze({ standard: 0.08, dota1: 0.10, dota2: 0.12 }) }),
  Object.freeze({ id: 'modem', name: 'Модем', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.PERCENT, rates: Object.freeze({ standard: 0, dota1: 0, dota2: 0 }) }),
  Object.freeze({ id: 'financing', name: 'Финансирование (% от суммы перевода)', block: BLOCKS.OPERATOR, rateType: RATE_TYPES.PERCENT, rates: Object.freeze({ standard: 0.003, dota1: 0.003, dota2: 0.003 }) })
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
 * Предоставляет города, категории, показатели экономического и операторского блока.
 */
class DataService {
  /**
   * Возвращает список городов.
   * @returns {Array<{id: string, name: string, categoryKey: string, categoryLabel: string, hourlyRate: number}>}
   */
  static getCities() {
    return Object.values(CITIES);
  }

  /**
   * Возвращает город по идентификатору.
   * @param {string} cityId
   * @returns {{id: string, name: string, categoryKey: string, categoryLabel: string, hourlyRate: number}|null}
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
   * Возвращает ключ категории города.
   * @param {string} cityId
   * @returns {string}
   */
  static getCityCategoryKey(cityId) {
    const city = DataService.getCity(cityId);
    return city ? city.categoryKey : CITY_CATEGORY_STANDARD;
  }

  /**
   * Возвращает название категории города для UI.
   * @param {string} cityId
   * @returns {string}
   */
  static getCityCategory(cityId) {
    const city = DataService.getCity(cityId);
    return city ? city.categoryLabel : EMPLOYEE_CATEGORY_LABELS[CITY_CATEGORY_STANDARD];
  }

  /**
   * Возвращает человекочитаемое имя категории.
   * @param {string} categoryKey
   * @returns {string}
   */
  static getCategoryLabel(categoryKey) {
    return EMPLOYEE_CATEGORY_LABELS[categoryKey] || EMPLOYEE_CATEGORY_LABELS[EMPLOYEE_CATEGORIES.STANDARD];
  }

  /**
   * Возвращает все показатели экономического блока.
   * @returns {ReadonlyArray<{id: string, name: string, rates: Object, rateType: string}>}
   */
  static getEconomicIndicators() {
    return economicIndicators;
  }

  /**
   * Совместимый alias для старого UI.
   * @returns {ReadonlyArray<{id: string, name: string, rates: Object, rateType: string}>}
   */
  static getSalesIndicators() {
    return DataService.getEconomicIndicators();
  }

  /**
   * Возвращает показатель экономического блока по id.
   * @param {string} indicatorId
   * @returns {{id: string, name: string, rates: Object, rateType: string}|null}
   */
  static getEconomicIndicator(indicatorId) {
    return economicIndicators.find((item) => item.id === indicatorId) || null;
  }

  /**
   * Совместимый alias для старого UI.
   * @param {string} indicatorId
   * @returns {{id: string, name: string, rates: Object, rateType: string}|null}
   */
  static getSalesIndicator(indicatorId) {
    return DataService.getEconomicIndicator(indicatorId);
  }

  /**
   * Возвращает все операторские показатели.
   * @returns {ReadonlyArray<{id: string, name: string, rates: Object, rateType: string}>}
   */
  static getOperatorIndicators() {
    return operatorIndicators.filter(item => item.id !== 'service_ops');
  }

  /**
   * Возвращает операторский показатель по id.
   * @param {string} indicatorId
   * @returns {{id: string, name: string, rates: Object, rateType: string}|null}
   */
  static getOperatorIndicator(indicatorId) {
    return operatorIndicators.find((item) => item.id === indicatorId) || null;
  }

  /**
   * Возвращает показатель по блоку и id.
   * @param {string} block - 'sales' | 'operator'
   * @param {string} indicatorId
   * @returns {{id: string, name: string, rates: Object, rateType: string}|null}
   */
  static getIndicator(block, indicatorId) {
    if (block === BLOCKS.ADMIN) return administrativeIndicators.find(item => item.id === indicatorId) || null;
    if (block === BLOCKS.SALES) {
      return DataService.getEconomicIndicator(indicatorId);
    }
    if (block === BLOCKS.OPERATOR) {
      return DataService.getOperatorIndicator(indicatorId);
    }
    return null;
  }

  /**
   * Возвращает ставку показателя по категории.
   * @param {Object|null} indicator
   * @param {string} categoryKey
   * @returns {number}
   */
  static getIndicatorRateByCategory(indicator, categoryKey) {
    if (!indicator || !indicator.rates) return 0;
    const normalized = categoryKey || EMPLOYEE_CATEGORIES.STANDARD;
    if (Object.prototype.hasOwnProperty.call(indicator.rates, normalized)) {
      return Utils.toNumber(indicator.rates[normalized], 0);
    }
    return Utils.toNumber(indicator.rates[EMPLOYEE_CATEGORIES.STANDARD], 0);
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
   * Процент сезонности для месяца (только для премии).
   * Янв–июнь: +10, июл–дек: −10.
   * @param {number|string} month - 1–12
   * @returns {number} процентные пункты
   */
  static getSeasonalityPercent(month) {
    const m = Number(month);
    if (!Number.isFinite(m)) {
      return DEFAULT_SEASONALITY_PERCENT;
    }
    const normalized = Math.trunc(m);
    if (normalized < 1 || normalized > 12) {
      return DEFAULT_SEASONALITY_PERCENT;
    }
    // Явная граница: 1–6 бонус, 7–12 штраф (без неоднозначного lookup)
    if (normalized <= SEASONALITY_BONUS_UNTIL_MONTH) {
      return SEASONALITY_BONUS_PERCENT;
    }
    return SEASONALITY_PENALTY_PERCENT;
  }

  /**
   * Множитель сезонности: 1 + percent/100.
   * Например +10% → 1.1, −10% → 0.9.
   * @param {number} month - 1–12
   * @returns {number}
   */
  static getSeasonality(month) {
    return 1 + DataService.getSeasonalityPercent(month) / 100;
  }

  /**
   * Применить сезонность только к премии (оклад не трогаем).
   * @param {number} premium
   * @param {number} month - 1–12
   * @returns {{percent: number, factor: number, premiumAfter: number, effect: number}}
   */
  static applySeasonalityToPremium(premium, month) {
    const base = Utils.toNumber(premium, 0);
    const percent = DataService.getSeasonalityPercent(month);
    const factor = 1 + percent / 100;
    const premiumAfter = Utils.roundMoney(base * factor);
    return {
      percent,
      factor,
      premiumAfter,
      effect: Utils.roundMoney(premiumAfter - base)
    };
  }

  /**
   * Объект процентов сезонности (для расширения и отладки).
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
    const values = kpiValues || DataService.getDefaultKpiValues();

    if (!rule || !Array.isArray(rule.metrics)) {
      return {
        metrics: [],
        passedCount: 0,
        failedCount: 0,
        total: 0,
        adjustment: 0,
        labelText: '0%'
      };
    }

    const threshold = Utils.toNumber(rule.passThreshold, 100);
    const metrics = rule.metrics.map((metric) => {
      const percent = Utils.toNumber(values[metric.valueKey], 0);
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
    const adjustment = Object.prototype.hasOwnProperty.call(rule.failAdjustments, failedCount)
      ? rule.failAdjustments[failedCount]
      : (rule.failAdjustments[3] || 0);
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
      Math.max(-30, Math.min(40, items.reduce((sum, item) => sum + item.adjustment, 0)))
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
      Math.min(40, rules.reduce((sum, rule) => sum + DataService.getMaxKpiAdjustment(rule), 0))
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

const administrativeIndicators = Object.freeze([
  Object.freeze({ id: 'vmr_bonus', name: 'ВМР: оценка за месяц ≥90% (МегаФон =100%)', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 2000, dota1: 2500, dota2: 3000 }) }),
  Object.freeze({ id: 'vmr_penalty', name: 'ВМР: нецелевая оценка <80% (МегаФон <90%); укажите 2 при двух месяцах подряд', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: -2000, dota1: -2500, dota2: -3000 }) }),
  Object.freeze({ id: 'recommend_manager', name: 'Рекомендация руководителя', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 5000, dota1: 5000, dota2: 5000 }) }),
  Object.freeze({ id: 'recommend_ptt', name: 'Рекомендация ПТТ', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 3000, dota1: 3000, dota2: 3000 }) }),
  Object.freeze({ id: 'salon_open', name: 'Подготовка к открытию нового салона', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 1000, dota1: 1000, dota2: 1000 }) }),
  Object.freeze({ id: 'vacation_cover', name: 'Проведение ФО', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 1000, dota1: 1000, dota2: 1000 }) }),
  Object.freeze({ id: 'senior_checklist', name: 'Старший продавец: чек-лист ДОВ ≥90%', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 1000, dota1: 1000, dota2: 1000 }) }),
  Object.freeze({ id: 'senior_sim', name: 'Старший продавец: план SIM 1 и 2 декады', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 1000, dota1: 1000, dota2: 1000 }) }),
  Object.freeze({ id: 'senior_services', name: 'Старший продавец: план услуг', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 2000, dota1: 2000, dota2: 2000 }) }),
  Object.freeze({ id: 'senior_mnp', name: 'Старший продавец: план MNP', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 2000, dota1: 2000, dota2: 2000 }) }),
  Object.freeze({ id: 'senior_partner', name: 'Старший продавец: дополнительный KPI партнёра', block: BLOCKS.ADMIN, rateType: RATE_TYPES.FIXED, rates: Object.freeze({ standard: 2000, dota1: 2000, dota2: 2000 }) })
]);

// Defaults match the supplied workbook; settings are saved per employee/month.
const REALISTIC_PLAN_FIELDS = Object.freeze([
  ['completedShifts', 'Уже отработано смен (пусто — по дневнику)', null, 'Основные данные'],
  ['multiplier', 'Мультипликатор плана (0,7–1,4)', 1, 'Основные данные'],
  ['admin', 'Административный бонус за месяц, ₽', 0, 'Основные данные'],
  ['goldCount', 'Золото / комбо за месяц, шт.', 5, 'Фиксированные объёмы'],
  ['abonCount', 'Абонементы Mixx за месяц, шт.', 5, 'Фиксированные объёмы'],
  ['applicationCount', 'Кредитные заявки за месяц, шт.', 10, 'Фиксированные объёмы'],
  ['simShare', 'SIM, % нужного бонуса', 35, 'Распределение бонуса'],
  ['accessoriesShare', 'Аксессуары, %', 30, 'Распределение бонуса'],
  ['smartphonesShare', 'Смартфоны, %', 10, 'Распределение бонуса'],
  ['servicesShare', 'Услуги, %', 20, 'Распределение бонуса'],
  ['mnpShare', 'MNP, %', 5, 'Распределение бонуса'],
  ['simLimit', 'SIM за смену, шт.', 3, 'Пределы реального плана'],
  ['accessoriesLimit', 'Аксессуары за смену, ₽', 3500, 'Пределы реального плана'],
  ['smartphonesLimit', 'Смартфоны за смену, ₽', 15000, 'Пределы реального плана'],
  ['servicesLimit', 'Услуги за смену, ₽', 1500, 'Пределы реального плана'],
  ['mnpLimit', 'MNP за месяц, шт.', 8, 'Пределы реального плана'],
  ['smartphonesCredit', 'Смартфоны в кредит, % оборота', 50, 'Оценка кредитного оборота'],
  ['accessoriesCredit', 'Аксессуары в кредит, % оборота', 50, 'Оценка кредитного оборота'],
  ['servicesCredit', 'Услуги в кредит, % оборота', 50, 'Оценка кредитного оборота'],
  ['insurancePerApplication', 'Страховка внутри кредита, ₽ / заявку', 2000, 'Оценка кредитного оборота']
]);
const REALISTIC_PLAN_PRODUCTS = Object.freeze([
  ['sim', 'SIM (High Bundle ТП)', BLOCKS.OPERATOR, 'high_bundle_tp', 'шт.'],
  ['accessories', 'Аксессуары', BLOCKS.SALES, 'accessories', '₽'],
  ['smartphones', 'Смартфоны Standart и планшеты', BLOCKS.SALES, 'smart_standart_tablet', '₽'],
  ['services', 'Услуги / настройки', BLOCKS.SALES, 'services_settings', '₽'],
  ['gold', 'Золото / комбо 3 месяца', BLOCKS.OPERATOR, 'gold_combo_sim_3m', 'шт.'],
  ['abon', 'Абонемент Mixx', BLOCKS.OPERATOR, 'mixx', 'шт.'],
  ['application', 'Кредитные заявки (ноябрь 2026)', BLOCKS.SALES, 'credit_application_nov26', 'шт.'],
  ['mnp', 'MNP, кроме МТС', BLOCKS.OPERATOR, 'mnp', 'шт.']
]);

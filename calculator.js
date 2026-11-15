/**
 * @file calculator.js
 * @description SalaryCalculator — расчёт оклада, премий, итогов дня/месяца и статистики.
 */

'use strict';

/**
 * Калькулятор заработной платы сотрудника салона связи.
 * Все формулы сосредоточены в одном классе для удобного расширения.
 */
class SalaryCalculator {
  /**
   * Рассчитывает начисление по одной строке показателя.
   * Ставка берётся из таблицы категории сотрудника.
   * @param {DayLineItem|Object} item
   * @param {string} categoryKey
   * @returns {{accrual: number, rate: number, rateType: string, indicatorName: string, salesAmount: number}}
   */
  static calculateLine(item, categoryKey, period = null) {
    const indicator = DataService.getIndicator(item.block, item.indicatorId);
    if (!indicator) {
      return {
        accrual: 0,
        rate: 0,
        rateType: RATE_TYPES.PERCENT,
        indicatorName: '',
        salesAmount: 0
      };
    }

    const value = Utils.toNumber(item.value, 0);
    if (item.indicatorId === 'credit_application_nov26' && (!period || period.year !== 2026 || period.month !== 11)) return { accrual: 0, rate: 0, rateType: indicator.rateType, indicatorName: indicator.name, salesAmount: 0 };
    const rate = DataService.getIndicatorRateByCategory(indicator, categoryKey);
    let accrual = 0;
    let salesAmount = 0;

    if (indicator.rateType === RATE_TYPES.FIXED) {
      // Начисление = количество × ставка
      accrual = value * rate;
    } else {
      // Начисление = сумма × процент
      accrual = value * rate;
      if (item.block === BLOCKS.SALES) {
        salesAmount = value;
      }
    }

    const paymentEligible = ['smart_red_apple_obmen', 'smart_standart_tablet', 'smart_green', 'smart_sellout_dead', 'feature_phones', 'trade_in', 'buyout'].includes(item.indicatorId);
    if (paymentEligible) accrual *= ({ card: 0.75, qr_credit: 1, cash: 1.25 })[item.paymentMethod] || 1;
    return {
      accrual: Utils.roundMoney(accrual),
      rate,
      rateType: indicator.rateType,
      indicatorName: indicator.name,
      salesAmount: Utils.roundMoney(salesAmount)
    };
  }

  /**
   * Оклад = часы × ставка.
   * @param {number} hours
   * @param {number} hourlyRate
   * @returns {number}
   */
  static calcSalary(hours, hourlyRate) {
    return Utils.roundMoney(Utils.toNumber(hours) * Utils.toNumber(hourlyRate));
  }

  /**
   * Среднее часов в день = часы ÷ рабочие дни.
   * @param {number} hours
   * @param {number} workDays
   * @returns {number}
   */
  static calcAvgHoursPerDay(hours, workDays) {
    const days = Utils.toNumber(workDays);
    if (days <= 0) return 0;
    return Utils.roundMoney(Utils.toNumber(hours) / days);
  }

  /**
   * Средняя зарплата за день = оклад ÷ рабочие дни.
   * @param {number} salary
   * @param {number} workDays
   * @returns {number}
   */
  static calcAvgSalaryPerDay(salary, workDays) {
    const days = Utils.toNumber(workDays);
    if (days <= 0) return 0;
    return Utils.roundMoney(Utils.toNumber(salary) / days);
  }

  /**
   * Полный расчёт одного дня.
   * @param {DayData} day
   * @param {number} hourlyRate
   * @param {string} categoryKey
   * @returns {Object}
   */
  static calculateDay(day, hourlyRate, categoryKey, period = null) {
    const hours = Utils.toNumber(day.hours, 0);
    const daySalary = SalaryCalculator.calcSalary(hours, hourlyRate);

    let salesTotal = 0;
    let salesPremium = 0;
    let operatorPremium = 0;
    let administrativePremium = 0;
    let salesCount = 0;
    let operatorCount = 0;
    const indicatorStats = {};

    const lines = day.items.map((item) => {
      const calc = SalaryCalculator.calculateLine(item, categoryKey, period);
      if (item.block === BLOCKS.SALES) {
        salesTotal += calc.salesAmount;
        salesPremium += calc.accrual;
        if (item.indicatorId && item.value !== 0) {
          salesCount += 1;
        }
      } else if (item.block === BLOCKS.ADMIN) {
        administrativePremium += calc.accrual;
      } else {
        operatorPremium += calc.accrual;
        if (item.indicatorId && item.value !== 0) {
          operatorCount += 1;
        }
      }

      if (item.indicatorId && calc.accrual !== 0) {
        if (!indicatorStats[item.indicatorId]) {
          indicatorStats[item.indicatorId] = {
            id: item.indicatorId,
            name: calc.indicatorName,
            block: item.block,
            accrual: 0,
            salesAmount: 0,
            count: 0
          };
        }
        indicatorStats[item.indicatorId].accrual += calc.accrual;
        indicatorStats[item.indicatorId].salesAmount += calc.salesAmount;
        indicatorStats[item.indicatorId].count += 1;
      }

      return {
        ...item.toJSON(),
        ...calc
      };
    });

    const premium = Utils.roundMoney(salesPremium + operatorPremium + administrativePremium);
    const total = Utils.roundMoney(daySalary + premium);
    const hasData = day.hasData();

    return {
      day: day.day,
      hours,
      comment: day.comment,
      hasData,
      daySalary,
      salesTotal: Utils.roundMoney(salesTotal),
      salesPremium: Utils.roundMoney(salesPremium),
      operatorPremium: Utils.roundMoney(operatorPremium),
      administrativePremium: Utils.roundMoney(administrativePremium),
      premium,
      total,
      salesCount,
      operatorCount,
      lines,
      indicatorStats
    };
  }

  /**
   * Полный расчёт месяца.
   * @param {EmployeePeriod} period
   * @returns {Object}
   */
  static calculateSalaryGoal(period, calculation) {
    const goal = period.salaryGoal;
    const category = DataService.getCityCategoryKey(period.cityId);
    const lines = goal.lines.map(item => {
      const base = SalaryCalculator.calculateLine(item, category, period);
      const factor = item.block === BLOCKS.ADMIN ? 1 : calculation.seasonalityCoefficient * calculation.kpi.factor;
      return { ...item, bonus: Utils.roundMoney(base.accrual * factor) };
    });
    const gap = Math.max(0, Utils.roundMoney(goal.desired - calculation.payout));
    const bonus = Utils.roundMoney(lines.reduce((sum, line) => sum + line.bonus, 0));
    const projected = Utils.roundMoney(calculation.payout + bonus);
    return {
      lines, gap, bonus, projected,
      coverage: gap === 0 ? 100 : Math.max(0, Math.min(100, bonus / gap * 100)),
      remaining: Math.max(0, Utils.roundMoney(goal.desired - projected))
    };
  }

  static calculatePlanProgress(period, plan, calculation = SalaryCalculator.calculatePeriod(period)) {
    const config = period.salaryGoal.realistic;
    const plannedShifts = config.shifts ?? period.workDays;
    const recordedShifts = Object.values(period.days).filter(day => day.hours > 0 || day.items.some(item => item.indicatorId && item.value > 0)).length;
    const completedShifts = config.completedShifts ?? recordedShifts;
    const remainingShifts = Math.max(0, plannedShifts - completedShifts);
    // Monthly workHours can contain the whole schedule; only diary hours are earned.
    const earned = Utils.roundMoney(calculation.totalDaySalary + calculation.finalPremium);
    const salaryRemaining = Math.max(0, Utils.roundMoney(period.salaryGoal.desired - earned));
    const planSalaryRemaining = Math.max(0, Utils.roundMoney(plan.projected - earned));
    const perShift = amount => amount === 0 ? 0 : remainingShifts > 0 ? Math.ceil(amount / remainingShifts - 1e-9) : null;
    const simIndicators = ['base_tp', 'bundle_base_tp', 'high_bundle_tp', 'high_bundle_plus_tp', 'high_bundle_plusplus_tp', 'premium_tp', 'promo_sim_booster'];
    const lines = plan.lines.map(line => {
      const definition = REALISTIC_PLAN_PRODUCTS.find(([key]) => key === line.key);
      let actual = 0;
      Object.values(period.days).forEach(day => day.items.forEach(item => {
        const matches = line.key === 'sim' ? item.block === BLOCKS.OPERATOR && simIndicators.includes(item.indicatorId) : item.block === definition[2] && item.indicatorId === definition[3];
        if (matches) actual += item.value;
      }));
      actual = Utils.roundMoney(actual);
      const remaining = Math.max(0, Utils.roundMoney(line.quantity - actual));
      return { ...line, actual, remaining, neededPerShift: perShift(remaining) };
    });
    return { lines, recordedShifts, completedShifts, remainingShifts, earned, salaryRemaining, planSalaryRemaining, neededEarningsPerShift: perShift(salaryRemaining), neededPlanEarningsPerShift: perShift(planSalaryRemaining) };
  }

  static calculateRealisticPlan(period) {
    const goal = period.salaryGoal;
    const config = Object.fromEntries(REALISTIC_PLAN_FIELDS.map(([key, , fallback]) => [key, goal.realistic?.[key] ?? fallback]));
    const hours = config.hours ?? period.workHours;
    const shifts = config.shifts ?? period.workDays;
    const errors = [];
    if (!(goal.desired > 0)) errors.push('Укажите желаемую зарплату.');
    if (!(hours > 0) || !(shifts > 0) || !Number.isInteger(shifts)) errors.push('Укажите часы и целое число смен больше нуля.');
    if (!(config.multiplier >= 0.7 && config.multiplier <= 1.4)) errors.push('Мультипликатор должен быть от 0,7 до 1,4.');
    const shares = ['sim', 'accessories', 'smartphones', 'services', 'mnp'];
    if (Math.abs(shares.reduce((sum, key) => sum + config[key + 'Share'], 0) - 100) > 0.000001) errors.push('Сумма долей бонуса должна быть 100%.');
    for (const [key] of REALISTIC_PLAN_FIELDS) {
      const value = config[key];
      if (value !== null && (!Number.isFinite(value) || (key !== 'admin' && value < 0))) errors.push('Проверьте числовые настройки плана.');
      if ((key.endsWith('Share') || key.endsWith('Credit')) && value > 100) errors.push('Доли должны быть от 0 до 100%.');
      if (key.endsWith('Count') && !Number.isInteger(value)) errors.push('Количество операций должно быть целым.');
    }
    if (config.completedShifts !== null && (!Number.isInteger(config.completedShifts) || config.completedShifts > shifts)) errors.push('Отработанные смены должны быть целым числом от нуля до плана смен.');
    const category = DataService.getCityCategoryKey(period.cityId);
    const rates = Object.fromEntries(REALISTIC_PLAN_PRODUCTS.map(([key, , block, id]) => {
      const rate = DataService.getIndicatorRateByCategory(DataService.getIndicator(block, id), category);
      const supplied = goal.rates?.[key];
      return [key, supplied == null ? rate : supplied];
    }));
    // The temporary application incentive remains restricted to November 2026.
    if (period.year !== 2026 || period.month !== 11) rates.application = 0;
    if (Object.values(rates).some(rate => !Number.isFinite(rate) || rate < 0)) errors.push('Ставки должны быть неотрицательными числами.');
    const salary = Utils.roundMoney(hours * DataService.getHourlyRate(period.cityId));
    const neededBonus = Math.max(0, goal.desired - salary - config.admin);
    const factor = config.multiplier * (1 + DataService.getSeasonalityPercent(period.month) / 100);
    if (errors.length) return { errors: [...new Set(errors)], rates, salary, neededBonus };
    const quantities = { gold: config.goldCount, abon: config.abonCount, application: config.applicationCount };
    const fixedBonus = (quantities.gold * rates.gold + quantities.abon * rates.abon + quantities.application * rates.application) * factor;
    const remainder = Math.max(0, neededBonus - fixedBonus);
    const ceil = value => Math.max(0, Math.ceil(value - 1e-9));
    const capped = [];
    shares.forEach(key => {
      const requested = rates[key] > 0 ? ceil(remainder * config[key + 'Share'] / 100 / (factor * rates[key])) : 0;
      const limit = key === 'mnp' ? Math.floor(config.mnpLimit) : key === 'sim' ? Math.floor(shifts * config.simLimit) : shifts * config[key + 'Limit'];
      quantities[key] = Math.min(limit, requested);
      if (requested > limit) capped.push(key);
    });
    const lines = REALISTIC_PLAN_PRODUCTS.map(([key, name, , , unit]) => {
      const quantity = quantities[key];
      return { key, name, unit, quantity, perShift: key === 'application' ? Utils.roundMoney(quantity / shifts) : ceil(quantity / shifts), rate: rates[key], bonus: Utils.roundMoney(quantity * rates[key] * factor), capped: capped.includes(key) };
    });
    const bonus = Utils.roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.rate * factor, 0));
    const projected = Utils.roundMoney(salary + config.admin + bonus);
    const credit = Math.round(quantities.smartphones * config.smartphonesCredit / 100 + quantities.accessories * config.accessoriesCredit / 100 + quantities.services * config.servicesCredit / 100 + quantities.application * config.insurancePerApplication);
    return { errors: [], rates, lines, salary, neededBonus, bonus, projected, remaining: Math.max(0, Utils.roundMoney(goal.desired - projected)), credit, creditPerShift: ceil(credit / shifts), factor, capped };
  }

  static calculatePeriod(period) {
    const hourlyRate = DataService.getHourlyRate(period.cityId);
    const city = DataService.getCity(period.cityId);
    const categoryKey = city ? city.categoryKey : EMPLOYEE_CATEGORIES.STANDARD;
    const categoryLabel = DataService.getCategoryLabel(categoryKey);
    const workDays = Utils.toNumber(period.workDays, 0);
    const workHours = Utils.toNumber(period.workHours, 0);
    const salary = SalaryCalculator.calcSalary(workHours, hourlyRate);
    const avgHoursPerDay = SalaryCalculator.calcAvgHoursPerDay(workHours, workDays);
    const avgSalaryPerDay = SalaryCalculator.calcAvgSalaryPerDay(salary, workDays);

    const days = [];
    let totalSales = 0;
    let totalPremium = 0;
    let totalSalesPremium = 0;
    let totalOperatorPremium = 0;
    let administrativePremium = 0;
    let totalDaySalary = 0;
    let salesCount = 0;
    let operatorCount = 0;
    let daysWithData = 0;
    const indicatorTotals = {};

    for (let d = 1; d <= period.daysInMonth; d += 1) {
      const day = period.getDay(d);
      const dayResult = SalaryCalculator.calculateDay(day, hourlyRate, categoryKey, period);
      days.push(dayResult);

      if (dayResult.hasData) {
        daysWithData += 1;
      }

      totalSales += dayResult.salesTotal;
      totalPremium += dayResult.premium;
      totalSalesPremium += dayResult.salesPremium;
      totalOperatorPremium += dayResult.operatorPremium;
      administrativePremium += dayResult.administrativePremium;
      totalDaySalary += dayResult.daySalary;
      salesCount += dayResult.salesCount;
      operatorCount += dayResult.operatorCount;

      Object.values(dayResult.indicatorStats).forEach((stat) => {
        if (!indicatorTotals[stat.id]) {
          indicatorTotals[stat.id] = {
            id: stat.id,
            name: stat.name,
            block: stat.block,
            accrual: 0,
            salesAmount: 0,
            count: 0
          };
        }
        indicatorTotals[stat.id].accrual += stat.accrual;
        indicatorTotals[stat.id].salesAmount += stat.salesAmount;
        indicatorTotals[stat.id].count += stat.count;
      });
    }

    totalSales = Utils.roundMoney(totalSales);
    totalPremium = Utils.roundMoney(totalPremium);
    totalSalesPremium = Utils.roundMoney(totalSalesPremium);
    totalOperatorPremium = Utils.roundMoney(totalOperatorPremium);
    totalDaySalary = Utils.roundMoney(totalDaySalary);

    // 1) Оклад уже рассчитан (salary) — сезонность к нему НЕ применяется
    // 2) totalPremium — премия до сезонности
    // 3) Сезонность: янв–июнь +10% к премии, июл–дек −10% к премии
    const seasonalityApplied = DataService.applySeasonalityToPremium(
      totalPremium - administrativePremium,
      period.month
    );
    const seasonalityPercent = seasonalityApplied.percent;
    const seasonalityCoefficient = seasonalityApplied.factor;
    const premiumAfterSeasonality = seasonalityApplied.premiumAfter;
    const seasonalityEffect = seasonalityApplied.effect;
    const seasonalityLabel = Utils.formatSeasonality(seasonalityPercent, 'percent');

    // 4) Мультипликатор KPI применяется к премии после сезонности
    const kpiResult = DataService.calculateKpiMultiplier(
      period.kpi,
      premiumAfterSeasonality
    );
    const finalPremium = Utils.roundMoney(
      premiumAfterSeasonality * kpiResult.factor + administrativePremium
    );

    // 5) Итоговая зарплата = оклад (без сезонности) + финальная премия
    const payout = Utils.roundMoney(salary + finalPremium);
    const maxPayout = Utils.roundMoney(salary + kpiResult.analytics.maxPremium + administrativePremium);
    const payoutGap = Utils.roundMoney(maxPayout - payout);

    /** @deprecated alias: премия после сезонности (до KPI) */
    const adjustedPremium = premiumAfterSeasonality;

    const avgPremiumPerDay = daysWithData > 0
      ? Utils.roundMoney(totalPremium / daysWithData)
      : 0;
    const avgAdjustedPremiumPerDay = daysWithData > 0
      ? Utils.roundMoney(premiumAfterSeasonality / daysWithData)
      : 0;
    const avgSalesPerDay = daysWithData > 0
      ? Utils.roundMoney(totalSales / daysWithData)
      : 0;
    const avgCheck = salesCount > 0
      ? Utils.roundMoney(totalSales / salesCount)
      : 0;

    // Лучший день по продажам
    let bestSalesDay = null;
    let bestPremiumDay = null;
    days.forEach((dayResult) => {
      if (!dayResult.hasData) return;
      if (!bestSalesDay || dayResult.salesTotal > bestSalesDay.salesTotal) {
        bestSalesDay = dayResult;
      }
      if (!bestPremiumDay || dayResult.premium > bestPremiumDay.premium) {
        bestPremiumDay = dayResult;
      }
    });

    // Самый прибыльный показатель
    let bestIndicator = null;
    Object.values(indicatorTotals).forEach((stat) => {
      if (!bestIndicator || stat.accrual > bestIndicator.accrual) {
        bestIndicator = {
          ...stat,
          accrual: Utils.roundMoney(stat.accrual),
          salesAmount: Utils.roundMoney(stat.salesAmount)
        };
      }
    });

    return {
      year: period.year,
      month: period.month,
      periodKey: period.key,
      title: period.title,
      cityId: period.cityId,
      cityName: city ? city.name : '',
      categoryKey,
      category: categoryLabel,
      hourlyRate,
      workDays,
      workHours,
      avgHoursPerDay,
      salary,
      avgSalaryPerDay,
      totalSales,
      /** Премия до коэффициента сезонности */
      totalPremium,
      totalSalesPremium,
      totalOperatorPremium,
      totalDaySalary,
      avgPremiumPerDay,
      avgAdjustedPremiumPerDay,
      avgSalesPerDay,
      avgCheck,
      salesCount,
      operatorCount,
      daysWithData,
      /** Коэффициент сезонности месяца (множитель, только для премии) */
      seasonalityCoefficient,
      /** Процентные пункты сезонности (+10 / −10) */
      seasonalityPercent,
      /** Текстовое представление (+10% / −10%) */
      seasonalityLabel,
      /** Рублёвый эффект сезонности (премия_после − премия_до) */
      seasonalityEffect,
      /** Премия после сезонности (до KPI) */
      premiumAfterSeasonality,
      /** @deprecated alias для совместимости */
      adjustedPremium,
      /** Детализация мультипликатора KPI */
      kpi: {
        values: { ...period.kpi },
        items: kpiResult.items,
        focus: kpiResult.focus,
        totalAdjustment: kpiResult.totalAdjustment,
        factor: kpiResult.factor,
        labelText: kpiResult.labelText,
        opportunities: kpiResult.opportunities,
        analytics: {
          ...kpiResult.analytics,
          seasonalityEffect,
          premiumBeforeKpi: premiumAfterSeasonality,
          administrativePremium,
          finalPremium,
          salary,
          payout,
          maxPayout,
          payoutGap
        }
      },
      /** Премия после KPI (финальная бонусная часть) */
      administrativePremium,
      finalPremium,
      seasonalityEffect,
      maxPayout,
      payoutGap,
      /** ИТОГО = оклад + финальная премия */
      payout,
      days,
      indicatorTotals: Object.values(indicatorTotals)
        .map((stat) => ({
          ...stat,
          accrual: Utils.roundMoney(stat.accrual),
          salesAmount: Utils.roundMoney(stat.salesAmount)
        }))
        .sort((a, b) => b.accrual - a.accrual),
      stats: {
        bestSalesDay,
        bestPremiumDay,
        bestIndicator,
        totalSales,
        avgCheck,
        totalPremium,
        premiumAfterSeasonality,
        adjustedPremium,
        administrativePremium,
        finalPremium,
        kpiTotalAdjustment: kpiResult.totalAdjustment,
        kpiLabel: kpiResult.labelText,
        seasonalityCoefficient,
        seasonalityPercent,
        seasonalityLabel,
        salary,
        payout
      }
    };
  }

  /**
   * Цветовой уровень карточки календаря по итогу дня.
   * @param {Object} dayResult
   * @returns {'empty'|'low'|'medium'|'high'|'top'}
   */
  static getDayColorLevel(dayResult) {
    if (!dayResult || !dayResult.hasData) {
      return 'empty';
    }
    const total = dayResult.total;
    if (total <= CALENDAR_THRESHOLDS.EMPTY) return 'empty';
    if (total < CALENDAR_THRESHOLDS.LOW) return 'low';
    if (total < CALENDAR_THRESHOLDS.MEDIUM) return 'medium';
    if (total < CALENDAR_THRESHOLDS.HIGH) return 'high';
    return 'top';
  }
}

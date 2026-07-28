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
   * @param {DayLineItem|Object} item
   * @returns {{accrual: number, rate: number, rateType: string, indicatorName: string, salesAmount: number}}
   */
  static calculateLine(item) {
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
    let accrual = 0;
    let salesAmount = 0;

    if (indicator.rateType === RATE_TYPES.FIXED) {
      // Начисление = количество × ставка
      accrual = value * indicator.rate;
    } else {
      // Начисление = сумма × процент
      accrual = value * indicator.rate;
      if (item.block === BLOCKS.SALES) {
        salesAmount = value;
      }
    }

    return {
      accrual: Utils.roundMoney(accrual),
      rate: indicator.rate,
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
   * @returns {Object}
   */
  static calculateDay(day, hourlyRate) {
    const hours = Utils.toNumber(day.hours, 0);
    const daySalary = SalaryCalculator.calcSalary(hours, hourlyRate);

    let salesTotal = 0;
    let salesPremium = 0;
    let operatorPremium = 0;
    let salesCount = 0;
    let operatorCount = 0;
    const indicatorStats = {};

    const lines = day.items.map((item) => {
      const calc = SalaryCalculator.calculateLine(item);
      if (item.block === BLOCKS.SALES) {
        salesTotal += calc.salesAmount;
        salesPremium += calc.accrual;
        if (item.indicatorId && item.value !== 0) {
          salesCount += 1;
        }
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

    const premium = Utils.roundMoney(salesPremium + operatorPremium);
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
  static calculatePeriod(period) {
    const hourlyRate = DataService.getHourlyRate(period.cityId);
    const city = DataService.getCity(period.cityId);
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
    let totalDaySalary = 0;
    let salesCount = 0;
    let operatorCount = 0;
    let daysWithData = 0;
    const indicatorTotals = {};

    for (let d = 1; d <= period.daysInMonth; d += 1) {
      const day = period.getDay(d);
      const dayResult = SalaryCalculator.calculateDay(day, hourlyRate);
      days.push(dayResult);

      if (dayResult.hasData) {
        daysWithData += 1;
      }

      totalSales += dayResult.salesTotal;
      totalPremium += dayResult.premium;
      totalSalesPremium += dayResult.salesPremium;
      totalOperatorPremium += dayResult.operatorPremium;
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
      totalPremium,
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
      premiumAfterSeasonality * kpiResult.factor
    );

    // 5) Итоговая зарплата = оклад (без сезонности) + финальная премия
    const payout = Utils.roundMoney(salary + finalPremium);
    const maxPayout = Utils.roundMoney(salary + kpiResult.analytics.maxPremium);
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
      category: city ? city.category : CITY_CATEGORY_STANDARD,
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
          finalPremium,
          salary,
          payout,
          maxPayout,
          payoutGap
        }
      },
      /** Премия после KPI (финальная бонусная часть) */
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

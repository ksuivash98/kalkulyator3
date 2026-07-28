/**
 * @file export.js
 * @description ExportService — экспорт PDF / Excel / JSON и импорт JSON.
 * Без внешних библиотек: PDF через печать, XLSX — минимальный OOXML ZIP.
 */

'use strict';

/**
 * Минимальный ZIP-писатель (метод STORE, без сжатия).
 * Достаточно для формирования валидного .xlsx.
 */
class ZipStoreWriter {
  constructor() {
    /** @type {Array<{name: string, data: Uint8Array, offset: number}>} */
    this.files = [];
  }

  /**
   * Добавляет файл в архив.
   * @param {string} name
   * @param {string|Uint8Array} content
   */
  addFile(name, content) {
    const data = typeof content === 'string'
      ? ZipStoreWriter.stringToUtf8(content)
      : content;
    this.files.push({ name, data, offset: 0 });
  }

  /**
   * Собирает ZIP как Blob.
   * @returns {Blob}
   */
  build() {
    const parts = [];
    let offset = 0;

    this.files.forEach((file) => {
      file.offset = offset;
      const nameBytes = ZipStoreWriter.stringToUtf8(file.name);
      const localHeader = ZipStoreWriter.createLocalHeader(nameBytes, file.data);
      parts.push(localHeader, nameBytes, file.data);
      offset += localHeader.length + nameBytes.length + file.data.length;
    });

    const centralStart = offset;
    this.files.forEach((file) => {
      const nameBytes = ZipStoreWriter.stringToUtf8(file.name);
      const central = ZipStoreWriter.createCentralHeader(nameBytes, file.data, file.offset);
      parts.push(central, nameBytes);
      offset += central.length + nameBytes.length;
    });

    const centralSize = offset - centralStart;
    parts.push(ZipStoreWriter.createEndRecord(this.files.length, centralSize, centralStart));

    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * @param {string} str
   * @returns {Uint8Array}
   */
  static stringToUtf8(str) {
    return new TextEncoder().encode(str);
  }

  /**
   * CRC32 для ZIP.
   * @param {Uint8Array} data
   * @returns {number}
   */
  static crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) {
      crc ^= data[i];
      for (let j = 0; j < 8; j += 1) {
        const mask = -(crc & 1);
        crc = (crc >>> 1) ^ (0xedb88320 & mask);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * @param {Uint8Array} nameBytes
   * @param {Uint8Array} data
   * @returns {Uint8Array}
   */
  static createLocalHeader(nameBytes, data) {
    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    const crc = ZipStoreWriter.crc32(data);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    return header;
  }

  /**
   * @param {Uint8Array} nameBytes
   * @param {Uint8Array} data
   * @param {number} offset
   * @returns {Uint8Array}
   */
  static createCentralHeader(nameBytes, data, offset) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    const crc = ZipStoreWriter.crc32(data);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, data.length, true);
    view.setUint32(24, data.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, offset, true);
    return header;
  }

  /**
   * @param {number} count
   * @param {number} centralSize
   * @param {number} centralOffset
   * @returns {Uint8Array}
   */
  static createEndRecord(count, centralSize, centralOffset) {
    const header = new Uint8Array(22);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, count, true);
    view.setUint16(10, count, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);
    return header;
  }
}

/**
 * Сервис экспорта и импорта данных расчёта.
 */
class ExportService {
  /**
   * @param {StorageService} storage
   */
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Безопасное имя файла.
   * @param {string} name
   * @returns {string}
   */
  static sanitizeFileName(name) {
    return String(name)
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  }

  /**
   * Базовое имя файла для экспорта.
   * @param {Employee} employee
   * @param {Object} calculation
   * @returns {string}
   */
  static buildBaseName(employee, calculation) {
    const emp = ExportService.sanitizeFileName(employee.name);
    const period = ExportService.sanitizeFileName(calculation.title);
    return `Зарплата_${emp}_${period}`;
  }

  /* ------------------------------------------------------------------------
   * JSON
   * ---------------------------------------------------------------------- */

  /**
   * Экспорт JSON выбранного сотрудника / периода или всего приложения.
   * @param {Employee} employee
   * @param {EmployeePeriod} period
   * @param {Object} calculation
   * @param {'period'|'employee'|'all'} [mode='period']
   */
  exportJson(employee, period, calculation, mode = 'period') {
    let payload;
    let filename;

    if (mode === 'all') {
      payload = this.storage.exportAll();
      filename = `salary_backup_${new Date().toISOString().slice(0, 10)}.json`;
    } else if (mode === 'employee') {
      payload = {
        version: 1,
        type: 'employee',
        exportedAt: new Date().toISOString(),
        employee: employee.toJSON()
      };
      filename = `${ExportService.sanitizeFileName(employee.name)}.json`;
    } else {
      payload = {
        version: 1,
        type: 'period',
        exportedAt: new Date().toISOString(),
        employeeId: employee.id,
        employeeName: employee.name,
        period: period.toJSON(),
        calculation
      };
      filename = `${ExportService.buildBaseName(employee, calculation)}.json`;
    }

    Utils.downloadText(JSON.stringify(payload, null, 2), filename, 'application/json');
  }

  /**
   * Импорт JSON (полный бэкап, сотрудник или период).
   * @param {string} jsonText
   * @param {Function} onPeriodImport - callback(employeeId, periodData)
   * @returns {{ok: boolean, message: string, type?: string}}
   */
  importJson(jsonText, onPeriodImport) {
    try {
      const payload = JSON.parse(jsonText);

      if (Array.isArray(payload.employees)) {
        const ok = this.storage.importAll(payload);
        return {
          ok,
          message: ok ? 'Данные успешно импортированы' : 'Ошибка импорта',
          type: 'all'
        };
      }

      if (payload.type === 'employee' && payload.employee) {
        this.storage.saveEmployee(payload.employee);
        return {
          ok: true,
          message: `Сотрудник «${payload.employee.name}» импортирован`,
          type: 'employee'
        };
      }

      if (payload.period && payload.employeeId) {
        if (typeof onPeriodImport === 'function') {
          onPeriodImport(payload.employeeId, payload.period, payload.employeeName);
        }
        return {
          ok: true,
          message: 'Период успешно импортирован',
          type: 'period'
        };
      }

      if (payload.id && payload.periods) {
        this.storage.saveEmployee(payload);
        return {
          ok: true,
          message: `Сотрудник «${payload.name}» импортирован`,
          type: 'employee'
        };
      }

      return { ok: false, message: 'Неизвестный формат JSON' };
    } catch (error) {
      console.error(error);
      return { ok: false, message: 'Не удалось разобрать JSON-файл' };
    }
  }

  /* ------------------------------------------------------------------------
   * Excel (.xlsx)
   * ---------------------------------------------------------------------- */

  /**
   * Экранирование XML.
   * @param {*} value
   * @returns {string}
   */
  static xmlEscape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Ячейка листа.
   * @param {number} row - 1-based
   * @param {number} col - 0-based
   * @param {*} value
   * @param {'n'|'s'} [type]
   * @returns {string}
   */
  static cellXml(row, col, value, type) {
    const colName = ExportService.colName(col);
    const ref = `${colName}${row}`;
    if (value === null || value === undefined || value === '') {
      return `<c r="${ref}"/>`;
    }
    if (type === 'n' || (type === undefined && typeof value === 'number')) {
      return `<c r="${ref}"><v>${value}</v></c>`;
    }
    const text = ExportService.xmlEscape(value);
    return `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
  }

  /**
   * Имя столбца Excel (A, B, ..., AA).
   * @param {number} index
   * @returns {string}
   */
  static colName(index) {
    let n = index;
    let name = '';
    do {
      name = String.fromCharCode(65 + (n % 26)) + name;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return name;
  }

  /**
   * Строка листа из массива значений.
   * @param {number} row
   * @param {Array<*>} values
   * @returns {string}
   */
  static rowXml(row, values) {
    const cells = values.map((value, col) => {
      const isNum = typeof value === 'number' && Number.isFinite(value);
      return ExportService.cellXml(row, col, value, isNum ? 'n' : 's');
    }).join('');
    return `<row r="${row}">${cells}</row>`;
  }

  /**
   * Экспорт полного расчёта в .xlsx.
   * @param {Employee} employee
   * @param {Object} calculation
   */
  exportExcel(employee, calculation) {
    const sheetRows = [];
    let r = 1;

    const push = (values) => {
      sheetRows.push(ExportService.rowXml(r, values));
      r += 1;
    };

    push(['Калькулятор заработной платы сотрудника салона связи']);
    push(['Сотрудник', employee.name]);
    push(['Период', calculation.title]);
    push(['Город', calculation.cityName]);
    push(['Категория', calculation.category]);
    push(['Стоимость часа', calculation.hourlyRate]);
    push([]);
    push(['Рабочих дней', calculation.workDays]);
    push(['Часов', calculation.workHours]);
    push(['Среднее часов в день', calculation.avgHoursPerDay]);
    push(['Оклад', calculation.salary]);
    push(['Средняя зарплата за день', calculation.avgSalaryPerDay]);
    push([]);
    push(['Общая сумма продаж', calculation.totalSales]);
    push(['Общая премия', calculation.totalPremium]);
    push(['Средняя премия за день', calculation.avgPremiumPerDay]);
    push(['Средняя продажа за день', calculation.avgSalesPerDay]);
    push(['Количество продаж', calculation.salesCount]);
    push(['Операторских операций', calculation.operatorCount]);
    push(['Итого к выплате', calculation.payout]);
    push([]);
    push([
      'Дата', 'Часы', 'Оклад за день', 'Продажи', 'Премия', 'Итого', 'Комментарий'
    ]);

    calculation.days.forEach((day) => {
      if (!day.hasData) return;
      push([
        Utils.formatDate(day.day, calculation.month, calculation.year),
        day.hours,
        day.daySalary,
        day.salesTotal,
        day.premium,
        day.total,
        day.comment || ''
      ]);
    });

    push([]);
    push(['Детализация показателей']);
    push(['Дата', 'Блок', 'Показатель', 'Значение', 'Ставка', 'Начисление']);

    calculation.days.forEach((day) => {
      day.lines.forEach((line) => {
        if (!line.indicatorId) return;
        push([
          Utils.formatDate(day.day, calculation.month, calculation.year),
          line.block === BLOCKS.SALES ? 'Продажи' : 'Операторский',
          line.indicatorName,
          line.value,
          line.rateType === RATE_TYPES.PERCENT
            ? Utils.formatPercent(line.rate)
            : line.rate,
          line.accrual
        ]);
      });
    });

    const sheetData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRows.join('\n    ')}
  </sheetData>
</worksheet>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Расчёт" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

    const zip = new ZipStoreWriter();
    zip.addFile('[Content_Types].xml', contentTypes);
    zip.addFile('_rels/.rels', rels);
    zip.addFile('xl/workbook.xml', workbook);
    zip.addFile('xl/_rels/workbook.xml.rels', workbookRels);
    zip.addFile('xl/worksheets/sheet1.xml', sheetData);

    const blob = zip.build();
    const filename = `${ExportService.buildBaseName(employee, calculation)}.xlsx`;
    Utils.downloadBlob(blob, filename);
  }

  /* ------------------------------------------------------------------------
   * PDF (печатная форма → «Сохранить как PDF»)
   * ---------------------------------------------------------------------- */

  /**
   * Открывает печатную форму полного расчёта для сохранения в PDF.
   * @param {Employee} employee
   * @param {Object} calculation
   */
  exportPdf(employee, calculation) {
    const daysRows = calculation.days
      .filter((day) => day.hasData)
      .map((day) => `
        <tr>
          <td>${Utils.formatDate(day.day, calculation.month, calculation.year)}</td>
          <td class="num">${Utils.formatNumber(day.hours)}</td>
          <td class="num">${Utils.formatMoney(day.daySalary)}</td>
          <td class="num">${Utils.formatMoney(day.salesTotal)}</td>
          <td class="num">${Utils.formatMoney(day.premium)}</td>
          <td class="num"><strong>${Utils.formatMoney(day.total)}</strong></td>
          <td>${Utils.escapeHtml(day.comment || '—')}</td>
        </tr>
      `).join('');

    const detailRows = [];
    calculation.days.forEach((day) => {
      day.lines.forEach((line) => {
        if (!line.indicatorId) return;
        detailRows.push(`
          <tr>
            <td>${Utils.formatDate(day.day, calculation.month, calculation.year)}</td>
            <td>${line.block === BLOCKS.SALES ? 'Продажи' : 'Операторский'}</td>
            <td>${Utils.escapeHtml(line.indicatorName)}</td>
            <td class="num">${Utils.formatNumber(line.value)}</td>
            <td class="num">${Utils.formatRate(line.rate, line.rateType)}</td>
            <td class="num">${Utils.formatMoney(line.accrual)}</td>
          </tr>
        `);
      });
    });

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <title>${Utils.escapeHtml(ExportService.buildBaseName(employee, calculation))}</title>
  <style>
    @page { margin: 16mm; }
    body {
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: #1a1a1a;
      font-size: 12px;
      line-height: 1.45;
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .meta { margin-bottom: 16px; }
    .meta div { margin: 2px 0; }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
    .card .label { color: #666; font-size: 11px; }
    .card .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    td.num, th.num { text-align: right; }
    .total { font-size: 15px; font-weight: 700; margin-top: 16px; }
    .footer { margin-top: 24px; color: #777; font-size: 10px; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="padding:8px 16px;margin-bottom:16px;cursor:pointer;">
    Печать / Сохранить как PDF
  </button>

  <h1>Расчёт заработной платы</h1>
  <div class="meta">
    <div><strong>Сотрудник:</strong> ${Utils.escapeHtml(employee.name)}</div>
    <div><strong>Период:</strong> ${Utils.escapeHtml(calculation.title)}</div>
    <div><strong>Город:</strong> ${Utils.escapeHtml(calculation.cityName)}
      (${Utils.escapeHtml(calculation.category)}, ставка ${Utils.formatMoney(calculation.hourlyRate)}/час)</div>
  </div>

  <div class="cards">
    <div class="card"><div class="label">Рабочих дней</div><div class="value">${calculation.workDays}</div></div>
    <div class="card"><div class="label">Часов</div><div class="value">${Utils.formatNumber(calculation.workHours)}</div></div>
    <div class="card"><div class="label">Оклад</div><div class="value">${Utils.formatMoney(calculation.salary)}</div></div>
    <div class="card"><div class="label">Продажи</div><div class="value">${Utils.formatMoney(calculation.totalSales)}</div></div>
    <div class="card"><div class="label">Премия</div><div class="value">${Utils.formatMoney(calculation.totalPremium)}</div></div>
    <div class="card"><div class="label">Итого к выплате</div><div class="value">${Utils.formatMoney(calculation.payout)}</div></div>
  </div>

  <h2>Итоги по дням</h2>
  <table>
    <thead>
      <tr>
        <th>Дата</th>
        <th class="num">Часы</th>
        <th class="num">Оклад</th>
        <th class="num">Продажи</th>
        <th class="num">Премия</th>
        <th class="num">Итого</th>
        <th>Комментарий</th>
      </tr>
    </thead>
    <tbody>
      ${daysRows || '<tr><td colspan="7">Нет данных</td></tr>'}
    </tbody>
  </table>

  <h2>Детализация показателей</h2>
  <table>
    <thead>
      <tr>
        <th>Дата</th>
        <th>Блок</th>
        <th>Показатель</th>
        <th class="num">Значение</th>
        <th class="num">Ставка</th>
        <th class="num">Начисление</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows.join('') || '<tr><td colspan="6">Нет данных</td></tr>'}
    </tbody>
  </table>

  <p class="total">Итого к выплате: ${Utils.formatMoney(calculation.payout)}</p>
  <p class="footer">Сформировано: ${new Date().toLocaleString('ru-RU')} · Калькулятор ЗП салона связи</p>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Utils.showToast('Разрешите всплывающие окна для экспорта PDF', 'error');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

const XLSX = require('xlsx');

/**
 * Parses CSV text, buffer, or array of rows into normalized holiday objects.
 * Supports:
 * - Date formats: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY
 * - Columns: Date, Holiday Description / Name, Bank Holiday, Public Holiday, Mercantile Holiday, Type
 */
function parseHolidaysInput(input) {
  let rows = [];

  if (Array.isArray(input)) {
    rows = input;
  } else if (typeof input === 'string') {
    const workbook = XLSX.read(input, { type: 'string', raw: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  } else if (Buffer.isBuffer(input)) {
    const workbook = XLSX.read(input, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }

  const holidays = [];
  rows.forEach((r) => {
    // Find Date field
    let rawDate = r.Date || r.date || r['Holiday Date'] || r['holiday_date'] || '';
    // Find Description / Name field
    let name = r['Holiday Description'] || r['Holiday Name'] || r.Description || r.description || r.Name || r.name || '';
    if (!rawDate && !name) return;

    // Normalize date to YYYY-MM-DD
    let dateStr = '';
    const rawTrimmed = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawTrimmed)) {
      dateStr = rawTrimmed;
    } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(rawTrimmed)) {
      dateStr = rawTrimmed.replace(/\//g, '-');
    } else if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(rawTrimmed)) {
      const parts = rawTrimmed.split(/[-\/]/);
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      dateStr = `${y}-${m}-${d}`;
    } else if (!isNaN(rawDate) && Number(rawDate) > 30000 && Number(rawDate) < 60000) {
      // Excel serial date (days since 1899-12-30)
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const targetDate = new Date(excelEpoch.getTime() + Number(rawDate) * 86400000);
      const y = targetDate.getUTCFullYear();
      const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getUTCDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    } else {
      // Try text date e.g. "January 03, 2026" or "03 January 2026" or "Jan 03, Friday"
      const monthMap = {
        jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
        apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
        aug: '08', august: '08', sep: '09', september: '09', oct: '10', october: '10',
        nov: '11', november: '11', dec: '12', december: '12'
      };
      const match1 = rawTrimmed.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+.*?(\d{4}))?/i);
      const match2 = rawTrimmed.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:[,\s]+.*?(\d{4}))?/i);
      if (match1 && monthMap[match1[1].toLowerCase()]) {
        const m = monthMap[match1[1].toLowerCase()];
        const d = String(match1[2]).padStart(2, '0');
        const y = match1[3] || '2026';
        dateStr = `${y}-${m}-${d}`;
      } else if (match2 && monthMap[match2[2].toLowerCase()]) {
        const m = monthMap[match2[2].toLowerCase()];
        const d = String(match2[1]).padStart(2, '0');
        const y = match2[3] || '2026';
        dateStr = `${y}-${m}-${d}`;
      }
    }

    if (!dateStr || !name) return;

    // Check holiday type flags
    const bankVal = String(r['Bank Holiday'] || r['bank_holiday'] || '').trim().toLowerCase();
    const pubVal = String(r['Public Holiday'] || r['public_holiday'] || '').trim().toLowerCase();
    const mercVal = String(r['Mercantile Holiday'] || r['mercantile_holiday'] || '').trim().toLowerCase();

    const isBank = (bankVal === 'true' || bankVal === '1' || bankVal === 'yes');
    const isPublic = (pubVal === 'true' || pubVal === '1' || pubVal === 'yes' || pubVal === '');
    const isMerc = (mercVal === 'true' || mercVal === '1' || mercVal === 'yes');

    let holidayType = r['Holiday Type'] || r['holiday_type'] || '';
    if (!holidayType) {
      if (isPublic && isBank && isMerc) holidayType = 'Public, Bank & Mercantile';
      else if (isPublic && isBank) holidayType = 'Public & Bank Holiday';
      else if (isPublic && isMerc) holidayType = 'Public & Mercantile Holiday';
      else if (isMerc) holidayType = 'Mercantile Holiday';
      else if (isBank) holidayType = 'Bank Holiday';
      else holidayType = 'Public Holiday';
    }

    holidays.push({
      name: name.trim(),
      holiday_date: dateStr,
      holiday_type: holidayType,
      bank_holiday: isBank ? 1 : 0,
      public_holiday: isPublic ? 1 : 0,
      mercantile_holiday: isMerc ? 1 : 0,
      is_recurring: (r['is_recurring'] === 1 || r['is_recurring'] === '1' || r['is_recurring'] === true || r['is_recurring'] === 'true') ? 1 : 0
    });
  });

  return holidays;
}

module.exports = {
  parseHolidaysInput
};

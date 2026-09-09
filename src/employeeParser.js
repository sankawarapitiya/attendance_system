const XLSX = require('xlsx');

/**
 * Normalizes and parses raw date values (Excel serial numbers, YYYY-MM-DD, DD/MM/YYYY, etc.)
 */
function parseDateValue(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null') return null;

  // Check for Excel serial date
  if (!isNaN(val) && Number(val) > 20000 && Number(val) < 70000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelEpoch.getTime() + Number(val) * 86400000);
    const y = targetDate.getUTCFullYear();
    const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Check YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymd = str.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // Check DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return str;
}

/**
 * Normalizes input keys for flexible header matching.
 */
function normalizeKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[#_/\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses employee records from CSV string, buffer, or array of objects.
 * 
 * @param {string|Buffer|Array} input 
 * @param {Array} existingShifts - List of shift objects from working_shifts table [{ id, name }, ...]
 * @returns {{ valid: Array, errors: Array }}
 */
function parseEmployeesInput(input, existingShifts = []) {
  let rows = [];

  if (Array.isArray(input)) {
    rows = input;
  } else if (typeof input === 'string') {
    let cleanInput = input;
    // Check if input is a data URI
    if (cleanInput.startsWith('data:')) {
      const base64Index = cleanInput.indexOf(';base64,');
      if (base64Index !== -1) {
        const base64Data = cleanInput.slice(base64Index + 8);
        const buf = Buffer.from(base64Data, 'base64');
        const workbook = XLSX.read(buf, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      } else {
        const workbook = XLSX.read(cleanInput, { type: 'string', raw: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      }
    } else {
      const workbook = XLSX.read(cleanInput, { type: 'string', raw: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    }
  } else if (Buffer.isBuffer(input)) {
    const workbook = XLSX.read(input, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }

  const valid = [];
  const errors = [];

  rows.forEach((row, rowIndex) => {
    // Build normalized row dictionary
    const norm = {};
    for (const [k, v] of Object.entries(row)) {
      norm[normalizeKey(k)] = (typeof v === 'string' ? v.trim() : v);
    }

    // Helper to find first matching key
    const getVal = (...keys) => {
      for (const k of keys) {
        const nKey = normalizeKey(k);
        if (norm[nKey] !== undefined && norm[nKey] !== '') {
          return norm[nKey];
        }
      }
      return '';
    };

    // Extract User ID / FingerPrint ID
    let userId = getVal(
      'fingerprint id', 'fingerprint_id', 'fingerprint',
      'user id', 'user_id', 'userid', 'pin',
      'employee id', 'employee_id', 'emp id', 'empid', 'emp_id', 'id'
    );

    // If userId looks like a row number column "#" or is empty, check other alternatives
    if (!userId || userId === '#') {
      const altId = getVal('service id', 'service_id', 'employee service id', 'nic');
      if (!altId) {
        // Skip empty row or record error if non-empty
        if (Object.values(norm).some(v => v !== '')) {
          errors.push({ row: rowIndex + 1, error: 'Missing User ID / FingerPrint ID' });
        }
        return;
      }
      userId = altId;
    }

    userId = String(userId).trim();
    // Strip trailing .0 if Excel parsed integer as float
    if (userId.endsWith('.0')) userId = userId.slice(0, -2);

    // Extract Full Name
    let fullName = getVal(
      'full name', 'fullname', 'full_name',
      'employee name', 'employee_name', 'name', 'emp name', 'emp_name'
    );
    const firstName = getVal('first name', 'first_name', 'firstname');
    const lastName = getVal('last name', 'last_name', 'lastname', 'surname');
    let title = getVal('title', 'salutation');

    if (!fullName && (firstName || lastName)) {
      fullName = [title, firstName, lastName].filter(Boolean).join(' ');
    }
    if (!fullName) {
      fullName = `Employee ${userId}`;
    }

    // If title is missing, try detecting from full name
    if (!title) {
      const titleMatch = fullName.match(/^(Mr|Mrs|Miss|Ms|Dr|Prof|Rev)\.?\s+/i);
      if (titleMatch) {
        title = titleMatch[1].charAt(0).toUpperCase() + titleMatch[1].slice(1).toLowerCase();
      }
    }

    // Extract Service ID & NIC
    const serviceId = getVal(
      'service id', 'service_id', 'serviceid',
      'service no', 'service_no', 'employee service id', 'employee_service_id'
    );
    const nic = getVal('nic', 'national id', 'national_id', 'nic no', 'nic_no', 'id card');

    // Extract Gender
    let gender = getVal('gender', 'sex');
    if (gender) {
      const gLower = gender.toLowerCase();
      if (gLower.startsWith('m') || gLower === '1') gender = 'Male';
      else if (gLower.startsWith('f') || gLower === '2') gender = 'Female';
      else gender = 'Other';
    }

    // Dates
    const rawBirthday = getVal('birthday', 'birth date', 'birth_date', 'date of birth', 'dob');
    const rawAppointment = getVal('appointment date', 'appointment_date', 'appointment', 'joining date', 'joining_date', 'joined date', 'hire date');
    const birthday = parseDateValue(rawBirthday);
    const appointmentDate = parseDateValue(rawAppointment);

    // Employment Status & Department & Role
    let employmentStatus = getVal('status', 'employment status', 'employment_status', 'job status');
    if (employmentStatus) {
      const sLower = employmentStatus.toLowerCase();
      if (sLower.includes('perm')) employmentStatus = 'Permanent';
      else if (sLower.includes('temp')) employmentStatus = 'Temporary';
      else if (sLower.includes('prob')) employmentStatus = 'Probation';
      else if (sLower.includes('cont')) employmentStatus = 'Contract';
      else if (sLower.includes('train') || sLower.includes('intern')) employmentStatus = 'Trainee';
    } else {
      employmentStatus = 'Permanent';
    }

    const department = getVal('department', 'dept', 'division', 'section') || 'General';
    const role = getVal('role', 'designation', 'position', 'job title') || 'Staff';

    // Contact Details
    const phone = getVal('mobile / phone', 'mobile', 'phone', 'telephone', 'mobile no', 'contact', 'contact no');
    const email = getVal('email', 'e-mail', 'mail');
    const cardNo = getVal('card #', 'card no', 'card_no', 'card number', 'card_number', 'rfid');
    const orderById = getVal('order id', 'order_id', 'order_by_id', 'order');

    // Active Status
    let isActive = 1;
    const activeVal = getVal('active status', 'active', 'is_active', 'status (active/inactive)');
    if (activeVal !== '') {
      const aLower = String(activeVal).toLowerCase();
      if (aLower === 'inactive' || aLower === '0' || aLower === 'no' || aLower === 'false') {
        isActive = 0;
      } else {
        isActive = 1;
      }
    }

    // Assigned Shift matching
    let shiftId = 1;
    let shiftName = 'General Shift';
    const shiftVal = getVal('assigned shift', 'assigned_shift', 'shift', 'shift name', 'shift_name', 'shift id', 'shift_id');
    if (shiftVal) {
      const numShift = parseInt(shiftVal, 10);
      if (!isNaN(numShift) && existingShifts.some(s => s.id === numShift)) {
        shiftId = numShift;
        const matched = existingShifts.find(s => s.id === numShift);
        if (matched) shiftName = matched.name;
      } else {
        // String name match
        const searchName = String(shiftVal).toLowerCase();
        const matched = existingShifts.find(s => {
          const sName = (s.name || '').toLowerCase();
          return sName && (searchName.includes(sName) || sName.includes(searchName));
        });
        if (matched) {
          shiftId = matched.id;
          shiftName = matched.name;
        }
      }
    } else if (existingShifts.length > 0) {
      shiftId = existingShifts[0].id;
      shiftName = existingShifts[0].name;
    }

    valid.push({
      user_id: userId,
      name: fullName,
      first_name: firstName || null,
      last_name: lastName || null,
      title: title || null,
      employee_service_id: serviceId || null,
      nic: nic || null,
      gender: gender || null,
      birthday: birthday || null,
      appointment_date: appointmentDate || null,
      employment_status: employmentStatus || 'Permanent',
      department: department || 'General',
      role: role || 'Staff',
      phone: phone || null,
      email: email || null,
      card_no: cardNo || null,
      shift_id: shiftId,
      shift_name: shiftName,
      order_by_id: orderById || null,
      is_active: isActive
    });
  });

  return { valid, errors };
}

module.exports = {
  parseEmployeesInput,
  parseDateValue
};

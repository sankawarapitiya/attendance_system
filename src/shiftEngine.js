/**
 * Shift & Day Identification Engine
 * Handles Weekday/Weekend classification, Holiday matching, and Punctuality calculation.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Converts a "HH:MM" string to minutes from midnight.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Classifies a date as WEEKDAY (Working Day), WEEKEND (Weekly Off), or HOLIDAY.
 * @param {string|Date} dateInput - 'YYYY-MM-DD' or Date object
 * @param {Object} shift - { work_days: '1,2,3,4,5', ... }
 * @param {Array} holidays - Array of { holiday_date, name, holiday_type, is_recurring }
 */
function getDayClassification(dateInput, shift = null, holidays = []) {
  let dateStr = '';
  let dt;

  if (typeof dateInput === 'string') {
    dateStr = dateInput.slice(0, 10);
    dt = new Date(dateStr + 'T00:00:00');
  } else if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().slice(0, 10);
    dt = dateInput;
  } else {
    dt = new Date();
    dateStr = dt.toISOString().slice(0, 10);
  }

  const dayOfWeek = dt.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const dayName = DAY_NAMES[dayOfWeek];

  // 1. Check if matches any holiday
  const monthDay = dateStr.slice(5); // 'MM-DD'
  const matchedHolidays = holidays.filter((h) => {
    if (!h.holiday_date) return false;
    const hDateStr = String(h.holiday_date).slice(0, 10);
    if (hDateStr === dateStr) return true;
    if (h.is_recurring && hDateStr.slice(5) === monthDay) return true;
    return false;
  });

  if (matchedHolidays.length > 0) {
    const combinedName = matchedHolidays.map((h) => h.name).join(' / ');
    const isBank = matchedHolidays.some((h) => h.bank_holiday) ? 1 : 0;
    const isPublic = matchedHolidays.some((h) => h.public_holiday) ? 1 : 0;
    const isMerc = matchedHolidays.some((h) => h.mercantile_holiday) ? 1 : 0;
    let holidayType = matchedHolidays[0].holiday_type || 'Public Holiday';
    if (isPublic && isBank && isMerc) holidayType = 'Public, Bank & Mercantile';
    else if (isPublic && isBank) holidayType = 'Public & Bank Holiday';
    else if (isPublic && isMerc) holidayType = 'Public & Mercantile Holiday';

    return {
      type: 'HOLIDAY',
      label: 'Holiday',
      name: combinedName,
      holidayType,
      bank_holiday: isBank,
      public_holiday: isPublic,
      mercantile_holiday: isMerc,
      dayOfWeek,
      dayName,
      isWorkingDay: false,
      badgeClass: 'badge-holiday',
      icon: '🎉'
    };
  }

  // 2. Check shift working days (default: Mon-Fri '1,2,3,4,5')
  const workDaysList = (shift && shift.work_days)
    ? String(shift.work_days).split(',').map((d) => parseInt(d.trim(), 10))
    : [1, 2, 3, 4, 5];

  const isWorkDay = workDaysList.includes(dayOfWeek);

  if (isWorkDay) {
    return {
      type: 'WEEKDAY',
      label: 'Working Day',
      name: dayName,
      dayOfWeek,
      dayName,
      isWorkingDay: true,
      badgeClass: 'badge-weekday',
      icon: '💼'
    };
  }

  return {
    type: 'WEEKEND',
    label: 'Weekend Off',
    name: dayName,
    dayOfWeek,
    dayName,
    isWorkingDay: false,
    badgeClass: 'badge-weekend',
    icon: '🏖️'
  };
}

/**
 * Calculates Overtime (OT) in hours based on company policy.
 *
 * Policy:
 * 1. Short Leave Days & Half Days are NOT allowed for OT Calculation (OT = 0).
 * 2. Employee must first cover the required full day.
 * 3. OT starts strictly after the first full hour (60 minutes) beyond the required full day end time.
 * 4. Once >= 60 mins, OT adds in 15-minute increments (0.25h):
 *    - 60m - 74m  -> 1.00 H
 *    - 75m - 89m  -> 1.25 H
 *    - 90m - 104m -> 1.50 H
 *    - 105m - 119m -> 1.75 H
 *    - 120m - 134m -> 2.00 H
 *
 * @param {number} extraMinutes - Minutes worked beyond required full day departure
 * @param {boolean} isFullDayEligible - True if day qualifies as Full Day and NO short leave was taken
 * @param {Object} options - { minOtMins: 60, otStepMins: 15 }
 */
function calculateOvertimeHours(extraMinutes, isFullDayEligible = true, options = {}) {
  if (!isFullDayEligible || extraMinutes < 0) {
    return 0;
  }

  const minOtMins = options.minOtMins !== undefined ? options.minOtMins : 60;
  const otStepMins = options.otStepMins !== undefined ? options.otStepMins : 15;

  if (extraMinutes < minOtMins) {
    return 0;
  }

  const quarters = Math.floor(extraMinutes / otStepMins);
  const otHours = (quarters * otStepMins) / 60;
  return parseFloat(otHours.toFixed(2));
}

/**
 * Evaluates punch punctuality against the assigned shift schedule.
 *
 * Policy Rules:
 * 1. Morning Grace Period:
 *    - Allowed only at start of day (arrival 08:30 - 09:00).
 *    - Max 2 days per calendar month.
 *    - Cannot be combined with Evening Short Leave on the same day.
 *
 * 2. Short Leave Policy (Max 2 days per month):
 *    - Morning Short Leave: Arrival between 09:00 and 10:00.
 *      - If departs after 16:15 -> Full Day (Short Leave). NOT eligible for OT.
 *      - If departs after working 4 hours -> Half Day. NOT eligible for OT.
 *    - Arrival after 10:00:
 *      - Covers 4 hours -> Half Day (4h Covered). NOT eligible for OT.
 *    - Evening Short Leave: Departure between 14:45 and 16:15.
 *      - Allowed ONLY if arrived on time (<= 08:30) and did NOT use Morning Grace today.
 *      - Qualifies as Full Day (Short Leave Evening). NOT eligible for OT.
 *
 * 3. Regular Half Day & Full Day:
 *    - On-Time (<= 08:30): Half Day = 12:00, Full Day = 16:15.
 *    - Late (> 08:30): Half Day = 12:30 + Late Time, Full Day = 16:15 + Late Time.
 *
 * 4. OT (Overtime) Calculation:
 *    - Short Leave Days & Half Days are NOT allowed for OT Calculation (OT = 0).
 *    - Starts after the first hour (60m) beyond required Full Day departure.
 *    - Adds each 15 minutes (1.0H, 1.25H, 1.5H, 1.75H, 2.0H, etc.).
 *
 * @param {string} punchTimeStr - 'YYYY-MM-DD HH:MM:SS'
 * @param {Object} shift - Shift configuration object
 * @param {Object} dayClassification - Result of getDayClassification
 * @param {number} punchState - 0 = Check-In, 1 = Check-Out, etc.
 * @param {Object} context - Calculation context from buildMonthlyGraceAndLateMap
 */
function evaluatePunchPunctuality(punchTimeStr, shift, dayClassification, punchState = 0, context = {}, punchId = null) {
  if (!punchTimeStr) {
    return { status: 'UNKNOWN', label: '-', badgeClass: 'badge-tag', otHours: 0 };
  }

  const timePart = punchTimeStr.length >= 19 ? punchTimeStr.slice(11, 16) : punchTimeStr.slice(0, 5);
  const punchMins = timeToMinutes(timePart);
  const firstMins = context.firstMins !== undefined ? context.firstMins : punchMins;
  const isExplicitCheckOut = (punchState === 1 || punchState === 5);

  const isMorningGraceEnabled = shift.enable_morning_grace !== 0 && shift.enable_morning_grace !== '0' && shift.enable_morning_grace !== false;
  const isShortLeaveEnabled = shift.enable_short_leave !== 0 && shift.enable_short_leave !== '0' && shift.enable_short_leave !== false;
  const isHalfDayCalcEnabled = shift.enable_half_day_calc !== 0 && shift.enable_half_day_calc !== '0' && shift.enable_half_day_calc !== false;
  const isOvertimeEnabled = shift.enable_overtime !== 0 && shift.enable_overtime !== '0' && shift.enable_overtime !== false;

  const shiftStartMins = timeToMinutes(shift.start_time || '08:30');
  const shiftEndMins = timeToMinutes(shift.end_time || '16:15');
  const graceMins = parseInt(shift.grace_period_mins, 10) || 30;
  const maxMonthlyGraceDays = parseInt(shift.monthly_grace_days, 10) || 2;
  const maxMonthlyShortLeaves = parseInt(shift.monthly_short_leaves, 10) || 2;
  const halfDayHours = parseFloat(shift.half_day_hours) || 3.5;
  const lateHalfDayHours = parseFloat(shift.late_half_day_hours) || 4.0;
  const standardHalfDayEndMins = shiftStartMins + Math.round(halfDayHours * 60); // 08:30 + 3.5h = 12:00
  const lateHalfDayBaseMins = shiftStartMins + Math.round(lateHalfDayHours * 60); // 08:30 + 4.0h = 12:30

  // ----------------------------------------------------
  // Determine punch role in the daily schedule:
  // First punch = CHECK_IN
  // Last punch (if > 1 punch) = CHECK_OUT
  // Punches in between = INTERMEDIATE
  // ----------------------------------------------------
  let punchRole = 'CHECK_IN';
  if (context && context.totalPunches !== undefined) {
    if (context.totalPunches > 1) {
      if (punchId && context.firstPunchId && punchId === context.firstPunchId) {
        punchRole = 'CHECK_IN';
      } else if (punchId && context.lastPunchId && punchId === context.lastPunchId) {
        punchRole = 'CHECK_OUT';
      } else if (!punchId && context.firstPunchTime && String(punchTimeStr) === String(context.firstPunchTime)) {
        punchRole = 'CHECK_IN';
      } else if (!punchId && context.lastPunchTime && String(punchTimeStr) === String(context.lastPunchTime)) {
        punchRole = 'CHECK_OUT';
      } else {
        punchRole = 'INTERMEDIATE';
      }
    } else {
      punchRole = 'CHECK_IN';
    }
  } else {
    // Fallback when no context available
    punchRole = (isExplicitCheckOut || (isHalfDayCalcEnabled ? punchMins >= standardHalfDayEndMins : punchMins >= (shiftStartMins + 120))) ? 'CHECK_OUT' : 'CHECK_IN';
  }

  // If punched on Holiday or Weekend
  if (!dayClassification.isWorkingDay) {
    let otHours = 0;
    if (isOvertimeEnabled && punchRole === 'CHECK_OUT' && punchMins > firstMins) {
      const workedMins = punchMins - firstMins;
      otHours = calculateOvertimeHours(workedMins, true, { minOtMins: 60, otStepMins: 15 });
    }

    if (dayClassification.type === 'HOLIDAY') {
      const label = otHours > 0 ? `Holiday Worked (+${otHours}H OT)` : 'Holiday Worked';
      return {
        status: 'HOLIDAY_WORKED',
        label,
        role: punchRole,
        roleLabel: punchRole === 'CHECK_IN' ? 'Check-In' : (punchRole === 'CHECK_OUT' ? 'Check-Out' : 'Log / Break'),
        roleBadge: punchRole === 'CHECK_IN' ? 'badge-in' : (punchRole === 'CHECK_OUT' ? 'badge-out' : 'badge-tag'),
        otHours,
        badgeClass: 'badge-worked-off',
        icon: '🎉',
        isException: true
      };
    }
    const label = otHours > 0 ? `Weekend Worked (+${otHours}H OT)` : 'Weekend Worked';
    return {
      status: 'WEEKEND_WORKED',
      label,
      role: punchRole,
      roleLabel: punchRole === 'CHECK_IN' ? 'Check-In' : (punchRole === 'CHECK_OUT' ? 'Check-Out' : 'Log / Break'),
      roleBadge: punchRole === 'CHECK_IN' ? 'badge-in' : (punchRole === 'CHECK_OUT' ? 'badge-out' : 'badge-tag'),
      otHours,
      badgeClass: 'badge-worked-off',
      icon: '🏖️',
      isException: true
    };
  }

  // Working day evaluation
  if (!shift || !shift.start_time) {
    return {
      status: 'RECORDED',
      label: 'Present',
      role: punchRole,
      roleLabel: punchRole === 'CHECK_IN' ? 'Check-In' : (punchRole === 'CHECK_OUT' ? 'Check-Out' : 'Log / Break'),
      roleBadge: punchRole === 'CHECK_IN' ? 'badge-in' : (punchRole === 'CHECK_OUT' ? 'badge-out' : 'badge-tag'),
      otHours: 0,
      badgeClass: 'badge-on-time',
      icon: '✓'
    };
  }

  // ----------------------------------------------------
  // Intermediate Punch (between first and last of the day)
  // ----------------------------------------------------
  if (punchRole === 'INTERMEDIATE') {
    return {
      status: 'INTERMEDIATE',
      label: 'Intermediate Punch',
      role: 'INTERMEDIATE',
      roleLabel: 'Log / Break',
      roleBadge: 'badge-tag',
      badgeClass: 'badge-tag',
      otHours: 0,
      icon: '🔄'
    };
  }

  const mShortStartMins = timeToMinutes(shift.morning_short_leave_start || '09:00');
  const mShortEndMins = timeToMinutes(shift.morning_short_leave_end || '10:00');
  const eShortStartMins = timeToMinutes(shift.evening_short_leave_start || '14:45');
  const eShortEndMins = timeToMinutes(shift.evening_short_leave_end || '16:15');

  const isMorningShortLeaveUsed = isShortLeaveEnabled && !!context.isMorningShortLeave;
  const isEveningShortLeaveUsed = isShortLeaveEnabled && !!context.isEveningShortLeave;
  const isMorningGraceUsed = isMorningGraceEnabled && !!context.isMorningGraceUsed;
  const morningLateMins = Math.max(0, parseInt(context.morningLateMinutes, 10) || 0);

  // ----------------------------------------------------
  // Check-Out Evaluation (Last punch of the day)
  // ----------------------------------------------------
  if (punchRole === 'CHECK_OUT') {
    // If Half Day / Custom calculation is DISABLED -> standard simple departure
    if (!isHalfDayCalcEnabled) {
      if (punchMins >= shiftEndMins) {
        let otHours = 0;
        if (isOvertimeEnabled) {
          const extraMins = punchMins - shiftEndMins;
          otHours = calculateOvertimeHours(extraMins, true, {
            minOtMins: parseInt(shift.ot_min_mins, 10) || 60,
            otStepMins: parseInt(shift.ot_step_mins, 10) || 15
          });
        }
        const baseLabel = 'Full Day Completed';
        const displayLabel = otHours > 0 ? `${baseLabel} (+${otHours}H OT)` : baseLabel;
        return {
          status: 'ON_TIME',
          label: displayLabel,
          baseLabel,
          role: 'CHECK_OUT',
          roleLabel: 'Check-Out',
          roleBadge: 'badge-out',
          otHours,
          badgeClass: 'badge-on-time',
          icon: '✓'
        };
      }
      const earlyMins = Math.max(1, shiftEndMins - punchMins);
      return {
        status: 'EARLY_OUT',
        label: `Early Out (${earlyMins}m)`,
        earlyMinutes: earlyMins,
        role: 'CHECK_OUT',
        roleLabel: 'Check-Out',
        roleBadge: 'badge-out',
        otHours: 0,
        badgeClass: 'badge-early-out',
        icon: '⏰'
      };
    }

    // ----------------------------------------------------
    // 1. Special Case: Morning Short Leave used today (Arrived 09:00 - 10:00) -> NO OT
    // ----------------------------------------------------
    if (isShortLeaveEnabled && isMorningShortLeaveUsed) {
      if (punchMins >= shiftEndMins) {
        return {
          status: 'ON_TIME_SHORT_LEAVE',
          label: 'Full Day (Short Leave)',
          role: 'CHECK_OUT',
          roleLabel: 'Check-Out',
          roleBadge: 'badge-out',
          otHours: 0,
          badgeClass: 'badge-on-time',
          icon: '✓'
        };
      }
      if (punchMins >= firstMins + 240) { // Covered 4 hours
        return {
          status: 'HALF_DAY',
          label: 'Half Day (Short Leave)',
          role: 'CHECK_OUT',
          roleLabel: 'Check-Out',
          roleBadge: 'badge-out',
          otHours: 0,
          badgeClass: 'badge-half-day',
          icon: '🌓'
        };
      }
      const shortMins = (firstMins + 240) - punchMins;
      return {
        status: 'EARLY_OUT',
        label: `Early Out (${shortMins}m)`,
        earlyMinutes: shortMins,
        role: 'CHECK_OUT',
        roleLabel: 'Check-Out',
        roleBadge: 'badge-out',
        otHours: 0,
        badgeClass: 'badge-early-out',
        icon: '⏰'
      };
    }

    // ----------------------------------------------------
    // 2. Special Case: Evening Short Leave used today (Departed 14:45 - 16:15, Arrived <= 08:30) -> NO OT
    // Strict Mutual Exclusion: Only ONE Short Leave per day (Morning OR Evening, never both)
    // ----------------------------------------------------
    if (isShortLeaveEnabled && isEveningShortLeaveUsed && !isMorningShortLeaveUsed && !isMorningGraceUsed && punchMins >= eShortStartMins && punchMins < shiftEndMins) {
      return {
        status: 'ON_TIME_SHORT_LEAVE',
        label: 'Full Day (Short Leave Evening)',
        role: 'CHECK_OUT',
        roleLabel: 'Check-Out',
        roleBadge: 'badge-out',
        otHours: 0,
        badgeClass: 'badge-on-time',
        icon: '✓'
      };
    }

    // ----------------------------------------------------
    // 3. Special Case: Arrived after 10:00 -> Can cover 4 hours for Half Day -> NO OT
    // ----------------------------------------------------
    if (isShortLeaveEnabled && firstMins > mShortEndMins) {
      const required4hMins = firstMins + 240;
      if (punchMins >= required4hMins) {
        return {
          status: 'HALF_DAY',
          label: 'Half Day (4h Covered)',
          role: 'CHECK_OUT',
          roleLabel: 'Check-Out',
          roleBadge: 'badge-out',
          otHours: 0,
          badgeClass: 'badge-half-day',
          icon: '🌓'
        };
      }
      const earlyMins = required4hMins - punchMins;
      return {
        status: 'EARLY_OUT',
        label: `Early Out (${earlyMins}m)`,
        earlyMinutes: earlyMins,
        role: 'CHECK_OUT',
        roleLabel: 'Check-Out',
        roleBadge: 'badge-out',
        otHours: 0,
        badgeClass: 'badge-early-out',
        icon: '⏰'
      };
    }

    // ----------------------------------------------------
    // 4. Standard Full Day & Half Day Target Calculation
    // ----------------------------------------------------
    const requireLateCover = shift.late_cover_end !== 0 && shift.late_cover_end !== '0';
    const effectiveMorningLateMins = requireLateCover ? morningLateMins : 0;

    const requiredFullDayEndMins = shiftEndMins + effectiveMorningLateMins;
    const requiredHalfDayEndMins = effectiveMorningLateMins > 0 
      ? (lateHalfDayBaseMins + effectiveMorningLateMins) 
      : standardHalfDayEndMins;

    // Full Day
    if (punchMins >= requiredFullDayEndMins) {
      const baseLabel = effectiveMorningLateMins > 0 
        ? 'Full Day (Late Covered)' 
        : 'Full Day Completed';

      // OT Calculation:
      let otHours = 0;
      if (isOvertimeEnabled && !isMorningShortLeaveUsed && !isEveningShortLeaveUsed) {
        const extraMins = punchMins - requiredFullDayEndMins;
        otHours = calculateOvertimeHours(extraMins, true, {
          minOtMins: parseInt(shift.ot_min_mins, 10) || 60,
          otStepMins: parseInt(shift.ot_step_mins, 10) || 15
        });
      }

      const displayLabel = otHours > 0 ? `${baseLabel} (+${otHours}H OT)` : baseLabel;

      return {
        status: 'ON_TIME',
        label: displayLabel,
        baseLabel,
        role: 'CHECK_OUT',
        roleLabel: 'Check-Out',
        roleBadge: 'badge-out',
        otHours,
        badgeClass: 'badge-on-time',
        icon: '✓'
      };
    }

    // Half Day -> NO OT
    if (punchMins >= requiredHalfDayEndMins) {
      const label = effectiveMorningLateMins > 0 
        ? 'Half Day (Late Covered)' 
        : 'Half Day Completed';
      return {
        status: 'HALF_DAY',
        label,
        role: 'CHECK_OUT',
        roleLabel: 'Check-Out',
        roleBadge: 'badge-out',
        otHours: 0,
        badgeClass: 'badge-half-day',
        icon: '🌓'
      };
    }

    // Early Out
    const targetMins = (punchMins >= standardHalfDayEndMins && punchMins < requiredHalfDayEndMins)
      ? requiredHalfDayEndMins
      : requiredFullDayEndMins;
    const earlyMins = Math.max(1, targetMins - punchMins);
    return {
      status: 'EARLY_OUT',
      label: `Early Out (${earlyMins}m)`,
      earlyMinutes: earlyMins,
      role: 'CHECK_OUT',
      roleLabel: 'Check-Out',
      roleBadge: 'badge-out',
      otHours: 0,
      badgeClass: 'badge-early-out',
      icon: '⏰'
    };
  }

  // ----------------------------------------------------
  // Morning Arrival / Check-In Evaluation
  // ----------------------------------------------------
  if (punchMins <= shiftStartMins) {
    return {
      status: 'ON_TIME',
      label: 'On Time',
      role: 'CHECK_IN',
      roleLabel: 'Check-In',
      roleBadge: 'badge-in',
      otHours: 0,
      badgeClass: 'badge-on-time',
      icon: '✓'
    };
  }

  // Arrival within Morning Grace window (08:30 - 09:00) when Grace is enabled
  if (isMorningGraceEnabled && punchMins <= shiftStartMins + graceMins) {
    if (context.isMorningGraceUsed || (context.isMorningGraceUsed === undefined && (parseInt(context.graceOrdinal, 10) || 1) <= maxMonthlyGraceDays)) {
      const graceOrdinal = parseInt(context.graceOrdinal, 10) || 1;
      return {
        status: 'ON_TIME_GRACE',
        label: `Grace (${graceOrdinal}/${maxMonthlyGraceDays})`,
        graceOrdinal,
        role: 'CHECK_IN',
        roleLabel: 'Check-In',
        roleBadge: 'badge-in',
        otHours: 0,
        badgeClass: 'badge-on-time',
        icon: '✓'
      };
    } else {
      const lateMins = punchMins - shiftStartMins;
      return {
        status: 'LATE_IN',
        label: `Late (${lateMins}m - Limit Exceeded)`,
        lateMinutes: lateMins,
        role: 'CHECK_IN',
        roleLabel: 'Check-In',
        roleBadge: 'badge-in',
        otHours: 0,
        badgeClass: 'badge-late-in',
        icon: '⚠️'
      };
    }
  }

  // Arrival within Morning Short Leave window (09:00 - 10:00) when Short Leave is enabled
  if (isShortLeaveEnabled && punchMins >= mShortStartMins && punchMins <= mShortEndMins) {
    if (context.isMorningShortLeave || (context.isMorningShortLeave === undefined && (parseInt(context.shortLeaveOrdinal, 10) || 1) <= maxMonthlyShortLeaves)) {
      const shortLeaveOrdinal = parseInt(context.shortLeaveOrdinal, 10) || 1;
      return {
        status: 'SHORT_LEAVE_MORNING',
        label: `Short Leave Morning (${shortLeaveOrdinal}/${maxMonthlyShortLeaves})`,
        shortLeaveOrdinal,
        role: 'CHECK_IN',
        roleLabel: 'Check-In',
        roleBadge: 'badge-in',
        otHours: 0,
        badgeClass: 'badge-on-time',
        icon: '✓'
      };
    } else {
      const lateMins = punchMins - shiftStartMins;
      return {
        status: 'LATE_IN',
        label: `Late (${lateMins}m - Short Leave Exceeded)`,
        lateMinutes: lateMins,
        role: 'CHECK_IN',
        roleLabel: 'Check-In',
        roleBadge: 'badge-in',
        otHours: 0,
        badgeClass: 'badge-late-in',
        icon: '⚠️'
      };
    }
  }

  // Standard Late Arrival
  const lateMins = punchMins - shiftStartMins;
  return {
    status: 'LATE_IN',
    label: `Late (${lateMins}m)`,
    lateMinutes: lateMins,
    role: 'CHECK_IN',
    roleLabel: 'Check-In',
    roleBadge: 'badge-in',
    otHours: 0,
    badgeClass: 'badge-late-in',
    icon: '⚠️'
  };
}

/**
 * Builds monthly grace & short leave usage maps for all attendance records.
 * @param {Array} records - Array of attendance records
 * @param {Array} holidays - Array of holidays
 */
function buildMonthlyGraceAndLateMap(records, holidays = []) {
  const userDateMap = {};

  records.forEach((r) => {
    const dateStr = String(r.punch_time).slice(0, 10);
    const userId = String(r.user_id);
    const key = `${userId}_${dateStr}`;
    if (!userDateMap[key]) {
      userDateMap[key] = [];
    }
    userDateMap[key].push(r);
  });

  const userMonthGraceMap = {}; // { 'userId_YYYY-MM': [date1, date2] }
  const userMonthShortLeaveMap = {}; // { 'userId_YYYY-MM': [date1, date2] }
  const userDateInfo = {}; // { 'userId_YYYY-MM-DD': { ... } }

  const sortedKeys = Object.keys(userDateMap).sort();

  sortedKeys.forEach((key) => {
    const dayRecords = userDateMap[key];
    dayRecords.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));

    const firstPunch = dayRecords[0];
    const lastPunch = dayRecords[dayRecords.length - 1];
    const dateStr = String(firstPunch.punch_time).slice(0, 10);
    const monthStr = dateStr.slice(0, 7); // 'YYYY-MM'
    const userId = String(firstPunch.user_id);
    const monthKey = `${userId}_${monthStr}`;

    if (!userMonthGraceMap[monthKey]) userMonthGraceMap[monthKey] = [];
    if (!userMonthShortLeaveMap[monthKey]) userMonthShortLeaveMap[monthKey] = [];

    const shift = {
      start_time: firstPunch.shift_start || '08:30',
      end_time: firstPunch.shift_end || '16:15',
      grace_period_mins: firstPunch.grace_period_mins !== undefined ? firstPunch.grace_period_mins : 30,
      monthly_grace_days: firstPunch.monthly_grace_days !== undefined ? firstPunch.monthly_grace_days : 2,
      monthly_short_leaves: firstPunch.monthly_short_leaves !== undefined ? firstPunch.monthly_short_leaves : 2,
      morning_short_leave_start: firstPunch.morning_short_leave_start || '09:00',
      morning_short_leave_end: firstPunch.morning_short_leave_end || '10:00',
      evening_short_leave_start: firstPunch.evening_short_leave_start || '14:45',
      evening_short_leave_end: firstPunch.evening_short_leave_end || '16:15',
      enable_morning_grace: firstPunch.enable_morning_grace,
      enable_short_leave: firstPunch.enable_short_leave,
      enable_half_day_calc: firstPunch.enable_half_day_calc,
      enable_overtime: firstPunch.enable_overtime,
      work_days: firstPunch.work_days || '1,2,3,4,5'
    };

    const isMorningGraceEnabled = shift.enable_morning_grace !== 0 && shift.enable_morning_grace !== '0' && shift.enable_morning_grace !== false;
    const isShortLeaveEnabled = shift.enable_short_leave !== 0 && shift.enable_short_leave !== '0' && shift.enable_short_leave !== false;

    const dayClass = getDayClassification(dateStr, shift, holidays);
    if (!dayClass.isWorkingDay) {
      userDateInfo[key] = {
        firstPunchId: firstPunch.id,
        lastPunchId: lastPunch.id,
        firstPunchTime: firstPunch.punch_time,
        lastPunchTime: lastPunch.punch_time,
        totalPunches: dayRecords.length,
        morningLateMinutes: 0,
        firstMins: timeToMinutes(String(firstPunch.punch_time).slice(11, 16)),
        lastMins: timeToMinutes(String(lastPunch.punch_time).slice(11, 16))
      };
      return;
    }

    const firstMins = timeToMinutes(String(firstPunch.punch_time).slice(11, 16));
    const lastMins = timeToMinutes(String(lastPunch.punch_time).slice(11, 16));
    const shiftStartMins = timeToMinutes(shift.start_time);
    const shiftEndMins = timeToMinutes(shift.end_time);
    const graceMins = parseInt(shift.grace_period_mins, 10) || 30;
    const maxMonthlyGraceDays = parseInt(shift.monthly_grace_days, 10) || 2;
    const maxMonthlyShortLeaves = parseInt(shift.monthly_short_leaves, 10) || 2;

    const mShortStartMins = timeToMinutes(shift.morning_short_leave_start);
    const mShortEndMins = timeToMinutes(shift.morning_short_leave_end);
    const eShortStartMins = timeToMinutes(shift.evening_short_leave_start);
    const eShortEndMins = timeToMinutes(shift.evening_short_leave_end);

    let morningStatus = 'ON_TIME';
    let morningLateMinutes = 0;
    let isMorningGraceUsed = false;
    let isMorningShortLeave = false;
    let isEveningShortLeave = false;
    let graceOrdinal = 0;
    let shortLeaveOrdinal = 0;

    // Evaluate Morning
    if (firstMins <= shiftStartMins) {
      // Arrived on-time / early (<= 08:30)
      morningStatus = 'ON_TIME';
      morningLateMinutes = 0;

      // Check Evening Short Leave (14:45 - 16:15) if enabled
      if (isShortLeaveEnabled && lastMins >= eShortStartMins && lastMins < shiftEndMins) {
        if (userMonthShortLeaveMap[monthKey].length < maxMonthlyShortLeaves) {
          userMonthShortLeaveMap[monthKey].push(dateStr);
          isEveningShortLeave = true;
          shortLeaveOrdinal = userMonthShortLeaveMap[monthKey].length;
        }
      }
    } else if (isMorningGraceEnabled && firstMins <= shiftStartMins + graceMins) {
      // Arrived during grace window (08:30 - 09:00) with Grace enabled
      if (userMonthGraceMap[monthKey].length < maxMonthlyGraceDays) {
        userMonthGraceMap[monthKey].push(dateStr);
        isMorningGraceUsed = true;
        graceOrdinal = userMonthGraceMap[monthKey].length;
        morningStatus = 'ON_TIME_GRACE';
        morningLateMinutes = 0; // Morning grace is granted: arrival is excused, no late penalty/covering!
      } else {
        morningStatus = 'LATE_IN';
        morningLateMinutes = firstMins - shiftStartMins; // Monthly grace quota exceeded: counted as late!
      }
      // Cannot get Evening Short Leave on the same day!
    } else if (isShortLeaveEnabled && firstMins >= mShortStartMins && firstMins <= mShortEndMins) {
      // Arrived during Morning Short Leave window (09:00 - 10:00) with Short Leave enabled
      if (userMonthShortLeaveMap[monthKey].length < maxMonthlyShortLeaves) {
        userMonthShortLeaveMap[monthKey].push(dateStr);
        isMorningShortLeave = true;
        shortLeaveOrdinal = userMonthShortLeaveMap[monthKey].length;
        morningStatus = 'SHORT_LEAVE_MORNING';
        morningLateMinutes = 0;
      } else {
        morningStatus = 'LATE_IN';
        morningLateMinutes = firstMins - shiftStartMins;
      }
    } else {
      // Arrived after 10:00 or when rules disabled
      morningStatus = 'LATE_IN';
      morningLateMinutes = firstMins - shiftStartMins;
    }

    userDateInfo[key] = {
      firstPunchId: firstPunch.id,
      lastPunchId: lastPunch.id,
      firstPunchTime: firstPunch.punch_time,
      lastPunchTime: lastPunch.punch_time,
      totalPunches: dayRecords.length,
      firstMins,
      lastMins,
      morningStatus,
      morningLateMinutes,
      isMorningGraceUsed,
      graceOrdinal,
      isMorningShortLeave,
      isEveningShortLeave,
      shortLeaveOrdinal
    };
  });

  return {
    getContext: (userId, dateStr) => userDateInfo[`${userId}_${dateStr}`] || { morningLateMinutes: 0 },
    getMorningLate: (userId, dateStr) => userDateInfo[`${userId}_${dateStr}`]?.morningLateMinutes || 0,
    getGraceOrdinal: (userId, dateStr) => userDateInfo[`${userId}_${dateStr}`]?.graceOrdinal || 1
  };
}

/**
 * Computes Daily Attendance summary rows (1 row per employee per date)
 * where first punch is Check-In and last punch is Check-Out.
 * If allEmployees is provided, also generates rows for absent employees.
 */
function computeDailyAttendanceSummary(records, holidays = [], allEmployees = [], targetDates = []) {
  const userDateMap = {};
  const foundDates = new Set();

  records.forEach((r) => {
    const dateStr = String(r.punch_time).slice(0, 10);
    const userId = String(r.user_id);
    foundDates.add(dateStr);
    const key = `${dateStr}___${userId}`;
    if (!userDateMap[key]) {
      userDateMap[key] = [];
    }
    userDateMap[key].push(r);
  });

  if (Array.isArray(targetDates) && targetDates.length > 0) {
    targetDates.forEach(d => {
      if (d) foundDates.add(String(d));
    });
  }

  const graceHelper = buildMonthlyGraceAndLateMap(records, holidays);
  const dailyRows = [];
  const processedKeys = new Set();
  const allowedUserIds = (Array.isArray(allEmployees) && allEmployees.length > 0)
    ? new Set(allEmployees.map(e => String(e.user_id)))
    : null;

  // 1. Process all punched users on their respective dates
  Object.keys(userDateMap).forEach((key) => {
    const [dateStr, userId] = key.split('___');
    if (allowedUserIds && !allowedUserIds.has(String(userId))) {
      return; // Skip inactive or excluded users
    }
    processedKeys.add(key);

    const dayRecords = userDateMap[key];
    dayRecords.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));

    const firstPunch = dayRecords[0];
    const lastPunch = dayRecords[dayRecords.length - 1];
    const context = graceHelper.getContext(userId, dateStr);

    const shiftObj = {
      name: firstPunch.shift_name || 'General Shift',
      start_time: firstPunch.shift_start || '08:30',
      end_time: firstPunch.shift_end || '16:15',
      grace_period_mins: firstPunch.grace_period_mins !== undefined ? firstPunch.grace_period_mins : 30,
      monthly_grace_days: firstPunch.monthly_grace_days !== undefined ? firstPunch.monthly_grace_days : 2,
      late_cover_end: firstPunch.late_cover_end !== undefined ? firstPunch.late_cover_end : 1,
      half_day_hours: firstPunch.half_day_hours !== undefined ? firstPunch.half_day_hours : 3.5,
      late_half_day_hours: firstPunch.late_half_day_hours !== undefined ? firstPunch.late_half_day_hours : 4.0,
      full_day_hours: firstPunch.full_day_hours !== undefined ? firstPunch.full_day_hours : 7.75,
      monthly_short_leaves: firstPunch.monthly_short_leaves !== undefined ? firstPunch.monthly_short_leaves : 2,
      morning_short_leave_start: firstPunch.morning_short_leave_start || '09:00',
      morning_short_leave_end: firstPunch.morning_short_leave_end || '10:00',
      evening_short_leave_start: firstPunch.evening_short_leave_start || '14:45',
      evening_short_leave_end: firstPunch.evening_short_leave_end || '16:15',
      disallow_grace_and_short_leave_same_day: firstPunch.disallow_grace_and_short_leave_same_day !== undefined ? firstPunch.disallow_grace_and_short_leave_same_day : 1,
      ot_min_mins: firstPunch.ot_min_mins !== undefined ? firstPunch.ot_min_mins : 60,
      ot_step_mins: firstPunch.ot_step_mins !== undefined ? firstPunch.ot_step_mins : 15,
      enable_morning_grace: firstPunch.enable_morning_grace !== undefined ? firstPunch.enable_morning_grace : 1,
      enable_short_leave: firstPunch.enable_short_leave !== undefined ? firstPunch.enable_short_leave : 1,
      enable_half_day_calc: firstPunch.enable_half_day_calc !== undefined ? firstPunch.enable_half_day_calc : 1,
      enable_overtime: firstPunch.enable_overtime !== undefined ? firstPunch.enable_overtime : 1,
      work_days: firstPunch.work_days || '1,2,3,4,5'
    };

    const dayClass = getDayClassification(dateStr, shiftObj, holidays);

    // Evaluate First Punch as Check-In
    const checkInEval = evaluatePunchPunctuality(firstPunch.punch_time, shiftObj, dayClass, firstPunch.punch_state, context, firstPunch.id);

    // Evaluate Last Punch as Check-Out if more than 1 punch
    let checkOutEval = null;
    let workedMinutes = 0;
    let otHours = 0;

    if (dayRecords.length > 1) {
      checkOutEval = evaluatePunchPunctuality(lastPunch.punch_time, shiftObj, dayClass, lastPunch.punch_state, context, lastPunch.id);
      workedMinutes = Math.max(0, context.lastMins - context.firstMins);
      otHours = checkOutEval.otHours || 0;
    } else {
      checkOutEval = {
        status: 'PENDING_CHECK_OUT',
        label: 'Missing / Pending Check-Out',
        badgeClass: 'badge-tag',
        otHours: 0,
        icon: '⏳'
      };
    }

    const hours = Math.floor(workedMinutes / 60);
    const mins = workedMinutes % 60;
    const workFormatted = workedMinutes > 0 ? `${hours}h ${mins}m` : '-';

    // Determine Overall Daily Status
    let dailyStatus = 'Present';
    let dailyBadge = 'badge-on-time';

    if (!dayClass.isWorkingDay) {
      dailyStatus = dayClass.label;
      dailyBadge = 'badge-worked-off';
    } else if (dayRecords.length === 1) {
      if (checkInEval.status === 'ON_TIME_GRACE') {
        dailyStatus = `Grace Used (${context.graceOrdinal}/${shiftObj.monthly_grace_days || 2}) - Single Punch`;
        dailyBadge = 'badge-on-time';
      } else {
        dailyStatus = 'Single Punch (Check-In Only)';
        dailyBadge = 'badge-tag';
      }
    } else if (checkOutEval.status === 'ON_TIME' || checkOutEval.status === 'ON_TIME_SHORT_LEAVE') {
      if (checkInEval.status === 'ON_TIME_GRACE') {
        const otText = otHours > 0 ? ` (+${otHours}H OT)` : '';
        dailyStatus = `Full Day (Grace Used ${context.graceOrdinal}/${shiftObj.monthly_grace_days || 2})${otText}`;
        dailyBadge = 'badge-on-time';
      } else {
        dailyStatus = checkOutEval.label;
        dailyBadge = 'badge-on-time';
      }
    } else if (checkOutEval.status === 'HALF_DAY') {
      if (checkInEval.status === 'ON_TIME_GRACE') {
        dailyStatus = `${checkOutEval.label} (Grace Used ${context.graceOrdinal}/${shiftObj.monthly_grace_days || 2})`;
        dailyBadge = 'badge-half-day';
      } else {
        dailyStatus = checkOutEval.label;
        dailyBadge = 'badge-half-day';
      }
    } else if (checkOutEval.status === 'EARLY_OUT') {
      if (checkInEval.status === 'ON_TIME_GRACE') {
        dailyStatus = `Early Out (${checkOutEval.earlyMinutes || ''}m) - Grace Used (${context.graceOrdinal}/${shiftObj.monthly_grace_days || 2})`;
        dailyBadge = 'badge-early-out';
      } else {
        dailyStatus = checkOutEval.label;
        dailyBadge = 'badge-early-out';
      }
    } else if (checkInEval.status === 'ON_TIME_GRACE') {
      dailyStatus = `Grace Used (${context.graceOrdinal}/${shiftObj.monthly_grace_days || 2})`;
      dailyBadge = 'badge-on-time';
    } else if (checkInEval.status === 'LATE_IN') {
      dailyStatus = checkInEval.label;
      dailyBadge = 'badge-late-in';
    }

    dailyRows.push({
      date: dateStr,
      user_id: userId,
      employee_name: firstPunch.employee_name || '',
      department: firstPunch.department || 'General',
      shift_name: shiftObj.name,
      shift_start: shiftObj.start_time,
      shift_end: shiftObj.end_time,
      first_punch_time: firstPunch.punch_time,
      first_punch_state: firstPunch.punch_state_name || 'Check-In',
      check_in_time: String(firstPunch.punch_time).slice(11, 19),
      check_in_status: checkInEval.status,
      check_in_label: checkInEval.label,
      check_in_badge: checkInEval.badgeClass,
      last_punch_time: dayRecords.length > 1 ? lastPunch.punch_time : null,
      last_punch_state: dayRecords.length > 1 ? (lastPunch.punch_state_name || 'Check-Out') : null,
      check_out_time: dayRecords.length > 1 ? String(lastPunch.punch_time).slice(11, 19) : '-',
      check_out_status: checkOutEval.status,
      check_out_label: checkOutEval.label,
      check_out_badge: checkOutEval.badgeClass,
      punch_count: dayRecords.length,
      worked_minutes: workedMinutes,
      worked_formatted: workFormatted,
      ot_hours: otHours,
      daily_status: dailyStatus,
      daily_badge: dailyBadge,
      day_type: dayClass.type,
      day_name: dayClass.name
    });
  });

  // 2. If allEmployees is provided, add absent employees for each target date
  if (Array.isArray(allEmployees) && allEmployees.length > 0) {
    foundDates.forEach((dateStr) => {
      allEmployees.forEach((emp) => {
        const userId = String(emp.user_id);
        const key = `${dateStr}___${userId}`;
        if (!processedKeys.has(key)) {
          const shiftObj = {
            name: emp.shift_name || 'General Shift',
            start_time: emp.shift_start || '08:30',
            end_time: emp.shift_end || '16:15',
            work_days: emp.work_days || '1,2,3,4,5'
          };
          const dayClass = getDayClassification(dateStr, shiftObj, holidays);
          const isWorkingDay = Boolean(dayClass.isWorkingDay);

          dailyRows.push({
            date: dateStr,
            user_id: userId,
            employee_name: emp.employee_name || emp.name || '',
            department: emp.department || 'General',
            shift_name: shiftObj.name,
            shift_start: shiftObj.start_time,
            shift_end: shiftObj.end_time,
            first_punch_time: null,
            first_punch_state: null,
            check_in_time: '-',
            check_in_status: (dateStr > (new Date().toISOString().split('T')[0])) ? (isWorkingDay ? 'FUTURE' : (dayClass.type === 'WEEKEND' ? 'WEEKEND' : 'HOLIDAY')) : (isWorkingDay ? 'ABSENT' : (dayClass.type === 'WEEKEND' ? 'WEEKEND' : 'HOLIDAY')),
            check_in_label: (dateStr > (new Date().toISOString().split('T')[0])) ? (isWorkingDay ? 'Scheduled' : dayClass.label) : (isWorkingDay ? 'Absent (No Punch)' : dayClass.label),
            check_in_badge: (dateStr > (new Date().toISOString().split('T')[0])) ? 'badge-tag' : (isWorkingDay ? 'badge-absent' : 'badge-worked-off'),
            last_punch_time: null,
            last_punch_state: null,
            check_out_time: '-',
            check_out_status: '-',
            check_out_label: '-',
            check_out_badge: 'badge-tag',
            punch_count: 0,
            worked_minutes: 0,
            worked_formatted: '-',
            ot_hours: 0,
            daily_status: (dateStr > (new Date().toISOString().split('T')[0])) ? (isWorkingDay ? 'Scheduled / Future' : dayClass.label) : (isWorkingDay ? 'Absent' : dayClass.label),
            daily_badge: (dateStr > (new Date().toISOString().split('T')[0])) ? (isWorkingDay ? 'badge-tag' : 'badge-worked-off') : (isWorkingDay ? 'badge-absent' : 'badge-worked-off'),
            day_type: dayClass.type,
            day_name: dayClass.name
          });
        }
      });
    });
  }

  // 3. Sort dailyRows: Date DESC (newest first), then User ID ASC (numerical order)
  dailyRows.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    const idA = parseInt(a.user_id, 10);
    const idB = parseInt(b.user_id, 10);
    if (!isNaN(idA) && !isNaN(idB)) {
      return idA - idB;
    }
    return String(a.user_id).localeCompare(String(b.user_id));
  });

  return dailyRows;
}

module.exports = {
  DAY_NAMES,
  timeToMinutes,
  getDayClassification,
  calculateOvertimeHours,
  evaluatePunchPunctuality,
  buildMonthlyGraceAndLateMap,
  computeDailyAttendanceSummary
};

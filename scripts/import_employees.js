const { dbRun, dbGet, dbAll, initDatabase } = require('../src/db');
const employeesList = require('../data/employee_master.json');

async function importMaster() {
  await initDatabase();

  let updatedCount = 0;
  let insertedCount = 0;

  for (const item of employeesList) {
    const userId = String(item.FingerPrintID || '').trim();
    if (!userId) continue;

    const title = (item.Title || '').trim();
    const firstName = (item.FirstName || '').trim();
    const lastName = (item.LastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || (item.name || 'Unassigned');
    const serviceId = (item.EmployeeServiceID || '').trim();
    const nic = (item.NIC || '').trim();
    let phone = (item.MobileNumber || '').trim();
    if (phone.length === 9 && !phone.startsWith('0')) {
      phone = '0' + phone;
    }
    const email = (item.Email || '').trim();
    const gender = (item.Gender || '').trim();
    const birthday = (item.BirthDay || '').trim();
    const appointmentDate = (item.AppoinmentDate || '').trim();
    const status = (item.Status || '').trim();
    const orderById = (item.OrderByID || '').trim();

    const existing = await dbGet('SELECT user_id, name FROM employees WHERE user_id = ?', [userId]);

    if (existing) {
      await dbRun(
        `UPDATE employees SET
          name = ?,
          first_name = ?,
          last_name = ?,
          title = ?,
          employee_service_id = ?,
          nic = ?,
          phone = ?,
          email = ?,
          gender = ?,
          birthday = ?,
          appointment_date = ?,
          employment_status = ?,
          order_by_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`,
        [fullName, firstName, lastName, title, serviceId, nic, phone, email, gender, birthday, appointmentDate, status, orderById, userId]
      );
      updatedCount++;
    } else {
      await dbRun(
        `INSERT INTO employees (
          user_id, name, department, role,
          first_name, last_name, title,
          employee_service_id, nic, phone, email,
          gender, birthday, appointment_date, employment_status, order_by_id
        ) VALUES (
          ?, ?, 'General', 'Staff',
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )`,
        [userId, fullName, firstName, lastName, title, serviceId, nic, phone, email, gender, birthday, appointmentDate, status, orderById]
      );
      insertedCount++;
    }
  }

  console.log('Master import completed successfully!');
  console.log('Updated existing employees:', updatedCount);
  console.log('Inserted new employees:', insertedCount);

  // Check sample employee 84
  const emp84 = await dbGet('SELECT * FROM employees WHERE user_id = ?', ['84']);
  console.log('\nEmployee 84 in DB:');
  console.log(emp84);

  // Check sample employee 2
  const emp2 = await dbGet('SELECT * FROM employees WHERE user_id = ?', ['2']);
  console.log('\nEmployee 2 in DB:');
  console.log(emp2);

  process.exit(0);
}

importMaster().catch(err => {
  console.error('Import error:', err);
  process.exit(1);
});

# SpeedFace-V5L Series Attendance Management Application

A modern attendance management web application and real-time synchronization server designed specifically for the **ZKTeco SpeedFace-V5L Series** (including SpeedFace-V5L, SpeedFace-V5L[TI], SpeedFace-V5L[P], SpeedFace-V5L[QR]).

---

## 🌟 Key Features

- **Direct Hardware Sync (Port 4370)**: Connects directly to the terminal's TCP port `4370` using an optimized 49-byte packet decoder tailored for SpeedFace Linux firmware.
- **ZKTeco ADMS / Cloud Server Protocol**: Built-in HTTP listener (`/iclock/cdata`) that receives instantaneous real-time facial recognition push events as employees scan in.
- **Embedded SQLite Database**: All records and user details are permanently stored locally in `data/attendance.db` with duplicate prevention (`ON CONFLICT IGNORE`).
- **Interactive Live Dashboard**:
  - Real-time punch feed with live WebSocket broadcasts.
  - Quick summary stats: Today's present count, total punches today, total persistent records, and device online status.
- **Attendance Records Explorer**:
  - Filter by date range (Today, Yesterday, Last 7 Days, This Month, Custom Dates).
  - Search by User ID, Employee Name, or Department.
  - Filter by Verification Mode (Face Recognition 👤, Palm ✋, Fingerprint 👆, RFID Card 💳, PIN/Password 🔑).
  - Filter by Punch State (Check-In, Check-Out, Break, Overtime).
- **One-Click Export**:
  - Export to **Excel (`.xlsx`)** with formatted headers and column widths.
  - Export to **CSV (`.csv`)**.
- **Employee Directory**:
  - Automatically imports all enrolled User IDs from the SpeedFace terminal.
  - Allows assigning Employee Names, Departments, Roles, Phone numbers, and Emails.
- **Device Control & Maintenance**:
  - Test connection & check terminal capacity / memory.
  - Synchronize terminal clock with computer time.
  - Reboot terminal remotely.
  - Automated background sync scheduler (default every 60 seconds).

---

## 🚀 Quick Start (Windows)

### Option 1: Double-Click Launcher
Simply double-click:
```bat
start.bat
```
This automatically starts the server and opens your browser to `http://localhost:8088`.

### Option 2: Command Line
```powershell
cd c:\Users\sanka\Documents\AttendanceV5L
npm install
node server.js
```
Open **[http://localhost:8088](http://localhost:8088)** in any modern web browser.

---

## 📱 SpeedFace-V5L Terminal Configuration

### 1. Terminal IP Address
Ensure your SpeedFace-V5L is connected to the same LAN / Wi-Fi network:
- Terminal IP: `192.168.10.15`
- Subnet Mask: `255.255.255.0`
- Gateway: `192.168.10.1`

### 2. Enable Real-Time Push (ADMS / Cloud Server)
To receive live instant scans as employees stand in front of the camera:
1. Tap the screen and enter the **Menu** (authenticate as Admin if prompted).
2. Navigate to: **Comm.** &rarr; **Cloud Server Setting** (or **ADMS / Web Server**).
3. Set **Server Mode** to: `ADMS` (or `Cloud Server`).
4. Set **Enable Domain Name** to: `OFF` (to input an IP directly).
5. Set **Server Address** to your computer's IP: `192.168.10.57`.
6. Set **Server Port** to: `8088`.
7. Set **Enable Proxy Server** to: `OFF`.
8. Tap **OK** or **Save**.

The device will immediately initiate a handshake with the application and begin streaming punches.

---

## 📂 Project Architecture

```
AttendanceV5L/
├── server.js               # Application server (Express + WebSockets + ADMS)
├── start.bat               # Windows 1-click launcher
├── package.json            # Node.js dependencies
├── data/
│   └── attendance.db       # Persistent SQLite database
├── src/
│   ├── db.js               # SQLite database layer & schema definitions
│   ├── zktProtocol.js      # SpeedFace 49-byte packet decoder & TCP client
│   ├── admsServer.js       # ZKTeco ADMS IClock HTTP Push protocol handler
│   ├── syncService.js      # Background scheduled sync engine
│   ├── exportService.js    # Excel (.xlsx) and CSV generators
│   └── apiRoutes.js        # REST API endpoints
└── public/
    ├── index.html          # Modern Single Page Application
    ├── css/
    │   └── style.css       # Clean responsive styles and badges
    └── js/
        └── app.js          # Reactive UI controller & WebSocket client
```

---

## 🛠️ REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/stats` | `GET` | Dashboard counts, device online state, recent punch |
| `/api/records` | `GET` | Filtered attendance logs with pagination |
| `/api/records/export` | `GET` | Export records as `.xlsx` or `.csv` |
| `/api/device/sync` | `POST` | Trigger immediate pull of attendance records |
| `/api/device/test` | `POST` | Test connection to terminal & query status |
| `/api/device/sync-time`| `POST` | Sync terminal clock with PC |
| `/api/device/reboot` | `POST` | Reboot terminal |
| `/api/employees` | `GET/POST` | List or update employee names, departments, and roles |
| `/api/employees/sync-all` | `POST` | Push all customized employee names to the SpeedFace device |
| `/api/employees/export` | `GET` | Export employee directory as `.xlsx` or `.csv` |
| `/api/settings` | `GET/POST` | Read or update device IP, port, and sync interval |
| `/api/network-ips` | `GET` | List host machine local IP addresses |
| `/ws` | `WebSocket`| Real-time live punch events (`LIVE_PUNCH`) |

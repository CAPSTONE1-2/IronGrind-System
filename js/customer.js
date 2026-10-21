<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IronGrind · My Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
<div class="app">
    <header class="app-header">
        <div class="logo-area">
            <div class="logo-icon">IG</div>
            <div class="logo-text">
                <h1>Iron<span>Grind</span></h1>
                <p>Member Dashboard</p>
            </div>
        </div>
        <div class="header-actions">
            <div class="user-chip">
                <i class="fas fa-user"></i>
                <span id="currentUserName">Member</span>
            </div>
            <button class="btn-logout" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        </div>
    </header>

    <div class="dashboard">
        <aside class="sidebar">
            <button class="nav-item active" data-section="home" onclick="showCustomerSection('home', event)">
                <i class="fas fa-home"></i> Overview
            </button>
            <button class="nav-item" data-section="progress" onclick="showCustomerSection('progress', event)">
                <i class="fas fa-chart-line"></i> My Progress
            </button>
            <button class="nav-item" data-section="attendance" onclick="showCustomerSection('attendance', event)">
                <i class="fas fa-calendar-check"></i> My Attendance
            </button>
            <button class="nav-item" data-section="store" onclick="showCustomerSection('store', event)">
                <i class="fas fa-store"></i> Gym Store
            </button>
        </aside>

        <main class="main-content">
            <!-- OVERVIEW -->
            <div id="section-home" class="admin-section">
                <div class="customer-hero">
                    <div>
                        <h2>Welcome back, <span id="heroName">Member!</span></h2>
                        <p id="memberStatus">Loading your membership status…</p>
                    </div>
                    <button class="btn-primary" onclick="showQRCode()">
                        <i class="fas fa-qrcode"></i> My QR Code
                    </button>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Membership Plan</div>
                        <div class="stat-value" id="statPlan" style="font-size:1.4rem;">—</div>
                        <div class="stat-sub"><i class="fas fa-id-card"></i> <span id="statPlanSub">—</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Days Remaining</div>
                        <div class="stat-value" id="statDaysLeft">0</div>
                        <div class="stat-sub"><i class="fas fa-hourglass-half"></i> Until expiry</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Visits This Month</div>
                        <div class="stat-value" id="statVisits">0</div>
                        <div class="stat-sub"><i class="fas fa-dumbbell"></i> Gym check-ins</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Total Visits</div>
                        <div class="stat-value" id="statTotalVisits">0</div>
                        <div class="stat-sub"><i class="fas fa-fire"></i> All-time</div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h2><i class="fas fa-chart-line"></i> Membership Progress</h2>
                    </div>
                    <div id="progressBarWrap"></div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h2><i class="fas fa-clock"></i> Recent Check-ins</h2>
                    </div>
                    <div id="recentAttendance"></div>
                </div>
            </div>

            <!-- PROGRESS -->
            <div id="section-progress" class="admin-section hidden">
                <div class="panel">
                    <div class="panel-header">
                        <h2><i class="fas fa-chart-line"></i> Membership Progress</h2>
                    </div>
                    <div id="progressDetail"></div>
                </div>
                <div class="panel">
                    <div class="panel-header">
                        <h2><i class="fas fa-calendar-alt"></i> Visit Frequency (Last 8 Weeks)</h2>
                    </div>
                    <div id="weeklyChart" style="display:flex; align-items:flex-end; gap:10px; height:180px; padding:12px 0;"></div>
                </div>
                <div class="panel">
                    <div class="panel-header">
                        <h2><i class="fas fa-bullseye"></i> Fitness Goal</h2>
                    </div>
                    <div id="goalCard"></div>
                </div>
            </div>

            -- ATTENDANCE --
            <div id="section-attendance" class="admin-section hidden">
                <div class="panel">
                    <div class="panel-header">
                        <h2><i class="fas fa-calendar-check"></i> My Attendance History</h2>
                        <select id="attendanceRange" class="btn-sm" onchange="renderMyAttendance()" style="background:#0d1219; color:#e8edf5; border:1px solid #1e2533; padding:8px 12px; border-radius:12px; font-family:inherit;">
                            <option value="7">Last 7 days</option>
                            <option value="30" selected>Last 30 days</option>
                            <option value="90">Last 90 days</option>
                            <option value="0">All time</option>
                        </select>
                    </div>
                    <div class="stats-grid" style="margin-bottom:20px;">
                        <div class="stat-card">
                            <div class="stat-label">Sessions</div>
                            <div class="stat-value" id="attSessions" style="font-size:1.5rem;">0</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Avg. Duration</div>
                            <div class="stat-value" id="attAvg" style="font-size:1.5rem;">—</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Longest Session</div>
                            <div class="stat-value" id="attLongest" style="font-size:1.5rem;">—</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Current Streak</div>
                            <div class="stat-value" id="attStreak" style="font-size:1.5rem;">0 <span style="font-size:0.8rem;color:#8b95a9;">days</span></div>
                        </div>
                    </div>
                    <div id="myAttendanceTable"></div>
                </div>
            </div>

            -- STORE (VIEW ONLY) --
            <div id="section-store" class="admin-section hidden">
                <div class="panel">
                    <div class="panel-header">
                        <h2><i class="fas fa-store"></i> Gym Store — Available Products</h2>
                    </div>
                    <div style="background:rgba(241,196,15,0.08); border:1px solid rgba(241,196,15,0.25); border-radius:14px; padding:12px 16px; margin-bottom:16px; font-size:0.82rem; color:#c5cbd8;">
                        <i class="fas fa-info-circle" style="color:#f1c40f;"></i>
                        Browse our available supplements and merchandise. To purchase, please visit the gym counter.
                    </div>
                    <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:12px; color:#8b95a9;">Supplements</h3>
                    <div class="supplement-grid" id="customerSupplementsGrid"></div>
                    <h3 style="font-size:0.9rem; font-weight:600; margin:24px 0 12px; color:#8b95a9;">Merchandise</h3>
                    <div class="supplement-grid" id="customerMerchGrid"></div>
                </div>
            </div>
        </main>
    </div>
</div>

<div id="modalOverlay" class="modal-overlay hidden" onclick="if(event.target===this) closeModal()">
    <div class="modal-content" id="modalContent"></div>
</div>
<div id="toast" class="toast hidden"></div>

<script src="customer.js"></script>
</body>
</html>
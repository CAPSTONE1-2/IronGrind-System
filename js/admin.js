<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IronGrind · Admin Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
<div id="page-loader"><div class="loader-logo">IronGrind</div><div class="loader-bar"></div></div>
<div class="app">
    <header class="app-header">
        <div class="logo-area">
            <div class="logo-icon">IG</div>
            <div class="logo-text"><h1>Iron<span>Grind</span></h1><p>Admin Dashboard</p></div>
        </div>
        <div class="header-actions">
            <div class="user-chip"><i class="fas fa-user-shield"></i><span id="currentUserName">Admin</span></div>
            <button class="btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
        </div>
    </header>

    <div class="dashboard">
        <aside class="sidebar">
            <button class="nav-item active" data-section="dashboard" onclick="showAdminSection('dashboard', event)"><i class="fas fa-th-large"></i> Dashboard</button>
            <div class="nav-section-label">Management</div>
            <button class="nav-item" data-section="membership" onclick="showAdminSection('membership', event)"><i class="fas fa-users"></i> Membership <span class="badge" id="pendingBadge">0</span></button>
            <button class="nav-item" data-section="attendance" onclick="showAdminSection('attendance', event)"><i class="fas fa-qrcode"></i> Attendance</button>
            <button class="nav-item" data-section="store" onclick="showAdminSection('store', event)"><i class="fas fa-store"></i> Store</button>
            <button class="nav-item" data-section="sales" onclick="showAdminSection('sales', event)"><i class="fas fa-receipt"></i> Sales</button>
            <button class="nav-item" data-section="reports" onclick="showAdminSection('reports', event)"><i class="fas fa-chart-bar"></i> Reports</button>
        </aside>

        <main class="main-content">
            <div id="section-dashboard" class="admin-section">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-label">Total Members</div><div class="stat-value" id="statTotalMembers">0</div></div>
                    <div class="stat-card"><div class="stat-label">Today's Check-ins</div><div class="stat-value" id="statCheckins">0</div></div>
                    <div class="stat-card"><div class="stat-label">Today's Sales</div><div class="stat-value" id="statSales">₱0</div></div>
                    <div class="stat-card"><div class="stat-label">Low Stock Items</div><div class="stat-value" id="statLowStock" style="color:#ff4d1a;">0</div></div>
                </div>
                <div class="panel"><div class="panel-header"><h2><i class="fas fa-clock"></i> Today's Attendance</h2></div><div id="dashboardAttendanceTable"></div></div>
                <div class="panel"><div class="panel-header"><h2><i class="fas fa-exclamation-triangle" style="color:#ff4d1a;"></i> Low Stock</h2></div><div class="low-stock-list" id="lowStockList"></div></div>
            </div>

            <div id="section-membership" class="admin-section hidden">
                <div class="panel">
                    <div class="panel-header"><h2><i class="fas fa-users"></i> Membership</h2><button class="btn-primary" onclick="openWalkInModal()"><i class="fas fa-plus"></i> Walk-in</button></div>
                    <div class="admin-tabs">
                        <button class="admin-tab active" data-tab="members" onclick="switchMemberTab('members')">Active Members</button>
                        <button class="admin-tab" data-tab="approvals" onclick="switchMemberTab('approvals')">Pending <span class="badge" id="approvalsCount">0</span></button>
                    </div>
                    <div id="tab-members"><div id="membersList"></div></div>
                    <div id="tab-approvals" class="hidden"><div id="approvalsList"></div></div>
                </div>
            </div>

            <div id="section-attendance" class="admin-section hidden">
                <div class="panel">
                    <div class="panel-header"><h2><i class="fas fa-qrcode"></i> Attendance</h2><button class="btn-sm" onclick="simulateQRScan()"><i class="fas fa-camera"></i> Simulate Scan</button></div>
                    <div class="qr-scanner-box" onclick="simulateQRScan()"><i class="fas fa-camera"></i><h3>Tap to Scan QR</h3></div>
                    <div id="attendanceLogTable"></div>
                </div>
            </div>

            <div id="section-store" class="admin-section hidden">
                <div id="storeLocked" class="store-lock">
                    <i class="fas fa-lock"></i><h3>Store Locked</h3>
                    <div class="password-input-group"><input type="password" id="storePasswordInput" placeholder="Password"><button class="btn-primary" onclick="unlockStore()"><i class="fas fa-unlock"></i></button></div>
                </div>
                <div id="storeUnlocked" class="hidden">
                    <div class="panel">
                        <div class="panel-header"><h2><i class="fas fa-store"></i> Inventory</h2><div style="display:flex; gap:8px;"><button class="btn-sm" onclick="openAddProductModal()">Add Product</button><button class="btn-primary" onclick="openNewSaleModal()">New Sale</button></div></div>
                        <div class="product-grid" id="supplementsGrid"></div>
                        <div class="product-grid" id="merchGrid"></div>
                    </div>
                </div>
            </div>

            <div id="section-sales" class="admin-section hidden">
                <div class="panel"><div class="panel-header"><h2><i class="fas fa-receipt"></i> Sales</h2></div><div id="salesTable"></div></div>
            </div>

            <div id="section-reports" class="admin-section hidden">
                <div class="panel"><div class="panel-header"><h2><i class="fas fa-chart-bar"></i> Reports</h2></div><div class="product-grid" id="reportsGrid"></div></div>
            </div>
        </main>
    </div>
</div>
<div id="modalOverlay" class="modal-overlay hidden" onclick="if(event.target===this) closeModal()"><div class="modal-content" id="modalContent"></div></div>
<div id="toast" class="toast hidden"></div>
<script src="admin.js"></script>
</body>
</html>
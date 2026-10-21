/* ========== AUTH GUARD ========== */
(function guardAdmin() {
    const session = JSON.parse(
        localStorage.getItem('irongrind_session') ||
        sessionStorage.getItem('irongrind_session') || 'null'
    );
    if (!session || session.role !== 'admin') {
        window.location.href = 'index.html?role=admin';
        return;
    }
    document.getElementById('currentUserName').textContent = session.username;
})();

/* ========== STATE ========== */
let members = [];
let products = [];
let sales = [];
let attendance = [];
let pendingApprovals = [];
let users = [];
let currentPlanFilter = 'all';
let currentMemberTab = 'members';

/* ========== HELPERS ========== */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
function formatPeso(n) { return '₱' + Number(n).toLocaleString('en-PH'); }
function uid(prefix) { return prefix + Math.floor(Math.random() * 9000 + 1000); }
function initials(name) { return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(); }
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function loadDB(key) {
    try { return JSON.parse(localStorage.getItem('ig_' + key)) || []; }
    catch { return []; }
}
function saveDB(key, data) { localStorage.setItem('ig_' + key, JSON.stringify(data)); }

/* ========== TOAST & MODAL ========== */
let toastTimer;
function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}
function openModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }
function printQRCode() {
    document.body.classList.add('print-qr-only');
    const cleanup = () => document.body.classList.remove('print-qr-only');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
}
let pendingConfirmationAction = null;
function escapeDialogText(value) {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
}
function askConfirmation(title, message, actionLabel, callback, danger = false) {
    pendingConfirmationAction = callback;
    openModal(`<div class="confirm-dialog">
        <div class="confirm-dialog-icon"><i class="fas ${danger ? 'fa-triangle-exclamation' : 'fa-circle-question'}"></i></div>
        <h3>${escapeDialogText(title)}</h3>
        <p class="modal-sub">${escapeDialogText(message)}</p>
        <div class="modal-actions">
            <button class="btn-sm" onclick="cancelConfirmation()">Cancel</button>
            <button class="${danger ? 'btn-danger' : 'btn-primary'}" onclick="runConfirmation()">${escapeDialogText(actionLabel)}</button>
        </div>
    </div>`);
}
function cancelConfirmation() {
    pendingConfirmationAction = null;
    closeModal();
}
function runConfirmation() {
    const callback = pendingConfirmationAction;
    pendingConfirmationAction = null;
    closeModal();
    callback?.();
}

/* ========== NAV ========== */
function showAdminSection(section, event) {
    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
    const clicked = event?.target?.closest('.nav-item') || document.querySelector(`[data-section="${section}"]`);
    if (clicked) clicked.classList.add('active');

    if (section === 'store') {
        document.getElementById('storeLocked').classList.remove('hidden');
        document.getElementById('storeUnlocked').classList.add('hidden');
        document.getElementById('storePasswordInput').value = '';
    }
    if (section === 'membership') switchMemberTab(currentMemberTab);
    if (section === 'attendance') renderAttendance();
    if (section === 'sales') renderSales();
    if (section === 'reports') renderReports();
    if (section === 'dashboard') renderDashboard();
}

function switchMemberTab(tab) {
    currentMemberTab = tab;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('tab-members').classList.toggle('hidden', tab !== 'members');
    document.getElementById('tab-approvals').classList.toggle('hidden', tab !== 'approvals');
    if (tab === 'approvals') renderApprovals();
    else renderMembers();
}

function logout() {
    askConfirmation('Log out?', 'Are you sure you want to log out?', 'Log out', () => {
        localStorage.removeItem('irongrind_session');
        sessionStorage.removeItem('irongrind_session');
        document.getElementById('page-loader')?.classList.remove('hidden-loader');
        window.setTimeout(() => window.location.replace('index.html'), 350);
    }, true);
}

/* ========== RENDER: DASHBOARD ========== */
function renderDashboard() {
    document.getElementById('statTotalMembers').textContent = members.length;

    const today = todayStr();
    const todayAtt = attendance.filter(a => a.date === today);
    const inside = todayAtt.filter(a => !a.timeOut).length;
    document.getElementById('statCheckins').textContent = todayAtt.length;
    document.getElementById('statInside').textContent = inside;

    const todaySales = sales.filter(s => s.date === today && s.status === 'Paid');
    const total = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
    document.getElementById('statSales').textContent = formatPeso(total);

    const low = products.filter(p => p.stock <= 4);
    document.getElementById('statLowStock').textContent = low.length;

    const attTable = document.getElementById('dashboardAttendanceTable');
    if (todayAtt.length === 0) attTable.innerHTML = '<div class="empty-state">No check-ins yet today.</div>';
    else attTable.innerHTML = `
        <table class="attendance-table">
            <thead><tr><th>Member</th><th>Time In</th><th>Time Out</th><th>Status</th></tr></thead>
            <tbody>${todayAtt.map(a => `
                <tr><td>${a.memberName}</td><td>${a.timeIn}</td><td>${a.timeOut || '—'}</td>
                <td>${a.timeOut ? '<span class="badge-status out">Checked Out</span>' : '<span class="badge-status in">Inside</span>'}</td></tr>
            `).join('')}</tbody>
        </table>`;

    const lowList = document.getElementById('lowStockList');
    if (low.length === 0) lowList.innerHTML = '<div class="empty-state">All items are well-stocked.</div>';
    else lowList.innerHTML = low.map(p => `<div class="low-stock-item"><span class="name">${p.name}${p.size ? ' — ' + p.size : ''}</span><span class="qty">${p.stock} left</span></div>`).join('');

    const pendingCount = pendingApprovals.filter(p => p.status === 'pending').length;
    document.getElementById('pendingBadge').textContent = pendingCount;
    document.getElementById('approvalsCount').textContent = pendingCount;
}

/* ========== RENDER: MEMBERS ========== */
function renderMembers() {
    const searchEl = document.getElementById('memberSearch');
    const query = searchEl ? searchEl.value.toLowerCase() : '';

    let filtered = members.filter(m => {
        if (currentPlanFilter !== 'all' && m.plan !== currentPlanFilter) return false;
        if (query && !m.name.toLowerCase().includes(query)) return false;
        return true;
    });

    const listEl = document.getElementById('membersList');
    if (filtered.length === 0) { listEl.innerHTML = '<div class="empty-state">No members found.</div>'; return; }

    const today = todayStr();
    listEl.innerHTML = filtered.map(m => {
        const expired = m.expiry < today;
        const statusClass = expired ? 'expired' : (m.paid ? '' : 'pending');
        const statusText = expired ? 'Expired' : (m.paid ? 'Paid' : 'Pending');
        return `
            <div class="member-row">
                <div class="member-info">
                    <div class="member-avatar">${initials(m.name)}</div>
                    <div class="member-details">
                        <h4>${m.name}</h4>
                        <p>${m.plan} · Expires ${m.expiry}${expired ? ' · EXPIRED' : ''}</p>
                    </div>
                </div>
                <div class="member-actions">
                    <button class="qr-badge" onclick="showMemberQR('${m.id}')"><i class="fas fa-qrcode"></i> QR</button>
                    <button class="renew-btn" onclick="renewMember('${m.id}')"><i class="fas fa-sync-alt"></i> Renew</button>
                    <span class="approve-badge ${statusClass}">${statusText}</span>
                </div>
            </div>`;
    }).join('');
}

function filterPlan(plan) {
    currentPlanFilter = plan;
    document.querySelectorAll('#planPills .pill').forEach(p => p.classList.toggle('active', p.dataset.plan === plan));
    renderMembers();
}

/* ========== RENDER: APPROVALS ========== */
function renderApprovals() {
    const el = document.getElementById('approvalsList');
    const pending = pendingApprovals.filter(p => p.status === 'pending');
    document.getElementById('approvalsCount').textContent = pending.length;

    if (pending.length === 0) {
        el.innerHTML = '<div class="empty-state">No pending applications.</div>';
        return;
    }

    el.innerHTML = pending.map(p => `
        <div style="background:#0d1219; border:1px solid #1e2533; border-left:4px solid #f1c40f; border-radius:18px; padding:20px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                <div class="member-info">
                    <div class="member-avatar">${initials(p.fullName)}</div>
                    <div class="member-details">
                        <h4>${p.fullName}</h4>
                        <p>Applied ${new Date(p.submittedAt).toLocaleString()}</p>
                    </div>
                </div>
                <span class="badge-status reserved">Pending</span>
            </div>
            <div style="background:#11161f; border-radius:14px; padding:16px; margin-bottom:16px;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem;">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Age · Sex</span>
                        <span>${p.age || '—'} · ${p.sex || '—'}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem;">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Mobile</span>
                        <span>${p.mobile || p.contact || '—'}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem;">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Plan</span>
                        <span><strong>${p.plan || 'Renewal'}</strong> — ₱${Number(p.planPrice || 0).toLocaleString('en-PH')}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem;">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Dates</span>
                        <span>${p.startDate || '—'} → ${p.endDate || '—'}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem;">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Emergency Contact</span>
                        <span>${p.emergencyContact ? `${p.emergencyContact.name} (${p.emergencyContact.relationship}) · ${p.emergencyContact.contact}` : 'Not provided for renewal'}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem;">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Username</span>
                        <span><code style="color:#ff6b2b;">${p.username}</code></span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; font-size:0.82rem;">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Other Medical Conditions</span>
                        <span>${p.otherMedicalConditions ? escapeHTML(p.otherMedicalConditions) : 'None reported'}</span>
                    </div>
                </div>
            </div>
            ${p.signature ? `<div style="background:#11161f; border-radius:14px; padding:16px; margin-bottom:16px;"><div style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600; margin-bottom:8px;">Member Signature over Printed Name</div><img src="${p.signature}" alt="${p.fullName}'s digital signature" style="display:block; max-width:100%; width:360px; height:120px; object-fit:contain; background:#fff; border-radius:8px;"><div style="margin-top:8px; color:#e8edf5; font-size:0.85rem;">${escapeHTML(p.signatureName || p.fullName)}</div></div>` : ''}
            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn-sm" onclick="rejectApplication('${p.id}')"><i class="fas fa-times"></i> Reject</button>
                <button class="btn-primary" onclick="approveApplication('${p.id}')"><i class="fas fa-check-circle"></i> Approve &amp; Create Account</button>
            </div>
        </div>
    `).join('');
}

/* ========== APPROVE / REJECT ========== */
function approveApplication(id) {
    const idx = pendingApprovals.findIndex(x => x.id === id);
    if (idx === -1) return;
    const p = pendingApprovals[idx];
    askConfirmation('Approve application?', `Approve ${p.fullName}? This will create their account and generate their QR code.`, 'Approve', () => completeApproval(id));
}

function completeApproval(id) {
    const idx = pendingApprovals.findIndex(x => x.id === id);
    if (idx === -1) return;
    const p = pendingApprovals[idx];

    users.push({
        username: p.username,
        password: p.password,
        fullName: p.fullName,
        role: 'customer',
        createdAt: new Date().toISOString()
    });
    saveDB('users', users);

    const newMember = {
        id: uid('M'),
        name: p.fullName,
        plan: p.plan,
        startDate: p.startDate,
        expiry: p.endDate,
        status: 'active',
        paid: true,
        goal: p.goals[0] || 'General Fitness',
        contact: p.mobile,
        username: p.username,
        healthConditions: p.healthConditions || [],
        otherMedicalConditions: p.otherMedicalConditions || '',
        signature: p.signature || null,
        signatureName: p.signatureName || p.fullName,
        qrCode: 'IRONGRIND|' + p.username
    };
    members.push(newMember);
    saveDB('members', members);

    sales.unshift({
        id: 'IG-' + Date.now().toString().slice(-4),
        customer: p.fullName,
        items: p.plan + ' Membership',
        total: p.planPrice,
        date: todayStr(),
        status: 'Paid'
    });
    saveDB('sales', sales);

    pendingApprovals.splice(idx, 1);
    saveDB('pendingApprovals', pendingApprovals);

    showApprovalSuccessModal(p, newMember);
    renderApprovals();
    renderMembers();
    renderDashboard();
}

function showApprovalSuccessModal(p, member) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(member.qrCode)}`;
    openModal(`
        <div style="text-align:center; padding:8px 0;">
            <div style="width:72px; height:72px; border-radius:50%; background:rgba(46,204,113,0.15); color:#2ecc71; display:flex; align-items:center; justify-content:center; font-size:2rem; margin:0 auto 16px;">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3 style="justify-content:center; display:flex;"><i class="fas fa-check-circle"></i> Membership Approved!</h3>
            <p class="modal-sub" style="text-align:center;"><strong>${p.fullName}</strong> is now an active member.</p>
            <div style="background:#fff; padding:16px; border-radius:20px; display:inline-block; margin:16px 0;">
                <img src="${qrUrl}" alt="QR" style="width:200px; height:200px;">
            </div>
            <div class="qr-print-card"><div class="qr-print-gym">Iron Grind Fitness Gym</div><img src="${qrUrl}" alt="Member QR code"></div>
            <div style="background:#0d1219; border:1px solid #1e2533; border-radius:16px; padding:16px; text-align:left; font-size:0.85rem;">
                <div style="font-size:0.75rem; text-transform:uppercase; color:#6a748b; font-weight:600; margin-bottom:12px;">Send to Member — Credentials</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Username:</span><code style="color:#ff6b2b; font-weight:700;">${p.username}</code></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Password:</span><code style="color:#ff6b2b; font-weight:700;">${p.password}</code></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Member ID:</span><span>${member.id}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#8b95a9;">Valid Until:</span><span>${p.endDate}</span></div>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn-sm" onclick="copyCredentials('${p.username}', '${p.password}')"><i class="fas fa-copy"></i> Copy</button>
            <button class="btn-primary" onclick="printQRCode()"><i class="fas fa-print"></i> Print</button>
        </div>
    `);
}

function copyCredentials(username, password) {
    const text = `Iron Grind Fitness Gym\nUsername: ${username}\nPassword: ${password}`;
    navigator.clipboard.writeText(text).then(() => toast('Credentials copied!', 'success')).catch(() => toast('Clipboard unavailable. Copy the credentials from the approval details.', 'error'));
}

function rejectApplication(id) {
    const idx = pendingApprovals.findIndex(x => x.id === id);
    if (idx === -1) return;
    const p = pendingApprovals[idx];
    askConfirmation('Reject application?', `Reject ${p.fullName}'s application?`, 'Reject', () => completeRejection(id), true);
}

function completeRejection(id) {
    const idx = pendingApprovals.findIndex(x => x.id === id);
    if (idx === -1) return;
    pendingApprovals.splice(idx, 1);
    saveDB('pendingApprovals', pendingApprovals);
    renderApprovals();
    renderDashboard();
    toast('Application rejected.', 'error');
}

/* ========== WALK-IN MEMBERSHIP (FULL FORM) ========== */
let signaturePad = null;

function openWalkInModal() {
    openModal(`
        <h3 style="display:flex; align-items:center; gap:10px;"><i class="fas fa-user-plus"></i> Walk-in Membership Registration</h3>
        <p class="modal-sub">Complete the same form used for online registration. Includes digital signature.</p>

        <!-- PERSONAL INFORMATION -->
        <div style="background:#0d1219; border:1px solid #1e2533; border-radius:14px; padding:18px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #1e2533;">
                <i class="fas fa-user" style="color:#ff6b2b;"></i><span>Personal Information</span>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Full Name *</label><input type="text" id="wiName" placeholder="Juan Dela Cruz"></div>
                <div class="form-group"><label>Date of Birth *</label><input type="date" id="wiDob"></div>
            </div>
            <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;">
                <div class="form-group"><label>Age</label><input type="number" id="wiAge" readonly></div>
                <div class="form-group"><label>Sex</label>
                    <select id="wiSex">
                        <option>Male</option><option>Female</option><option>Prefer not to say</option>
                    </select>
                </div>
                <div class="form-group"><label>Mobile *</label><input type="tel" id="wiContact" placeholder="0917 123 4567"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Height (cm)</label><input type="number" id="wiHeight" placeholder="170"></div>
                <div class="form-group"><label>Weight (kg)</label><input type="number" id="wiWeight" placeholder="65"></div>
            </div>
        </div>

        <!-- EMERGENCY CONTACT -->
        <div style="background:#0d1219; border:1px solid #1e2533; border-radius:14px; padding:18px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #1e2533;">
                <i class="fas fa-phone" style="color:#ff6b2b;"></i><span>Emergency Contact</span>
            </div>
            <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;">
                <div class="form-group"><label>Name *</label><input type="text" id="wiEcName" placeholder="Maria Dela Cruz"></div>
                <div class="form-group"><label>Relationship *</label><input type="text" id="wiEcRelation" placeholder="Mother"></div>
                <div class="form-group"><label>Contact Number *</label><input type="tel" id="wiEcContact" placeholder="0917 123 4567"></div>
            </div>
        </div>

        <!-- MEMBERSHIP DETAILS -->
        <div style="background:#0d1219; border:1px solid #1e2533; border-radius:14px; padding:18px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #1e2533;">
                <i class="fas fa-id-card" style="color:#ff6b2b;"></i><span>Membership Details</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:16px;">
                <label style="cursor:pointer; background:#11161f; border:2px solid #1e2533; border-radius:12px; padding:12px; display:block;">
                    <input type="radio" name="wiPlan" value="Monthly|800" required style="accent-color:#ff6b2b; margin-right:6px;">
                    <span style="font-weight:600; font-size:0.85rem;">Monthly</span>
                    <div style="font-size:1rem; font-weight:700; color:#ff6b2b; margin-top:4px;">₱800</div>
                </label>
                <label style="cursor:pointer; background:#11161f; border:2px solid #1e2533; border-radius:12px; padding:12px; display:block;">
                    <input type="radio" name="wiPlan" value="Half Month|400" style="accent-color:#ff6b2b; margin-right:6px;">
                    <span style="font-weight:600; font-size:0.85rem;">Half Month</span>
                    <div style="font-size:1rem; font-weight:700; color:#ff6b2b; margin-top:4px;">₱400</div>
                </label>
                <label style="cursor:pointer; background:#11161f; border:2px solid #1e2533; border-radius:12px; padding:12px; display:block;">
                    <input type="radio" name="wiPlan" value="Walk-in|80" style="accent-color:#ff6b2b; margin-right:6px;">
                    <span style="font-weight:600; font-size:0.85rem;">Walk-in</span>
                    <div style="font-size:1rem; font-weight:700; color:#ff6b2b; margin-top:4px;">₱80/day</div>
                </label>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Start Date</label><input type="date" id="wiStartDate" readonly></div>
                <div class="form-group"><label>End Date</label><input type="date" id="wiEndDate" readonly></div>
            </div>
        </div>

        <!-- HEALTH & GOAL -->
        <div style="background:#0d1219; border:1px solid #1e2533; border-radius:14px; padding:18px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #1e2533;">
                <i class="fas fa-heartbeat" style="color:#ff6b2b;"></i><span>Health Declaration &amp; Fitness Goal</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div>
                    <p style="font-size:0.75rem; color:#8b95a9; margin-bottom:10px;">Health conditions:</p>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" id="wiHcBp" style="accent-color:#ff6b2b;"> High Blood Pressure</label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" id="wiHcHeart" style="accent-color:#ff6b2b;"> Heart Condition</label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" id="wiHcAsthma" style="accent-color:#ff6b2b;"> Asthma</label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" id="wiHcInjury" style="accent-color:#ff6b2b;"> Recent Injury/Surgery</label>
                    </div>
                </div>
                <div>
                    <p style="font-size:0.75rem; color:#8b95a9; margin-bottom:10px;">Fitness goal:</p>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" name="wiGoal" value="Weight Loss" style="accent-color:#ff6b2b;"> Weight Loss</label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" name="wiGoal" value="Muscle Gain" style="accent-color:#ff6b2b;"> Muscle Gain</label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" name="wiGoal" value="Strength" style="accent-color:#ff6b2b;"> Strength</label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.8rem;"><input type="checkbox" name="wiGoal" value="General Fitness" style="accent-color:#ff6b2b;"> General Fitness</label>
                    </div>
                </div>
            </div>
        </div>

        <!-- DIGITAL SIGNATURE -->
        <div style="background:#0d1219; border:1px solid #1e2533; border-radius:14px; padding:18px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #1e2533;">
                <i class="fas fa-signature" style="color:#ff6b2b;"></i><span>Digital Signature</span>
            </div>
            <p style="font-size:0.75rem; color:#8b95a9; margin-bottom:10px;">Sign with your finger (mobile) or mouse (desktop).</p>
            <div style="background:#fff; border-radius:12px; overflow:hidden; position:relative;">
                <canvas id="signatureCanvas" style="width:100%; height:180px; display:block; touch-action:none; cursor:crosshair;"></canvas>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <small style="color:#6a748b; font-size:0.7rem;">Signature required before submitting.</small>
                <button type="button" class="btn-sm" onclick="clearSignature()"><i class="fas fa-eraser"></i> Clear</button>
            </div>
        </div>

        <!-- ACTIONS -->
        <div class="modal-actions" style="position:sticky; bottom:0; background:#11161f; padding-top:12px;">
            <button class="btn-sm" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitWalkIn()"><i class="fas fa-check"></i> Register &amp; Generate QR</button>
        </div>
    `);

    // ---- Attach signature pad AFTER the modal HTML is in the DOM ----
    setTimeout(() => {
        const canvas = document.getElementById('signatureCanvas');
        if (!canvas || typeof SignaturePad === 'undefined') return;

        // Handle high-DPI displays so signature stays crisp
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        const ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);

        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgba(255,255,255,0)',
            penColor: '#11161f',
            minWidth: 1,
            maxWidth: 2.5
        });
    }, 100);

    // ---- Auto-compute age from DOB ----
    setTimeout(() => {
        const dobInput = document.getElementById('wiDob');
        if (dobInput) {
            dobInput.addEventListener('change', function () {
                const dob = new Date(this.value);
                if (isNaN(dob)) return;
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                document.getElementById('wiAge').value = age >= 0 ? age : '';
            });
        }

        // ---- Auto-compute end date from plan ----
        const updateWiDates = () => {
            const plan = document.querySelector('input[name="wiPlan"]:checked');
            if (!plan) return;
            const name = plan.value.split('|')[0];
            const days = name === 'Monthly' ? 30 : name === 'Half Month' ? 15 : 1;
            const start = todayStr();
            document.getElementById('wiStartDate').value = start;
            document.getElementById('wiEndDate').value = addDays(start, days);
        };
        document.querySelectorAll('input[name="wiPlan"]').forEach(r => r.addEventListener('change', updateWiDates));
    }, 100);
}

function clearSignature() {
    if (signaturePad) signaturePad.clear();
}

function submitWalkIn() {
    // ---- Personal ----
    const name = document.getElementById('wiName').value.trim();
    const dob = document.getElementById('wiDob').value;
    const age = Number(document.getElementById('wiAge').value);
    const sex = document.getElementById('wiSex').value;
    const contact = document.getElementById('wiContact').value.trim();
    const height = document.getElementById('wiHeight').value;
    const weight = document.getElementById('wiWeight').value;

    // ---- Emergency ----
    const ecName = document.getElementById('wiEcName').value.trim();
    const ecRelation = document.getElementById('wiEcRelation').value.trim();
    const ecContact = document.getElementById('wiEcContact').value.trim();

    // ---- Plan ----
    const planInput = document.querySelector('input[name="wiPlan"]:checked');
    if (!planInput) { toast('Please select a membership plan.', 'error'); return; }
    const [plan, price] = planInput.value.split('|');
    const startDate = document.getElementById('wiStartDate').value || todayStr();
    const endDate = document.getElementById('wiEndDate').value;
    const days = plan === 'Monthly' ? 30 : plan === 'Half Month' ? 15 : 1;

    // ---- Health ----
    const healthConditions = [];
    if (document.getElementById('wiHcBp').checked) healthConditions.push('High Blood Pressure');
    if (document.getElementById('wiHcHeart').checked) healthConditions.push('Heart Condition');
    if (document.getElementById('wiHcAsthma').checked) healthConditions.push('Asthma');
    if (document.getElementById('wiHcInjury').checked) healthConditions.push('Recent Injury');

    // ---- Goals ----
    const goals = Array.from(document.querySelectorAll('input[name="wiGoal"]:checked')).map(g => g.value);

    // ---- Validation ----
    if (!name) { toast('Full Name is required.', 'error'); return; }
    if (!dob) { toast('Date of Birth is required.', 'error'); return; }
    if (age < 12) { toast('Member must be at least 12 years old.', 'error'); return; }
    if (!contact) { toast('Mobile Number is required.', 'error'); return; }
    if (!ecName || !ecRelation || !ecContact) { toast('Emergency contact is required.', 'error'); return; }

    // ---- SIGNATURE VALIDATION ----
    if (!signaturePad || signaturePad.isEmpty()) {
        toast('Digital signature is required.', 'error');
        return;
    }
    const signatureData = signaturePad.toDataURL('image/png');

    // ---- Create Member ----
    const memberId = uid('M');
    members.push({
        id: memberId,
        name,
        plan,
        startDate: startDate,
        expiry: endDate || addDays(startDate, days),
        status: 'active',
        paid: true,
        goal: goals[0] || 'General Fitness',
        contact,
        dob, age, sex, height, weight,
        healthConditions,
        emergencyContact: { name: ecName, relationship: ecRelation, contact: ecContact },
        signature: signatureData,   // base64 PNG
        registeredAt: new Date().toISOString(),
        qrCode: 'IRONGRIND|' + memberId + '|' + name
    });
    saveDB('members', members);

    // ---- Record Sale ----
    sales.unshift({
        id: 'IG-' + Date.now().toString().slice(-4),
        customer: name,
        items: plan + ' Membership (Walk-in)',
        total: Number(price),
        date: todayStr(),
        status: 'Paid'
    });
    saveDB('sales', sales);

    // ---- Close & Refresh ----
    signaturePad = null;
    closeModal();
    renderMembers();
    renderDashboard();
    toast(`✅ ${name} registered with signature.`, 'success');

    // ---- Show QR for the new member ----
    setTimeout(() => showMemberQR(memberId), 400);
}

function renewMember(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const days = m.plan === 'Monthly' ? 30 : m.plan === 'Half Month' ? 15 : 1;
    const price = m.plan === 'Monthly' ? 800 : m.plan === 'Half Month' ? 400 : 80;
    askConfirmation('Renew membership?', `Renew ${m.name}'s ${m.plan} membership for ${formatPeso(price)}?`, 'Renew', () => completeMemberRenewal(id), false);
}

function completeMemberRenewal(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const days = m.plan === 'Monthly' ? 30 : m.plan === 'Half Month' ? 15 : 1;
    const price = m.plan === 'Monthly' ? 800 : m.plan === 'Half Month' ? 400 : 80;
    m.startDate = todayStr();
    m.expiry = addDays(todayStr(), days);
    m.paid = true;
    saveDB('members', members);
    sales.unshift({ id: 'IG-' + Date.now().toString().slice(-4), customer: m.name, items: m.plan + ' Renewal', total: price, date: todayStr(), status: 'Paid' });
    saveDB('sales', sales);
    renderMembers();
    renderDashboard();
    toast(`✅ ${m.name} renewed until ${m.expiry}.`, 'success');
}

function showMemberQR(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('IRONGRIND|' + m.id + '|' + m.name)}`;
    openModal(`
        <h3><i class="fas fa-qrcode"></i> Member QR</h3>
        <p class="modal-sub">${m.name} · ${m.id}</p>
        <div style="text-align:center; padding:20px; background:#fff; border-radius:20px;"><img src="${qrUrl}" style="width:200px;height:200px;"></div>
        <div class="qr-print-card"><div class="qr-print-gym">Iron Grind Fitness Gym</div><img src="${qrUrl}" alt="Member QR code"></div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Close</button><button class="btn-primary" onclick="printQRCode()"><i class="fas fa-print"></i> Print</button></div>
    `);
}

/* ========== ATTENDANCE ========== */
function renderAttendance() {
    const today = todayStr();
    const todayAtt = attendance.filter(a => a.date === today);
    const el = document.getElementById('attendanceLogTable');
    if (todayAtt.length === 0) { el.innerHTML = '<div class="empty-state">No attendance records for today.</div>'; return; }
    el.innerHTML = `
        <table class="attendance-table">
            <thead><tr><th>Member</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${todayAtt.map(a => `
                <tr><td>${a.memberName}</td><td>${a.timeIn}</td><td>${a.timeOut || '—'}</td>
                <td>${a.timeOut ? '<span class="badge-status out">Checked Out</span>' : '<span class="badge-status in">Inside</span>'}</td>
                <td>${a.timeOut ? '' : `<button class="btn-sm" onclick="checkOut('${a.id}')">Check Out</button>`}</td></tr>
            `).join('')}</tbody>
        </table>`;
}

function simulateQRScan() {
    const active = members.filter(m => m.expiry >= todayStr());
    if (active.length === 0) { toast('No active members.', 'error'); return; }
    const random = active[Math.floor(Math.random() * active.length)];
    const today = todayStr();
    if (attendance.find(a => a.memberId === random.id && a.date === today && !a.timeOut)) {
        toast(`${random.name} is already inside.`, 'error'); return;
    }
    const timeIn = new Date().toTimeString().slice(0, 5);
    attendance.push({ id: uid('A'), memberId: random.id, memberName: random.name, date: today, timeIn, timeOut: null });
    saveDB('attendance', attendance);
    renderAttendance();
    renderDashboard();
    toast(`✅ ${random.name} checked in at ${timeIn}.`, 'success');
}

function checkOut(id) {
    const a = attendance.find(x => x.id === id);
    if (!a) return;
    a.timeOut = new Date().toTimeString().slice(0, 5);
    saveDB('attendance', attendance);
    renderAttendance();
    renderDashboard();
    toast(`${a.memberName} checked out.`, 'success');
}

function exportAttendance() {
    const csv = ['Member,Time In,Time Out,Status']
        .concat(attendance.filter(a => a.date === todayStr()).map(a => `${a.memberName},${a.timeIn},${a.timeOut || '—'},${a.timeOut ? 'Checked Out' : 'Inside'}`))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('Exported.', 'success');
}

/* ========== STORE ========== */
function unlockStore() {
    const input = document.getElementById('storePasswordInput');
    if (input.value.trim() === 'irongrind2025') {
        document.getElementById('storeLocked').classList.add('hidden');
        document.getElementById('storeUnlocked').classList.remove('hidden');
        renderStore();
    } else {
        toast('Incorrect password. Hint: irongrind2025', 'error');
        input.value = '';
    }
}

function renderStore() {
    const supp = products.filter(p => p.category === 'Supplement');
    const merch = products.filter(p => p.category === 'Merch');
    document.getElementById('supplementsGrid').innerHTML = supp.map(productCard).join('') || '<div class="empty-state">No supplements.</div>';
    document.getElementById('merchGrid').innerHTML = merch.map(productCard).join('') || '<div class="empty-state">No merchandise.</div>';
}

function productCard(p) {
    const low = p.stock <= 4;
    return `
        <div class="product-card">
            <span class="cat">${p.category}</span>
            <h4>${p.name}${p.size ? ' — ' + p.size : ''}</h4>
            <div class="price">${formatPeso(p.price)}</div>
            <div class="stock ${low ? 'low' : ''}">${low ? '⚠ ' : ''}${p.stock} in stock</div>
            <div class="product-actions">
                <button class="btn-edit" onclick="editProduct('${p.id}')">Edit</button>
                <button class="btn-delete" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
}

function openAddProductModal() {
    openModal(`
        <h3><i class="fas fa-plus"></i> Add Product</h3>
        <div class="form-group" style="margin-bottom:14px;"><label>Name</label><input type="text" id="apName" placeholder="Whey Protein — Vanilla"></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Category</label><select id="apCat"><option value="Supplement">Supplement</option><option value="Merch">Merchandise</option></select></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Size (optional)</label><input type="text" id="apSize" placeholder="Large"></div>
        <div class="form-row">
            <div class="form-group"><label>Price ₱</label><input type="number" id="apPrice" placeholder="650"></div>
            <div class="form-group"><label>Stock</label><input type="number" id="apStock" placeholder="10"></div>
        </div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitAddProduct()">Add</button></div>
    `);
}

function submitAddProduct() {
    const name = document.getElementById('apName').value.trim();
    const category = document.getElementById('apCat').value;
    const size = document.getElementById('apSize').value.trim();
    const price = Number(document.getElementById('apPrice').value);
    const stock = Number(document.getElementById('apStock').value);
    if (!name || !price) { toast('Fill all required fields.', 'error'); return; }
    products.push({ id: uid('P'), name, category, price, stock, size });
    saveDB('products', products);
    closeModal();
    renderStore();
    renderDashboard();
    toast(`✅ Added ${name}.`, 'success');
}

function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    openModal(`
        <h3><i class="fas fa-edit"></i> Edit Product</h3>
        <p class="modal-sub">Password required to change price.</p>
        <div class="form-group" style="margin-bottom:14px;"><label>Name</label><input type="text" id="epName" value="${p.name}"></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Size</label><input type="text" id="epSize" value="${p.size || ''}"></div>
        <div class="form-row">
            <div class="form-group"><label>Price</label><input type="number" id="epPrice" value="${p.price}"></div>
            <div class="form-group"><label>Stock</label><input type="number" id="epStock" value="${p.stock}"></div>
        </div>
        <div class="form-group" style="margin-top:14px;"><label>Password (for price change)</label><input type="password" id="epPassword" placeholder="irongrind2025"></div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitEditProduct('${p.id}')">Save</button></div>
    `);
}

function submitEditProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const newPrice = Number(document.getElementById('epPrice').value);
    const pw = document.getElementById('epPassword').value;
    if (newPrice !== p.price && pw !== 'irongrind2025') { toast('Wrong password.', 'error'); return; }
    p.name = document.getElementById('epName').value.trim();
    p.size = document.getElementById('epSize').value.trim();
    p.price = newPrice;
    p.stock = Number(document.getElementById('epStock').value);
    saveDB('products', products);
    closeModal();
    renderStore();
    renderDashboard();
    toast(`✅ Updated ${p.name}.`, 'success');
}

function deleteProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    askConfirmation('Delete product?', `Delete ${p.name}? This action cannot be undone.`, 'Delete', () => completeProductDeletion(id), true);
}

function completeProductDeletion(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    products = products.filter(x => x.id !== id);
    saveDB('products', products);
    renderStore();
    renderDashboard();
    toast(`Deleted ${p.name}.`, 'error');
}

function openNewSaleModal() {
    const available = products.filter(p => p.stock > 0);
    if (available.length === 0) { toast('No stock.', 'error'); return; }
    openModal(`
        <h3><i class="fas fa-cash-register"></i> New Sale</h3>
        <div class="form-group" style="margin-bottom:14px;"><label>Customer</label><input type="text" id="nsCustomer" placeholder="Walk-in name"></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Product</label><select id="nsProduct">
            ${available.map(p => `<option value="${p.id}">${p.name}${p.size ? ' (' + p.size + ')' : ''} — ${formatPeso(p.price)}</option>`).join('')}
        </select></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Quantity</label><input type="number" id="nsQty" value="1" min="1"></div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitNewSale()">Complete</button></div>
    `);
}

function submitNewSale() {
    const customer = document.getElementById('nsCustomer').value.trim() || 'Walk-in';
    const pid = document.getElementById('nsProduct').value;
    const qty = Number(document.getElementById('nsQty').value);
    const p = products.find(x => x.id === pid);
    if (!p || qty < 1 || qty > p.stock) { toast('Invalid quantity.', 'error'); return; }
    p.stock -= qty;
    const total = p.price * qty;
    sales.unshift({ id: 'IG-' + Date.now().toString().slice(-4), customer, items: `${p.name} x${qty}`, total, date: todayStr(), status: 'Paid' });
    saveDB('products', products);
    saveDB('sales', sales);
    closeModal();
    renderStore();
    renderSales();
    renderDashboard();
    toast(`✅ Sale complete — ${formatPeso(total)}.`, 'success');
}

function renderSales() {
    const el = document.getElementById('salesTable');
    if (sales.length === 0) { el.innerHTML = '<div class="empty-state">No sales.</div>'; return; }
    el.innerHTML = `
        <table class="attendance-table">
            <thead><tr><th>Receipt</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>${sales.map(s => `
                <tr><td>#${s.id}</td><td>${s.customer}</td><td>${s.items}</td><td>${formatPeso(s.total)}</td><td>${s.date}</td>
                <td>${s.status === 'Paid' ? '<span class="badge-status paid">Paid</span>' : '<span class="badge-status reserved">Reserved</span>'}</td></tr>
            `).join('')}</tbody>
        </table>`;
}

function renderReports() {
    const reports = [
        { id: 'membership', name: 'Membership Report' },
        { id: 'payment', name: 'Payment Report' },
        { id: 'attendance', name: 'Attendance Report' },
        { id: 'inventory', name: 'Inventory Report' },
        { id: 'sales', name: 'Sales Report' }
    ];
    document.getElementById('reportsGrid').innerHTML = reports.map(r => `
        <div class="product-card" style="cursor:pointer;" onclick="viewReport('${r.id}')">
            <span class="cat">Report</span>
            <h4>${r.name}</h4>
            <button class="btn-sm" style="width:100%; justify-content:center; margin-top:12px;">View</button>
        </div>
    `).join('');
}

function viewReport(type) {
    let body = '';
    if (type === 'membership') {
        body = `<table class="attendance-table"><thead><tr><th>Name</th><th>Plan</th><th>Expires</th></tr></thead><tbody>
            ${members.map(m => `<tr><td>${m.name}</td><td>${m.plan}</td><td>${m.expiry}</td></tr>`).join('')}</tbody></table>`;
    } else if (type === 'payment' || type === 'sales') {
        body = `<table class="attendance-table"><thead><tr><th>Receipt</th><th>Customer</th><th>Total</th><th>Date</th></tr></thead><tbody>
            ${sales.map(s => `<tr><td>${s.id}</td><td>${s.customer}</td><td>${formatPeso(s.total)}</td><td>${s.date}</td></tr>`).join('')}</tbody></table>`;
    } else if (type === 'attendance') {
        body = `<table class="attendance-table"><thead><tr><th>Member</th><th>Date</th><th>In</th><th>Out</th></tr></thead><tbody>
            ${attendance.map(a => `<tr><td>${a.memberName}</td><td>${a.date}</td><td>${a.timeIn}</td><td>${a.timeOut || '—'}</td></tr>`).join('')}</tbody></table>`;
    } else if (type === 'inventory') {
        body = `<table class="attendance-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th></tr></thead><tbody>
            ${products.map(p => `<tr><td>${p.name}${p.size ? ' (' + p.size + ')' : ''}</td><td>${formatPeso(p.price)}</td><td>${p.stock}</td></tr>`).join('')}</tbody></table>`;
    }
    openModal(`<h3><i class="fas fa-chart-bar"></i> ${type.charAt(0).toUpperCase() + type.slice(1)} Report</h3>
        <div style="max-height:60vh; overflow:auto; margin-top:16px;">${body}</div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Close</button></div>`);
}

function exportAllReports() {
    const data = { members, products, sales, attendance, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `irongrind-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast('Exported.', 'success');
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
    // Seed defaults if empty
    if (!localStorage.getItem('ig_members')) {
        saveDB('members', [
            { id: 'M001', name: 'Juan Dela Cruz', plan: 'Monthly', startDate: '2025-03-15', expiry: '2025-04-15', status: 'active', paid: true, goal: 'Muscle Gain', contact: '09171234567' },
            { id: 'M002', name: 'Maria Santos', plan: 'Monthly', startDate: '2025-04-03', expiry: '2025-05-03', status: 'active', paid: true, goal: 'Weight Loss', contact: '09171234568' },
            { id: 'M003', name: 'Pedro Reyes', plan: 'Walk-in', startDate: '2025-04-08', expiry: '2025-04-08', status: 'active', paid: false, goal: 'General Fitness', contact: '09171234569' },
            { id: 'M004', name: 'Ana Lopez', plan: 'Monthly', startDate: '2025-04-02', expiry: '2025-05-02', status: 'active', paid: true, goal: 'Strength', contact: '09171234570' },
            { id: 'M005', name: 'Mark Villanueva', plan: 'Half Month', startDate: '2025-04-05', expiry: '2025-04-20', status: 'active', paid: true, goal: 'Endurance', contact: '09171234571' }
        ]);
    }
    if (!localStorage.getItem('ig_products')) {
        saveDB('products', [
            { id: 'P001', name: 'Whey Protein — Chocolate', category: 'Supplement', price: 2450, stock: 3, size: '' },
            { id: 'P002', name: 'Creatine Monohydrate', category: 'Supplement', price: 1200, stock: 2, size: '' },
            { id: 'P003', name: 'Pre-Workout — Fruit Punch', category: 'Supplement', price: 1850, stock: 4, size: '' },
            { id: 'P004', name: 'Multivitamins', category: 'Supplement', price: 850, stock: 24, size: '' },
            { id: 'P005', name: 'IronGrind Shirt', category: 'Merch', price: 650, stock: 1, size: 'Large' },
            { id: 'P006', name: 'IronGrind Shirt', category: 'Merch', price: 650, stock: 12, size: 'Medium' },
            { id: 'P007', name: 'IronGrind Shirt', category: 'Merch', price: 650, stock: 8, size: 'Small' }
        ]);
    }
    if (!localStorage.getItem('ig_sales')) {
        saveDB('sales', [
            { id: 'IG-1042', customer: 'Maria Santos', items: 'Whey Protein x1', total: 2450, date: todayStr(), status: 'Paid' },
            { id: 'IG-1041', customer: 'Walk-in — Carlo M.', items: 'Shirt (L) + Vitamins', total: 1500, date: todayStr(), status: 'Paid' },
            { id: 'IG-1040', customer: 'Juan Dela Cruz', items: 'Pre-Workout x1', total: 1850, date: todayStr(), status: 'Paid' }
        ]);
    }
    if (!localStorage.getItem('ig_attendance')) {
        saveDB('attendance', [
            { id: 'A1', memberId: 'M001', memberName: 'Juan Dela Cruz', date: todayStr(), timeIn: '06:12', timeOut: '07:45' },
            { id: 'A2', memberId: 'M002', memberName: 'Maria Santos', date: todayStr(), timeIn: '07:05', timeOut: '08:30' },
            { id: 'A3', memberId: 'M003', memberName: 'Pedro Reyes', date: todayStr(), timeIn: '08:15', timeOut: null },
            { id: 'A4', memberId: 'M004', memberName: 'Ana Lopez', date: todayStr(), timeIn: '08:45', timeOut: null }
        ]);
    }
    if (!localStorage.getItem('ig_pendingApprovals')) saveDB('pendingApprovals', []);
    if (!localStorage.getItem('ig_users')) saveDB('users', []);

    members = loadDB('members');
    products = loadDB('products');
    sales = loadDB('sales');
    attendance = loadDB('attendance');
    pendingApprovals = loadDB('pendingApprovals');
    users = loadDB('users');

    renderDashboard();
    renderMembers();
    renderApprovals();
    renderAttendance();
    renderSales();
    renderReports();

    const pwInput = document.getElementById('storePasswordInput');
    if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlockStore(); });
});

window.addEventListener('load', () => {
    window.setTimeout(() => document.getElementById('page-loader')?.classList.add('hidden-loader'), 300);
});

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
let planArchives = [];
let membershipArchives = [];
let currentPlanFilter = 'all';
let currentMemberTab = 'members';
let currentApprovalType = 'registration';
let activeQRScanner = null;
let qrScanHandled = false;

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
function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    stopQRScanner();
}
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
    if (section === 'walkin-sales') renderWalkinSalesReport();
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

function switchApprovalType(type) {
    currentApprovalType = type === 'renewal' ? 'renewal' : 'registration';
    document.querySelectorAll('[data-approval-type]').forEach(button => button.classList.toggle('active', button.dataset.approvalType === currentApprovalType));
    document.getElementById('registrationApprovalsList').classList.toggle('hidden', currentApprovalType !== 'registration');
    document.getElementById('renewalApprovalsList').classList.toggle('hidden', currentApprovalType !== 'renewal');
    renderApprovals(currentApprovalType);
}

function logout() {
    askConfirmation('Log out?', 'Are you sure you want to log out?', 'Log out', () => {
        localStorage.removeItem('irongrind_session');
        sessionStorage.removeItem('irongrind_session');
        document.getElementById('page-loader')?.classList.remove('hidden-loader');
        window.setTimeout(() => window.location.replace('index.html'), 1200);
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

    const pending = pendingApprovals.filter(p => p.status === 'pending');
    document.getElementById('pendingBadge').textContent = pending.length;
    document.getElementById('approvalsCount').textContent = pending.length;
    document.getElementById('registrationApprovalsCount').textContent = pending.filter(p => p.source !== 'dashboard-renewal').length;
    document.getElementById('renewalApprovalsCount').textContent = pending.filter(p => p.source === 'dashboard-renewal').length;
}

/* ========== RENDER: MEMBERS ========== */
function getPlanDurationDays(plan) {
    if (plan === 'Monthly') return 30;
    if (plan === 'Half Month') return 15;
    if (plan === 'Weekly') return 7;
    return 1;
}

function getPlanPrice(plan, member = null) {
    if (plan === 'Monthly') return 800;
    if (plan === 'Half Month') return 400;
    if (plan === 'Weekly') return Number(member?.planPrice) || 0;
    return 80;
}

function isPastMembershipArchiveGrace(member) {
    return Boolean(member?.expiry && member.expiry < todayStr() && todayStr() >= addDays(member.expiry, 10));
}

function isMembershipArchiveReady(record) {
    return Boolean(record?.renewedAt || (record?.expiry && todayStr() >= addDays(record.expiry, 10)));
}

function renderMembers() {
    const searchEl = document.getElementById('memberSearch');
    const query = searchEl ? searchEl.value.toLowerCase() : '';

    let filtered = members.filter(m => !isPastMembershipArchiveGrace(m)).filter(m => {
        if (currentPlanFilter !== 'all' && m.plan !== currentPlanFilter) return false;
        if (query && !m.name.toLowerCase().includes(query)) return false;
        return true;
    });

    const listEl = document.getElementById('membersList');
    if (filtered.length === 0) {
        const hasArchived = members.some(isPastMembershipArchiveGrace);
        listEl.innerHTML = hasArchived
            ? '<div class="empty-state">No members found. Expired memberships beyond the 10-day grace period are in <button class="btn-sm" onclick="viewReport(\'archives\')">Membership Archives</button>.</div>'
            : '<div class="empty-state">No members found.</div>';
        return;
    }

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
                    <button class="renew-btn" onclick="openChangePlanModal('${m.id}')"><i class="fas fa-exchange-alt"></i> Change Plan</button>
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
function renderApprovals(type = currentApprovalType) {
    const isRenewal = type === 'renewal';
    const el = document.getElementById(isRenewal ? 'renewalApprovalsList' : 'registrationApprovalsList');
    const allPending = pendingApprovals.filter(p => p.status === 'pending');
    const registrations = allPending.filter(p => p.source !== 'dashboard-renewal');
    const renewals = allPending.filter(p => p.source === 'dashboard-renewal');
    document.getElementById('approvalsCount').textContent = allPending.length;
    document.getElementById('registrationApprovalsCount').textContent = registrations.length;
    document.getElementById('renewalApprovalsCount').textContent = renewals.length;
    const pending = isRenewal ? renewals : registrations;

    if (pending.length === 0) {
        el.innerHTML = isRenewal
            ? '<div class="empty-state">No pending renewal requests.</div>'
            : '<div class="empty-state">No pending new registrations.</div>';
        return;
    }

    el.innerHTML = pending.map(p => `
        <div style="background:#0d1219; border:1px solid #1e2533; border-left:4px solid #f1c40f; border-radius:18px; padding:20px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                <div class="member-info">
                    <div class="member-avatar">${initials(p.fullName)}</div>
                    <div class="member-details">
                        <h4>${p.fullName}</h4>
                        <p><strong>${p.source === 'dashboard-renewal' ? 'Renewal application' : 'New member registration'}</strong> · Applied ${new Date(p.submittedAt).toLocaleString()}</p>
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;"><span class="badge-status reserved">${p.source === 'dashboard-renewal' ? 'Renewal' : 'Registration'}</span><span class="badge-status reserved">Pending</span></div>
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
                        <span style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600;">Height</span>
                        <span>${p.height !== null && p.height !== undefined && p.height !== '' ? `${p.height} ${p.heightUnit || 'cm'}` : 'Not provided'}</span>
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
            ${p.signature ? `<div style="background:#11161f; border-radius:14px; padding:16px; margin-bottom:16px;"><div style="font-size:0.68rem; text-transform:uppercase; color:#6a748b; font-weight:600; margin-bottom:8px;">Member Signature</div><img src="${p.signature}" alt="${p.fullName}'s digital signature" style="display:block; max-width:100%; width:360px; height:120px; object-fit:contain; background:#fff; border-radius:8px;"></div>` : ''}
            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn-sm" onclick="rejectApplication('${p.id}')"><i class="fas fa-times"></i> Reject</button>
                <button class="btn-primary" onclick="approveApplication('${p.id}')"><i class="fas fa-check-circle"></i> ${p.source === 'dashboard-renewal' ? 'Approve Renewal' : 'Approve &amp; Create Account'}</button>
            </div>
        </div>
    `).join('');
}

/* ========== APPROVE / REJECT ========== */
function approveApplication(id) {
    const idx = pendingApprovals.findIndex(x => x.id === id);
    if (idx === -1) return;
    const p = pendingApprovals[idx];
    const isRenewal = p.source === 'dashboard-renewal';
    askConfirmation(isRenewal ? 'Approve renewal?' : 'Approve application?', isRenewal ? `Approve ${p.fullName}'s renewal and reactivate the membership?` : `Approve ${p.fullName}? This will create their account and generate their QR code.`, isRenewal ? 'Approve Renewal' : 'Approve', () => completeApproval(id));
}

function completeApproval(id) {
    const idx = pendingApprovals.findIndex(x => x.id === id);
    if (idx === -1) return;
    const p = pendingApprovals[idx];

    // Member portal renewal requests update the existing member account.
    // Keep the old subscription snapshot before replacing its dates and plan.
    if (p.source === 'dashboard-renewal') {
        const member = members.find(item => item.id === p.memberId || item.username?.toLowerCase() === p.username?.toLowerCase());
        if (!member) { toast('Could not find the member for this renewal request.', 'error'); return; }
        archiveExpiredMembership(member, true);
        const duration = getPlanDurationDays(p.plan);
        const startDate = todayStr();
        member.plan = p.plan || member.plan;
        member.planPrice = Number(p.planPrice) || getPlanPrice(member.plan, member);
        member.startDate = startDate;
        member.expiry = addDays(startDate, duration);
        member.status = 'active';
        member.paid = true;
        saveDB('members', members);
        saveDB('membershipArchives', membershipArchives);
        sales.unshift({
            id: 'IG-' + Date.now().toString().slice(-4),
            customer: member.name,
            items: member.plan + ' Renewal',
            total: member.planPrice,
            date: todayStr(),
            status: 'Paid'
        });
        saveDB('sales', sales);
        pendingApprovals.splice(idx, 1);
        saveDB('pendingApprovals', pendingApprovals);
        renderApprovals();
        renderMembers();
        renderDashboard();
        renderReports();
        toast(`${member.name}'s renewal was approved. Their previous subscription is saved in Archives.`, 'success');
        return;
    }

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
        planPrice: Number(p.planPrice) || 0,
        startDate: p.startDate,
        expiry: p.endDate,
        status: 'active',
        registrationSource: 'Online application',
        paid: true,
        goal: p.goals[0] || 'General Fitness',
        contact: p.mobile,
        username: p.username,
        height: p.height ?? null,
        heightUnit: p.heightUnit || null,
        weight: p.weight ?? null,
        healthConditions: p.healthConditions || [],
        otherMedicalConditions: p.otherMedicalConditions || '',
        signature: p.signature || null,
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

/* ========== ADD MEMBER (FULL REGISTRATION FORM) ========== */
let signaturePad = null;

function openAddMemberModal() {
    signaturePad = null;
    openModal(`
        <h3 style="display:flex; align-items:center; gap:10px;"><i class="fas fa-user-plus"></i> Add New Member</h3>
        <p class="modal-sub">Enter the member’s details, choose a membership plan, and capture their digital signature.</p>

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
                <button type="button" id="clearSignatureButton" class="btn-sm"><i class="fas fa-eraser"></i> Clear</button>
            </div>
        </div>

        <!-- MEMBER PORTAL ACCOUNT -->
        <div style="background:#0d1219; border:1px solid #1e2533; border-radius:14px; padding:18px; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #1e2533;">
                <i class="fas fa-key" style="color:#ff6b2b;"></i><span>Member Portal Account</span>
            </div>
            <p style="font-size:0.75rem; color:#8b95a9; margin-bottom:12px;">Create login credentials so the member can access their portal.</p>
            <div class="form-row">
                <div class="form-group"><label>Username *</label><input type="text" id="wiUsername" placeholder="juan.delacruz" autocomplete="username"></div>
                <div class="form-group"><label>Password *</label><input type="password" id="wiPassword" placeholder="At least 6 characters" autocomplete="new-password"></div>
            </div>
            <div class="form-group" style="margin-bottom:0;"><label>Confirm Password *</label><input type="password" id="wiConfirmPassword" placeholder="Re-enter the password" autocomplete="new-password"></div>
        </div>

        <!-- ACTIONS -->
        <div class="modal-actions" style="position:sticky; bottom:0; background:#11161f; padding-top:12px;">
            <button class="btn-sm" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewMember()"><i class="fas fa-check"></i> Add Member &amp; Generate QR</button>
        </div>
    `);

    // ---- Attach the signature canvas after the modal is visible ----
    setTimeout(() => {
        if (typeof initDigitalSignature !== 'function') {
            toast('The signature canvas could not load. Please refresh and try again.', 'error');
            return;
        }
        signaturePad = initDigitalSignature('signatureCanvas', 'clearSignatureButton');
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

function submitNewMember() {
    // ---- Personal ----
    const name = document.getElementById('wiName').value.trim();
    const dob = document.getElementById('wiDob').value;
    const age = Number(document.getElementById('wiAge').value);
    const sex = document.getElementById('wiSex').value;
    const contact = document.getElementById('wiContact').value.trim();
    const username = document.getElementById('wiUsername').value.trim().toLowerCase();
    const password = document.getElementById('wiPassword').value;
    const confirmPassword = document.getElementById('wiConfirmPassword').value;
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
    if (username.length < 4 || !/^[a-z0-9_.]+$/.test(username)) {
        toast('Username must be 4+ characters and use only letters, numbers, dots, or underscores.', 'error');
        return;
    }
    if (password.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
    if (password !== confirmPassword) { toast('Passwords do not match.', 'error'); return; }
    if (users.some(user => user.username?.toLowerCase() === username) || members.some(member => member.username?.toLowerCase() === username) || pendingApprovals.some(application => application.username?.toLowerCase() === username)) {
        toast('That username is already in use.', 'error');
        return;
    }

    // ---- SIGNATURE VALIDATION ----
    if (!signaturePad || signaturePad.isEmpty()) {
        toast('Digital signature is required.', 'error');
        return;
    }
    const signatureData = signaturePad.toDataURL('image/png');

    // ---- Create Member ----
    const memberId = uid('M');
    const saleId = 'IG-' + Date.now().toString().slice(-4);
    users.push({ username, password, fullName: name, role: 'customer', createdAt: new Date().toISOString() });
    saveDB('users', users);
    members.push({
        id: memberId,
        name,
        username,
        registrationSource: 'Walk-in',
        plan,
        planPrice: Number(price),
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
        receiptId: saleId,
        qrCode: 'IRONGRIND|' + memberId + '|' + name
    });
    saveDB('members', members);

    // ---- Record Sale ----
    sales.unshift({
        id: saleId,
        customer: name,
        items: plan + ' Membership (Admin registration)',
        lineItems: [{ name: `${plan} Membership`, quantity: 1, unitPrice: Number(price), total: Number(price) }],
        total: Number(price),
        date: todayStr(),
        createdAt: new Date().toISOString(),
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

function openChangePlanModal(id) {
    const member = members.find(item => String(item.id) === String(id));
    if (!member) return;
    openModal(`<h3><i class="fas fa-exchange-alt"></i> Change Membership Plan</h3>
        <p class="modal-sub">Changing ${escapeHTML(member.name)} from <strong>${escapeHTML(member.plan || 'No plan')}</strong>. The new plan starts today and replaces the current expiry; the previous plan and dates will be kept in the archive. The previous payment is non-refundable, including unused days.</p>
        <div class="form-group" style="margin-bottom:14px;"><label>New Plan</label><select id="changePlanSelect" onchange="updatePlanChangePrice()">
            <option value="Monthly" data-days="30" data-price="800">Monthly — ₱800 / 30 days</option>
            <option value="Half Month" data-days="15" data-price="400">Half Month — ₱400 / 15 days</option>
            <option value="Walk-in" data-days="1" data-price="80">Walk-in — ₱80 / day</option>
        </select></div>
        <div class="form-group"><label>New Plan Charge (₱)</label><input type="number" id="changePlanPrice" min="0" step="0.01" placeholder="Enter amount"></div>
        <p style="font-size:0.75rem; color:#8b95a9;">Previous plan: ${escapeHTML(member.plan || '—')} · Expires ${escapeHTML(member.expiry || '—')}</p>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitMemberPlanChange('${encodeURIComponent(String(member.id))}')"><i class="fas fa-archive"></i> Save Change &amp; Archive</button></div>`);
    updatePlanChangePrice();
}

function updatePlanChangePrice() {
    const select = document.getElementById('changePlanSelect');
    const priceInput = document.getElementById('changePlanPrice');
    if (!select || !priceInput) return;
    const selectedPrice = select.selectedOptions[0]?.dataset.price;
    priceInput.value = selectedPrice || '';
    priceInput.readOnly = Boolean(selectedPrice);
}

function submitMemberPlanChange(encodedId) {
    const id = decodeURIComponent(encodedId);
    const member = members.find(item => String(item.id) === id);
    const select = document.getElementById('changePlanSelect');
    const priceValue = document.getElementById('changePlanPrice')?.value.trim();
    const price = Number(priceValue);
    if (!member || !select) return;
    const newPlan = select.value;
    const duration = Number(select.selectedOptions[0]?.dataset.days) || getPlanDurationDays(newPlan);
    if (!priceValue || !Number.isFinite(price) || price <= 0) { toast('Enter an amount greater than zero for the new plan.', 'error'); return; }
    if (newPlan === member.plan && price === Number(member.planPrice || getPlanPrice(member.plan, member))) {
        toast('The member already has this plan and price.', 'error');
        return;
    }

    const changedAt = new Date().toISOString();
    const nextStartDate = todayStr();
    const nextExpiry = addDays(nextStartDate, duration);
    const previous = {
        plan: member.plan || '—',
        startDate: member.startDate || null,
        expiry: member.expiry || null,
        planPrice: Number(member.planPrice || getPlanPrice(member.plan, member)) || 0
    };
    archiveExpiredMembership(member, true);
    const archiveRecord = {
        id: 'PA-' + Date.now().toString().slice(-8),
        memberId: member.id,
        memberName: member.name,
        previousPlan: previous.plan,
        previousStartDate: previous.startDate,
        previousExpiry: previous.expiry,
        previousPrice: previous.planPrice,
        newPlan,
        newStartDate: nextStartDate,
        newExpiry: nextExpiry,
        newPrice: price,
        refundIssued: false,
        refundAmount: 0,
        refundPolicy: 'No refund for the previous plan, including unused days.',
        changedAt,
        changedBy: 'admin'
    };

    planArchives.unshift(archiveRecord);
    member.plan = newPlan;
    member.planPrice = price;
    member.startDate = nextStartDate;
    member.expiry = nextExpiry;
    member.paid = true;
    member.status = 'active';

    const saleId = 'IG-' + Date.now().toString().slice(-4);
    sales.unshift({
        id: saleId,
        customer: member.name,
        items: `${newPlan} Membership Plan Change`,
        lineItems: [{ name: `${newPlan} Membership Plan Change`, quantity: 1, unitPrice: price, total: price }],
        total: price,
        date: todayStr(),
        createdAt: changedAt,
        status: 'Paid'
    });

    saveDB('members', members);
    saveDB('planArchives', planArchives);
    saveDB('membershipArchives', membershipArchives);
    saveDB('sales', sales);
    closeModal();
    renderMembers();
    renderDashboard();
    renderSales();
    renderReports();
    toast(`${member.name}'s plan changed to ${newPlan}. Previous plan archived.`, 'success');
}

function renewMember(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    if (m.plan === 'Weekly') {
        toast('Weekly plans are no longer offered. Use Change Plan to select an available plan.', 'error');
        return;
    }
    const days = getPlanDurationDays(m.plan);
    const price = getPlanPrice(m.plan, m);
    askConfirmation('Renew membership?', `Renew ${m.name}'s ${m.plan} membership for ${formatPeso(price)}?`, 'Renew', () => completeMemberRenewal(id), false);
}

function completeMemberRenewal(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const days = getPlanDurationDays(m.plan);
    const price = getPlanPrice(m.plan, m);
    archiveExpiredMembership(m, true);
    m.startDate = todayStr();
    m.expiry = addDays(todayStr(), days);
    m.paid = true;
    saveDB('members', members);
    saveDB('membershipArchives', membershipArchives);
    sales.unshift({ id: 'IG-' + Date.now().toString().slice(-4), customer: m.name, items: m.plan + ' Renewal', total: price, date: todayStr(), status: 'Paid' });
    saveDB('sales', sales);
    renderMembers();
    renderDashboard();
    toast(`✅ ${m.name} renewed until ${m.expiry}.`, 'success');
}

function showMemberQR(id) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const account = users.find(user => user.username?.toLowerCase() === m.username?.toLowerCase());
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('IRONGRIND|' + m.id + '|' + m.name)}`;
    openModal(`
        <h3><i class="fas fa-qrcode"></i> Member QR</h3>
        <p class="modal-sub">${m.name} · ${m.id}</p>
        <div style="text-align:center; padding:20px; background:#fff; border-radius:20px;"><img src="${qrUrl}" style="width:200px;height:200px;"></div>
        <div class="qr-print-card"><div class="qr-print-gym">Iron Grind Fitness Gym</div><img src="${qrUrl}" alt="Member QR code"></div>
        ${account ? `<div style="margin-top:14px; padding:14px; background:#0d1219; border:1px solid #1e2533; border-radius:14px;"><strong style="display:block; margin-bottom:8px; color:#f1f3f7;">Member Portal Login</strong><div style="font-size:0.82rem; color:#a4adc2;">Username: <code style="color:#ff6b2b;">${escapeHTML(account.username)}</code></div><div style="margin-top:5px; font-size:0.82rem; color:#a4adc2;">Password: <code style="color:#ff6b2b;">${escapeHTML(account.password)}</code></div><small style="display:block; margin-top:8px; color:#6a748b;">Share these credentials privately with the member.</small></div>` : ''}
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Close</button>${m.receiptId ? `<button class="btn-sm" onclick="showSaleReceipt(decodeURIComponent('${encodeURIComponent(String(m.receiptId))}'))"><i class="fas fa-receipt"></i> Receipt</button>` : ''}<button class="btn-primary" onclick="printQRCode()"><i class="fas fa-print"></i> Print QR</button></div>
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

function startQRScanner() {
    if (typeof Html5Qrcode === 'undefined') {
        toast('The QR scanner could not load. Check your internet connection and reload.', 'error');
        return;
    }

    qrScanHandled = false;
    openModal(`<div class="qr-camera-modal">
        <h3><i class="fas fa-camera"></i> Scan Member QR</h3>
        <p class="modal-sub">Allow camera access and hold the member QR code in the frame.</p>
        <div class="qr-reader-frame">
            <div id="qrReader" class="qr-reader"></div>
            <div id="qrScanProcessing" class="qr-scan-processing" hidden role="status" aria-live="polite">
                <span class="qr-scan-spinner" aria-hidden="true"><i class="fas fa-qrcode"></i></span>
                <strong>Recording attendance</strong>
                <span>Reading member details…</span>
            </div>
        </div>
        <p id="qrCameraStatus" class="qr-camera-status" role="status">Starting camera…</p>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button></div>
    </div>`);

    activeQRScanner = new Html5Qrcode('qrReader');
    activeQRScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        decodedText => {
            if (qrScanHandled) return;
            qrScanHandled = true;
            const scannedText = decodedText.trim();
            const processing = document.getElementById('qrScanProcessing');
            const status = document.getElementById('qrCameraStatus');
            if (processing) processing.hidden = false;
            if (status) status.textContent = 'QR detected. Recording attendance…';
            window.setTimeout(() => {
                closeModal();
                const member = findMemberFromQR(scannedText);
                if (!member) {
                    toast('QR code not recognized. Scan a QR code issued by Iron Grind.', 'error');
                    return;
                }
                recordMemberCheckIn(member);
            }, 650);
        },
        () => {}
    ).then(() => {
        const status = document.getElementById('qrCameraStatus');
        if (status) status.textContent = 'Camera is on. Point it at the member’s QR code.';
    }).catch(error => {
        stopQRScanner();
        const status = document.getElementById('qrCameraStatus');
        if (status) status.textContent = 'Camera unavailable. Allow camera access and use this page over HTTPS or localhost.';
        console.warn('QR camera failed to start:', error);
    });
}

function stopQRScanner() {
    const scanner = activeQRScanner;
    activeQRScanner = null;
    if (!scanner) return;
    scanner.stop().catch(() => {}).finally(() => {
        try { scanner.clear(); } catch {}
    });
}

function findMemberFromQR(value) {
    const exactMatch = members.find(member => member.qrCode && member.qrCode === value);
    if (exactMatch) return exactMatch;
    const parts = value.split('|');
    if (parts[0]?.toUpperCase() !== 'IRONGRIND' || !parts[1]) return null;
    const identifier = parts[1].trim();
    return members.find(member => String(member.id) === identifier || member.username === identifier) || null;
}

function recordMemberCheckIn(member) {
    if (!member || member.expiry < todayStr()) {
        toast('Membership is expired. Check the member’s renewal status.', 'error');
        return;
    }
    const today = todayStr();
    if (attendance.find(a => a.memberId === member.id && a.date === today && !a.timeOut)) {
        toast(`${member.name} is already checked in.`, 'error'); return;
    }
    const timeIn = new Date().toTimeString().slice(0, 5);
    attendance.push({ id: uid('A'), memberId: member.id, memberName: member.name, date: today, timeIn, timeOut: null });
    saveDB('attendance', attendance);
    renderAttendance();
    renderDashboard();
    toast(`${member.name} checked in at ${timeIn}.`, 'success');
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
            ${p.image ? `<div class="product-img-wrap"><img src="${p.image}" alt="${escapeHTML(p.name)}" loading="lazy"></div>` : ''}
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
        <div class="form-group product-photo-field"><label for="apImage">Product photo (optional)</label><input type="file" id="apImage" accept="image/*" onchange="previewProductPhoto(this, 'apImagePreview')"><div id="apImagePreview" class="product-photo-preview"><span>No photo selected</span></div><small>Images are resized before saving.</small></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Name</label><input type="text" id="apName" placeholder="Whey Protein — Vanilla"></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Category</label><select id="apCat"><option value="Supplement">Supplement</option><option value="Merch">Merchandise</option></select></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Size (optional)</label><input type="text" id="apSize" placeholder="Large"></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Supplement weight in grams (optional)</label><input type="number" id="apWeightGrams" min="0" step="0.01" placeholder="e.g. 500"><small class="field-hint">Used to calculate total grams sold per day. Leave blank for merchandise.</small></div>
        <div class="form-row">
            <div class="form-group"><label>Price ₱</label><input type="number" id="apPrice" placeholder="650"></div>
            <div class="form-group"><label>Stock</label><input type="number" id="apStock" placeholder="10"></div>
        </div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitAddProduct()">Add</button></div>
    `);
}

async function submitAddProduct() {
    const name = document.getElementById('apName').value.trim();
    const category = document.getElementById('apCat').value;
    const size = document.getElementById('apSize').value.trim();
    const price = Number(document.getElementById('apPrice').value);
    const stock = Number(document.getElementById('apStock').value);
    const weightInput = document.getElementById('apWeightGrams').value.trim();
    const weightGrams = weightInput ? Number(weightInput) : null;
    if (!name || !price) { toast('Fill all required fields.', 'error'); return; }
    if (weightInput && (!Number.isFinite(weightGrams) || weightGrams <= 0)) { toast('Supplement weight must be greater than zero.', 'error'); return; }
    const image = await getProductPhoto('apImage');
    if (image === false) return;
    products.push({ id: uid('P'), name, category, price, stock, size, ...(weightGrams ? { weightGrams } : {}), ...(image ? { image } : {}) });
    try { saveDB('products', products); }
    catch { products.pop(); toast('Could not save product photo. Try a smaller image or remove photos from other products.', 'error'); return; }
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
        <div class="form-group product-photo-field"><label for="epImage">Product photo (optional)</label><input type="file" id="epImage" accept="image/*" onchange="previewProductPhoto(this, 'epImagePreview')"><div id="epImagePreview" class="product-photo-preview">${p.image ? `<img src="${p.image}" alt="Current product photo">` : '<span>No photo selected</span>'}</div><label class="product-photo-remove"><input type="checkbox" id="epRemoveImage"> Remove current photo</label><small>Choose a new image to replace the current one.</small></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Name</label><input type="text" id="epName" value="${p.name}"></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Size</label><input type="text" id="epSize" value="${p.size || ''}"></div>
        <div class="form-group" style="margin-bottom:14px;"><label>Supplement weight in grams (optional)</label><input type="number" id="epWeightGrams" min="0" step="0.01" value="${p.weightGrams || ''}" placeholder="e.g. 500"><small class="field-hint">Used to calculate total grams sold per day. Leave blank for merchandise.</small></div>
        <div class="form-row">
            <div class="form-group"><label>Price</label><input type="number" id="epPrice" value="${p.price}"></div>
            <div class="form-group"><label>Stock</label><input type="number" id="epStock" value="${p.stock}"></div>
        </div>
        <div class="form-group" style="margin-top:14px;"><label>Password (for price change)</label><input type="password" id="epPassword" placeholder="irongrind2025"></div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitEditProduct('${p.id}')">Save</button></div>
    `);
}

async function submitEditProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const newPrice = Number(document.getElementById('epPrice').value);
    const weightInput = document.getElementById('epWeightGrams').value.trim();
    const weightGrams = weightInput ? Number(weightInput) : null;
    const pw = document.getElementById('epPassword').value;
    if (newPrice !== p.price && pw !== 'irongrind2025') { toast('Wrong password.', 'error'); return; }
    if (weightInput && (!Number.isFinite(weightGrams) || weightGrams <= 0)) { toast('Supplement weight must be greater than zero.', 'error'); return; }
    const image = await getProductPhoto('epImage');
    if (image === false) return;
    const oldProduct = { ...p };
    p.name = document.getElementById('epName').value.trim();
    p.size = document.getElementById('epSize').value.trim();
    p.price = newPrice;
    p.stock = Number(document.getElementById('epStock').value);
    if (weightGrams) p.weightGrams = weightGrams;
    else delete p.weightGrams;
    if (image) p.image = image;
    else if (document.getElementById('epRemoveImage').checked) delete p.image;
    try { saveDB('products', products); }
    catch { Object.assign(p, oldProduct); toast('Could not save product photo. Try a smaller image or remove photos from other products.', 'error'); return; }
    closeModal();
    renderStore();
    renderDashboard();
    toast(`✅ Updated ${p.name}.`, 'success');
}

function previewProductPhoto(input, previewId) {
    const preview = document.getElementById(previewId);
    const file = input.files && input.files[0];
    if (!preview || !file) return;
    if (!file.type.startsWith('image/')) { input.value = ''; toast('Choose an image file.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { preview.innerHTML = `<img src="${reader.result}" alt="Selected product photo preview">`; };
    reader.onerror = () => toast('Could not read that image.', 'error');
    reader.readAsDataURL(file);
}

function getProductPhoto(inputId) {
    const file = document.getElementById(inputId)?.files?.[0];
    if (!file) return Promise.resolve('');
    if (!file.type.startsWith('image/')) { toast('Choose an image file.', 'error'); return Promise.resolve(false); }
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onerror = () => { toast('Could not read that image.', 'error'); resolve(false); };
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => { toast('Could not process that image.', 'error'); resolve(false); };
            img.onload = () => {
                const scale = Math.min(1, 900 / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.78));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
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

function getProductWeightGrams(product) {
    const stored = Number(product?.weightGrams);
    if (Number.isFinite(stored) && stored > 0) return stored;
    const label = `${product?.size || ''} ${product?.name || ''}`;
    const match = label.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|g|grams?)\b/i);
    if (!match) return null;
    const amount = Number(match[1]);
    return /^k/i.test(match[2]) ? amount * 1000 : amount;
}

function submitNewSale() {
    const customer = document.getElementById('nsCustomer').value.trim() || 'Walk-in';
    const pid = document.getElementById('nsProduct').value;
    const qty = Number(document.getElementById('nsQty').value);
    const p = products.find(x => x.id === pid);
    if (!p || qty < 1 || qty > p.stock) { toast('Invalid quantity.', 'error'); return; }
    p.stock -= qty;
    const total = p.price * qty;
    const saleId = 'IG-' + Date.now().toString().slice(-4);
    const unitWeightGrams = p.category === 'Supplement' ? getProductWeightGrams(p) : null;
    sales.unshift({
        id: saleId,
        customer,
        source: 'walk-in',
        category: p.category,
        productId: p.id,
        productName: p.name,
        quantity: qty,
        unitWeightGrams,
        items: `${p.name} x${qty}`,
        lineItems: [{ name: p.name, productId: p.id, category: p.category, quantity: qty, unitPrice: p.price, total, unitWeightGrams }],
        total,
        date: todayStr(),
        createdAt: new Date().toISOString(),
        status: 'Paid'
    });
    saveDB('products', products);
    saveDB('sales', sales);
    closeModal();
    renderStore();
    renderSales();
    renderDashboard();
    showSaleReceipt(saleId);
    toast(`✅ Sale complete — ${formatPeso(total)}.`, 'success');
}

function switchWalkinSalesType(type) {
    const selected = type === 'Merch' ? 'Merch' : 'Supplement';
    document.querySelectorAll('[data-walkin-type]').forEach(button => button.classList.toggle('active', button.dataset.walkinType === selected));
    document.getElementById('walkinSupplementPanel').classList.toggle('hidden', selected !== 'Supplement');
    document.getElementById('walkinMerchPanel').classList.toggle('hidden', selected !== 'Merch');
}

function renderWalkinSalesReport() {
    const dateInput = document.getElementById('walkinSalesDate');
    if (!dateInput) return;
    if (!dateInput.value) dateInput.value = todayStr();
    const daySales = sales.filter(sale => sale.source === 'walk-in' && sale.date === dateInput.value && sale.status === 'Paid');
    const supplementSales = daySales.filter(sale => sale.category === 'Supplement');
    const merchSales = daySales.filter(sale => sale.category === 'Merch');
    const sumIncome = items => items.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    document.getElementById('walkinTotalIncome').textContent = formatPeso(sumIncome(daySales));
    document.getElementById('walkinSupplementIncome').textContent = formatPeso(sumIncome(supplementSales));
    document.getElementById('walkinMerchIncome').textContent = formatPeso(sumIncome(merchSales));

    const aggregate = items => {
        const byProduct = new Map();
        items.forEach(sale => {
            const key = sale.productId || sale.productName || sale.items;
            const existing = byProduct.get(key) || {
                name: sale.productName || sale.items || 'Product',
                quantity: 0,
                income: 0,
                grams: 0,
                missingWeight: false
            };
            const quantity = Number(sale.quantity) || Number(sale.lineItems?.[0]?.quantity) || 0;
            const weight = Number(sale.unitWeightGrams ?? sale.lineItems?.[0]?.unitWeightGrams);
            existing.quantity += quantity;
            existing.income += Number(sale.total || 0);
            if (Number.isFinite(weight) && weight > 0) existing.grams += quantity * weight;
            else if (items === supplementSales) existing.missingWeight = true;
            byProduct.set(key, existing);
        });
        return [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name));
    };
    const supplements = aggregate(supplementSales);
    const merchandise = aggregate(merchSales);
    document.getElementById('walkinSupplementTable').innerHTML = supplements.length
        ? `<div class="table-scroll"><table class="attendance-table"><thead><tr><th>Supplement</th><th>Packs Sold</th><th>Total Grams</th><th>Income</th></tr></thead><tbody>${supplements.map(item => `<tr><td>${escapeHTML(item.name)}</td><td>${item.quantity}</td><td>${item.missingWeight ? '<span class="walkin-missing-weight">Set product weight</span>' : `${item.grams.toLocaleString('en-PH')} g`}</td><td>${formatPeso(item.income)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-state">No supplement sales for this date.</div>';
    document.getElementById('walkinMerchTable').innerHTML = merchandise.length
        ? `<div class="table-scroll"><table class="attendance-table"><thead><tr><th>Merchandise</th><th>Quantity Sold</th><th>Income</th></tr></thead><tbody>${merchandise.map(item => `<tr><td>${escapeHTML(item.name)}</td><td>${item.quantity}</td><td>${formatPeso(item.income)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-state">No merchandise sales for this date.</div>';
}

function renderSales() {
    const el = document.getElementById('salesTable');
    if (sales.length === 0) { el.innerHTML = '<div class="empty-state">No sales.</div>'; return; }
    el.innerHTML = `
        <table class="attendance-table">
            <thead><tr><th>Receipt</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${sales.map(s => `
                <tr><td>#${s.id}</td><td>${s.customer}</td><td>${s.items}</td><td>${formatPeso(s.total)}</td><td>${s.date}</td>
                <td>${s.status === 'Paid' ? '<span class="badge-status paid">Paid</span>' : '<span class="badge-status reserved">Reserved</span>'}</td>
                <td><button class="btn-sm" onclick="showSaleReceipt(decodeURIComponent('${encodeURIComponent(String(s.id))}'))" aria-label="View or print receipt"><i class="fas fa-receipt"></i> Receipt</button></td></tr>
            `).join('')}</tbody>
        </table>`;
}

function getSaleReceiptMarkup(sale) {
    const items = Array.isArray(sale.lineItems) && sale.lineItems.length
        ? sale.lineItems
        : [{ name: sale.items || 'Sale', quantity: 1, unitPrice: sale.total, total: sale.total }];
    const created = sale.createdAt ? new Date(sale.createdAt) : null;
    const timeLabel = created && !Number.isNaN(created.getTime())
        ? created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return `<article class="pos-receipt">
        <header class="pos-receipt-header">
            <img src="assets/images/iron-grind-mark.png" alt="">
            <div class="pos-receipt-brand">IRON GRIND<span>FITNESS GYM</span></div>
            <div class="pos-receipt-label">SALES RECEIPT</div>
        </header>
        <div class="pos-receipt-meta"><span>Receipt</span><strong>#${escapeHTML(sale.id)}</strong></div>
        <div class="pos-receipt-meta"><span>Date</span><strong>${escapeHTML(sale.date || todayStr())}${timeLabel ? ` · ${escapeHTML(timeLabel)}` : ''}</strong></div>
        <div class="pos-receipt-meta"><span>Customer</span><strong>${escapeHTML(sale.customer || 'Walk-in')}</strong></div>
        <div class="pos-receipt-rule"></div>
        <div class="pos-receipt-items">${items.map(item => `<div class="pos-receipt-item">
            <div><strong>${escapeHTML(item.name || 'Item')}</strong><span>${Number(item.quantity) || 1} × ${formatPeso(item.unitPrice ?? item.total ?? 0)}</span></div>
            <strong>${formatPeso(item.total ?? sale.total)}</strong>
        </div>`).join('')}</div>
        <div class="pos-receipt-rule"></div>
        <div class="pos-receipt-total"><span>TOTAL PAID</span><strong>${formatPeso(sale.total)}</strong></div>
        <div class="pos-receipt-paid"><i class="fas fa-check-circle"></i> ${escapeHTML(sale.status || 'Paid')}</div>
        <footer class="pos-receipt-thanks">Thank you for choosing Iron Grind.<br>Train hard. Stay strong.</footer>
    </article>`;
}

function showSaleReceipt(id) {
    const sale = sales.find(item => String(item.id) === String(id));
    if (!sale) { toast('Receipt could not be found.', 'error'); return; }
    openModal(`<h3><i class="fas fa-receipt"></i> Sale Receipt</h3>
        <div class="pos-receipt-preview">${getSaleReceiptMarkup(sale)}</div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Close</button><button class="btn-primary" onclick="printSaleReceipt(decodeURIComponent('${encodeURIComponent(String(sale.id))}'))"><i class="fas fa-print"></i> Print Receipt</button></div>`);
}

function printSaleReceipt(id) {
    const sale = sales.find(item => String(item.id) === String(id));
    if (!sale) { toast('Receipt could not be found.', 'error'); return; }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        toast('Allow pop-ups to print the receipt.', 'error');
        return;
    }

    const logoURL = new URL('assets/images/iron-grind-mark.png', window.location.href).href;
    const receiptMarkup = getSaleReceiptMarkup(sale).replace('src="assets/images/iron-grind-mark.png"', `src="${logoURL}"`);
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Receipt ${escapeHTML(sale.id)}</title>
        <style>
            @page { size: 80mm auto; margin: 4mm; }
            * { box-sizing: border-box; }
            body { width: 72mm; margin: 0 auto; padding: 0; color: #171a20; font: 11px Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .pos-receipt { width: 100%; padding: 3mm 1mm; background: #fff; }
            .pos-receipt-header { display: flex; flex-direction: column; align-items: center; text-align: center; padding-bottom: 12px; border-bottom: 2px solid #d31212; }
            .pos-receipt-header img { width: 42px; height: 42px; margin-bottom: 5px; object-fit: contain; }
            .pos-receipt-brand { color: #151922; font-size: 16px; font-weight: 900; letter-spacing: 1.2px; }
            .pos-receipt-brand span { display: block; margin-top: 2px; color: #737987; font-size: 8px; letter-spacing: 3px; }
            .pos-receipt-label { margin-top: 9px; color: #d31212; font-size: 9px; font-weight: 800; letter-spacing: 2px; }
            .pos-receipt-meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 9px; }
            .pos-receipt-meta span { color: #666d79; }
            .pos-receipt-meta strong { text-align: right; }
            .pos-receipt-rule { margin: 11px 0; border-top: 1px dashed #aeb3bc; }
            .pos-receipt-item { display: flex; justify-content: space-between; gap: 8px; margin: 9px 0; font-size: 10px; }
            .pos-receipt-item > div { display: flex; flex-direction: column; gap: 3px; }
            .pos-receipt-item span { color: #666d79; font-size: 9px; }
            .pos-receipt-total { display: flex; justify-content: space-between; align-items: baseline; font-size: 10px; font-weight: 800; }
            .pos-receipt-total strong { color: #d31212; font-size: 16px; }
            .pos-receipt-paid { margin-top: 10px; color: #287a4b; font-size: 9px; font-weight: 700; text-align: center; text-transform: uppercase; }
            .pos-receipt-thanks { margin-top: 17px; padding-top: 10px; border-top: 1px solid #e1e3e8; color: #555d69; font-size: 9px; line-height: 1.6; text-align: center; }
        </style></head><body>${receiptMarkup}</body></html>`);
    printWindow.document.close();
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 350);
}

function getMemberActivityStatus(member) {
    const savedStatus = String(member.status || '').toLowerCase();
    const explicitlyInactive = ['inactive', 'disabled', 'suspended', 'expired'].includes(savedStatus);
    const membershipExpired = Boolean(member.expiry && member.expiry < todayStr());
    return explicitlyInactive || membershipExpired ? 'Inactive' : 'Active';
}

function archiveExpiredMembership(member, renewed = false) {
    if (!member?.expiry || member.expiry >= todayStr()) return;
    const exists = membershipArchives.find(record => record.memberId === member.id && record.expiry === member.expiry && record.plan === member.plan);
    if (exists) {
        if (renewed && !exists.renewedAt) exists.renewedAt = new Date().toISOString();
        return;
    }
    membershipArchives.unshift({
        id: `EA-${member.id}-${member.expiry}-${member.plan}`,
        memberId: member.id,
        memberName: member.name,
        username: member.username || '',
        plan: member.plan || '—',
        startDate: member.startDate || '',
        expiry: member.expiry,
        price: Number(member.planPrice || getPlanPrice(member.plan, member)) || 0,
        archivedAt: new Date().toISOString(),
        ...(renewed ? { renewedAt: new Date().toISOString() } : {})
    });
}

function captureExpiredMemberships() {
    const before = membershipArchives.length;
    members.forEach(archiveExpiredMembership);
    if (membershipArchives.length !== before) saveDB('membershipArchives', membershipArchives);
}

function renderReports() {
    const reports = [
        { id: 'membership', name: 'Membership Report' },
        { id: 'member-status', name: 'Active / Inactive Members' },
        { id: 'archives', name: 'Membership Archives' },
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
        const currentMembers = members.filter(member => !isPastMembershipArchiveGrace(member));
        body = `<table class="attendance-table"><thead><tr><th>Name</th><th>Plan</th><th>Started</th><th>Expires</th></tr></thead><tbody>
            ${currentMembers.map(m => `<tr><td>${m.name}</td><td>${m.plan}</td><td>${m.startDate || '—'}</td><td>${m.expiry}</td></tr>`).join('')}</tbody></table>`;
    } else if (type === 'member-status') {
        const activeMembers = members.filter(member => getMemberActivityStatus(member) === 'Active');
        const inactiveMembers = members.filter(member => getMemberActivityStatus(member) === 'Inactive');
        const statusTable = (items, status) => `<h4 style="margin:18px 0 8px; color:${status === 'Active' ? '#2ecc71' : '#ff6b6b'};">${status} Members (${items.length})</h4>
            <table class="attendance-table"><thead><tr><th>Name</th><th>Username</th><th>Registration Source</th><th>Plan</th><th>Expires</th></tr></thead><tbody>
            ${items.map(member => `<tr><td>${escapeHTML(member.name)}</td><td>${escapeHTML(member.username || '—')}</td><td>${escapeHTML(member.registrationSource || 'Not recorded')}</td><td>${escapeHTML(member.plan || '—')}</td><td>${escapeHTML(member.expiry || '—')}</td></tr>`).join('') || '<tr><td colspan="5">No members in this group.</td></tr>'}</tbody></table>`;
        body = `<p class="modal-sub">Active means the membership has not expired. Inactive includes expired, suspended, or disabled memberships.</p>
            ${statusTable(activeMembers, 'Active')}${statusTable(inactiveMembers, 'Inactive')}`;
    } else if (type === 'archives') {
        captureExpiredMemberships();
        const archivedPlans = [...planArchives].sort((a, b) => String(b.changedAt || '').localeCompare(String(a.changedAt || '')));
        const expiredMembers = membershipArchives.filter(isMembershipArchiveReady).sort((a, b) => String(b.expiry || '').localeCompare(String(a.expiry || '')));
        const expiredTable = expiredMembers.length
            ? `<table class="attendance-table"><thead><tr><th>Member</th><th>Username</th><th>Plan</th><th>Started</th><th>Expired</th><th>Fee</th></tr></thead><tbody>${expiredMembers.map(record => `<tr><td>${escapeHTML(record.memberName)}</td><td>${escapeHTML(record.username || '—')}</td><td>${escapeHTML(record.plan)}</td><td>${escapeHTML(record.startDate || '—')}</td><td>${escapeHTML(record.expiry)}</td><td>${formatPeso(record.price || 0)}</td></tr>`).join('')}</tbody></table>`
            : '<div class="empty-state">No expired subscriptions have been archived.</div>';
        const planTable = archivedPlans.length
            ? `<table class="attendance-table"><thead><tr><th>Member</th><th>Previous Plan</th><th>New Plan</th><th>Previous Expiry</th><th>New Expiry</th><th>Previous Fee</th><th>New Fee</th><th>Changed</th></tr></thead><tbody>${archivedPlans.map(record => `<tr><td>${escapeHTML(record.memberName)}</td><td>${escapeHTML(record.previousPlan)}</td><td>${escapeHTML(record.newPlan)}</td><td>${escapeHTML(record.previousExpiry || '—')}</td><td>${escapeHTML(record.newExpiry || '—')}</td><td>${formatPeso(record.previousPrice || 0)}</td><td>${formatPeso(record.newPrice || 0)}</td><td>${escapeHTML(record.changedAt ? new Date(record.changedAt).toLocaleString() : '—')}</td></tr>`).join('')}</tbody></table>`
            : '<div class="empty-state">No plan changes have been archived yet.</div>';
        body = `<section><h4>Expired Subscriptions (${expiredMembers.length})</h4>${expiredTable}</section><section style="margin-top:24px;"><h4>Plan Changes (${archivedPlans.length})</h4><p class="modal-sub">No refunds are issued for unused time on the previous plan.</p>${planTable}</section>`;
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
    const title = type === 'member-status'
        ? 'Active / Inactive Members Report'
        : type === 'archives'
            ? 'Membership Archives'
            : `${type.charAt(0).toUpperCase() + type.slice(1)} Report`;
    openModal(`<h3><i class="fas fa-chart-bar"></i> ${title}</h3>
        <div style="max-height:60vh; overflow:auto; margin-top:16px;">${body}</div>
        <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Close</button><button class="btn-primary" onclick="printReportPDF('${type}')"><i class="fas fa-file-pdf"></i> Print / Save PDF</button></div>`);
}

function printReportPDF(type) {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        toast('Allow pop-ups to print or save this report as a PDF.', 'error');
        return;
    }

    const reportNames = { membership: 'Membership', 'member-status': 'Active / Inactive Members', archives: 'Membership Archives', payment: 'Payment', attendance: 'Attendance', inventory: 'Inventory', sales: 'Sales' };
    const reportTitle = `${reportNames[type] || 'Gym'} Report`;
    let columns = [];
    let rows = [];
    let dateForRow = () => null;

    if (type === 'membership') {
        columns = ['Member', 'Plan', 'Started', 'Expires'];
        rows = members.filter(member => !isPastMembershipArchiveGrace(member)).map(member => ({
            cells: [member.name, member.plan, member.startDate || '—', member.expiry || '—'],
            date: member.startDate || member.registeredAt
        }));
        dateForRow = row => row.date;
    } else if (type === 'member-status') {
        columns = ['Member', 'Username', 'Registration Source', 'Plan', 'Expires'];
        rows = members.map(member => ({
            cells: [member.name, member.username || '—', member.registrationSource || 'Not recorded', member.plan || '—', member.expiry || '—'],
            status: getMemberActivityStatus(member)
        }));
    } else if (type === 'archives') {
        captureExpiredMemberships();
        columns = ['Record Type', 'Member', 'Username', 'Plan', 'Previous Plan', 'New Plan', 'Started', 'Expired', 'New Expiry', 'Fee', 'New Fee', 'Recorded'];
        rows = [
            ...membershipArchives.filter(isMembershipArchiveReady).map(record => ({
                cells: ['Expired subscription', record.memberName, record.username || '—', record.plan, '—', '—', record.startDate || '—', record.expiry, '—', formatPeso(record.price || 0), '—', record.expiry],
                date: record.expiry
            })),
            ...planArchives.map(record => ({
                cells: ['Plan change', record.memberName, '—', '—', record.previousPlan, record.newPlan, record.previousStartDate || '—', record.previousExpiry || '—', record.newExpiry || '—', formatPeso(record.previousPrice || 0), formatPeso(record.newPrice || 0), record.changedAt ? new Date(record.changedAt).toLocaleString() : '—'],
                date: record.changedAt
            }))
        ];
        dateForRow = row => row.date;
    } else if (type === 'payment' || type === 'sales') {
        columns = ['Receipt', 'Customer', 'Total', 'Date'];
        rows = sales.map(sale => ({ cells: [sale.id, sale.customer, formatPeso(sale.total), sale.date], date: sale.date }));
        dateForRow = row => row.date;
    } else if (type === 'attendance') {
        columns = ['Member', 'Date', 'Time in', 'Time out'];
        rows = attendance.map(record => ({
            cells: [record.memberName, record.date, record.timeIn, record.timeOut || '—'],
            date: record.date
        }));
        dateForRow = row => row.date;
    } else if (type === 'inventory') {
        columns = ['Product', 'Price', 'Stock'];
        rows = products.map(product => ({
            cells: [`${product.name}${product.size ? ` (${product.size})` : ''}`, formatPeso(product.price), product.stock]
        }));
    }

    const tableHTML = records => `<table><thead><tr>${columns.map(column => `<th>${escapeHTML(column)}</th>`).join('')}</tr></thead><tbody>${records.map(row =>
        `<tr>${row.cells.map(cell => `<td>${escapeHTML(cell ?? '—')}</td>`).join('')}</tr>`
    ).join('')}</tbody></table>`;

    let reportContent;
    if (type === 'inventory') {
        reportContent = `<section class="report-section"><div class="section-heading"><h2>Current Inventory Snapshot</h2><span>${rows.length} products</span></div>${rows.length ? tableHTML(rows) : '<p class="empty">No inventory records.</p>'}</section>`;
    } else if (type === 'member-status') {
        reportContent = ['Active', 'Inactive'].map(status => {
            const groupRows = rows.filter(row => row.status === status);
            return `<section class="report-section"><div class="section-heading"><h2>${status} Members</h2><span>${groupRows.length} ${groupRows.length === 1 ? 'member' : 'members'}</span></div>${groupRows.length ? tableHTML(groupRows) : '<p class="empty">No members in this group.</p>'}</section>`;
        }).join('');
    } else {
        const monthGroups = new Map();
        rows.forEach(row => {
            const value = dateForRow(row);
            const parsed = value ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : null;
            const key = parsed && !Number.isNaN(parsed.getTime())
                ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
                : 'undated';
            const label = key === 'undated'
                ? 'Date not recorded'
                : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(parsed);
            if (!monthGroups.has(key)) monthGroups.set(key, { label, rows: [] });
            monthGroups.get(key).rows.push(row);
        });
        const orderedGroups = [...monthGroups.entries()].sort(([a], [b]) => {
            if (a === 'undated') return 1;
            if (b === 'undated') return -1;
            return b.localeCompare(a);
        });
        reportContent = orderedGroups.length
            ? orderedGroups.map(([, group]) => `<section class="report-section"><div class="section-heading"><h2>${escapeHTML(group.label)}</h2><span>${group.rows.length} ${group.rows.length === 1 ? 'record' : 'records'}</span></div>${tableHTML(group.rows)}</section>`).join('')
            : '<p class="empty">No report records available.</p>';
    }

    const generatedAt = new Date().toLocaleString();
    const logoURL = new URL('assets/images/iron-grind-mark.png', window.location.href).href;
    reportWindow.document.open();
    reportWindow.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Iron Grind - ${reportTitle} - ${todayStr()}</title>
        <style>
            @page { size: auto; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #20242c; font: 11px Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .masthead { display: flex; align-items: center; gap: 14px; padding: 17px 20px; color: #fff; background: #11161f; border-bottom: 5px solid #d31212; }
            .masthead img { width: 48px; height: 48px; object-fit: contain; border-radius: 8px; background: #fff; }
            .brand { color: #c4cad5; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
            h1 { margin: 4px 0 0; color: #fff; font-size: 21px; }
            .meta { display: flex; justify-content: space-between; gap: 12px; margin: 15px 0 20px; color: #636b78; font-size: 10px; }
            .report-section { margin: 0 0 22px; }
            .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; padding: 8px 11px; border-left: 4px solid #d31212; background: #f2f3f5; break-after: avoid; }
            .section-heading h2 { margin: 0; color: #242933; font-size: 13px; }
            .section-heading span { color: #727987; font-size: 9px; font-weight: 700; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px 9px; border-bottom: 1px solid #e1e4e9; text-align: left; vertical-align: top; }
            th { color: #fff; background: #282e38; font-size: 9px; letter-spacing: .5px; text-transform: uppercase; }
            tbody tr:nth-child(even) { background: #f7f8fa; }
            tr { break-inside: avoid; }
            .empty { padding: 18px; border: 1px dashed #cbd0d8; color: #707887; text-align: center; }
            .footer { margin-top: 28px; padding-top: 9px; border-top: 1px solid #d8dce2; color: #858c98; font-size: 9px; }
            @media print { thead { display: table-header-group; } }
        </style></head><body><header class="masthead"><img src="${logoURL}" alt="Iron Grind"><div><div class="brand">Iron Grind Fitness Gym</div><h1>${escapeHTML(reportTitle)}</h1></div></header><div class="meta"><span>${rows.length} ${rows.length === 1 ? 'total record' : 'total records'}</span><span>Generated ${escapeHTML(generatedAt)}</span></div>${reportContent}<footer class="footer">Iron Grind Fitness Gym · Internal report · ${todayStr()}</footer></body></html>`);
    reportWindow.document.close();
    window.setTimeout(() => {
        reportWindow.focus();
        reportWindow.print();
    }, 300);
}

function exportAllReports() {
    const data = { members, products, sales, attendance, planArchives, generatedAt: new Date().toISOString() };
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
    planArchives = loadDB('planArchives');
    membershipArchives = loadDB('membershipArchives');
    captureExpiredMemberships();

    renderDashboard();
    renderMembers();
    renderApprovals();
    renderAttendance();
    renderSales();
    renderReports();

    window.setInterval(() => {
        captureExpiredMemberships();
        renderMembers();
    }, 60 * 1000);

    const pwInput = document.getElementById('storePasswordInput');
    if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlockStore(); });
});

window.addEventListener('load', () => {
    window.setTimeout(() => document.getElementById('page-loader')?.classList.add('hidden-loader'), 2500);
});

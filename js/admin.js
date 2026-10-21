(function guardAdmin() {
    const session = JSON.parse(localStorage.getItem('irongrind_session') || sessionStorage.getItem('irongrind_session') || 'null');
    if (!session || session.role !== 'admin') { window.location.href = 'index.html'; return; }
    document.getElementById('currentUserName').textContent = session.username;
})();

let members = [], products = [], sales = [], attendance = [], pendingApprovals = [], users = [];
let currentPlanFilter = 'all';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function formatPeso(n) { return '₱' + Number(n).toLocaleString('en-PH'); }
function uid(prefix) { return prefix + Math.floor(Math.random() * 9000 + 1000); }
function initials(name) { return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(); }
function loadDB(key) { try { return JSON.parse(localStorage.getItem('ig_' + key)) || []; } catch { return []; } }
function saveDB(key, data) { localStorage.setItem('ig_' + key, JSON.stringify(data)); }

let toastTimer;
function toast(msg, type = '') {
    const el = document.getElementById('toast'); el.textContent = msg; el.className = 'toast ' + type; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}
function openModal(html) { document.getElementById('modalContent').innerHTML = html; document.getElementById('modalOverlay').classList.remove('hidden'); }
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

function showAdminSection(section, event) {
    document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('section-' + section).classList.remove('hidden');
    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
    if (event && event.target) event.target.closest('.nav-item').classList.add('active');

    if (section === 'store') { document.getElementById('storeLocked').classList.remove('hidden'); document.getElementById('storeUnlocked').classList.add('hidden'); }
    if (section === 'membership') switchMemberTab('members');
    if (section === 'attendance') renderAttendance();
    if (section === 'sales') renderSales();
    if (section === 'reports') renderReports();
    if (section === 'dashboard') renderDashboard();
}

function switchMemberTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('tab-members').classList.toggle('hidden', tab !== 'members');
    document.getElementById('tab-approvals').classList.toggle('hidden', tab !== 'approvals');
    if (tab === 'approvals') renderApprovals(); else renderMembers();
}
function logout() { if(confirm('Logout?')){ localStorage.removeItem('irongrind_session'); sessionStorage.removeItem('irongrind_session'); window.location.href = 'index.html'; } }

function renderDashboard() {
    document.getElementById('statTotalMembers').textContent = members.length;
    const today = todayStr();
    const todayAtt = attendance.filter(a => a.date === today);
    document.getElementById('statCheckins').textContent = todayAtt.length;
    const todaySales = sales.filter(s => s.date === today && s.status === 'Paid');
    document.getElementById('statSales').textContent = formatPeso(todaySales.reduce((sum, s) => sum + Number(s.total), 0));
    const low = products.filter(p => p.stock <= 4);
    document.getElementById('statLowStock').textContent = low.length;
    document.getElementById('pendingBadge').textContent = pendingApprovals.filter(p=>p.status==='pending').length;

    document.getElementById('dashboardAttendanceTable').innerHTML = todayAtt.length ? `<table class="attendance-table"><thead><tr><th>Member</th><th>In</th><th>Out</th></tr></thead><tbody>${todayAtt.map(a=>`<tr><td>${a.memberName}</td><td>${a.timeIn}</td><td>${a.timeOut||'—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No check-ins.</div>';
    document.getElementById('lowStockList').innerHTML = low.length ? low.map(p=>`<div class="low-stock-item"><span>${p.name}</span><span class="qty">${p.stock} left</span></div>`).join('') : '<div class="empty-state">Stock OK.</div>';
}

function renderMembers() {
    const listEl = document.getElementById('membersList');
    listEl.innerHTML = `<div style="padding:20px;"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div></div>`;
    setTimeout(() => {
        const filtered = members.filter(m => currentPlanFilter === 'all' || m.plan === currentPlanFilter);
        listEl.innerHTML = filtered.length ? filtered.map(m => {
            const expired = m.expiry < todayStr();
            return `<div class="member-row">
                <div class="member-info"><div class="member-avatar">${initials(m.name)}</div><div class="member-details"><h4>${m.name}</h4><p>${m.plan} · Exp: ${m.expiry}</p></div></div>
                <div class="member-actions"><button class="qr-badge" onclick="showMemberQR('${m.id}')"><i class="fas fa-qrcode"></i></button><span class="approve-badge ${expired?'expired':'pending'}">${expired?'Expired':'Active'}</span></div>
            </div>`;
        }).join('') : '<div class="empty-state">No members.</div>';
    }, 300);
}

function renderApprovals() {
    const el = document.getElementById('approvalsList');
    const pending = pendingApprovals.filter(p => p.status === 'pending');
    document.getElementById('approvalsCount').textContent = pending.length;
    el.innerHTML = pending.length ? pending.map(p => `
        <div style="background:#0d1219; border-left:4px solid #f1c40f; border-radius:8px; padding:16px; margin-bottom:12px;">
            <h4>${p.fullName}</h4><p style="font-size:0.8rem; color:#8b95a9;">Plan: ${p.plan} | User: ${p.username}</p>
            <div style="margin-top:10px; display:flex; gap:10px;"><button class="btn-sm" onclick="rejectApp('${p.id}')">Reject</button><button class="btn-primary" onclick="approveApp('${p.id}')">Approve</button></div>
        </div>`).join('') : '<div class="empty-state">No pending applications.</div>';
}

function approveApp(id) {
    const idx = pendingApprovals.findIndex(x => x.id === id); if(idx===-1) return;
    const p = pendingApprovals[idx];
    users.push({ username: p.username, password: p.password, fullName: p.fullName });
    saveDB('users', users);
    members.push({ id: uid('M'), name: p.fullName, plan: p.plan, expiry: p.endDate, paid: true });
    saveDB('members', members);
    pendingApprovals.splice(idx, 1); saveDB('pendingApprovals', pendingApprovals);
    toast('Approved!', 'success'); renderApprovals(); renderMembers(); renderDashboard();
}

function rejectApp(id) {
    pendingApprovals = pendingApprovals.filter(x => x.id !== id); saveDB('pendingApprovals', pendingApprovals);
    renderApprovals(); renderDashboard(); toast('Rejected.', 'error');
}

function simulateQRScan() {
    if (!members.length) return toast('No members.', 'error');
    const m = members[Math.floor(Math.random() * members.length)];
    const t = new Date().toTimeString().slice(0, 5);
    attendance.push({ id: uid('A'), memberName: m.name, date: todayStr(), timeIn: t, timeOut: null });
    saveDB('attendance', attendance); toast(`${m.name} checked in!`, 'success'); renderDashboard();
}

function unlockStore() { if (document.getElementById('storePasswordInput').value === 'irongrind2025') { document.getElementById('storeLocked').classList.add('hidden'); document.getElementById('storeUnlocked').classList.remove('hidden'); renderStore(); } else toast('Wrong password', 'error'); }

function renderStore() {
    const supp = products.filter(p => p.category === 'Supplement');
    const merch = products.filter(p => p.category === 'Merch');
    document.getElementById('supplementsGrid').innerHTML = supp.map(p=>`<div class="product-card"><span class="cat">${p.category}</span><h4>${p.name}</h4><div class="price">${formatPeso(p.price)}</div><div class="stock">${p.stock} in stock</div></div>`).join('');
    document.getElementById('merchGrid').innerHTML = merch.map(p=>`<div class="product-card"><span class="cat">${p.category}</span><h4>${p.name}</h4><div class="price">${formatPeso(p.price)}</div><div class="stock">${p.stock} in stock</div></div>`).join('');
}

function openWalkInModal() {
    openModal(`<h3><i class="fas fa-user-plus"></i> Walk-in</h3>
    <div class="form-row"><div class="form-group"><label>Name</label><input type="text" id="wiName"></div><div class="form-group"><label>Mobile</label><input type="tel" id="wiContact"></div></div>
    <div class="modal-actions"><button class="btn-sm" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="submitWalkIn()">Register</button></div>`);
}

function submitWalkIn() {
    const name = document.getElementById('wiName').value;
    if(!name) return toast('Name required', 'error');
    members.push({ id: uid('M'), name, plan: 'Walk-in', expiry: addDays(todayStr(), 1), paid: true });
    saveDB('members', members); closeModal(); renderMembers(); renderDashboard(); toast('Walk-in registered!', 'success');
}

function renderSales() { document.getElementById('salesTable').innerHTML = '<div class="empty-state">No sales yet.</div>'; }
function renderReports() { document.getElementById('reportsGrid').innerHTML = '<div class="empty-state">Reports coming soon.</div>'; }
function openAddProductModal() { toast('Feature coming soon'); }
function openNewSaleModal() { toast('Feature coming soon'); }
function showMemberQR(id) { toast('QR generated'); }

document.addEventListener('DOMContentLoaded', () => {
    members = loadDB('members'); products = loadDB('products'); sales = loadDB('sales'); attendance = loadDB('attendance'); pendingApprovals = loadDB('pendingApprovals'); users = loadDB('users');
    renderDashboard();
});

window.addEventListener('load', () => { setTimeout(() => { document.getElementById('page-loader').classList.add('hidden-loader'); }, 500); });
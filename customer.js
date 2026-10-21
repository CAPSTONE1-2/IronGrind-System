/* =====================================================
   IRONGRIND CUSTOMER DASHBOARD — VIEW-ONLY + PROGRESS
   ===================================================== */

// ===== AUTH GUARD =====
let session;
(function guardCustomer() {
    session = JSON.parse(
        localStorage.getItem('irongrind_session') ||
        sessionStorage.getItem('irongrind_session') || 'null'
    );
    if (!session || session.role !== 'customer') {
        window.location.href = 'index.html?role=customer';
        return;
    }
    const pretty = session.fullName || session.username;
    document.getElementById('currentUserName').textContent = pretty;
    document.getElementById('heroName').textContent = pretty.split(' ')[0] + '!';
})();

// ===== HELPERS =====
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
function formatPeso(n) { return '₱' + Number(n).toLocaleString('en-PH'); }
function loadDB(key) {
    try { return JSON.parse(localStorage.getItem('ig_' + key)) || []; }
    catch { return []; }
}
function saveDB(key, data) { localStorage.setItem('ig_' + key, JSON.stringify(data)); }

// ===== PRODUCT IMAGE GENERATOR =====
// Since there are no real product photos stored, generate a branded placeholder
// using the product name. Swap `imgUrl` in your data with real image paths later.
function productImage(p) {
    if (p.image) return p.image;
    const label = encodeURIComponent(p.name.replace(/[—-]/g, ' ').trim());
    const color = p.category === 'Supplement' ? '1e2533' : '2a1a1a';
    const accent = p.category === 'Supplement' ? '2ecc71' : 'd31212';
    return `https://placehold.co/400x300/${color}/e8edf5?text=${label}&font=montserrat`;
}

// ===== TOAST & MODAL =====
let toastTimer;
function toast(msg, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
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
}

function logout() {
    if (!confirm('Are you sure you want to log out?')) return;
    localStorage.removeItem('irongrind_session');
    sessionStorage.removeItem('irongrind_session');
    document.getElementById('page-loader')?.classList.remove('hidden-loader');
    window.setTimeout(() => window.location.replace('index.html'), 350);
}

// ===== FIND CURRENT MEMBER =====
function getCurrentMember() {
    const members = loadDB('members');
    let m = members.find(m => m.username === session.username);
    if (!m && session.fullName) {
        m = members.find(m => m.name && m.name.toLowerCase() === session.fullName.toLowerCase());
    }
    return m || null;
}

// ===== MEMBERSHIP STATUS =====
function updateMemberStatus() {
    const m = getCurrentMember();
    const statusEl = document.getElementById('memberStatus');
    if (!m) {
        statusEl.textContent = 'Membership record not found. Contact the gym admin.';
        return;
    }
    const today = todayStr();
    const expired = m.expiry < today;
    if (expired) {
        statusEl.innerHTML = `Your membership <strong style="color:#e74c3c;">expired</strong> on ${m.expiry}. Please renew at the gym.`;
    } else {
        statusEl.innerHTML = `Your <strong>${m.plan}</strong> membership is active · Expires ${m.expiry}`;
    }
}

// ===== MEMBERSHIP PROGRESS =====
function renderMembershipProgress() {
    const el = document.getElementById('membershipProgress');
    const m = getCurrentMember();
    if (!m) {
        el.innerHTML = '<div class="empty-state">No membership record found.</div>';
        return;
    }

    const today = new Date(todayStr());
    const start = new Date(m.startDate || todayStr());
    const end = new Date(m.expiry);
    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const elapsed = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
    const daysLeft = Math.max(0, Math.round((end - today) / (1000 * 60 * 60 * 24)));
    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
    const expired = m.expiry < todayStr();

    // Progress bar colour
    let barColor = '#2ecc71';
    if (expired) barColor = '#d31212';
    else if (daysLeft <= 3) barColor = '#f1c40f';
    else if (daysLeft <= 7) barColor = '#e67e22';

    el.innerHTML = `
        <div class="progress-wrap">
            <div class="progress-meta">
                <div>
                    <span class="progress-label">Current Plan</span>
                    <div class="progress-plan">${m.plan}</div>
                </div>
                <div style="text-align:right;">
                    <span class="progress-label">${expired ? 'Status' : 'Days Remaining'}</span>
                    <div class="progress-plan" style="color:${barColor};">${expired ? 'Expired' : daysLeft + ' day' + (daysLeft === 1 ? '' : 's')}</div>
                </div>
            </div>

            <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${pct}%; background:${barColor};"></div>
            </div>

            <div class="progress-dates">
                <span><i class="fas fa-play"></i> Started ${m.startDate || '—'}</span>
                <span><i class="fas fa-flag-checkered"></i> Expires ${m.expiry}</span>
            </div>

            <div class="progress-stats">
                <div class="progress-stat">
                    <div class="ps-value">${totalDays}</div>
                    <div class="ps-label">Total Days</div>
                </div>
                <div class="progress-stat">
                    <div class="ps-value">${Math.min(elapsed, totalDays)}</div>
                    <div class="ps-label">Days Used</div>
                </div>
                <div class="progress-stat">
                    <div class="ps-value" style="color:${barColor};">${expired ? 0 : daysLeft}</div>
                    <div class="ps-label">Days Left</div>
                </div>
                <div class="progress-stat">
                    <div class="ps-value">${pct}%</div>
                    <div class="ps-label">Progress</div>
                </div>
            </div>

            ${expired ? `
            <div class="progress-alert">
                <i class="fas fa-exclamation-triangle"></i>
                Your membership has expired. Visit the front desk to renew.
            </div>` : daysLeft <= 3 ? `
            <div class="progress-alert warn">
                <i class="fas fa-bell"></i>
                Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left — renew soon at the gym!
            </div>` : ''}
        </div>
    `;
}

// ===== ATTENDANCE HISTORY =====
function renderAttendanceHistory() {
    const el = document.getElementById('attendanceHistory');
    const summaryEl = document.getElementById('attendanceSummary');
    const m = getCurrentMember();
    if (!m) {
        el.innerHTML = '<div class="empty-state">No member record.</div>';
        summaryEl.textContent = '';
        return;
    }

    const all = loadDB('attendance').filter(a =>
        a.memberId === m.id || a.memberName === m.name
    );

    // Summary counts
    const today = todayStr();
    const thisMonth = today.slice(0, 7);
    const monthCount = all.filter(a => a.date.startsWith(thisMonth)).length;
    const totalCount = all.length;
    const insideNow = all.some(a => a.date === today && !a.timeOut);

    summaryEl.innerHTML = `<i class="fas fa-clock"></i> ${totalCount} total visits · ${monthCount} this month${insideNow ? ' · <span style="color:#2ecc71;">Currently inside</span>' : ''}`;

    if (all.length === 0) {
        el.innerHTML = '<div class="empty-state">No attendance records yet. Check in at the gym to start tracking!</div>';
        return;
    }

    // Sort newest first, show last 15
    const sorted = [...all].sort((a, b) => (b.date + (b.timeIn || '')).localeCompare(a.date + (a.timeIn || '')));
    const recent = sorted.slice(0, 15);

    el.innerHTML = `
        <table class="attendance-table">
            <thead><tr><th>Date</th><th>Time In</th><th>Time Out</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
                ${recent.map(a => {
                    let duration = '—';
                    if (a.timeIn && a.timeOut) {
                        const [h1, m1] = a.timeIn.split(':').map(Number);
                        const [h2, m2] = a.timeOut.split(':').map(Number);
                        let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
                        if (mins < 0) mins += 24 * 60;
                        const hrs = Math.floor(mins / 60);
                        const rm = mins % 60;
                        duration = (hrs > 0 ? hrs + 'h ' : '') + rm + 'm';
                    }
                    const status = a.timeOut
                        ? '<span class="badge-status out">Completed</span>'
                        : '<span class="badge-status in">Inside</span>';
                    return `<tr>
                        <td>${a.date}</td>
                        <td>${a.timeIn || '—'}</td>
                        <td>${a.timeOut || '—'}</td>
                        <td>${duration}</td>
                        <td>${status}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        ${all.length > 15 ? `<p style="text-align:center; font-size:0.75rem; color:#6a748b; margin-top:12px;">Showing 15 of ${all.length} visits</p>` : ''}
    `;
}

// ===== STORE (VIEW ONLY) =====
function renderStore() {
    const products = loadDB('products');
    const supp = products.filter(p => p.category === 'Supplement');
    const merch = products.filter(p => p.category === 'Merch');

    const suppGrid = document.getElementById('customerSupplementsGrid');
    const merchGrid = document.getElementById('customerMerchGrid');

    if (supp.length === 0) suppGrid.innerHTML = '<div class="empty-state">No supplements available.</div>';
    else suppGrid.innerHTML = supp.map(productCard).join('');

    if (merch.length === 0) merchGrid.innerHTML = '<div class="empty-state">No merchandise available.</div>';
    else merchGrid.innerHTML = merch.map(productCard).join('');
}

function productCard(p) {
    const out = p.stock === 0;
    const low = p.stock > 0 && p.stock <= 4;
    let stockLabel = p.stock + ' in stock';
    let stockClass = '';
    if (out) { stockLabel = 'Out of stock'; stockClass = 'low'; }
    else if (low) { stockLabel = 'Only ' + p.stock + ' left'; stockClass = 'low'; }

    return `
        <div class="product-card view-only-card">
            <div class="product-img-wrap">
                <img src="${productImage(p)}" alt="${p.name}" loading="lazy">
                ${out ? '<span class="img-badge out">Out</span>' : ''}
            </div>
            <span class="cat">${p.category}</span>
            <h4>${p.name}${p.size ? ' — ' + p.size : ''}</h4>
            <div class="price-row">
                <span class="price">${formatPeso(p.price)}</span>
                <span class="stock-tag ${stockClass}">${stockLabel}</span>
            </div>
            <div class="view-only-note"><i class="fas fa-store"></i> Available in-store only</div>
        </div>`;
}

// ===== SHOW QR =====
function showQRCode() {
    const m = getCurrentMember();
    if (!m) {
        toast('Member record not found.', 'error');
        return;
    }
    const qrData = m.qrCode || ('IRONGRIND|' + (m.id || session.username) + '|' + (m.name || session.username));
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}`;
    openModal(`
        <h3><i class="fas fa-qrcode"></i> My QR Code</h3>
        <p class="modal-sub">Show this at the gym entrance for check-in.</p>
        <div style="text-align:center; padding:20px; background:#fff; border-radius:20px;">
            <img src="${qrUrl}" alt="My QR" style="width:240px; height:240px;">
        </div>
        <p style="text-align:center; margin-top:16px; font-size:0.85rem; color:#8b95a9;">
            Member: <strong>${m.name || session.username}</strong>
        </p>
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">Close</button>
            <button class="btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
        </div>
    `);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    updateMemberStatus();
    renderMembershipProgress();
    renderAttendanceHistory();
    renderStore();
});

window.addEventListener('load', () => {
    window.setTimeout(() => document.getElementById('page-loader')?.classList.add('hidden-loader'), 300);
});

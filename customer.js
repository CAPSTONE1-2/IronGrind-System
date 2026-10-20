/* =====================================================
   IRONGRIND CUSTOMER DASHBOARD — COMPLETE LOGIC
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

    // Fill the form with logged-in member's info
    const mfName = document.getElementById('mfName');
    if (mfName) mfName.value = session.fullName || session.username;
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
    window.location.href = 'index.html';
}

// ===== NUMERIC-ONLY PHONE VALIDATION =====
function validatePhoneInput(input) {
    const original = input.value;
    const cleaned = original.replace(/[^0-9]/g, '');
    const errorEl = document.getElementById(input.id + 'Error');

    if (original !== cleaned) {
        input.classList.add('input-error');
        if (errorEl) errorEl.classList.remove('hidden');
        input.value = cleaned;
        clearTimeout(input._errorTimer);
        input._errorTimer = setTimeout(() => {
            input.classList.remove('input-error');
            if (errorEl) errorEl.classList.add('hidden');
        }, 1600);
    } else {
        input.classList.remove('input-error');
        if (errorEl) errorEl.classList.add('hidden');
    }
}
function isValidPhoneNumber(value) {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length === 11 && digits.startsWith('09')) return true;
    if (digits.length === 12 && digits.startsWith('639')) return true;
    if (digits.length === 10 && digits.startsWith('9')) return true;
    return false;
}

// ===== FIND CURRENT MEMBER RECORD =====
function getCurrentMember() {
    const members = loadDB('members');
    return members.find(m => m.username === session.username) || null;
}

// ===== UPDATE STATUS TEXT =====
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
        statusEl.innerHTML = `Your membership <strong style="color:#e74c3c;">expired</strong> on ${m.expiry}. Please renew.`;
    } else {
        statusEl.innerHTML = `Your <strong>${m.plan}</strong> membership is active · Expires ${m.expiry}`;
    }
}

// ===== RENDER STORE =====
function renderStore() {
    const products = loadDB('products');
    const grid = document.getElementById('customerStoreGrid');
    if (products.length === 0) {
        grid.innerHTML = '<div class="empty-state">No products available right now.</div>';
        return;
    }
    grid.innerHTML = products.map(p => {
        const low = p.stock <= 4;
        const out = p.stock === 0;
        return `
            <div class="supplement-card">
                <span class="tag">${p.category}</span>
                <h4>${p.name}${p.size ? ' — ' + p.size : ''}</h4>
                <p class="desc">${p.category === 'Supplement' ? 'Premium quality' : 'Official gym merch'}</p>
                <div class="price-row">
                    <span class="price">${formatPeso(p.price)}</span>
                    <span class="stock-badge ${low ? 'low' : ''}">${out ? 'Out of stock' : p.stock + ' left'}</span>
                </div>
                <button class="btn-reserve-lg" ${out ? 'disabled' : ''} onclick="reserveItem('${p.id}')">
                    <i class="fas fa-bookmark"></i> ${out ? 'Unavailable' : 'Reserve Now'}
                </button>
            </div>`;
    }).join('');
}

// ===== RESERVE =====
function reserveItem(productId) {
    const products = loadDB('products');
    const p = products.find(x => x.id === productId);
    if (!p) return;
    if (p.stock < 1) { toast('Out of stock.', 'error'); return; }

    p.stock -= 1;
    saveDB('products', products);

    const reservations = loadDB('reservations_' + session.username);
    reservations.push({
        id: 'R' + Date.now(),
        productId: p.id,
        productName: p.name + (p.size ? ' — ' + p.size : ''),
        price: p.price,
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'Pending Payment'
    });
    saveDB('reservations_' + session.username, reservations);

    renderStore();
    renderMyReservations();
    toast(`✅ Reserved ${p.name}. Pay within 24 hours.`, 'success');
}

// ===== MY RESERVATIONS =====
function renderMyReservations() {
    const reservations = loadDB('reservations_' + session.username);
    const panel = document.getElementById('myReservationsPanel');
    const list = document.getElementById('myReservationsList');

    if (reservations.length === 0) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';

    list.innerHTML = reservations.map(r => {
        const expires = new Date(r.expiresAt);
        const hoursLeft = Math.max(0, Math.round((expires - Date.now()) / (1000 * 60 * 60)));
        return `
            <div class="member-row">
                <div class="member-info">
                    <div class="member-avatar" style="background:rgba(255,107,43,0.15);">
                        <i class="fas fa-bookmark" style="color:#ff6b2b;"></i>
                    </div>
                    <div class="member-details">
                        <h4>${r.productName}</h4>
                        <p>${formatPeso(r.price)} · Expires in ${hoursLeft}h</p>
                    </div>
                </div>
                <div class="member-actions">
                    <span class="approve-badge pending"><i class="fas fa-clock"></i> ${r.status}</span>
                    <button class="renew-btn" onclick="cancelReservation('${r.id}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>`;
    }).join('');
}

function cancelReservation(id) {
    if (!confirm('Cancel this reservation? Stock will be released.')) return;
    let reservations = loadDB('reservations_' + session.username);
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    const products = loadDB('products');
    const p = products.find(x => x.id === r.productId);
    if (p) { p.stock += 1; saveDB('products', products); }

    reservations = reservations.filter(x => x.id !== id);
    saveDB('reservations_' + session.username, reservations);

    renderStore();
    renderMyReservations();
    toast('Reservation cancelled. Stock released.', 'error');
}

// ===== SHOW QR =====
function showQRCode() {
    const m = getCurrentMember();
    if (!m) {
        toast('Member record not found.', 'error');
        return;
    }
    const qrData = m.qrCode || ('IRONGRIND|' + session.username);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrData)}`;
    openModal(`
        <h3><i class="fas fa-qrcode"></i> My QR Code</h3>
        <p class="modal-sub">Show this at the gym entrance for check-in.</p>
        <div style="text-align:center; padding:20px; background:#fff; border-radius:20px;">
            <img src="${qrUrl}" alt="My QR" style="width:240px; height:240px;">
        </div>
        <p style="text-align:center; margin-top:16px; font-size:0.85rem; color:#8b95a9;">
            Member: <strong>${session.fullName || session.username}</strong>
        </p>
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">Close</button>
            <button class="btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Print</button>
        </div>
    `);
}

// ===== RENEW MEMBERSHIP =====
function renewMembership() {
    openModal(`
        <h3><i class="fas fa-sync-alt"></i> Renew Membership</h3>
        <p class="modal-sub">Choose a plan to renew your membership.</p>
        <div class="form-group" style="margin-bottom:14px;">
            <label>Plan</label>
            <select id="renewPlan">
                <option value="Monthly|800">Monthly — ₱800</option>
                <option value="Half Month|400">Half Month — ₱400</option>
                <option value="Walk-in|80">Walk-in — ₱80</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="confirmRenew()">
                <i class="fas fa-check"></i> Confirm Renewal
            </button>
        </div>
    `);
}

function confirmRenew() {
    const [plan, price] = document.getElementById('renewPlan').value.split('|');
    const days = plan === 'Monthly' ? 30 : plan === 'Half Month' ? 15 : 1;
    const expiry = addDays(todayStr(), days);

    // Update the member record
    const members = loadDB('members');
    const idx = members.findIndex(m => m.username === session.username);
    if (idx !== -1) {
        members[idx].plan = plan;
        members[idx].startDate = todayStr();
        members[idx].expiry = expiry;
        members[idx].paid = true;
        saveDB('members', members);
    }

    // Record sale
    const sales = loadDB('sales');
    sales.unshift({
        id: 'IG-' + Date.now().toString().slice(-4),
        customer: session.fullName || session.username,
        items: plan + ' Renewal',
        total: Number(price),
        date: todayStr(),
        status: 'Paid'
    });
    saveDB('sales', sales);

    updateMemberStatus();
    closeModal();
    toast(`✅ Membership renewed until ${expiry}.`, 'success');
}

// ===== MEMBERSHIP FORM (for renewals/updates from dashboard) =====
function submitMembershipForm(event) {
    event.preventDefault();
    const name = document.getElementById('mfName').value.trim();
    const contact = document.getElementById('mfContact').value.trim();
    const [plan] = document.getElementById('mfPlan').value.split('|');
    const goal = document.getElementById('mfGoal').value;

    if (!name || !contact) { toast('Please fill in all fields.', 'error'); return; }

    if (!/^[0-9]+$/.test(contact)) {
        toast('Contact number must contain numbers only.', 'error');
        document.getElementById('mfContact').classList.add('input-error');
        return;
    }
    if (!isValidPhoneNumber(contact)) {
        toast('Enter a valid PH mobile number (e.g. 09171234567).', 'error');
        document.getElementById('mfContact').classList.add('input-error');
        return;
    }

    // Push to pending approvals
    const pending = loadDB('pendingApprovals');
    pending.push({
        id: 'APP' + Date.now(),
        fullName: name,
        mobile: contact,
        plan, planPrice: 0,
        goals: [goal],
        username: session.username,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        source: 'dashboard-renewal'
    });
    saveDB('pendingApprovals', pending);

    toast('✅ Form submitted! Awaiting admin approval.', 'success');
    event.target.reset();
    document.getElementById('mfName').value = name;
}

// ===== CHATBOT =====
function toggleChatbot() {
    document.getElementById('chatbotPanel').classList.toggle('open');
}

function sendChatMessage() {
    const input = document.getElementById('chatbotInput');
    const body = document.getElementById('chatbotBody');
    const text = input.value.trim();
    if (!text) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'msg user';
    userMsg.textContent = text;
    body.appendChild(userMsg);
    input.value = '';
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'msg bot';
        const lower = text.toLowerCase();
        const products = loadDB('products');

        if (lower.includes('supplement') || lower.includes('protein') || lower.includes('creatine')) {
            const supps = products.filter(p => p.category === 'Supplement').slice(0, 4);
            const list = supps.map(p => `• ${p.name} — ${formatPeso(p.price)} (${p.stock} left)`).join('<br>');
            botMsg.innerHTML = `💊 Available supplements:<br>${list || 'No supplements currently stocked.'}<br><br>Tap Reserve on the store section!`;
        } else if (lower.includes('workout') || lower.includes('routine') || lower.includes('exercise')) {
            const workouts = {
                muscle: '🏋️ <strong>Muscle Gain</strong><br>Warm-up: 5 min bike<br>Bench Press: 4x8<br>Squats: 4x10<br>Deadlifts: 3x8<br>Rows: 3x10<br>Cool-down: Stretch',
                weight: '🔥 <strong>Weight Loss</strong><br>Warm-up: 5 min jog<br>Burpees: 3x15<br>Jump Rope: 3x60s<br>Mountain Climbers: 3x20<br>Plank: 3x45s',
                default: '🏋️ <strong>Full-Body</strong><br>Warm-up: 5 min cardio<br>Squats: 4x10<br>Push-ups: 3x15<br>Rows: 3x12<br>Plank: 3x45s'
            };
            const goal = lower.includes('muscle') ? 'muscle' : lower.includes('weight') ? 'weight' : 'default';
            botMsg.innerHTML = workouts[goal];
        } else if (lower.includes('membership') || lower.includes('renew')) {
            botMsg.innerHTML = '📋 Use the <strong>Renew Membership</strong> button on your dashboard. Need help with anything else?';
        } else if (lower.includes('price') || lower.includes('how much')) {
            botMsg.innerHTML = '💰 Monthly ₱800 · Half Month ₱400 · Walk-in ₱80';
        } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
            botMsg.innerHTML = 'Hey! 👋 Ask me for a <strong>workout</strong>, <strong>supplement</strong>, or <strong>membership</strong> help.';
        } else {
            botMsg.textContent = 'Got it! I can help with workouts, supplements, prices, and membership info.';
        }
        body.appendChild(botMsg);
        body.scrollTop = body.scrollHeight;
    }, 600);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    updateMemberStatus();
    renderStore();
    renderMyReservations();

    const chatInput = document.getElementById('chatbotInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }

    // Block non-numeric keystrokes on phone field
    document.addEventListener('keypress', (e) => {
        const el = e.target;
        if (el.tagName !== 'INPUT') return;
        if (el.id !== 'mfContact') return;
        if (!/[0-9]/.test(e.key)) {
            e.preventDefault();
            el.classList.add('input-error');
            const errorEl = document.getElementById('mfContactError');
            if (errorEl) errorEl.classList.remove('hidden');
            clearTimeout(el._errorTimer);
            el._errorTimer = setTimeout(() => {
                el.classList.remove('input-error');
                if (errorEl) errorEl.classList.add('hidden');
            }, 1600);
        }
    });

    // Auto-expire old reservations
    const reservations = loadDB('reservations_' + session.username);
    const now = Date.now();
    let changed = false;
    const active = reservations.filter(r => {
        if (new Date(r.expiresAt).getTime() < now && r.status === 'Pending Payment') {
            const products = loadDB('products');
            const p = products.find(x => x.id === r.productId);
            if (p) { p.stock += 1; saveDB('products', products); }
            changed = true;
            return false;
        }
        return true;
    });
    if (changed) {
        saveDB('reservations_' + session.username, active);
        renderStore();
        renderMyReservations();
    }
});
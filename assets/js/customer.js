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

function saveExpiredMembershipSnapshot(member, renewed = false) {
    if (!member?.expiry || member.expiry >= todayStr()) return;
    const archives = loadDB('membershipArchives');
    const existing = archives.find(record => record.memberId === member.id && record.expiry === member.expiry && record.plan === member.plan);
    if (existing) {
        if (renewed && !existing.renewedAt) {
            existing.renewedAt = new Date().toISOString();
            saveDB('membershipArchives', archives);
        }
        return;
    }
    archives.unshift({
        id: `EA-${member.id}-${member.expiry}-${member.plan}`,
        memberId: member.id,
        memberName: member.name,
        username: member.username || '',
        plan: member.plan || '—',
        startDate: member.startDate || '',
        expiry: member.expiry,
        price: Number(member.planPrice) || 0,
        archivedAt: new Date().toISOString(),
        ...(renewed ? { renewedAt: new Date().toISOString() } : {})
    });
    saveDB('membershipArchives', archives);
}

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
    if (memberTourActive) finishMemberTour();
    document.getElementById('modalOverlay').classList.add('hidden');
}

// ===== FIRST-VISIT MEMBER TOUR =====
let memberTourActive = false;
let memberTourStep = -1;
const memberTourSteps = [
    {
        icon: 'fa-qrcode',
        target: '.customer-hero',
        title: 'Your member QR code',
        text: 'Use the Show QR Code button when you arrive. Gym staff can scan it to record your visit.'
    },
    {
        icon: 'fa-chart-line',
        target: '#member-progress',
        scrollBlock: 'start',
        title: 'Track your membership',
        text: 'Check your current plan and how much time is left in your membership here.'
    },
    {
        icon: 'fa-calendar-check',
        target: '#member-attendance',
        title: 'Review your visits',
        text: 'Your attendance history shows the dates and times you have visited the gym.'
    },
    {
        icon: 'fa-id-card',
        target: '#member-request > summary',
        title: 'Request a renewal',
        text: 'Open Membership Registration / Renewal to fill out a request and send it to the gym admin.'
    },
    {
        icon: 'fa-store',
        target: '#member-store > summary',
        title: 'Browse the gym store',
        text: 'Open this section to see supplements and gym merchandise available for purchase in person.'
    }
];

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function memberTourStorageKey() {
    return `ig_member_tour_seen_${String(session?.username || 'member').toLowerCase()}`;
}

function showMemberWelcome() {
    let alreadySeen = false;
    try { alreadySeen = localStorage.getItem(memberTourStorageKey()) === 'true'; }
    catch { alreadySeen = true; }
    if (alreadySeen) return;
    memberTourActive = true;
    memberTourStep = -1;
    renderMemberTourStep();
}

function renderMemberTourStep() {
    const firstName = escapeHTML((session?.fullName || session?.username || 'Member').trim().split(/\s+/)[0]);
    if (memberTourStep < 0) {
        document.getElementById('memberTourLayer')?.classList.add('hidden');
        openModal(`<section class="member-onboarding" role="dialog" aria-modal="true" aria-labelledby="memberTourTitle">
            <div class="onboarding-mark"><i class="fas fa-dumbbell"></i></div>
            <p class="onboarding-eyebrow">IRON GRIND MEMBER PORTAL</p>
            <h2 id="memberTourTitle">Welcome, ${firstName}!</h2>
            <p class="onboarding-copy">Here’s a quick tour to help you get started. It only takes a moment.</p>
            <div class="onboarding-actions"><button class="btn-sm" onclick="finishMemberTour()">Skip tour</button><button class="btn-primary" onclick="startMemberTour()">Start tour <i class="fas fa-arrow-right"></i></button></div>
        </section>`);
        return;
    }

    const step = memberTourSteps[memberTourStep];
    const progress = memberTourSteps.map((_, index) => `<span class="${index <= memberTourStep ? 'current' : ''}"></span>`).join('');
    const isLast = memberTourStep === memberTourSteps.length - 1;
    document.getElementById('modalOverlay').classList.add('hidden');
    const layer = document.getElementById('memberTourLayer');
    const tooltip = document.getElementById('memberTourTooltip');
    tooltip.innerHTML = `<section class="member-tour-card" role="dialog" aria-modal="false" aria-labelledby="memberTourTitle">
        <div class="onboarding-progress"><span>STEP ${memberTourStep + 1} OF ${memberTourSteps.length}</span><div>${progress}</div></div>
        <div class="tour-card-icon"><i class="fas ${step.icon}"></i></div>
        <h2 id="memberTourTitle">${step.title}</h2>
        <p class="onboarding-copy">${step.text}</p>
        <div class="onboarding-actions"><button class="btn-sm" onclick="previousMemberTourStep()"><i class="fas fa-arrow-left"></i> Back</button><button class="btn-primary" onclick="${isLast ? 'finishMemberTour()' : 'nextMemberTourStep()'}">${isLast ? 'Finish' : 'Next'} <i class="fas ${isLast ? 'fa-check' : 'fa-arrow-right'}"></i></button></div>
        <button class="onboarding-skip" onclick="finishMemberTour()">Skip tour</button>
    </section>`;
    layer.classList.remove('hidden');
    const target = document.querySelector(step.target);
    target?.scrollIntoView({
        behavior: step.scrollBlock ? 'auto' : 'smooth',
        block: step.scrollBlock || 'center',
        inline: 'nearest'
    });
    repositionMemberTour();
    window.setTimeout(repositionMemberTour, step.scrollBlock ? 0 : 320);
}

function repositionMemberTour() {
    if (!memberTourActive || memberTourStep < 0) return;
    const step = memberTourSteps[memberTourStep];
    const target = document.querySelector(step.target);
    const spotlight = document.getElementById('memberTourSpotlight');
    const tooltip = document.getElementById('memberTourTooltip');
    if (!target || !spotlight || !tooltip) return;

    const rect = target.getBoundingClientRect();
    const pad = 7;
    spotlight.style.left = `${Math.max(4, rect.left - pad)}px`;
    spotlight.style.top = `${Math.max(4, rect.top - pad)}px`;
    spotlight.style.width = `${Math.min(window.innerWidth - 8, rect.width + pad * 2)}px`;
    spotlight.style.height = `${Math.min(window.innerHeight - 8, rect.height + pad * 2)}px`;

    const tipRect = tooltip.getBoundingClientRect();
    const margin = 16;
    const gap = 16;
    const rightSpace = window.innerWidth - rect.right - margin;
    const leftSpace = rect.left - margin;
    let left;
    let top;

    // Keep the membership progress card unobstructed. That step scrolls the
    // tracker near the top; on desktop, use the open space to its right.
    if (step.scrollBlock === 'start') {
        if (window.innerWidth >= 900 && rightSpace >= tipRect.width + gap) {
            left = rect.right + gap;
            top = Math.max(margin, Math.min(rect.top + rect.height / 2 - tipRect.height / 2, window.innerHeight - tipRect.height - margin));
        } else {
            left = Math.max(margin, Math.min(rect.left + rect.width / 2 - tipRect.width / 2, window.innerWidth - tipRect.width - margin));
            top = rect.bottom + gap;
        }
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        return;
    }

    if (rightSpace >= tipRect.width + gap) {
        left = rect.right + gap;
        top = Math.max(margin, Math.min(rect.top + rect.height / 2 - tipRect.height / 2, window.innerHeight - tipRect.height - margin));
    } else if (leftSpace >= tipRect.width + gap) {
        left = rect.left - tipRect.width - gap;
        top = Math.max(margin, Math.min(rect.top + rect.height / 2 - tipRect.height / 2, window.innerHeight - tipRect.height - margin));
    } else {
        left = Math.max(margin, Math.min(rect.left + rect.width / 2 - tipRect.width / 2, window.innerWidth - tipRect.width - margin));
        const below = rect.bottom + gap;
        const above = rect.top - tipRect.height - gap;
        if (below + tipRect.height <= window.innerHeight - margin) top = below;
        else if (above >= margin) top = above;
        else top = Math.max(margin, Math.min(rect.top + rect.height / 2 - tipRect.height / 2, window.innerHeight - tipRect.height - margin));
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function startMemberTour() {
    memberTourStep = 0;
    renderMemberTourStep();
}

function nextMemberTourStep() {
    if (memberTourStep < 0) return startMemberTour();
    if (memberTourStep >= memberTourSteps.length - 1) return finishMemberTour();
    memberTourStep += 1;
    renderMemberTourStep();
}

function previousMemberTourStep() {
    if (memberTourStep <= 0) {
        memberTourStep = -1;
        document.getElementById('memberTourLayer')?.classList.add('hidden');
    } else {
        memberTourStep -= 1;
    }
    renderMemberTourStep();
}

function finishMemberTour() {
    memberTourActive = false;
    try { localStorage.setItem(memberTourStorageKey(), 'true'); } catch {}
    document.getElementById('modalOverlay').classList.add('hidden');
    document.getElementById('memberTourLayer')?.classList.add('hidden');
}

window.addEventListener('resize', repositionMemberTour);
window.addEventListener('scroll', repositionMemberTour, true);

function printQRCode() {
    document.body.classList.add('print-qr-only');
    const cleanup = () => document.body.classList.remove('print-qr-only');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
}

function confirmLogout() {
    openModal(`<div class="confirm-dialog">
        <div class="confirm-dialog-icon"><i class="fas fa-right-from-bracket"></i></div>
        <h3>Log out?</h3>
        <p class="modal-sub">Are you sure you want to log out?</p>
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">Cancel</button>
            <button class="btn-danger" onclick="completeLogout()">Log out</button>
        </div>
    </div>`);
}

function logout() {
    confirmLogout();
}

function completeLogout() {
    closeModal();
    localStorage.removeItem('irongrind_session');
    sessionStorage.removeItem('irongrind_session');
    document.getElementById('page-loader')?.classList.remove('hidden-loader');
    window.setTimeout(() => window.location.replace('index.html'), 1200);
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
    const supplement = p.category === 'Supplement';
    const low = p.stock > 0 && (supplement ? p.stock <= 100 : p.stock <= 4);
    let stockLabel = `${Number(p.stock).toLocaleString('en-PH')}${supplement ? ' g' : ''} in stock`;
    let stockClass = '';
    if (out) { stockLabel = 'Out of stock'; stockClass = 'low'; }
    else if (low) { stockLabel = 'Only ' + p.stock + (supplement ? ' g left' : ' left'); stockClass = 'low'; }

    return `
        <div class="product-card view-only-card">
            <div class="product-img-wrap">
                <img src="${productImage(p)}" alt="${p.name}" loading="lazy">
                ${out ? '<span class="img-badge out">Out</span>' : ''}
            </div>
            <span class="cat">${p.category}</span>
            <h4>${p.name}${!supplement && p.size ? ' — ' + p.size : ''}</h4>
            <div class="price-row">
                <span class="price">${formatPeso(p.price)}${supplement ? ' / g' : ''}</span>
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
        <div class="qr-print-card"><div class="qr-print-gym">Iron Grind Fitness Gym</div><img src="${qrUrl}" alt="Member QR code"></div>
        <p style="text-align:center; margin-top:16px; font-size:0.85rem; color:#8b95a9;">
            Member: <strong>${m.name || session.username}</strong>
        </p>
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">Close</button>
            <button class="btn-primary" onclick="printQRCode()"><i class="fas fa-print"></i> Print</button>
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
    const m = getCurrentMember();
    if (!m) {
        toast('No membership record found. Please contact admin.', 'error');
        closeModal();
        return;
    }

    const [plan, price] = document.getElementById('renewPlan').value.split('|');
    const days = plan === 'Monthly' ? 30 : plan === 'Half Month' ? 15 : 1;
    const expiry = addDays(todayStr(), days);

    // Update the member record (match by id)
    const members = loadDB('members');
    const idx = members.findIndex(x => x.id === m.id);
    if (idx !== -1) {
        saveExpiredMembershipSnapshot(members[idx], true);
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
const membershipSignature = initDigitalSignature('membershipSignature', 'clearMembershipSignature');

function submitMembershipForm(event) {
    event.preventDefault();
    const name = document.getElementById('mfName').value.trim();
    const contact = document.getElementById('mfContact').value.trim();
    const planInput = document.getElementById('mfPlan');
    const [plan, planPriceStr] = planInput ? planInput.value.split('|') : ['Renewal', '0'];
    const planPrice = Number(planPriceStr) || 0;
    const goal = document.getElementById('mfGoal')?.value || 'General Fitness';

    if (!membershipSignature || membershipSignature.isEmpty()) {
        toast('Please add your digital signature.', 'error');
        return;
    }

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
        plan,
        planPrice,
        goals: [goal],
        signature: membershipSignature.toDataURL(),
        username: session.username,
        memberId: getCurrentMember()?.id || null,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        source: 'dashboard-renewal'
    });
    saveDB('pendingApprovals', pending);

    toast('✅ Form submitted! Awaiting admin approval.', 'success');
    document.getElementById('mfContact').value = '';
    membershipSignature.clear();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    updateMemberStatus();
    renderMembershipProgress();
    renderAttendanceHistory();
    renderStore();
    window.setTimeout(showMemberWelcome, 2600);
});

window.addEventListener('load', () => {
    window.setTimeout(() => document.getElementById('page-loader')?.classList.add('hidden-loader'), 2500);
});

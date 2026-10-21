function loadDB(key) {
    try {
        const value = JSON.parse(localStorage.getItem(`ig_${key}`) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function readSession() {
    for (const storage of [localStorage, sessionStorage]) {
        try {
            const session = JSON.parse(storage.getItem('irongrind_session') || 'null');
            if (session) return session;
        } catch {
            storage.removeItem('irongrind_session');
        }
    }
    return null;
}

const customerSession = readSession();
if (!customerSession || customerSession.role !== 'customer') {
    window.location.replace('index.html');
} else {
    document.addEventListener('DOMContentLoaded', initializeCustomerDashboard);
}

function initializeCustomerDashboard() {
    const name = customerSession.fullName || customerSession.username || 'Member';
    setText('currentUserName', name);
    setText('heroName', `${name}!`);

    const member = loadDB('members').find(item =>
        item.username === customerSession.username || item.name === name
    );
    const visits = loadDB('attendance').filter(item =>
        item.username === customerSession.username || item.memberName === name
    );

    renderMembership(member);
    renderVisitSummary(visits);
    renderRecentAttendance(visits);
    renderProgress(member, visits);
    renderMyAttendance();
    renderCustomerStore();
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function renderMembership(member) {
    if (!member) {
        setText('memberStatus', 'Your membership details will appear here after approval.');
        setText('statPlan', '—');
        setText('statPlanSub', 'No active plan');
        setText('statDaysLeft', '0');
        document.getElementById('progressBarWrap').innerHTML = '<div class="empty-state">No membership information available.</div>';
        return;
    }

    const expiry = member.expiry || member.endDate;
    const daysLeft = expiry ? Math.max(0, Math.ceil((new Date(`${expiry}T00:00:00`) - new Date(new Date().toDateString())) / 86400000)) : 0;
    setText('memberStatus', expiry ? `Membership valid until ${expiry}.` : 'Membership active.');
    setText('statPlan', member.plan || 'Member');
    setText('statPlanSub', expiry ? `Expires ${expiry}` : 'Active membership');
    setText('statDaysLeft', String(daysLeft));

    const elapsed = expiry ? Math.max(0, Math.min(100, 100 - (daysLeft / 30) * 100)) : 0;
    document.getElementById('progressBarWrap').innerHTML = `
        <p>${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining</p>
        <div class="progress-track"><div class="progress-fill" style="width:${elapsed}%"></div></div>`;
    document.getElementById('progressDetail').innerHTML = `
        <p><strong>${member.plan || 'Membership'}</strong></p>
        <p>${expiry ? `Valid until ${expiry}` : 'Active membership'}</p>`;
}

function renderVisitSummary(visits) {
    const now = new Date();
    const thisMonth = visits.filter(item => {
        const date = new Date(`${item.date}T00:00:00`);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    setText('statVisits', String(thisMonth.length));
    setText('statTotalVisits', String(visits.length));
}

function renderRecentAttendance(visits) {
    const recent = [...visits].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    document.getElementById('recentAttendance').innerHTML = recent.length
        ? `<ul>${recent.map(item => `<li>${item.date || 'Unknown date'}${item.timeIn ? ` · ${item.timeIn}` : ''}</li>`).join('')}</ul>`
        : '<div class="empty-state">No check-ins yet.</div>';
}

function renderProgress(member, visits) {
    const chart = document.getElementById('weeklyChart');
    if (chart) {
        const weeks = Array.from({ length: 8 }, (_, index) => {
            const start = new Date();
            start.setDate(start.getDate() - (7 * (7 - index)));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            const count = visits.filter(item => {
                const date = new Date(`${item.date}T00:00:00`);
                return date >= start && date < end;
            }).length;
            return { label: start.toLocaleDateString('en', { month: 'short', day: 'numeric' }), count };
        });
        const max = Math.max(1, ...weeks.map(week => week.count));
        chart.innerHTML = weeks.map(week => `
            <div style="flex:1;text-align:center;height:100%;display:flex;flex-direction:column;justify-content:flex-end;">
                <span>${week.count}</span>
                <div style="height:${Math.max(4, week.count / max * 110)}px;background:#ff4d1a;border-radius:6px 6px 0 0;"></div>
                <small>${week.label}</small>
            </div>`).join('');
    }
    const goal = document.getElementById('goalCard');
    if (goal) goal.innerHTML = member ? '<div class="empty-state">Keep checking in to build your progress.</div>' : '<div class="empty-state">Your fitness goal will appear here.</div>';
}

function showCustomerSection(section, event) {
    document.querySelectorAll('.admin-section').forEach(element => element.classList.add('hidden'));
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.sidebar .nav-item').forEach(element => element.classList.remove('active'));
    const button = event?.target?.closest('.nav-item');
    if (button) button.classList.add('active');
    if (section === 'attendance') renderMyAttendance();
    if (section === 'store') renderCustomerStore();
}

function renderMyAttendance() {
    const body = document.getElementById('myAttendanceTable');
    if (!body || !customerSession) return;
    const range = Number(document.getElementById('attendanceRange')?.value || 30);
    const allVisits = loadDB('attendance').filter(item =>
        item.username === customerSession.username || item.memberName === (customerSession.fullName || customerSession.username)
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const visits = allVisits.filter(item => !range || new Date(`${item.date}T00:00:00`) >= cutoff)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    setText('attSessions', String(visits.length));
    const durations = visits.map(item => {
        if (!item.timeIn || !item.timeOut) return null;
        const minutes = (new Date(`1970-01-01T${item.timeOut}`) - new Date(`1970-01-01T${item.timeIn}`)) / 60000;
        return minutes >= 0 ? minutes : null;
    }).filter(value => value !== null);
    setText('attAvg', durations.length ? `${Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)} min` : '—');
    setText('attLongest', durations.length ? `${Math.max(...durations)} min` : '—');

    const days = new Set(allVisits.map(item => item.date).filter(Boolean));
    let streak = 0;
    const day = new Date();
    if (!days.has(day.toISOString().slice(0, 10))) day.setDate(day.getDate() - 1);
    while (days.has(day.toISOString().slice(0, 10))) {
        streak += 1;
        day.setDate(day.getDate() - 1);
    }
    const streakElement = document.getElementById('attStreak');
    if (streakElement) streakElement.innerHTML = `${streak} <span style="font-size:0.8rem;color:#8b95a9;">days</span>`;

    body.innerHTML = visits.length
        ? `<table class="attendance-table"><thead><tr><th>Date</th><th>Time in</th><th>Time out</th></tr></thead><tbody>${visits.map(item => `<tr><td>${item.date || '—'}</td><td>${item.timeIn || '—'}</td><td>${item.timeOut || '—'}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty-state">No attendance records for this period.</div>';
}

function renderCustomerStore() {
    const products = loadDB('products');
    const renderGroup = category => {
        const matches = products.filter(product => product.category === category);
        return matches.length ? matches.map(product => `
            <div class="product-card"><span class="cat">${product.category}</span><h4>${product.name}</h4>
            <div class="price">₱${Number(product.price || 0).toLocaleString('en-PH')}</div>
            <div class="stock">${Number(product.stock || 0)} in stock</div></div>`).join('')
            : '<div class="empty-state">No products available.</div>';
    };
    const supplements = document.getElementById('customerSupplementsGrid');
    const merchandise = document.getElementById('customerMerchGrid');
    if (supplements) supplements.innerHTML = renderGroup('Supplement');
    if (merchandise) merchandise.innerHTML = renderGroup('Merch');
}

function showQRCode() {
    openModal(`<h3>Member QR Code</h3><p>${customerSession?.username || 'Member'}</p><div class="empty-state">Show your member username at the counter for attendance check-in.</div>`);
}

function openModal(html) {
    const content = document.getElementById('modalContent');
    const overlay = document.getElementById('modalOverlay');
    if (content && overlay) {
        content.innerHTML = html;
        overlay.classList.remove('hidden');
    }
}

function closeModal() {
    document.getElementById('modalOverlay')?.classList.add('hidden');
}

function toast(message, type = '') {
    const element = document.getElementById('toast');
    if (!element) return;
    element.textContent = message;
    element.className = `toast ${type}`;
    element.classList.remove('hidden');
    clearTimeout(window.customerToastTimer);
    window.customerToastTimer = setTimeout(() => element.classList.add('hidden'), 3000);
}

function logout() {
    localStorage.removeItem('irongrind_session');
    sessionStorage.removeItem('irongrind_session');
    window.location.replace('index.html');
}

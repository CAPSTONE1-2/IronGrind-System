/* =====================================================
   IRONGRIND CUSTOMER DASHBOARD — VIEW-ONLY + PROGRESS
   ===================================================== */

// ===== AUTH GUARD =====
let session;
let supabaseMember = null;
let supabaseAttendance = null;
let supabaseProducts = null;
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
function isUUID(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')); }
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
function renewalFormMessage(message, type = '') {
    const status = document.getElementById('renewalFormStatus');
    if (status) {
        status.textContent = message;
        status.style.color = type === 'error' ? '#ff7777' : type === 'success' ? '#69d899' : '#b8c0cc';
    }
    if (message) toast(message, type);
}
function settingsFormMessage(message, type = '') {
    setSettingsStatus('memberSettingsStatus', message, type);
}
function setSettingsStatus(id, message, type = '') {
    const status = document.getElementById(id);
    if (!status) return;
    status.textContent = message;
    status.style.color = type === 'error' ? '#ff7777' : type === 'success' ? '#69d899' : '#b8c0cc';
}
function openModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() {
    if (memberTourActive) finishMemberTour();
    document.getElementById('modalOverlay').classList.add('hidden');
}

// ===== FIRST-VISIT MEMBER WELCOME =====
let memberTourActive = false;

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
    const firstName = escapeHTML((session?.fullName || session?.username || 'Member').trim().split(/\s+/)[0]);
    openModal(`<section class="member-onboarding" role="dialog" aria-modal="true" aria-labelledby="memberTourTitle">
        <div class="onboarding-mark"><i class="fas fa-dumbbell"></i></div>
        <p class="onboarding-eyebrow">IRON GRIND MEMBER PORTAL</p>
        <h2 id="memberTourTitle">Welcome, ${firstName}!</h2>
        <p class="onboarding-copy">Use your QR code at the gym, check your membership and visits, and send a renewal request here.</p>
        <div class="onboarding-actions"><button class="btn-primary" onclick="finishMemberTour()">Got it</button></div>
    </section>`);
}

function finishMemberTour() {
    memberTourActive = false;
    try { localStorage.setItem(memberTourStorageKey(), 'true'); } catch {}
    document.getElementById('modalOverlay').classList.add('hidden');
}

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

async function completeLogout() {
    closeModal();
    await window.ironGrindSupabase?.auth.signOut();
    localStorage.removeItem('irongrind_session');
    sessionStorage.removeItem('irongrind_session');
    document.getElementById('page-loader')?.classList.remove('hidden-loader');
    window.setTimeout(() => window.location.replace('index.html'), 1200);
}

// ===== FIND CURRENT MEMBER =====
function getCurrentMember() {
    if (supabaseMember) return supabaseMember;
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

    const attendanceRows = supabaseAttendance || loadDB('attendance');
    const all = attendanceRows.filter(a =>
        String(a.memberId) === String(m.id) || (!supabaseAttendance && a.memberName === m.name)
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
    const products = supabaseProducts || loadDB('products');
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
    const supplement = p.category === 'Supplement';
    const out = !supplement && p.stock === 0;
    const low = !supplement && p.stock > 0 && p.stock <= 4;
    let stockLabel = `${Number(p.stock).toLocaleString('en-PH')} in stock`;
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
            <h4>${p.name}${!supplement && p.size ? ' — ' + p.size : ''}</h4>
            <div class="price-row">
                <span class="price">${formatPeso(p.price)}${supplement ? ' / g' : ''}</span>
                ${!supplement ? `<span class="stock-tag ${stockClass}">${stockLabel}</span>` : ''}
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
    const qrData = 'IRONGRIND|' + (m.id || session.username);
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
        source: 'member-portal-renewal',
        items: plan + ' Renewal',
        lineItems: [{ name: plan + ' Membership Renewal', quantity: 1, unitPrice: Number(price), total: Number(price) }],
        total: Number(price),
        date: todayStr(),
        createdAt: new Date().toISOString(),
        status: 'Paid'
    });
    saveDB('sales', sales);

    updateMemberStatus();
    closeModal();
    toast(`✅ Membership renewed until ${expiry}.`, 'success');
}

// ===== MEMBERSHIP RENEWAL REQUEST =====
async function submitMembershipForm(event) {
    event.preventDefault();
    const form = event.currentTarget || document.getElementById('membershipForm');
    const submitButton = form?.querySelector('button[type="submit"]');
    if (submitButton?.disabled) return;
    const originalButtonHTML = submitButton?.innerHTML;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }
    renewalFormMessage('', '');
    try {
    const nameInput = document.getElementById('mfName');
    const planInput = document.getElementById('mfPlan');
    const [plan, planPriceStr] = planInput ? planInput.value.split('|') : ['Renewal', '0'];
    const planPrice = Number(planPriceStr) || 0;

    const client = window.ironGrindSupabase;
    if (!client) {
        renewalFormMessage('Renewal not submitted: the connection to Supabase did not load. Refresh the page and try again.', 'error');
        return;
    }
    const { data: authData, error: authError } = await client.auth.getUser();
    const user = authData?.user;
    if (authError || !user) {
        renewalFormMessage('Your Supabase session could not be verified. Sign in again, then retry.', 'error');
        return;
    }

    if (!supabaseMember) await loadSupabaseMember();
    const member = supabaseMember;
    if (!member || !isUUID(member.id) || member.authUserId !== user.id) {
        renewalFormMessage('No Supabase member record is linked to this login. Contact the gym admin.', 'error');
        return;
    }
    const name = member.name?.trim() || '';
    if (!name) {
        renewalFormMessage('Your member name is missing. Update it in Account Settings first.', 'error');
        return;
    }
    if (nameInput) nameInput.value = name;

        const { data: existing, error: lookupError } = await client
            .from('membership_applications')
            .select('id')
            .eq('auth_user_id', user.id)
            .eq('application_type', 'renewal')
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle();
        if (lookupError) {
            renewalFormMessage(`Could not check existing renewal requests: ${lookupError.message}`, 'error');
            return;
        }
        if (existing) {
            renewalFormMessage('You already have a renewal request waiting for admin approval.', 'error');
            return;
        }

        const submittedAt = new Date().toISOString();
        const estimatedEndDate = addDays(todayStr(), plan === 'Monthly' ? 30 : plan === 'Half Month' ? 15 : 1);
        const { error: insertError } = await client.from('membership_applications').insert({
            auth_user_id: user.id,
            member_id: member.id,
            application_type: 'renewal',
            full_name: name,
            email: member.email || user.email,
            username: member.username || session.username,
            mobile: member.contact || null,
            plan,
            plan_price: planPrice,
            start_date: todayStr(),
            end_date: estimatedEndDate,
            fitness_goals: member.fitnessGoals || [],
            health_conditions: member.healthConditions || [],
            other_medical_conditions: member.otherMedicalConditions || '',
            status: 'pending',
            submitted_at: submittedAt
        });
        if (insertError) {
            console.error('Supabase renewal request failed:', insertError);
            renewalFormMessage(`Could not submit renewal request: ${insertError.message}`, 'error');
            return;
        }

        renewalFormMessage('Renewal request submitted to the admin for approval.', 'success');
        return;
    } catch (error) {
        console.error('Unexpected renewal submission error:', error);
        renewalFormMessage(`Renewal could not be submitted: ${error?.message || 'Please refresh and try again.'}`, 'error');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    }
}

async function submitMemberSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton?.disabled) return;
    const originalButtonHTML = submitButton?.innerHTML;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    settingsFormMessage('');
    try {
        const fullName = document.getElementById('settingsFullName').value.trim();
        const dob = document.getElementById('settingsDob').value;
        const mobile = document.getElementById('settingsMobile').value.replace(/\D/g, '');
        const emergencyMobile = document.getElementById('settingsEmergencyMobile').value.replace(/\D/g, '');
        const heightValue = document.getElementById('settingsHeight').value;
        const weightValue = document.getElementById('settingsWeight').value;
        const otherMedicalChoice = document.getElementById('settingsOtherMedicalChoice').checked;
        const otherMedicalConditions = otherMedicalChoice ? document.getElementById('settingsOtherMedical').value.trim() : '';
        if (!fullName) {
            settingsFormMessage('Enter your full name.', 'error');
            return;
        }
        if (!dob || dob > todayStr()) {
            settingsFormMessage('Enter a valid date of birth that is not in the future.', 'error');
            return;
        }
        if (mobile && !/^09\d{9}$/.test(mobile)) {
            settingsFormMessage('Enter a valid PH mobile number (e.g. 09171234567), or leave it blank.', 'error');
            return;
        }
        if (emergencyMobile && !/^09\d{9}$/.test(emergencyMobile)) {
            settingsFormMessage('Enter a valid emergency contact number, or leave it blank.', 'error');
            return;
        }
        if ((heightValue && (!Number.isFinite(Number(heightValue)) || Number(heightValue) <= 0)) ||
            (weightValue && (!Number.isFinite(Number(weightValue)) || Number(weightValue) <= 0))) {
            settingsFormMessage('Height and weight must be greater than zero.', 'error');
            return;
        }
        if (otherMedicalChoice && !otherMedicalConditions) {
            settingsFormMessage('Describe the other medical condition or clear the checkbox.', 'error');
            return;
        }

        const client = window.ironGrindSupabase;
        if (!client) {
            settingsFormMessage('Settings could not be saved because the connection did not load. Refresh and try again.', 'error');
            return;
        }
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user) {
            settingsFormMessage('Your session could not be verified. Sign in again, then retry.', 'error');
            return;
        }
        const profile = {
            full_name: fullName,
            mobile: mobile || null,
            date_of_birth: dob,
            sex: document.getElementById('settingsSex').value,
            height: heightValue ? Number(heightValue) : null,
            height_unit: document.getElementById('settingsHeightUnit').value,
            weight_kg: weightValue ? Number(weightValue) : null,
            emergency_contact: {
                name: document.getElementById('settingsEmergencyName').value.trim(),
                relationship: document.getElementById('settingsEmergencyRelationship').value.trim(),
                contact: emergencyMobile || ''
            },
            fitness_goals: [...document.querySelectorAll('input[name="settingsGoal"]:checked')].map(input => input.value),
            health_conditions: [...document.querySelectorAll('input[name="settingsHealth"]:checked')].map(input => input.value),
            other_medical_conditions: otherMedicalConditions
        };
        const { error } = await client.rpc('update_own_member_personal_info', {
            p_profile: profile
        });
        if (error) {
            settingsFormMessage(`Could not save your information: ${error.message}`, 'error');
            return;
        }

        if (supabaseMember) {
            supabaseMember.name = fullName;
            supabaseMember.contact = mobile || null;
            supabaseMember.dateOfBirth = dob;
            supabaseMember.sex = profile.sex;
            supabaseMember.height = profile.height;
            supabaseMember.heightUnit = profile.height_unit;
            supabaseMember.weight = profile.weight_kg;
            supabaseMember.emergencyContact = profile.emergency_contact;
            supabaseMember.fitnessGoals = profile.fitness_goals;
            supabaseMember.healthConditions = profile.health_conditions;
            supabaseMember.otherMedicalConditions = profile.other_medical_conditions;
        }
        session.fullName = fullName;
        const sessionStorageArea = localStorage.getItem('irongrind_session') ? localStorage : sessionStorage;
        sessionStorageArea.setItem('irongrind_session', JSON.stringify(session));
        document.getElementById('currentUserName').textContent = fullName;
        document.getElementById('heroName').textContent = fullName.trim().split(/\s+/)[0] + '!';
        document.getElementById('mfName').value = fullName;
        updateSettingsAge();
        settingsFormMessage('Your information was updated.', 'success');
        toast('Account information updated.', 'success');
    } catch (error) {
        console.error('Member settings update failed:', error);
        settingsFormMessage(`Could not save your information: ${error?.message || 'Please try again.'}`, 'error');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    }
}

async function submitMemberEmail(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const originalButtonHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    setSettingsStatus('memberEmailStatus', '');
    try {
        const client = window.ironGrindSupabase;
        if (!client) throw new Error('Supabase connection did not load. Refresh and try again.');
        const email = document.getElementById('settingsEmail').value.trim();
        const { data, error } = await client.auth.updateUser({ email });
        if (error) throw error;
        if (data.user?.new_email) {
            setSettingsStatus('memberEmailStatus', `Confirm the change using the link sent to ${data.user.new_email}. Your current email remains active until confirmation.`, 'success');
        } else {
            if (data.user?.email) {
                document.getElementById('settingsEmail').value = data.user.email;
                if (supabaseMember) supabaseMember.email = data.user.email;
            }
            setSettingsStatus('memberEmailStatus', 'Email updated.', 'success');
        }
    } catch (error) {
        setSettingsStatus('memberEmailStatus', `Could not update email: ${error?.message || 'Please try again.'}`, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalButtonHTML;
    }
}

async function submitMemberPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const originalButtonHTML = button.innerHTML;
    const passwordInput = document.getElementById('settingsPassword');
    const confirmInput = document.getElementById('settingsPasswordConfirm');
    setSettingsStatus('memberPasswordStatus', '');
    if (passwordInput.value.length < 8) {
        setSettingsStatus('memberPasswordStatus', 'Use a password with at least 8 characters.', 'error');
        return;
    }
    if (passwordInput.value !== confirmInput.value) {
        setSettingsStatus('memberPasswordStatus', 'The passwords do not match.', 'error');
        return;
    }
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    try {
        const client = window.ironGrindSupabase;
        if (!client) throw new Error('Supabase connection did not load. Refresh and try again.');
        const { error } = await client.auth.updateUser({ password: passwordInput.value });
        if (error) throw error;
        passwordInput.value = '';
        confirmInput.value = '';
        setSettingsStatus('memberPasswordStatus', 'Password updated.', 'success');
    } catch (error) {
        setSettingsStatus('memberPasswordStatus', `Could not update password: ${error?.message || 'Please try again.'}`, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalButtonHTML;
    }
}

function updateSettingsAge() {
    const dob = document.getElementById('settingsDob').value;
    if (!dob) {
        document.getElementById('settingsAge').value = '';
        return;
    }
    const birthDate = new Date(`${dob}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age--;
    document.getElementById('settingsAge').value = age >= 0 ? age : '';
}

function populateMemberSettings(member) {
    const emergency = member?.emergencyContact || {};
    document.getElementById('settingsFullName').value = member?.name || session.fullName || '';
    document.getElementById('settingsDob').value = member?.dateOfBirth || '';
    document.getElementById('settingsSex').value = member?.sex || 'Prefer not to say';
    document.getElementById('settingsMobile').value = member?.contact || '';
    document.getElementById('settingsHeight').value = member?.height ?? '';
    document.getElementById('settingsHeightUnit').value = member?.heightUnit || 'cm';
    document.getElementById('settingsWeight').value = member?.weight ?? '';
    document.getElementById('settingsEmergencyName').value = emergency.name || '';
    document.getElementById('settingsEmergencyRelationship').value = emergency.relationship || '';
    document.getElementById('settingsEmergencyMobile').value = emergency.contact || '';
    document.querySelectorAll('input[name="settingsGoal"]').forEach(input => { input.checked = (member?.fitnessGoals || []).includes(input.value); });
    document.querySelectorAll('input[name="settingsHealth"]').forEach(input => { input.checked = (member?.healthConditions || []).includes(input.value); });
    const hasOtherMedical = Boolean(member?.otherMedicalConditions);
    document.getElementById('settingsOtherMedicalChoice').checked = hasOtherMedical;
    document.getElementById('settingsOtherMedical').value = member?.otherMedicalConditions || '';
    document.getElementById('settingsOtherMedicalGroup').hidden = !hasOtherMedical;
    document.getElementById('settingsOtherMedical').required = hasOtherMedical;
    document.getElementById('settingsEmail').value = member?.email || '';
    updateSettingsAge();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('membershipForm')?.addEventListener('submit', submitMembershipForm);
    document.getElementById('memberSettingsForm')?.addEventListener('submit', submitMemberSettings);
    document.getElementById('memberEmailForm')?.addEventListener('submit', submitMemberEmail);
    document.getElementById('memberPasswordForm')?.addEventListener('submit', submitMemberPassword);
    document.getElementById('settingsDob')?.addEventListener('change', updateSettingsAge);
    document.getElementById('settingsOtherMedicalChoice')?.addEventListener('change', event => {
        const details = document.getElementById('settingsOtherMedicalGroup');
        details.hidden = !event.currentTarget.checked;
        document.getElementById('settingsOtherMedical').required = event.currentTarget.checked;
    });
    loadSupabaseMember().finally(() => {
    const member = getCurrentMember();
    document.getElementById('mfName').value = member?.name || session.fullName || '';
    populateMemberSettings(member);
    updateMemberStatus();
    renderMembershipProgress();
    renderAttendanceHistory();
    renderStore();
    window.setTimeout(showMemberWelcome, 2600);
    });
});

async function loadSupabaseMember() {
    const client = window.ironGrindSupabase;
    if (!client) return;
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return;
    const { data: row, error } = await client
        .from('members')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();
    if (error || !row) {
        console.error('Could not load Supabase membership:', error);
        return;
    }
    supabaseMember = {
        id: row.id,
        authUserId: row.auth_user_id || row.user_id,
        name: row.full_name,
        dateOfBirth: row.date_of_birth,
        sex: row.sex,
        plan: row.plan,
        planPrice: Number(row.plan_price) || (typeof row.paid === 'number' ? row.paid : 0),
        startDate: row.start_date,
        expiry: row.expiry_date || row.end_date,
        status: row.status,
        paid: typeof row.paid === 'boolean' ? row.paid : Number(row.paid) > 0,
        goal: (row.fitness_goals || [])[0] || 'General Fitness',
        contact: row.mobile,
        email: user.email || row.email,
        username: row.username || session.username,
        height: row.height,
        heightUnit: row.height_unit,
        weight: row.weight_kg ?? row.weight,
        healthConditions: row.health_conditions || [],
        otherMedicalConditions: row.other_medical_conditions || '',
        fitnessGoals: row.fitness_goals || [],
        emergencyContact: row.emergency_contact && typeof row.emergency_contact === 'object'
            ? row.emergency_contact
            : { name: row.emergency_name || '', relationship: row.emergency_relationship || '', contact: row.emergency_contact || '' },
        signature: row.signature_path || row.signature_data || null,
        qrCode: `IRONGRIND|${row.id}`
    };
    populateMemberSettings(supabaseMember);

    const [attendanceResult, productsResult] = await Promise.all([
        client.from('attendance').select('*').eq('member_id', row.id).order('time_in', { ascending: false }),
        client.from('products').select('*').eq('is_active', true).order('name')
    ]);
    if (attendanceResult.error) {
        console.error('Could not load member attendance from Supabase:', attendanceResult.error);
    } else {
        supabaseAttendance = attendanceResult.data.map(record => {
            const start = new Date(record.time_in);
            const end = record.time_out ? new Date(record.time_out) : null;
            const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const localTime = date => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            return {
                id: record.id,
                memberId: record.member_id,
                date: localDate(start),
                timeIn: localTime(start),
                timeOut: end ? localTime(end) : null
            };
        });
    }
    if (productsResult.error) {
        console.error('Could not load products from Supabase:', productsResult.error);
    } else {
        supabaseProducts = productsResult.data.map(product => ({
            id: product.id,
            name: product.name,
            category: product.category === 'supplement' ? 'Supplement' : 'Merch',
            price: Number(product.price_per_unit) || 0,
            stock: Number(product.stock) || 0,
            size: product.size || '',
            image: product.image_path || ''
        }));
    }
}

window.addEventListener('load', () => {
    window.setTimeout(() => document.getElementById('page-loader')?.classList.add('hidden-loader'), 2500);
});
    window.setTimeout(() => document.getElementById('page-loader')?.classList.add('hidden-loader'), 2500);
});

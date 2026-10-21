function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}
function loadDB(key) {
    try { return JSON.parse(localStorage.getItem('ig_' + key)) || []; }
    catch { return []; }
}

function saveDB(key, data) { localStorage.setItem('ig_' + key, JSON.stringify(data)); }
function toggleRegPassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
    else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}
function showError(msg) {
    document.getElementById('regErrorText').textContent = msg;
    document.getElementById('regError').classList.remove('hidden');
    window.scrollTo({ top: document.getElementById('regError').offsetTop - 100, behavior: 'smooth' });
}
function hideError() { document.getElementById('regError').classList.add('hidden'); }
function openModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

const registrationSignature = initDigitalSignature('registrationSignature', 'clearRegistrationSignature');

document.getElementById('regDob').addEventListener('change', function() {
    const dob = new Date(this.value);
    if (isNaN(dob)) return;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    document.getElementById('regAge').value = age >= 0 ? age : '';
});

const otherMedicalChoice = document.getElementById('otherMedicalChoice');
const otherMedicalDetailsGroup = document.getElementById('otherMedicalDetailsGroup');
const otherMedicalDetailsInput = document.getElementById('otherMedicalDetails');

function updateOtherMedicalDetails() {
    const hasOtherCondition = otherMedicalChoice.checked;
    otherMedicalDetailsGroup.classList.toggle('hidden', !hasOtherCondition);
    otherMedicalDetailsInput.required = hasOtherCondition;
    if (!hasOtherCondition) otherMedicalDetailsInput.value = '';
}

otherMedicalChoice.addEventListener('change', updateOtherMedicalDetails);
updateOtherMedicalDetails();

function updateDatesFromPlan() {
    const plan = document.querySelector('input[name="regPlan"]:checked');
    if (!plan) return;
    const name = plan.value.split('|')[0];
    const start = todayStr();
    let days = name === 'Monthly' ? 30 : name === 'Half Month' ? 15 : 1;
    document.getElementById('regStartDate').value = start;
    document.getElementById('regEndDate').value = addDays(start, days);
}
document.querySelectorAll('input[name="regPlan"]').forEach(r => r.addEventListener('change', updateDatesFromPlan));

function submitRegistration(event) {
    event.preventDefault();
    hideError();

    const fullName = document.getElementById('regFullName').value.trim();
    const dob = document.getElementById('regDob').value;
    const age = Number(document.getElementById('regAge').value);
    const sex = document.getElementById('regSex').value;
    const mobile = document.getElementById('regMobile').value.trim();
    const height = document.getElementById('regHeight').value;
    const weight = document.getElementById('regWeight').value;
    const ecName = document.getElementById('regEcName').value.trim();
    const ecRelation = document.getElementById('regEcRelation').value.trim();
    const ecContact = document.getElementById('regEcContact').value.trim();

    const planInput = document.querySelector('input[name="regPlan"]:checked');
    if (!planInput) { showError('Please select a membership plan.'); return; }
    const [planName, planPrice] = planInput.value.split('|');
    const startDate = document.getElementById('regStartDate').value || todayStr();
    let endDate = document.getElementById('regEndDate').value;
    if (!endDate) {
        const days = planName === 'Monthly' ? 30 : planName === 'Half Month' ? 15 : 1;
        endDate = addDays(startDate, days);
    }

    const healthConditions = [];
    if (document.getElementById('hcHighBp').checked) healthConditions.push('High Blood Pressure');
    if (document.getElementById('hcHeart').checked) healthConditions.push('Heart Condition');
    if (document.getElementById('hcAsthma').checked) healthConditions.push('Asthma');
    if (document.getElementById('hcInjury').checked) healthConditions.push('Recent Injury');
    const otherMedicalConditions = otherMedicalChoice.checked ? otherMedicalDetailsInput.value.trim() : '';

    const goals = Array.from(document.querySelectorAll('input[name="goal"]:checked')).map(g => g.value);

    if (!document.getElementById('agreeRules').checked) { showError('You must agree to the Rules and Agreement.'); return; }
    if (!document.getElementById('agreeWaiver').checked) { showError('You must accept the Liability Waiver.'); return; }
    if (otherMedicalChoice.checked && !otherMedicalConditions) { showError('Please specify your other medical condition details.'); return; }
    if (!registrationSignature || registrationSignature.isEmpty()) { showError('Please add your digital signature.'); return; }

    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;

    if (!fullName || !dob || !mobile) { showError('Please complete all required personal information.'); return; }
    if (age < 12) { showError('You must be at least 12 years old to register.'); return; }
    if (!ecName || !ecRelation || !ecContact) { showError('Please complete the emergency contact details.'); return; }
    if (username.length < 4) { showError('Username must be at least 4 characters.'); return; }
    if (!/^[a-z0-9_.]+$/.test(username)) { showError('Username can only contain letters, numbers, underscores, and dots.'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { showError('Passwords do not match.'); return; }

    const users = loadDB('users');
    const pending = loadDB('pendingApprovals');
    if (users.find(u => u.username === username)) { showError('Username already taken.'); return; }
    if (pending.find(p => p.username === username)) { showError('An application with this username is pending.'); return; }

    const application = {
        id: 'APP' + Date.now(),
        fullName, dob, age, sex, mobile,
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        emergencyContact: { name: ecName, relationship: ecRelation, contact: ecContact },
        plan: planName, planPrice: Number(planPrice),
        startDate, endDate,
        healthConditions, otherMedicalConditions, goals,
        signature: registrationSignature.toDataURL(),
        username, password,
        submittedAt: new Date().toISOString(),
        status: 'pending'
    };

    pending.push(application);
    saveDB('pendingApprovals', pending);
    showSuccessModal(application);
}

function showSuccessModal(app) {
    openModal(`
        <div style="text-align:center; padding:8px 0;">
            <div style="width:72px; height:72px; border-radius:50%; background:rgba(46,204,113,0.15); color:#2ecc71; display:flex; align-items:center; justify-content:center; font-size:2rem; margin:0 auto 16px;">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3 style="justify-content:center; display:flex;"><i class="fas fa-check-circle"></i> Application Submitted!</h3>
            <p class="modal-sub" style="text-align:center;">Thank you, <strong>${app.fullName}</strong>. Your application is now pending admin approval.</p>
            <div style="background:#0d1219; border:1px solid #1e2533; border-radius:16px; padding:16px; text-align:left; font-size:0.85rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Application ID:</span><code style="color:#ff6b2b;">${app.id}</code></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Plan:</span><strong>${app.plan}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Amount:</span><strong>₱${app.planPrice.toLocaleString()}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Username:</span><strong>${app.username}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#8b95a9;">Status:</span><span class="badge-status reserved">Pending</span></div>
            </div>
            <div style="background:rgba(255,107,43,0.08); border:1px solid rgba(255,107,43,0.25); border-radius:14px; padding:14px; font-size:0.8rem; color:#8b95a9; text-align:left; margin-top:16px;">
                <i class="fas fa-info-circle" style="color:#ff6b2b;"></i>
                Visit the gym to complete your payment. Once approved, log in with your chosen username and password.
            </div>
        </div>
        <div class="modal-actions">
            <a href="index.html" class="btn-primary" style="text-decoration:none; justify-content:center; padding:12px;">Go to Login</a>
        </div>
    `);
}

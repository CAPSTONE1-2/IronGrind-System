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

const registrationHeight = document.getElementById('regHeight');
const registrationHeightUnit = document.getElementById('regHeightUnit');
let previousHeightUnit = registrationHeightUnit.value;
registrationHeightUnit.addEventListener('change', function() {
    const nextUnit = this.value;
    const enteredHeight = Number(registrationHeight.value);
    if (registrationHeight.value && Number.isFinite(enteredHeight) && enteredHeight > 0 && previousHeightUnit !== nextUnit) {
        const convertedHeight = previousHeightUnit === 'cm' ? enteredHeight / 2.54 : enteredHeight * 2.54;
        registrationHeight.value = String(Number(convertedHeight.toFixed(2)));
    }
    previousHeightUnit = nextUnit;
});

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

async function submitRegistration(event) {
    event.preventDefault();
    hideError();

    const fullName = document.getElementById('regFullName').value.trim();
    const dob = document.getElementById('regDob').value;
    const age = Number(document.getElementById('regAge').value);
    const sex = document.getElementById('regSex').value;
    const mobile = document.getElementById('regMobile').value.trim();
    const height = document.getElementById('regHeight').value;
    const heightUnit = height ? document.getElementById('regHeightUnit').value : null;
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

    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;

    if (!fullName || !dob || !mobile) { showError('Please complete all required personal information.'); return; }
    if (age < 12) { showError('You must be at least 12 years old to register.'); return; }
    if (!ecName || !ecRelation || !ecContact) { showError('Please complete the emergency contact details.'); return; }
    if (!email || !document.getElementById('regEmail').checkValidity()) { showError('Enter a valid email address for your account.'); return; }
    if (username.length < 4) { showError('Username must be at least 4 characters.'); return; }
    if (!/^[a-z0-9_.]+$/.test(username)) { showError('Username can only contain letters, numbers, underscores, and dots.'); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { showError('Passwords do not match.'); return; }

    const application = {
        id: null,
        fullName, dob, age, sex, mobile,
        height: height ? Number(height) : null,
        heightUnit,
        weight: weight ? Number(weight) : null,
        emergencyContact: { name: ecName, relationship: ecRelation, contact: ecContact },
        plan: planName, planPrice: Number(planPrice),
        startDate, endDate,
        healthConditions, otherMedicalConditions, goals,
        signature: registrationSignature.toDataURL(),
        email, username,
        submittedAt: new Date().toISOString(),
        status: 'pending'
    };

    const submitButton = document.querySelector('#registrationForm button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…';
    try {
        const { data, error } = await window.ironGrindSupabase.auth.signUp({
            email,
            password,
            options: {
                data: { username, full_name: fullName },
                emailRedirectTo: `${window.location.origin}${window.location.pathname}?completeApplication=1`
            }
        });

        if (error) {
            showError(error.message.includes('already registered')
                ? 'An account already exists for this email. Sign in or contact the gym admin.'
                : error.message);
            return;
        }
        if (!data.user) {
            showError('Supabase did not return an account. Please try again.');
            return;
        }

        application.id = data.user.id;
        application.submittedAt = new Date().toISOString();
        const draft = { userId: data.user.id, application, savedAt: Date.now() };
        // Keep a short-lived recovery copy until the database confirms insert.
        // The password is intentionally excluded from the saved application.
        localStorage.setItem('ig_registration_draft', JSON.stringify(draft));

        if (data.session) {
            const saved = await insertSupabaseApplication(draft);
            if (!saved) return;
            showSuccessModal(application, false);
        } else {
            // Supabase requires email confirmation before RLS permits submission.
            // Keep the form data briefly in this browser, never the password.
            showSuccessModal(application, true);
        }
    } catch (error) {
        console.error('Registration submission failed:', error);
        showError('Could not connect to the registration service. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Membership Application';
    }
}

async function insertSupabaseApplication(draft) {
    const app = draft.application;
    const emergency = app.emergencyContact || {};
    const userId = draft.userId;
    const row = {
        user_id: userId,
        auth_user_id: userId,
        member_id: null,
        application_type: 'registration',
        full_name: app.fullName,
        email: app.email,
        username: app.username,
        mobile: app.mobile,
        date_of_birth: app.dob,
        age: app.age,
        sex: app.sex,
        height: app.height,
        height_unit: app.heightUnit,
        weight: app.weight,
        emergency_name: emergency.name,
        emergency_relationship: emergency.relationship,
        emergency_contact: emergency.contact,
        plan: app.plan,
        plan_price: app.planPrice,
        start_date: app.startDate,
        end_date: app.endDate,
        fitness_goals: app.goals,
        health_conditions: app.healthConditions,
        other_medical_conditions: app.otherMedicalConditions,
        signature_data: app.signature,
        status: 'pending',
        submitted_at: app.submittedAt,
        created_at: app.submittedAt,
        reviewed_at: null,
        reviewed_by: null
    };
    const { data, error } = await window.ironGrindSupabase
        .from('membership_applications')
        .insert(row)
        .select('id')
        .single();

    if (error) {
        console.error('Application save failed:', error);
        showError(`Your account was created, but the application could not be saved: ${error.message}`);
        return false;
    }
    app.id = data.id;
    localStorage.removeItem('ig_registration_draft');
    return true;
}

async function completeConfirmedRegistration() {
    let draft;
    try { draft = JSON.parse(localStorage.getItem('ig_registration_draft') || 'null'); }
    catch { draft = null; }
    if (draft && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('ig_registration_draft');
        draft = null;
    }
    if (new URLSearchParams(window.location.search).get('completeApplication') !== '1') return;
    if (!draft) {
        showError('Your saved application expired. Sign in and contact the gym admin to continue.');
        return;
    }
    const { data: { session }, error } = await window.ironGrindSupabase.auth.getSession();
    if (error || !session || session.user.id !== draft.userId) {
        showError('Your email may be confirmed, but this browser did not receive the confirmation session. Return to the registration page and sign in with your confirmed email to continue. If your application is still missing, contact the gym admin.');
        return;
    }
    if (await insertSupabaseApplication(draft)) showSuccessModal(draft.application, false, true);
}

document.addEventListener('DOMContentLoaded', completeConfirmedRegistration);

function showSuccessModal(app, confirmationRequired = false, emailJustConfirmed = false) {
    openModal(`
        <div style="text-align:center; padding:8px 0;">
            <div style="width:72px; height:72px; border-radius:50%; background:rgba(46,204,113,0.15); color:#2ecc71; display:flex; align-items:center; justify-content:center; font-size:2rem; margin:0 auto 16px;">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3 style="justify-content:center; display:flex;"><i class="fas ${confirmationRequired ? 'fa-envelope' : 'fa-check-circle'}"></i> ${confirmationRequired ? 'Confirm Your Email' : 'Application Submitted!'}</h3>
            <p class="modal-sub" style="text-align:center;">${confirmationRequired
                ? `Your account was created, ${app.fullName}. Confirm your email to submit your application for admin review.`
                : emailJustConfirmed
                    ? `Your email is confirmed, ${app.fullName}. Your application has been sent to the gym for review and is awaiting approval.`
                    : `Thank you, <strong>${app.fullName}</strong>. Your application is now pending admin approval.`}</p>
            <div style="background:#0d1219; border:1px solid #1e2533; border-radius:16px; padding:16px; text-align:left; font-size:0.85rem;">
                ${confirmationRequired ? '' : `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Application ID:</span><code style="color:#ff6b2b;">${app.id}</code></div>`}
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Plan:</span><strong>${app.plan}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Amount:</span><strong>₱${app.planPrice.toLocaleString()}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Username:</span><strong>${app.username}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:#8b95a9;">Email:</span><strong>${app.email}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#8b95a9;">Status:</span><span class="badge-status reserved">${confirmationRequired ? 'Confirm email first' : 'Pending review'}</span></div>
            </div>
            <div style="background:rgba(255,107,43,0.08); border:1px solid rgba(255,107,43,0.25); border-radius:14px; padding:14px; font-size:0.8rem; color:#8b95a9; text-align:left; margin-top:16px;">
                <i class="fas fa-info-circle" style="color:#ff6b2b;"></i>
                ${confirmationRequired
                    ? 'Check your email and confirm your account. Return to this browser after confirmation to finish submitting your application. Your form is saved here temporarily; your password is not stored.'
                    : emailJustConfirmed
                        ? 'Email confirmation is complete. The gym admin must approve your registration before you can access the member portal. Check your email for an update, or contact the gym if you need to follow up.'
                        : 'Visit the gym to complete your payment. Once approved, sign in with your email and password.'}
            </div>
        </div>
        <div class="modal-actions">
            <a href="index.html" class="btn-primary" style="text-decoration:none; justify-content:center; padding:12px;">Go to Login</a>
        </div>
    `);
}

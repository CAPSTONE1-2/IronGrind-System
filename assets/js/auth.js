function loadUsers() {
    try {
        const users = JSON.parse(localStorage.getItem('ig_users') || '[]');
        return Array.isArray(users) ? users : [];
    } catch {
        return [];
    }
}

function togglePassword() {
    const input = document.getElementById('loginPassword');
    const icon = document.getElementById('togglePwIcon');
    if (!input || !icon) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

function showError(message) {
    document.getElementById('loginErrorText').textContent = message;
    document.getElementById('loginError').classList.remove('hidden');
}

function hideError() {
    document.getElementById('loginError').classList.add('hidden');
}

function showForgotPassword() {
    document.getElementById('forgotPasswordModal').classList.remove('hidden');
}

function closeForgotPassword() {
    document.getElementById('forgotPasswordModal').classList.add('hidden');
}

async function recoverConfirmedRegistration(client, user) {
    let draft;
    try { draft = JSON.parse(localStorage.getItem('ig_registration_draft') || 'null'); }
    catch { draft = null; }
    if (!draft || draft.userId !== user.id) return { recovered: false };
    if (!draft.savedAt || Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('ig_registration_draft');
        return { recovered: false, expired: true };
    }

    const { data: existing, error: lookupError } = await client
        .from('membership_applications')
        .select('id')
        .eq('auth_user_id', user.id)
        .eq('application_type', 'registration')
        .limit(1)
        .maybeSingle();
    if (lookupError) return { recovered: false, error: lookupError };
    if (existing) {
        localStorage.removeItem('ig_registration_draft');
        return { recovered: false, alreadySubmitted: true };
    }

    const app = draft.application || {};
    const emergency = app.emergencyContact || {};
    const submittedAt = new Date().toISOString();
    const { error: insertError } = await client.from('membership_applications').insert({
        user_id: user.id,
        auth_user_id: user.id,
        member_id: null,
        application_type: 'registration',
        full_name: app.fullName,
        email: app.email || user.email,
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
        fitness_goals: app.goals || [],
        health_conditions: app.healthConditions || [],
        other_medical_conditions: app.otherMedicalConditions || '',
        signature_data: app.signature || null,
        status: 'pending',
        submitted_at: submittedAt,
        created_at: submittedAt,
        reviewed_at: null,
        reviewed_by: null
    });
    if (insertError) return { recovered: false, error: insertError };

    localStorage.removeItem('ig_registration_draft');
    return { recovered: true };
}

async function handleLogin(event) {
    event.preventDefault();
    hideError();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    if (!email || !password) {
        showError('Please fill in all fields.');
        return;
    }

    const submitButton = document.querySelector('#loginForm button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

    try {
        const supabaseClient = window.ironGrindSupabase;
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (!error && data.user) {
            const recovery = await recoverConfirmedRegistration(supabaseClient, data.user);
            if (recovery.error) {
                await supabaseClient.auth.signOut();
                console.error('Could not complete saved registration:', recovery.error);
                showError(`We could not submit your saved application: ${recovery.error.message}`);
                return;
            }
            if (recovery.recovered) {
                await supabaseClient.auth.signOut();
                showError('Your registration application has been submitted and is waiting for admin approval.');
                return;
            }

            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('role, username, full_name')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile) {
                await supabaseClient.auth.signOut();
                showError('Your account profile could not be loaded. Please contact the gym admin.');
                return;
            }

            const role = profile.role === 'admin' ? 'admin' : 'customer';
            if (role === 'customer') {
                const { data: member, error: memberError } = await supabaseClient
                    .from('members')
                    .select('id')
                    .eq('auth_user_id', data.user.id)
                    .maybeSingle();
                if (memberError) {
                    await supabaseClient.auth.signOut();
                    showError('We could not check your membership. Please contact the gym admin.');
                    return;
                }
                if (!member) {
                    const { data: application, error: applicationError } = await supabaseClient
                        .from('membership_applications')
                        .select('status')
                        .eq('auth_user_id', data.user.id)
                        .order('submitted_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    await supabaseClient.auth.signOut();
                    if (applicationError) {
                        showError('We could not check your application status. Please contact the gym admin.');
                        return;
                    }
                    showError(application?.status === 'rejected'
                        ? 'Your application was not approved. Please contact the gym admin.'
                        : application
                            ? 'Your membership application is awaiting admin approval.'
                            : 'No registration application was found for this account. Please contact the gym admin to recover your registration.');
                    return;
                }
            }

            const session = {
                role,
                username: profile.username || data.user.email,
                fullName: profile.full_name || data.user.email,
                loginTime: new Date().toISOString()
            };
            saveLoginSession(session, remember);
            return;
        }

        if (error) await supabaseClient.auth.signOut();

        // Existing member accounts still use the current localStorage flow
        // until member registration and records are migrated to Supabase.
        const user = loadUsers().find(item => item.email?.toLowerCase() === email && item.password === password);
        if (user) {
            saveLoginSession({
                role: 'customer',
                username: user.username,
                fullName: user.fullName || user.username || email,
                loginTime: new Date().toISOString()
            }, remember);
            return;
        }

        let pending = [];
        try {
            const saved = JSON.parse(localStorage.getItem('ig_pendingApprovals') || '[]');
            if (Array.isArray(saved)) pending = saved;
        } catch {
            // Ignore malformed pending data and show the normal login error.
        }
        showError(pending.some(item => item.email?.toLowerCase() === email)
            ? 'Your application is still pending approval.'
            : 'Invalid email or password.');
    } catch (error) {
        console.error('Login failed:', error);
        showError('Unable to connect to the login service. Please try again.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
}

function saveLoginSession(session, remember) {
    localStorage.removeItem('irongrind_session');
    sessionStorage.removeItem('irongrind_session');
    (remember ? localStorage : sessionStorage).setItem('irongrind_session', JSON.stringify(session));
    window.location.replace(session.role === 'admin' ? 'admin.html' : 'customer.html');
}

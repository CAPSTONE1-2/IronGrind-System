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
                    const { data: application } = await supabaseClient
                        .from('membership_applications')
                        .select('status')
                        .eq('auth_user_id', data.user.id)
                        .order('submitted_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    await supabaseClient.auth.signOut();
                    showError(application?.status === 'rejected'
                        ? 'Your application was not approved. Please contact the gym admin.'
                        : 'Your membership application is awaiting approval.');
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

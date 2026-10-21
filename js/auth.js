const ADMIN_USER = { username: 'admin', password: 'irongrind2025' };

function loadUsers() {
    try { return JSON.parse(localStorage.getItem('ig_users')) || []; }
    catch { return []; }
}

function togglePassword() {
    const pwInput = document.getElementById('loginPassword');
    const icon = document.getElementById('togglePwIcon');
    if (pwInput.type === 'password') {
        pwInput.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        pwInput.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function showError(message) {
    document.getElementById('loginErrorText').textContent = message;
    document.getElementById('loginError').classList.remove('hidden');
}

function hideError() {
    document.getElementById('loginError').classList.add('hidden');
}

function handleLogin(event) {
    event.preventDefault();
    hideError();

    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;
    const submitBtn = document.getElementById('loginBtn');

    if (!id || !password) { showError('Please fill in all fields.'); return; }

    submitBtn.classList.add('btn-loading');

    setTimeout(() => {
        let session = null;

        // 1. Check Admin
        if (id === ADMIN_USER.username && password === ADMIN_USER.password) {
            session = { role: 'admin', username: id, fullName: 'Administrator', loginTime: new Date().toISOString() };
        } 
        // 2. Check Member
        else {
            const users = loadUsers();
            const user = users.find(u => u.username === id && u.password === password);
            
            if (user) {
                session = { role: 'customer', username: id, fullName: user.fullName || id, loginTime: new Date().toISOString() };
            } else {
                submitBtn.classList.remove('btn-loading');
                const pending = JSON.parse(localStorage.getItem('ig_pendingApprovals') || '[]');
                if (pending.find(p => p.username === id)) {
                    showError('Your application is still pending admin approval.');
                } else {
                    showError('Invalid username or password.');
                }
                return;
            }
        }

        // Save Session
        if (remember) localStorage.setItem('irongrind_session', JSON.stringify(session));
        else sessionStorage.setItem('irongrind_session', JSON.stringify(session));

        // Redirect
        if (session.role === 'admin') {
            window.location.replace('admin.html');
        } else {
            window.location.replace('customer.html');
        }
    }, 600);
}
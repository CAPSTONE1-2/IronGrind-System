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

        if (id === ADMIN_USER.username && password === ADMIN_USER.password) {
            session = { role: 'admin', username: id, loginTime: new Date().toISOString() };
        } else {
            const users = loadUsers();
            const user = users.find(u => u.username === id && u.password === password);
            
            if (user) {
                session = { role: 'customer', username: id, fullName: user.fullName, loginTime: new Date().toISOString() };
            } else {
                submitBtn.classList.remove('btn-loading');
                const pending = JSON.parse(localStorage.getItem('ig_pendingApprovals') || '[]');
                if (pending.find(p => p.username === id)) {
                    showError('Your application is still pending admin approval.');
                } else {
                    showError('Invalid username or password. New here? Register first.');
                }
                return;
            }
        }

        if (remember) localStorage.setItem('irongrind_session', JSON.stringify(session));
        else sessionStorage.setItem('irongrind_session', JSON.stringify(session));

        window.location.href = session.role === 'admin' ? 'admin.html' : 'customer.html';
    }, 600);
}
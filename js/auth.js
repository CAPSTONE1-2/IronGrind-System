// ... (keep your existing togglePassword, showError, hideError, handleLogin functions) ...

/* ========== FORGOT PASSWORD LOGIC ========== */
function openForgotPasswordModal(e) {
    if(e) e.preventDefault();
    
    document.getElementById('modalContent').innerHTML = `
        <h3><i class="fas fa-key"></i> Reset Password</h3>
        <p class="modal-sub">Enter your username and we will send a password reset link to the email address associated with your account.</p>
        
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="resetUsername" placeholder="Enter your username" required>
        </div>
        
        <div class="modal-actions">
            <button class="btn-sm" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" id="resetBtn" onclick="submitForgotPassword()">Send Reset Link</button>
        </div>
    `;
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function submitForgotPassword() {
    const username = document.getElementById('resetUsername').value.trim().toLowerCase();
    const btn = document.getElementById('resetBtn');
    
    if (!username) {
        showToast('Please enter your username.');
        return;
    }

    btn.classList.add('btn-loading');

    // Simulate network delay
    setTimeout(() => {
        btn.classList.remove('btn-loading');
        
        // In a real backend, this would trigger an email. 
        // For this local frontend version, we just show a success message.
        document.getElementById('modalContent').innerHTML = `
            <div style="text-align:center; padding:8px 0;">
                <div style="width:72px; height:72px; border-radius:50%; background:rgba(61,220,151,0.15); color:#3ddc97; display:flex; align-items:center; justify-content:center; font-size:2rem; margin:0 auto 16px;">
                    <i class="fas fa-paper-plane"></i>
                </div>
                <h3 style="justify-content:center; display:flex;">Check your email</h3>
                <p class="modal-sub" style="text-align:center;">If an account exists for <strong>${username}</strong>, a password reset link has been sent.</p>
                <p style="font-size:0.75rem; color:#ff4d1a; background:rgba(255,77,26,0.1); padding:10px; border-radius:8px; margin-bottom:16px;">
                    <i class="fas fa-info-circle"></i> Note: Since this is a demo system, no actual email was sent. Contact the gym admin to reset your password.
                </p>
                <button class="btn-primary" style="width:100%; justify-content:center;" onclick="closeModal()">Back to Login</button>
            </div>
        `;
    }, 800);
}

function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}
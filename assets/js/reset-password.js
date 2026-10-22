(() => {
    const client = window.ironGrindSupabase;
    const loading = document.getElementById('recoveryLoading');
    const form = document.getElementById('resetPasswordForm');
    const errorBox = document.getElementById('recoveryError');
    const errorText = document.getElementById('recoveryErrorText');
    const successBox = document.getElementById('recoverySuccess');
    const statusBox = document.getElementById('resetStatus');
    const statusText = document.getElementById('resetStatusText');
    const saveButton = document.getElementById('savePasswordButton');
    let recoveryReady = false;

    function showRecoveryError(message) {
        loading.classList.add('hidden');
        form.classList.add('hidden');
        errorText.textContent = message;
        errorBox.classList.remove('hidden');
    }

    function enablePasswordForm() {
        recoveryReady = true;
        loading.classList.add('hidden');
        errorBox.classList.add('hidden');
        form.classList.remove('hidden');
        document.getElementById('newPassword').focus();
    }

    async function initializeRecovery() {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const authError = urlParams.get('error_description') || hashParams.get('error_description');
        if (authError) {
            showRecoveryError('This reset link is invalid or expired. Request a new password reset email and try again.');
            return;
        }
        if (!client) {
            showRecoveryError('The sign-in service is unavailable. Refresh the page or contact the gym for help.');
            return;
        }

        client.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || session) enablePasswordForm();
        });

        const { data, error } = await client.auth.getSession();
        if (error) {
            showRecoveryError('We could not verify this reset link. Request a new one and try again.');
            return;
        }
        if (data.session) {
            enablePasswordForm();
            return;
        }

        window.setTimeout(() => {
            if (!recoveryReady) showRecoveryError('This reset link is invalid or expired. Request a new password reset email and try again.');
        }, 1200);
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!recoveryReady) return;
        const password = document.getElementById('newPassword').value;
        const confirmation = document.getElementById('confirmPassword').value;
        statusBox.classList.add('hidden');
        if (password.length < 8) {
            statusText.textContent = 'Use a password with at least 8 characters.';
            statusBox.classList.remove('hidden');
            return;
        }
        if (password !== confirmation) {
            statusText.textContent = 'The passwords do not match.';
            statusBox.classList.remove('hidden');
            return;
        }

        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
        try {
            const { error } = await client.auth.updateUser({ password });
            if (error) throw error;
            form.classList.add('hidden');
            document.getElementById('resetIntro').textContent = 'Password updated successfully.';
            successBox.classList.remove('hidden');
            try {
                await client.auth.signOut();
            } catch (signOutError) {
                console.warn('Password changed, but the recovery session could not be closed:', signOutError);
            }
        } catch (error) {
            console.error('Password reset failed:', error);
            statusText.textContent = 'We could not update your password. The link may have expired; request a new one and try again.';
            statusBox.classList.remove('hidden');
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-lock"></i> Save New Password';
        }
    });

    initializeRecovery();
})();

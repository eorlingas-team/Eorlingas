import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import styles from '../styles/LoginPage.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    // If no token, redirect to login or show error
    if (!token) {
        return (
            <div className={`${styles['login-container']} ${styles['dark']}`}>
                <div className={`${styles['login-wrapper']}`}>
                    <div className={`${styles['login-card']}`}>
                        <p className={`${styles['error-message']}`}>Invalid request. Missing reset token.</p>
                        <button className={`${styles['login-btn']}`} onClick={() => navigate('/login')}>Back to Login</button>
                    </div>
                </div>
            </div>
        );
    }

    const getStrength = (pass) => {
        if (!pass) return '';
        if (pass.length < 8) return 'strength-weak';
        if (pass.length < 10) return 'strength-medium';
        return 'strength-strong';
    };

    const strengthClass = getStrength(newPassword);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        try {
            await authApi.resetPassword({ token, newPassword, confirmPassword });
            setSuccess(true);
            setMessage("Your password changed successfully! You can now log in.");
        } catch (err) {
            console.error("Reset Password Error:", err);
            const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to reset password.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className={`${styles['login-container']} ${styles['dark']}`}>
                <div className={`${styles['login-wrapper']}`}>
                    <main className={`${styles['login-card']}`} style={{ textAlign: 'center' }}>
                        <span className={`material-symbols-outlined`} style={{ fontSize: '3rem', color: 'var(--success-color)', marginBottom: '16px' }}>check_circle</span>
                        <h2 className={styles['login-title']} style={{ color: 'var(--success-color)' }}>Success!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{message}</p>
                        <button className={`${styles['login-btn']}`} onClick={() => navigate('/login')}>Go to Login</button>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles['login-container']} ${styles['dark']}`}>
            <div className={`${styles['login-wrapper']}`}>
                <div className={`${styles['login-header']}`}>
                    <h1 className={styles['login-title']}>Reset Password</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Please create a strong password for your account.</p>
                </div>

                <main className={`${styles['login-card']}`}>
                    {error && <div className={`${styles['error-message']}`}>{error}</div>}

                    <form onSubmit={handleSubmit} className={`${styles['login-form']}`}>

                        <div className={`${styles['form-group']}`}>
                            <span className={`${styles['form-label']}`}>New Password</span>
                            <div className={`${styles['password-wrapper']}`}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className={`${styles['form-input']}`}
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                                <span
                                    className={`material-symbols-outlined ${styles['password-toggle-icon']}`}
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </div>
                            {/* Reuse RegisterPage strength bar */}
                        </div>

                        <div className={`${styles['form-group']}`}>
                            <span className={`${styles['form-label']}`}>Confirm Password</span>
                            <div className={`${styles['password-wrapper']}`}>
                                <input
                                    type={showConfirm ? "text" : "password"}
                                    className={`${styles['form-input']}`}
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                <span
                                    className={`material-symbols-outlined ${styles['password-toggle-icon']}`}
                                    onClick={() => setShowConfirm(!showConfirm)}
                                >
                                    {showConfirm ? 'visibility_off' : 'visibility'}
                                </span>
                            </div>
                        </div>

                        <button type="submit" className={`${styles['login-btn']}`} disabled={loading}>
                            {loading ? <LoadingSpinner size="sm" color="white" /> : 'Reset Password'}
                        </button>
                    </form>
                </main>
            </div>
        </div>
    );
};

export default ResetPasswordPage;

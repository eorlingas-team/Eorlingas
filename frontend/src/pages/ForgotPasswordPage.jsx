import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import styles from '../styles/LoginPage.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!email.endsWith('@itu.edu.tr')) {
            setError("Please enter a valid İTÜ email address (@itu.edu.tr).");
            return;
        }

        // Show message
        setMessage('If an account associated with this email exists, a password reset link has been sent. Please check your inbox.');
        setLoading(true);

        // Perform actual request in background
        authApi.forgotPassword(email)
            .catch(err => {
                console.error("Forgot Password Background Error:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    return (
        <div className={`${styles['login-container']} ${styles['dark']}`}>
            <button className={`${styles['btn-return-home']}`} onClick={() => navigate('/login')}>
                <span className={`material-symbols-outlined`}>arrow_back</span>
                <span>Back to Login</span>
            </button>

            <div className={`${styles['login-wrapper']}`}>
                <div className={`${styles['login-header']}`}>
                    <h1 className={styles['login-title']}>Forgot Password?</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Enter your İTÜ email address to receive a reset link.</p>
                </div>

                <main className={`${styles['login-card']}`}>
                    {message && (
                        <div style={{
                            backgroundColor: 'color-mix(in srgb, var(--success-color) 10%, transparent)',
                            border: '1px solid var(--success-color)',
                            color: 'var(--success-color)',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '0.9rem'
                        }}>
                            {message}
                        </div>
                    )}

                    {error && <div className={`${styles['error-message']}`}>{error}</div>}

                    <form onSubmit={handleSubmit} className={`${styles['login-form']}`}>
                        <div className={`${styles['form-group']}`}>
                            <label className={`${styles['input-wrapper']}`}>
                                <p className={`${styles['form-label']}`}>İTÜ Email</p>
                                <input
                                    type="email"
                                    className={`${styles['form-input']}`}
                                    placeholder="user@itu.edu.tr"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </label>
                        </div>

                        <button type="submit" className={`${styles['login-btn']}`} disabled={loading}>
                            {loading ? <LoadingSpinner size="sm" color="white" /> : 'Send Reset Link'}
                        </button>
                    </form>
                </main>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;

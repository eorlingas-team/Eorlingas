import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/LoginPage.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.role === 'Administrator') {
        navigate('/admin');
      } else if (user.role === 'Space_Manager') {
        navigate('/space-manager');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles['login-container']} ${styles['dark']}`}>
      {/* Return to Home Button */}
      <button className={`${styles['btn-return-home']}`} onClick={() => navigate('/')}>
        <span className={`material-symbols-outlined`}>arrow_back</span>
        <span>Return to Home</span>
      </button>

      <div className={`${styles['login-wrapper']}`}>
        <div className={`${styles['login-header']}`}>
          <h1 className={`${styles['login-title']}`}>Login to your account</h1>
        </div>

        <main className={`${styles['login-card']}`}>
          {error && <div className={`${styles['error-message']}`}>{error}</div>}

          <form onSubmit={handleLogin} className={`${styles['login-form']}`}>
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
              <p className={`${styles['helper-text']}`}>Only @itu.edu.tr accounts are permitted.</p>
            </div>

            <div className={`${styles['form-group']}`}>
              <div className={`${styles['form-label']}`}>
                <span>Password</span>
              </div>
              <div className={`${styles['password-wrapper']}`}>
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${styles['form-input']}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span
                  className={`material-symbols-outlined ${styles['password-toggle-icon']}`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </div>
              <div style={{ textAlign: 'right', marginTop: '4px' }}>
                <span className={`${styles['forgot-link']}`} onClick={() => navigate('/forgot-password')}>Forgot Password?</span>
              </div>
            </div>

            <button type="submit" className={`${styles['login-btn']}`} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" color="white" /> : 'Login'}
            </button>
          </form>
        </main>

        <footer className={`${styles['login-footer']}`}>
          <p>
            Don't have an account?
            <span className={`${styles['signup-link']}`} onClick={() => navigate('/register')}>Sign Up</span>
          </p>

          <div className={`${styles['divider-container']}`}>
            <div className={`${styles['divider-line']}`} aria-hidden="true"></div>
            <div className={`${styles['divider-text-wrapper']}`}>
              <span className={`${styles['divider-text']}`}>Or</span>
            </div>
          </div>

          <span className={`${styles['guest-link']}`} onClick={() => navigate('/')}>Continue as Guest</span>
        </footer>
      </div>
    </div>
  );
};

export default LoginPage;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useToast } from '../contexts/ToastContext';
import styles from '../styles/RegisterPage.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    studentNumber: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const getStrength = (pass) => {
    if (!pass) return '';
    if (pass.length < 6) return 'strength-weak';
    if (pass.length < 10) return 'strength-medium';
    return 'strength-strong';
  };

  const strengthClass = getStrength(formData.password);
  const strengthLabel = {
    'strength-weak': 'Weak',
    'strength-medium': 'Medium',
    'strength-strong': 'Strong',
    '': ''
  }[strengthClass];

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!formData.email.endsWith('@itu.edu.tr')) {
      addToast("Please use a valid ITU email address (@itu.edu.tr)", "error");
      setLoading(false);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      addToast("Passwords do not match!", "error");
      setLoading(false);
      return;
    }

    try {
      const apiData = {
        fullName: formData.fullName,
        email: formData.email,
        studentNumber: formData.studentNumber,
        password: formData.password,
        passwordConfirmation: formData.confirmPassword,
        phoneNumber: formData.phoneNumber
      };

      await authApi.register(apiData);
      addToast("Registration successful! Please verify your email.", "success");
      navigate('/verify-email', { state: { email: formData.email } });
    } catch (err) {
      console.error("Register Error:", err);
      const errorData = err.response?.data?.error;
      const errorMessage = errorData?.message || err.response?.data?.message || err.message;
      const errorDetails = errorData?.details ? `\n- ${errorData.details.join('\n- ')}` : '';

      addToast(`Registration failed: ${errorMessage}${errorDetails}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className={`${styles['register-container']} ${styles['dark']}`}>
      {/* Return to Home Button */}
      <button className={`${styles['btn-return-home']}`} onClick={() => navigate('/')}>
        <span className={`material-symbols-outlined`}>arrow_back</span>
        <span>Return to Home</span>
      </button>

      <div className={`${styles['register-wrapper']}`}>
        <div className={`${styles['register-header']}`}>
          <h1 className={`${styles['register-title']}`}>Create Your Account</h1>
          <p className={`${styles['register-subtitle']}`}>Register for İTÜ Study Space Finder</p>
        </div>

        <div className={`${styles['register-card']}`}>
          <form onSubmit={handleRegister} className={`${styles['register-form']}`}>
            <label className={`${styles['form-label-group']}`}>
              <span className={`${styles['form-label']}`}>Full Name</span>
              <input
                name="fullName"
                type="text"
                className={`${styles['form-input']}`}
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </label>

            <div className={`${styles['form-label-group']}`}>
              <label>
                <span className={`${styles['form-label']}`}>İTÜ Email</span>
                <input
                  name="email"
                  type="email"
                  className={`${styles['form-input']}`}
                  placeholder="user@itu.edu.tr"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </label>
              <p className={`${styles['helper-text']}`}>Please use your official İTÜ email address.</p>
            </div>

            <div className={`${styles['form-grid-row']}`}>
              <label className={`${styles['form-label-group']}`}>
                <span className={`${styles['form-label']}`}>Student Number</span>
                <input
                  name="studentNumber"
                  type="text"
                  className={`${styles['form-input']}`}
                  placeholder="e.g. 123456789"
                  value={formData.studentNumber}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className={`${styles['form-label-group']}`}>
                <span className={`${styles['form-label']}`}>Phone Number <span className={`${styles['label-optional']}`}>(Optional)</span></span>
                <input
                  name="phoneNumber"
                  type="tel"
                  className={`${styles['form-input']}`}
                  placeholder="+90 555 555 5555"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div className={`${styles['form-label-group']}`}>
              <span className={`${styles['form-label']}`}>Password</span>
              <div className={`${styles['password-wrapper']}`}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className={`${styles['form-input']}`}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button type="button" className={`${styles['password-toggle']}`} onClick={() => setShowPassword(!showPassword)}>
                  <span className={`material-symbols-outlined`}>{showPassword ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
              <div className={`${styles['strength-container']} ${styles[strengthClass]}`}>
                <div className={`${styles['strength-bar-bg']}`}>
                  <div className={`${styles['strength-bar-fill']}`}></div>
                </div>
                <span className={`${styles['strength-text']}`}>{strengthLabel}</span>
              </div>
            </div>

            <div className={`${styles['form-label-group']}`}>
              <span className={`${styles['form-label']}`}>Confirm Password</span>
              <div className={`${styles['password-wrapper']}`}>
                <input
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  className={`${styles['form-input']} ${formData.confirmPassword && formData.password !== formData.confirmPassword ? styles.error : ''}`}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button type="button" className={`${styles['password-toggle']}`} onClick={() => setShowConfirm(!showConfirm)}>
                  <span className={`material-symbols-outlined`}>{showConfirm ? 'visibility' : 'visibility_off'}</span>
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className={`${styles['error-text']}`}>Passwords do not match.</p>
              )}
            </div>

            <button type="submit" className={`${styles['submit-btn']}`} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" color="white" /> : 'Register'}
            </button>
          </form>
        </div>

        <p className={`${styles['register-footer']}`}>
          Already have an account? <span className={`${styles['login-link']}`} onClick={() => navigate('/login')}>Log in</span>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useToast } from '../contexts/ToastContext';
import styles from '../styles/VerifyEmailPage.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef([]);

  const [verificationStatus, setVerificationStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const stateEmail = location.state?.email;
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      const verifyWithToken = async () => {
        setVerificationStatus('loading');
        try {
          await authApi.verifyEmail({ token });
          setVerificationStatus('success');
          setStatusMessage('Your email has been successfully verified! You can now log in.');
        } catch (err) {
          console.error("Token verification error:", err);
          setVerificationStatus('error');
          const msg = err.response?.data?.error?.message || "Verification link is invalid or expired.";
          setStatusMessage(msg);
        }
      };
      if (verificationStatus === 'idle') {
        verifyWithToken();
      }
    }
    else if (!stateEmail) {
      navigate('/login');
    }
  }, [token, stateEmail, navigate, verificationStatus]);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  if (token) {
    return (
      <div className={`${styles['verify-container']} ${styles['dark']}`}>
        <main className={`${styles['verify-main']}`}>
          <div className={`${styles['verify-card']}`}>
            {verificationStatus === 'loading' && (
              <>
                <div className={`${styles['spinner']}`}></div>
                <h2 className={`${styles['verify-title']}`} style={{ fontSize: '1.5rem', marginTop: '10px' }}>Verifying...</h2>
                <p className={`${styles['verify-text']}`}>Please wait while we verify your email address.</p>
              </>
            )}

            {verificationStatus === 'success' && (
              <>
                <span className={`material-symbols-outlined ${styles['success-icon']}`}>check_circle</span>
                <h2 className={`${styles['verify-title']}`} style={{ fontSize: '1.5rem', marginTop: '10px' }}>Verified!</h2>
                <p className={`${styles['verify-text']}`} style={{ marginBottom: '24px' }}>{statusMessage}</p>
                <button className={`${styles['verify-btn']}`} onClick={() => navigate('/login')}>
                  Go to Login
                </button>
              </>
            )}

            {verificationStatus === 'error' && (
              <>
                <span className={`material-symbols-outlined ${styles['error-icon']}`}>error</span>
                <h2 className={`${styles['verify-title']}`} style={{ fontSize: '1.5rem', marginTop: '10px' }}>Verification Failed</h2>
                <p className={`${styles['verify-text']}`} style={{ marginBottom: '24px' }}>{statusMessage}</p>
                <button className={`${styles['verify-btn']}`} onClick={() => navigate('/login')}>
                  Back to Login
                </button>
                <p className={`${styles['resend-text']}`} style={{ marginTop: '16px' }}>
                  Link expired? Try logging in to request a new one.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (!stateEmail) return null;

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Focus next input
    if (element.value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // Focus previous input on backspace if current is empty
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length === 6) {
      setVerifyLoading(true);
      try {
        await authApi.verifyEmail({ email: stateEmail, code });
        addToast("Verification successful! You can now log in.", "success");
        navigate('/login');
      } catch (err) {
        console.error("Code verification error:", err);
        const msg = err.response?.data?.error?.message || err.response?.data?.message || "Verification failed.";
        addToast(msg, "error");
      } finally {
        setVerifyLoading(false);
      }
    } else {
      addToast("Please enter the full 6-digit code.", "warning");
    }
  };

  const handleResend = async () => {
    if (!stateEmail) return;
    if (timer > 0) return;

    setResendLoading(true);
    try {
      await authApi.resendVerification(stateEmail);
      addToast(`Verification code resent to ${stateEmail}!`, "success");
      setTimer(60); // Reset timer to 60 seconds
    } catch (err) {
      console.error("Resend error:", err);
      addToast("Failed to resend code.", "error");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className={`${styles['verify-container']} ${styles['dark']}`}>
      <main className={`${styles['verify-main']}`}>
        <div className={`${styles['verify-card']}`}>

          <h1 className={`${styles['verify-title']}`}>Verify Your Account</h1>

          <p className={`${styles['verify-text']}`}>
            We've sent a verification code to <strong>{stateEmail}</strong>. <br />
            Please enter it below or click the link in the email.
          </p>

          <div className={`${styles['otp-container']}`}>
            <fieldset className={`${styles['otp-fieldset']}`}>
              {otp.map((data, index) => (
                <React.Fragment key={index}>
                  <input
                    className={`${styles['otp-input']}`}
                    type="text"
                    name="otp"
                    maxLength="1"
                    value={data}
                    onChange={e => handleChange(e.target, index)}
                    onKeyDown={e => handleKeyDown(e, index)}
                    ref={el => inputRefs.current[index] = el}
                    inputMode="numeric"
                  />
                  {index === 2 && <span className={`${styles['separator']}`}>-</span>}
                </React.Fragment>
              ))}
            </fieldset>
          </div>

          <div className={`${styles['verify-btn-container']}`}>
            <button className={`${styles['verify-btn']}`} onClick={handleVerify} disabled={verifyLoading}>
              {verifyLoading ? <LoadingSpinner size="sm" color="white" /> : 'Verify'}
            </button>
          </div>

          <div className={`${styles['resend-container']}`}>
            {timer > 0 ? (
              <div className={`${styles['resend-text']}`}>
                Resend code in <span className={`${styles['timer-text']}`}>{timer}s</span>
              </div>
            ) : (
              <div className={`${styles['resend-text']}`}>
                Didn't receive the email? <span className={`${styles['resend-link']} ${resendLoading ? styles.disabled : ''}`} onClick={handleResend}>
                  {resendLoading ? <LoadingSpinner size="sm" variant="primary" className={styles['inline-spinner']} /> : 'Resend Code'}
                </span>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default VerifyEmailPage;
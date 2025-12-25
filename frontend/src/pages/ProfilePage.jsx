import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { formatDate } from '../utils/dateUtils';
import { authApi } from '../api/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import styles from '../styles/ProfilePage.module.css';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout, updateProfile, deleteAccount, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    department: '',
    studentNumber: ''
  });

  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotif: true,
    webNotif: true
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isLoadingPass, setIsLoadingPass] = useState(false);

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const handleChangePass = (e) => {
    const { name, value } = e.target;
    setPassData(prev => ({ ...prev, [name]: value }));
  };

  const handleSavePass = async () => {
    setPassError('');
    setPassSuccess('');
    setIsLoadingPass(true);

    if (passData.newPassword !== passData.confirmPassword) {
      setPassError("New passwords do not match.");
      setIsLoadingPass(false);
      return;
    }
    if (!passData.currentPassword) {
      setPassError("Current password is required.");
      setIsLoadingPass(false);
      return;
    }

    try {
      await authApi.changePassword({
        currentPassword: passData.currentPassword,
        newPassword: passData.newPassword,
        newPasswordConfirmation: passData.confirmPassword
      });
      setPassSuccess("Password changed successfully.");
      setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      setTimeout(() => {
        setIsChangingPassword(false);
        setPassSuccess('');
        setIsLoadingPass(false);
        setShowCurrentPass(false);
        setShowNewPass(false);
        setShowConfirmPass(false);
      }, 2000);

    } catch (err) {
      console.error("Change Password Error:", err);
      const msg = err.response?.data?.error?.message || "Failed to change password.";
      setPassError(msg);
      setIsLoadingPass(false);
    }
  };

  const handleCancelPass = () => {
    setIsChangingPassword(false);
    setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPassError('');
    setPassSuccess('');
    setShowCurrentPass(false);
    setShowNewPass(false);
    setShowConfirmPass(false);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        phone: user.phoneNumber || '',
        department: user.department || '',
        studentNumber: user.studentNumber || ''
      });
      if (user.notificationPreferences) {
        setNotificationPrefs({
          emailNotif: user.notificationPreferences.emailNotifications !== false,
          webNotif: user.notificationPreferences.webNotifications !== false
        });
      }
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await updateProfile({
        fullName: formData.fullName,
        phoneNumber: formData.phone
      });
      addToast("Profile updated successfully", "success");
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      addToast("Failed to update profile", "error");
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        phone: user.phoneNumber || '',
        department: user.department || '',
        studentNumber: user.studentNumber || ''
      });
    }
    setIsEditing(false);
  };

  const handleToggle = async (key) => {
    const newPrefs = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(newPrefs);

    try {
      const backendPrefs = {
        emailNotifications: newPrefs.emailNotif,
        webNotifications: newPrefs.webNotif
      };

      await updateProfile({ notificationPreferences: backendPrefs });
    } catch (error) {
      console.error("Failed to update preferences", error);
      setNotificationPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleDeleteAccount = async () => {
    await confirm({
      title: "Delete Account",
      message: "Are you sure you want to delete your account? This action cannot be undone.",
      confirmText: "Delete Account",
      variant: "danger",
      onConfirm: async () => {
        const result = await deleteAccount();
        if (!result.success) {
          addToast(result.error, "error");
          throw new Error(result.error);
        }
      }
    });
  };

  if (!user) {
    return <div className={styles['profile-container']}><LoadingSpinner fullHeight text="Loading profile..." /></div>;
  }

  const formatRole = (role) => {
    if (!role) return '';
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const isPrivilegedUser = ['administrator', 'admin', 'space_manager'].includes(user.role?.toLowerCase());

  return (
    <div className={`${styles['profile-container']} ${styles.dark}`}>
      <Header />

      {/* Main Content */}
      <main className={styles['profile-main']}>
        <div className={styles['content-wrapper']}>

          <h1 className={styles['page-title']}>My Profile</h1>

          <div className={styles['profile-grid']}>

            {/* Left Column: Summary Card */}
            <aside>
              <div className={styles['profile-card']}>
                <div className={styles['profile-summary']}>
                  <h2 className={styles['user-name']} style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{user.fullName}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                    <span className={styles['user-role']} style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      backgroundColor: 'color-mix(in srgb, var(--primary-color) 10%, transparent)',
                      color: 'var(--primary-color)',
                      borderRadius: '20px',
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}>
                      {formatRole(user.role)}
                    </span>
                  </div>
                </div>

                {(user.createdAt || user.registrationDate) && (
                  <div className={styles['member-since']}>
                    <p className={styles['label-text']}>Member Since</p>
                    <p className={styles['value-text']}>{formatDate(user.createdAt || user.registrationDate)}</p>
                  </div>
                )}

                <button className={styles['logout-btn']} onClick={logout}>
                  <span className="material-symbols-outlined">logout</span>
                  Logout
                </button>
              </div>
            </aside>

            {/* Right Column: Details */}
            <section className={styles['content-column']}>

              {/* Personal Information */}
              <div className={styles['info-section']}>
                <div className={styles['section-header']}>
                  <h3 className={styles['section-title']}>Personal Information</h3>
                  <div className={styles['header-actions']}>
                    {!isEditing ? (
                      <button className={styles['edit-btn']} onClick={() => setIsEditing(true)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span> Edit
                      </button>
                    ) : (
                      <>
                        <button className={`${styles['icon-action-btn']} ${styles.cancel}`} onClick={handleCancel} title="Cancel">
                          <span className="material-symbols-outlined">close</span>
                        </button>
                        <button className={`${styles['icon-action-btn']} ${styles.save}`} onClick={handleSave} title="Save Changes">
                          <span className="material-symbols-outlined">check</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles['info-grid']}>
                  <div className={styles['input-group']}>
                    <label className={styles['label-text']}>Full Name</label>
                    <input
                      type="text"
                      name="fullName"
                      className={styles['profile-input']}
                      value={formData.fullName}
                      onChange={handleChange}
                      readOnly={!isEditing}
                    />
                  </div>

                  <div className={styles['input-group']}>
                    <label className={styles['label-text']}>Email</label>
                    <input
                      type="email"
                      className={styles['profile-input']}
                      value={user.email || ''}
                      readOnly
                      disabled
                    />
                    <p className={styles['helper-text']}>Email cannot be changed</p>
                  </div>

                  {!isPrivilegedUser && (
                    <>
                      <div className={styles['input-group']}>
                        <label className={styles['label-text']}>Student Number</label>
                        <input
                          type="text"
                          className={styles['profile-input']}
                          value={user.studentNumber || ''}
                          readOnly
                          disabled
                        />
                        <p className={styles['helper-text']}>Student number cannot be changed</p>
                      </div>


                    </>
                  )}

                  <div className={styles['input-group']}>
                    <label className={styles['label-text']}>Phone Number</label>
                    <div className={styles['phone-wrapper']}>
                      <input
                        type="tel"
                        name="phone"
                        className={styles['profile-input']}
                        value={formData.phone}
                        onChange={handleChange}
                        readOnly={!isEditing}
                        style={{ paddingRight: '32px' }}
                      />
                      {isEditing && (
                        <button className={styles['phone-edit-icon']} onClick={(e) => { e.preventDefault(); setIsEditing(true); }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Preferences */}
              <div className={styles['info-section']}>
                <div className={styles['section-header']}>
                  <h3 className={styles['section-title']}>Contact Preferences</h3>
                </div>

                <div className={styles['pref-row']}>
                  <div>
                    <p className={styles['value-text']} style={{ fontWeight: 500 }}>Email Notifications</p>
                  </div>
                  <label className={styles['toggle-label']}>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.emailNotif}
                      onChange={() => handleToggle('emailNotif')}
                    />
                    <span className={styles['toggle-slider']}></span>
                  </label>
                </div>

                <div className={styles['pref-row']}>
                  <div>
                    <p className={styles['value-text']} style={{ fontWeight: 500 }}>Web Notifications</p>
                  </div>
                  <label className={styles['toggle-label']}>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.webNotif}
                      onChange={() => handleToggle('webNotif')}
                    />
                    <span className={styles['toggle-slider']}></span>
                  </label>
                </div>
              </div>

              {/* Theme Preferences */}
              <div className={styles['info-section']}>
                <div className={styles['section-header']}>
                  <h3 className={styles['section-title']}>Appearance</h3>
                </div>

                <div className={styles['preferences-grid']}>
                  <div
                    className={`${styles['pref-item']} ${theme === 'light' ? styles['active'] : ''}`}
                    onClick={() => setTheme('light')}
                    style={{ cursor: 'pointer', border: theme === 'light' ? '2px solid var(--primary-color)' : '1px solid var(--border-main)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--status-orange)' }}>light_mode</span>
                      <span className={styles['pref-label']}>Light Mode</span>
                    </div>
                    {theme === 'light' && <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>check_circle</span>}
                  </div>

                  <div
                    className={`${styles['pref-item']} ${theme === 'dark' ? styles['active'] : ''}`}
                    onClick={() => setTheme('dark')}
                    style={{ cursor: 'pointer', border: theme === 'dark' ? '2px solid var(--primary-color)' : '1px solid var(--border-main)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>dark_mode</span>
                      <span className={styles['pref-label']}>Dark Mode</span>
                    </div>
                    {theme === 'dark' && <span className="material-symbols-outlined" style={{ color: 'var(--primary-color)' }}>check_circle</span>}
                  </div>
                </div>
              </div>

              {/* Contact Preferences */}

              {/* Change Password */}
              <div className={styles['info-section']}>
                {!isChangingPassword ? (
                  <div className={styles['pref-row']}>
                    <div>
                      <p className={styles['action-title']}>Change Password</p>
                      <p className={styles['helper-text']}>Update your password regularly to keep your account secure</p>
                    </div>
                    {passSuccess && <span style={{ color: 'var(--success-color)', marginRight: '10px', fontSize: '0.9rem' }}>{passSuccess}</span>}
                    <button className={styles['action-btn']} onClick={() => { setIsChangingPassword(true); setPassSuccess(''); setPassError(''); }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock_reset</span> Change
                    </button>
                  </div>
                ) : passSuccess ? (
                  <div className={styles['success-overlay']}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--success-color)', marginBottom: '16px' }}>check_circle</span>
                    <h3 className={styles['success-title']}>Password Updated!</h3>
                    <p className={styles['success-text']}>Your password has been changed successfully.</p>
                  </div>
                ) : (
                  <div className={styles['password-change-form']}>
                    <div className={styles['section-header']}>
                      <h3 className={styles['section-title']}>Change Password</h3>
                    </div>

                    {passError && <div className="error-message" style={{ marginBottom: '16px' }}>{passError}</div>}

                    <div className={styles['input-group']}>
                      <label className={styles['label-text']}>Current Password</label>
                      <div className={styles['password-input-wrapper']}>
                        <input
                          type={showCurrentPass ? "text" : "password"}
                          name="currentPassword"
                          className={styles['profile-input']}
                          value={passData.currentPassword}
                          onChange={handleChangePass}
                          placeholder="Enter current password"
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          className={styles['password-toggle-icon']}
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {showCurrentPass ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className={styles['input-group']}>
                      <label className={styles['label-text']}>New Password</label>
                      <div className={styles['password-input-wrapper']}>
                        <input
                          type={showNewPass ? "text" : "password"}
                          name="newPassword"
                          className={styles['profile-input']}
                          value={passData.newPassword}
                          onChange={handleChangePass}
                          placeholder="Enter new password"
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          className={styles['password-toggle-icon']}
                          onClick={() => setShowNewPass(!showNewPass)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {showNewPass ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className={styles['input-group']}>
                      <label className={styles['label-text']}>Confirm New Password</label>
                      <div className={styles['password-input-wrapper']}>
                        <input
                          type={showConfirmPass ? "text" : "password"}
                          name="confirmPassword"
                          className={styles['profile-input']}
                          value={passData.confirmPassword}
                          onChange={handleChangePass}
                          placeholder="Confirm new password"
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          className={styles['password-toggle-icon']}
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {showConfirmPass ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className={styles['action-buttons']} style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                      <button className={styles['cancel-btn-text']} onClick={handleCancelPass} disabled={isLoadingPass}>
                        Cancel
                      </button>
                      <button className={styles['save-btn']} onClick={handleSavePass} disabled={isLoadingPass}>
                        {isLoadingPass ? (
                          <>
                            <LoadingSpinner size="sm" variant="white" />
                            Updating...
                          </>
                        ) : (
                          'Update Password'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Account */}
              <div className={`${styles['info-section']} ${styles['delete-section']}`}>
                <div className={styles['pref-row']}>
                  <div>
                    <p className={styles['delete-title']}>Delete Account</p>
                    <p className={styles['helper-text']}>Once deleted, there is no going back</p>
                  </div>
                  <button className={styles['delete-btn']} onClick={handleDeleteAccount}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Booking Issue Section */}
              {user.role?.toLowerCase() === 'student' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    className={styles['action-btn']}
                    onClick={() => navigate('/report')}
                    style={{
                      background: 'none',
                      border: 'none',
                      boxShadow: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      opacity: 0.8
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>report</span>
                    Report Bookings
                  </button>
                </div>
              )}

            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
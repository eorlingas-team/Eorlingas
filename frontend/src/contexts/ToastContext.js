import React, { createContext, useContext, useState, useCallback } from 'react';
import styles from '../styles/Toast.module.css';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem = ({ message, type, duration, onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <div className={`${styles.container} ${styles[type]}`}>
      <span className={`material-symbols-outlined ${styles.icon}`}>
        {getIcon()}
      </span>
      <div className={styles.message}>{message}</div>
      <button className={styles.closeBtn} onClick={onClose} title="Close">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
      </button>
      <div 
        className={styles.progressBar} 
        style={{ animationDuration: `${duration}ms` }} 
      />
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          {...toast} 
          onClose={() => removeToast(toast.id)} 
        />
      ))}
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    
    // Default durations per type if default duration is passed
    let finalDuration = duration;
    if (duration === 5000) {
      if (type === 'error') finalDuration = 7000;
      if (type === 'warning') finalDuration = 6000;
      if (type === 'success') finalDuration = 4000;
    }

    setToasts((prevToasts) => [...prevToasts, { id, message, type, duration: finalDuration }]);
    
    if (finalDuration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, finalDuration);
    }
    
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

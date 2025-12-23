import React, { createContext, useContext, useState, useCallback } from 'react';
import styles from '../styles/ConfirmDialog.module.css';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

const ConfirmDialog = ({ title, message, confirmText, cancelText, variant, onConfirm, onCancel, loading }) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger': return 'warning';
      case 'warning': return 'error_outline';
      case 'info': return 'help_outline';
      default: return 'help_outline';
    }
  };

  const handleKeyDown = (e) => {
    if (loading) return;
    
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm();
    }
  };

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading]);

  return (
    <div className={styles.overlay} onClick={loading ? undefined : onCancel}>
      <div 
        className={`${styles.dialog} ${styles[variant]}`} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className={styles.header}>
          <span className={`material-symbols-outlined ${styles.icon}`}>
            {getIcon()}
          </span>
          <h2 id="confirm-title" className={styles.title}>{title}</h2>
        </div>
        
        <p id="confirm-message" className={styles.message}>{message}</p>
        
        <div className={styles.actions}>
          <button 
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={onCancel}
            disabled={loading}
            autoFocus
          >
            {cancelText}
          </button>
          <button 
            className={`${styles.button} ${styles.confirmButton}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                <span style={{ marginLeft: '8px' }}>Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ConfirmProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: options.title || 'Confirm',
        message: options.message || 'Are you sure?',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'info',
        loading: false,
        onConfirm: async () => {
          if (options.onConfirm) {
            // Set loading state
            setConfirmState(prev => ({ ...prev, loading: true }));
            
            try {
              await options.onConfirm();
              // Close dialog on success
              setConfirmState(null);
              resolve(true);
            } catch (error) {
              setConfirmState(prev => ({ ...prev, loading: false }));
              resolve(false);
            }
          } else {
            setConfirmState(null);
            resolve(true);
          }
        },
        onCancel: () => {
          if (confirmState?.loading) return;
          setConfirmState(null);
          resolve(false);
        }
      });
    });
  }, [confirmState]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {confirmState && <ConfirmDialog {...confirmState} />}
    </ConfirmContext.Provider>
  );
};

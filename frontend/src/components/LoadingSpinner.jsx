import React from 'react';
import styles from '../styles/LoadingSpinner.module.css';

const LoadingSpinner = ({
    size = 'md',
    variant = 'primary',
    fullHeight = false,
    text = '',
    className = '',
    color
}) => {
    return (
        <div className={`${styles['spinner-container']} ${fullHeight ? styles['full-height'] : ''} ${className}`}>
            <div
                className={`${styles.spinner} ${styles[size]} ${styles[variant]}`}
                style={color ? {
                    borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
                    borderTopColor: color
                } : {}}
            ></div>
            {text && <p className={styles['spinner-text']}>{text}</p>}
        </div>
    );
};

export default LoadingSpinner;

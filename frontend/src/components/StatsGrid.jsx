import React from 'react';
import styles from '../styles/StatsGrid.module.css';
import LoadingSpinner from './LoadingSpinner';

const StatsCard = ({ label, value, loading }) => (
    <div className={`${styles['stats-card']}`}>
        <span className={`${styles['stats-label']}`}>{label}</span>
        <span className={`${styles['stats-value']}`}>
            {loading ? <LoadingSpinner size="sm" /> : value}
        </span>
    </div>
);

const StatsGrid = ({ stats, loading = false }) => {
    if (!stats || stats.length === 0) return null;

    return (
        <div className={`${styles['stats-grid-container']}`}>
            {stats.map((stat, index) => (
                <StatsCard
                    key={index}
                    label={stat.label}
                    value={stat.value}
                    loading={loading}
                />
            ))}
        </div>
    );
};

export default StatsGrid;

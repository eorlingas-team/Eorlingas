import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { reportsApi } from '../api/reports';
import { formatDateTime } from '../utils/dateUtils';
import styles from '../styles/ReportDefensePage.module.css';

const ReportDefensePage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [defenseMessage, setDefenseMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const response = await reportsApi.getByToken(token);
                if (response.data?.success) {
                    setReport(response.data.data.report);
                    if (response.data.data.report.defenseMessage) {
                        setSubmitted(true);
                        setDefenseMessage(response.data.data.report.defenseMessage);
                    }
                }
            } catch (err) {
                console.error('Error fetching report:', err);
                setError(err.response?.data?.error?.message || 'Invalid or expired link');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchReport();
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (defenseMessage.length < 10) {
            addToast('Defense must be at least 10 characters long', 'error');
            return;
        }

        setSubmitting(true);

        try {
            await reportsApi.submitDefense(token, defenseMessage);
            setSubmitted(true);
            addToast('Your defense has been submitted successfully', 'success');
        } catch (err) {
            console.error('Error submitting defense:', err);
            addToast(err.response?.data?.error?.message || 'Failed to submit defense', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className={styles['defense-container']}>
                <Header />
                <main className={styles['defense-main']}>
                    <LoadingSpinner fullHeight text="Loading..." />
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles['defense-container']}>
                <Header />
                <main className={styles['defense-main']}>
                    <div className={styles['error-card']}>
                        <span className="material-symbols-outlined">error</span>
                        <h2>Invalid Link</h2>
                        <p>{error}</p>
                        <button onClick={() => navigate('/')} className={styles['home-btn']}>
                            Return to Home
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles['defense-container']}>
            <Header />
            <main className={styles['defense-main']}>
                <div className={styles['content-wrapper']}>
                    <h1 className={styles['page-title']}>Submit Defense</h1>

                    <div className={styles['report-info']}>
                        <h3>Report Information</h3>
                        <div className={styles['info-grid']}>
                            <div className={styles['info-item']}>
                                <span className={styles['info-label']}>Study Space</span>
                                <span className={styles['info-value']}>
                                    {report?.space?.spaceName} - Room {report?.space?.roomNumber}
                                </span>
                            </div>
                            <div className={styles['info-item']}>
                                <span className={styles['info-label']}>Location</span>
                                <span className={styles['info-value']}>
                                    {report?.space?.buildingName}, {report?.space?.campusName}
                                </span>
                            </div>
                            <div className={styles['info-item']}>
                                <span className={styles['info-label']}>Date</span>
                                <span className={styles['info-value']}>
                                    {report?.booking?.startTime && formatDateTime(report.booking.startTime)}
                                </span>
                            </div>
                            <div className={styles['info-item']}>
                                <span className={styles['info-label']}>Report Date</span>
                                <span className={styles['info-value']}>
                                    {report?.createdAt && formatDateTime(report.createdAt)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {submitted ? (
                        <div className={styles['success-card']}>
                            <span className="material-symbols-outlined">check_circle</span>
                            <h2>Defense Submitted</h2>
                            <p>Your defense has been successfully recorded and will be reviewed by administrators.</p>
                            <div className={styles['submitted-defense']}>
                                <h4>Submitted Defense:</h4>
                                <p>{defenseMessage}</p>
                            </div>
                        </div>
                    ) : (
                        <form className={styles['defense-form']} onSubmit={handleSubmit}>
                            <div className={styles['warning-box']}>
                                <span className="material-symbols-outlined">warning</span>
                                <p>
                                    A complaint has been reported about your booking.
                                    You can write your defense in the field below. Your defense will be reviewed by administrators.
                                </p>
                            </div>

                            <div className={styles['form-group']}>
                                <label htmlFor="defense">Your Defense</label>
                                <textarea
                                    id="defense"
                                    value={defenseMessage}
                                    onChange={(e) => setDefenseMessage(e.target.value)}
                                    placeholder="Explain the situation (at least 10 characters)"
                                    rows={6}
                                    required
                                    minLength={10}
                                />
                                <span className={styles['char-count']}>{defenseMessage.length} / 10+</span>
                            </div>

                            <button
                                type="submit"
                                className={styles['submit-btn']}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <LoadingSpinner size="sm" variant="white" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">send</span>
                                        Submit Defense
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ReportDefensePage;

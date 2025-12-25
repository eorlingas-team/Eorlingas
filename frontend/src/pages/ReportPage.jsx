import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { spacesApi } from '../api/spaces';
import { reportsApi } from '../api/reports';
import styles from '../styles/ReportPage.module.css';

const ReportPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ campuses: [], buildings: [], spaces: [] });

    // Form state
    const [selectedCampus, setSelectedCampus] = useState('');
    const [selectedBuilding, setSelectedBuilding] = useState('');
    const [selectedSpace, setSelectedSpace] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [message, setMessage] = useState('');

    // Filtered dropdowns
    const [filteredBuildings, setFilteredBuildings] = useState([]);
    const [filteredSpaces, setFilteredSpaces] = useState([]);



    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const response = await spacesApi.getFilterOptions();
                if (response.data?.success) {
                    setFilterOptions(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching filter options:', error);
                addToast('Failed to fetch filter options', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchFilterOptions();
    }, [addToast]);

    // Filter buildings based on selected campus
    useEffect(() => {
        if (selectedCampus) {
            const buildings = filterOptions.buildings?.filter(
                b => b.campus_id === parseInt(selectedCampus)
            ) || [];
            setFilteredBuildings(buildings);
            setSelectedBuilding('');
            setSelectedSpace('');
        } else {
            setFilteredBuildings([]);
        }
    }, [selectedCampus, filterOptions.buildings]);

    // Filter spaces based on selected building
    useEffect(() => {
        if (selectedBuilding) {
            const spaces = filterOptions.spaces?.filter(
                s => s.building_id === parseInt(selectedBuilding)
            ) || [];
            setFilteredSpaces(spaces);
            setSelectedSpace('');
        } else {
            setFilteredSpaces([]);
        }
    }, [selectedBuilding, filterOptions.spaces]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedSpace || !selectedTime || !message) {
            addToast('Please fill in all fields', 'error');
            return;
        }

        if (message.length < 10) {
            addToast('Message must be at least 10 characters long', 'error');
            return;
        }

        setSubmitting(true);

        try {
            const today = new Date();
            const [hours, minutes] = selectedTime.split(':').map(Number);

            const reportTime = new Date(today);
            reportTime.setHours(hours, minutes, 0, 0);

            await reportsApi.create({
                spaceId: parseInt(selectedSpace),
                reportTime: reportTime.toISOString(),
                message: message.trim()
            });

            addToast('Your report has been submitted successfully', 'success');
            navigate('/');
        } catch (error) {
            console.error('Error creating report:', error);
            const errorCode = error.response?.data?.error?.code;
            const errorMessage = error.response?.data?.error?.message || 'Failed to submit report';

            if (errorCode === 'SELF_REPORT_NOT_ALLOWED') {
                addToast("You cannot report your own booking.", 'error');
            } else {
                addToast(errorMessage, 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className={styles['report-container']}>
                <Header />
                <main className={styles['report-main']}>
                    <LoadingSpinner fullHeight text="Loading..." />
                </main>
            </div>
        );
    }

    return (
        <div className={styles['report-container']}>
            <Header />
            <main className={styles['report-main']}>
                <div className={styles['content-wrapper']}>
                    <div className={styles['page-header']}>
                        <button className={styles['back-btn']} onClick={() => navigate(-1)}>
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 className={styles['page-title']}>Report a Booking Problem</h1>
                    </div>



                    <form className={styles['report-form']} onSubmit={handleSubmit}>
                        <div className={styles['form-group']}>
                            <label htmlFor="campus">Campus</label>
                            <select
                                id="campus"
                                value={selectedCampus}
                                onChange={(e) => setSelectedCampus(e.target.value)}
                                required
                            >
                                <option value="">Select campus</option>
                                {filterOptions.campuses.map((campus) => (
                                    <option key={campus.campus_id} value={campus.campus_id}>
                                        {campus.campus_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles['form-group']}>
                            <label htmlFor="building">Building</label>
                            <select
                                id="building"
                                value={selectedBuilding}
                                onChange={(e) => setSelectedBuilding(e.target.value)}
                                disabled={!selectedCampus}
                                required
                            >
                                <option value="">Select building</option>
                                {filteredBuildings.map((building) => (
                                    <option key={building.building_id} value={building.building_id}>
                                        {building.building_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles['form-group']}>
                            <label htmlFor="space">Study Space</label>
                            <select
                                id="space"
                                value={selectedSpace}
                                onChange={(e) => setSelectedSpace(e.target.value)}
                                disabled={!selectedBuilding}
                                required
                            >
                                <option value="">Select space</option>
                                {filteredSpaces.map((space) => (
                                    <option key={space.space_id} value={space.space_id}>
                                        {space.space_name} - Oda {space.room_number}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles['form-group']}>
                            <label htmlFor="time">Time (Today)</label>
                            <input
                                type="time"
                                id="time"
                                value={selectedTime}
                                onChange={(e) => setSelectedTime(e.target.value)}
                                required
                                className={styles['time-input']}
                            />
                        </div>

                        <div className={styles['form-group']}>
                            <label htmlFor="message">Description</label>
                            <textarea
                                id="message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Explain the issue in detail (at least 10 characters)"
                                rows={4}
                                required
                                minLength={10}
                            />
                            <span className={styles['char-count']}>{message.length} / 10+</span>
                        </div>

                        <div className={styles['form-actions']}>
                            <button
                                type="button"
                                className={styles['cancel-btn']}
                                onClick={() => navigate(-1)}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
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
                                        Submit Report
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default ReportPage;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import Header from '../components/Header';
import StatsGrid from '../components/StatsGrid';
import styles from '../styles/AdminDashboard.module.css';
import LoadingSpinner from '../components/LoadingSpinner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getTodayIstanbul, getIstanbulNow } from '../utils/dateUtils';
import { format, addDays } from 'date-fns';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { stats, statsLoading, actions } = useAdmin();

  // Default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const today = getIstanbulNow();
    return format(addDays(today, -30), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(getTodayIstanbul());

  // Fetch data when dates change
  useEffect(() => {
    actions.fetchStats({ startDate, endDate });
  }, [startDate, endDate]);



  // Safe defaults
  const {
    activeUsers = 0,
    totalSpaces = 0,
    totalBookings = 0,
    cancellationRate = 0,
    breakdown = { completed: 0, upcoming: 0, cancelled: 0, total: 0 },
    peakBookingHours = [],
    mostBookedSpaces = [],
  } = stats || {};

  // Calculate percentages for breakdown
  const getPercent = (val) => breakdown.total > 0 ? ((val / breakdown.total) * 100).toFixed(1) : 0;
  const getWidth = (val) => breakdown.total > 0 ? `${(val / breakdown.total) * 100}%` : '0%';

  return (
    <div className={`${styles['dashboard-container']}`}>
      <Header />

      <main className={`${styles['dashboard-main']}`}>
        <div className={`${styles['content-wrapper']}`}>

          {/* Page Heading & Calendar */}
          <div className={`${styles['page-header']}`}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h1 className={`${styles['page-title']}`}>Admin Dashboard</h1>
              {statsLoading && <LoadingSpinner size="sm" />}
            </div>

            <div className={`${styles['date-filters']}`}>
              <div className={`${styles['date-field-group']}`}>
                <label className={`${styles['date-label']}`}>From</label>
                <div className={`${styles['date-input-wrapper']}`}>
                  <input
                    type="date"
                    className={`${styles['custom-date-input']}`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className={`${styles['date-field-group']}`}>
                <label className={`${styles['date-label']}`}>To</label>
                <div className={`${styles['date-input-wrapper']}`}>
                  <input
                    type="date"
                    className={`${styles['custom-date-input']}`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid using Component */}
          <StatsGrid stats={[
            { label: 'Total Active Users', value: activeUsers.toLocaleString() },
            { label: 'Total Manageable Spaces', value: totalSpaces },
            { label: 'Total Bookings', value: totalBookings.toLocaleString() },
            { label: 'Cancellation Rate', value: `${cancellationRate}%` }
          ]} loading={statsLoading} />

          {/* Charts Section */}
          <div className={`${styles['charts-grid']}`}>
            {/* Booking Status Breakdown */}
            <div className={`${styles['chart-card']} ${styles['lg-col-span-2']}`}>
              <p className={`${styles['card-title']}`}>Booking Status Breakdown</p>
              <div className={`${styles['breakdown-header']}`}>
                <p className={`${styles['breakdown-total']}`}>{breakdown.total.toLocaleString()} Total</p>
              </div>

              <div className={`${styles['breakdown-list']}`}>
                <div className={`${styles['breakdown-item']}`}>
                  <div className={`${styles['breakdown-info']}`}>
                    <span className={`${styles['breakdown-label']}`}>Completed</span>
                    <span className={`${styles['breakdown-count']}`}>{breakdown.completed.toLocaleString()}</span>
                  </div>
                  <div className={`${styles['progress-bar-bg']}`}>
                    <div className={`${styles['progress-bar-fill']} ${styles['primary']}`} style={{ width: getWidth(breakdown.completed) }}></div>
                  </div>
                </div>

                <div className={`${styles['breakdown-item']}`}>
                  <div className={`${styles['breakdown-info']}`}>
                    <span className={`${styles['breakdown-label']}`}>Upcoming</span>
                    <span className={`${styles['breakdown-count']}`}>{breakdown.upcoming.toLocaleString()}</span>
                  </div>
                  <div className={`${styles['progress-bar-bg']}`}>
                    <div className={`${styles['progress-bar-fill']} ${styles['warning']}`} style={{ width: getWidth(breakdown.upcoming) }}></div>
                  </div>
                </div>

                <div className={`${styles['breakdown-item']}`}>
                  <div className={`${styles['breakdown-info']}`}>
                    <span className={`${styles['breakdown-label']}`}>Cancelled</span>
                    <span className={`${styles['breakdown-count']}`}>{breakdown.cancelled.toLocaleString()}</span>
                  </div>
                  <div className={`${styles['progress-bar-bg']}`}>
                    <div className={`${styles['progress-bar-fill']} ${styles['danger']}`} style={{ width: getWidth(breakdown.cancelled) }}></div>
                  </div>
                </div>


              </div>
            </div>

            {/* Peak Booking Hours */}
            <div className={`${styles['chart-card']} ${styles['lg-col-span-3']}`}>
              <p className={`${styles['card-title']}`}>Peak Booking Hours</p>
              <div className={`${styles['chart-container']}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={peakBookingHours}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-main)" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(h) => `${h}:00`}
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 12 }}
                      interval={3}
                    />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--primary-color)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Most Booked Spaces */}
          <div className={`${styles['table-card']}`}>
            <h3 className={`${styles['card-title']} ${styles['mb-4']}`}>Most Booked Spaces</h3>
            <div className={`${styles['spaces-table']}`}>
              <div className={`${styles['table-header']}`}>
                <div className={`${styles['col-rank']}`}>Rank</div>
                <div className={`${styles['col-space']}`}>Space</div>
                <div className={`${styles['col-count']} ${styles['text-right']}`}>Bookings</div>
              </div>

              {mostBookedSpaces.length > 0 ? (
                mostBookedSpaces.map((space, index) => (
                  <div className={`${styles['table-row']}`} key={space.name}>
                    <div className={`${styles['col-rank']}`}>
                      <div className={`${styles['rank-badge']}`}>{index + 1}</div>
                    </div>
                    <div className={`${styles['col-space']}`}>
                      <p className={`${styles['space-name']}`}>{space.name}</p>
                      <p className={`${styles['space-location']}`}>{space.location}</p>
                    </div>
                    <div className={`${styles['col-count']} ${styles['text-right']} ${styles['font-bold']}`}>
                      {space.bookings.toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className={`${styles['no-data-row']}`}>No bookings data available for this period.</div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
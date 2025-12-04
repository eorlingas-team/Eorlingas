import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upcoming');

  // Mock User Data
  const user = {
    name: "Yağmur Çizmecioğlu",
    email: "cizmecioglu21@itu.edu.tr",
    studentId: "820210329"
  };

  // Mock Reservation Data
  const [reservations, setReservations] = useState([
    {
      id: 101,
      room: "Library Study Room A",
      date: "Tuesday, December 12, 2025",
      time: "10:00 AM - 12:00 PM",
      status: "Confirmed",
      type: "upcoming"
    },
    {
      id: 102,
      room: "Computer Lab 202",
      date: "Friday, December 15, 2025",
      time: "14:00 PM - 16:00 PM",
      status: "Confirmed",
      type: "upcoming"
    },
    {
      id: 201,
      room: "MED-C Ground Floor",
      date: "Monday, November 20, 2025",
      time: "09:00 AM - 11:00 AM",
      status: "Completed",
      type: "past"
    }
  ]);

  // Handle Cancellation (Simulated)
  const handleCancel = (id) => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      setReservations(prev => 
        prev.map(res => 
          res.id === id ? { ...res, status: "Cancelled", type: "past" } : res
        )
      );
    }
  };

  // Filter reservations based on active tab
  const displayReservations = reservations.filter(res => res.type === activeTab);

  return (
    <div className="profile-container">
      {/* 1. Header with User Info */}
      <header className="profile-header">
        <div className="avatar-placeholder">👤</div>
        <div className="user-info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <p>ID: {user.studentId}</p>
        </div>
      </header>

      {/* 2. Tab Navigation */}
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming Reservations
        </button>
        <button 
          className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Past Reservations
        </button>
      </div>

      {/* 3. Reservations List */}
      <div className="reservation-list">
        {displayReservations.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>No reservations found.</p>
        ) : (
          displayReservations.map(res => (
            <div key={res.id} className="reservation-card">
              <div className="res-details">
                <h3>{res.room}</h3>
                <p>{res.date}</p>
                <p>{res.time}</p>
                <span className={`res-status ${res.status.toLowerCase()}`}>
                  {res.status}
                </span>
              </div>
              
              {/* Only show Cancel button for Upcoming confirmed bookings */}
              {activeTab === 'upcoming' && res.status === 'Confirmed' && (
                <button 
                  className="cancel-btn"
                  onClick={() => handleCancel(res.id)}
                >
                  Cancel
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* 4. Bottom Navigation */}
      <footer className="bottom-nav">
        <span className="nav-link" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
          🏠 Home
        </span>
        <span className="nav-link" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
          🔍 Browse Spaces
        </span>
        <span className="nav-link" style={{cursor: 'not-allowed', color: '#ccc'}}>
          ⚙️ Settings
        </span>
      </footer>
    </div>
  );
};

export default ProfilePage;
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './SpaceDetailsPage.css';

const SpaceDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Get room ID from URL

  // Booking State
  const [date, setDate] = useState("2025-12-12");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  // Mock Data for "MED-C"
  const roomDetails = {
    name: "MED-C",
    capacity: 100,
    amenities: ["Wi-Fi", "Whiteboard", "Projector"],
    noiseLevel: "Low",
    description: "Comfortable and well-equipped study space designed to help students stay focused.",
    image: "https://placehold.co/600x400/e5e5e5/666666?text=Study+Room+Image"
  };

  // Simple duration calculation logic
  const calculateDuration = () => {
    const start = parseInt(startTime.split(':')[0]);
    const end = parseInt(endTime.split(':')[0]);
    const duration = end - start;
    return duration > 0 ? `${duration} hour(s)` : 'Invalid duration';
  };

  const handleBooking = () => {
    alert(`Booking Confirmed for ${roomDetails.name} on ${date}!`);
    // In the future, this will connect to the backend API
  };

  return (
    <div className="details-container">
      {/* Header */}
      <header className="details-header">
        <span className="back-btn" onClick={() => navigate('/')}>&lt; Back</span>
        <h1 className="room-title">{roomDetails.name}</h1>
        <span className="profile-link" onClick={() => navigate('/profile')}>Profile</span>
      </header>

      <div className="details-content">
        {/* Left Column: Image & Booking Controls */}
        <div className="left-column">
          <img src={roomDetails.image} alt={roomDetails.name} className="room-image" />
          
          <div className="booking-card">
            <div className="form-group">
              <label>Select Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Time Slot</label>
              <div className="time-row">
                <select value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                </select>
                <span>to</span>
                <select value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                </select>
              </div>
              <p className="duration-display">Duration: {calculateDuration()}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Room Info */}
        <div className="right-column">
          <div className="info-section">
            <h3>Capacity</h3>
            <p>{roomDetails.capacity} People</p>
          </div>

          <div className="info-section">
            <h3>Amenities</h3>
            <p>{roomDetails.amenities.join(', ')}</p>
          </div>

          <div className="info-section">
            <h3>Noise Level</h3>
            <p>📶 {roomDetails.noiseLevel}</p>
          </div>

          <div className="info-section">
            <h3>Description</h3>
            <p>{roomDetails.description}</p>
          </div>

          <button className="confirm-btn" onClick={handleBooking}>
            Confirm Booking
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpaceDetailsPage;
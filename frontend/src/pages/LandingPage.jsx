import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Ensure this is imported
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate(); // Ensure this hook is called

  const [filters, setFilters] = useState({
    campus: 'ITU Ayazaga',
    building: 'All',
    roomType: 'All',
    capacity: 10,
    date: new Date().toISOString().split('T')[0], 
    availableNow: false
  });

  // Mock Data
  const spaces = [
    {
      id: 1,
      name: 'Room 101',
      capacity: 10,
      status: 'Available',
      nextAvailable: 'Now'
    },
    {
      id: 2,
      name: 'Room 202',
      capacity: 15,
      status: 'Maintenance',
      nextAvailable: 'Tomorrow'
    },
    {
      id: 3,
      name: 'Room 305',
      capacity: 25,
      status: 'Occupied',
      nextAvailable: '1:30 PM'
    },
    {
      id: 4,
      name: 'Room 406',
      capacity: 12,
      status: 'Available',
      nextAvailable: '3:00 PM'
    }
  ];

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="landing-container">
      <aside className="filter-sidebar">
        <h2>Space Search and Filtering</h2>
        
        <div className="filter-group">
          <label>Campus</label>
          <select name="campus" value={filters.campus} onChange={handleFilterChange}>
            <option value="ITU Ayazaga">ITU Ayazaga</option>
            <option value="ITU Macka">ITU Macka</option>
            <option value="ITU Gumussuyu">ITU Gumussuyu</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Building</label>
          <select name="building" value={filters.building} onChange={handleFilterChange}>
            <option value="All">All</option>
            <option value="Computer Engineering">Computer Engineering</option>
            <option value="Library">Library</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Room Type</label>
          <select name="roomType" value={filters.roomType} onChange={handleFilterChange}>
            <option value="All">All</option>
            <option value="Quiet Study">Quiet Study</option>
            <option value="Group Room">Group Room</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Capacity: {filters.capacity}</label>
          <input 
            type="range" 
            name="capacity" 
            min="1" 
            max="50" 
            value={filters.capacity} 
            onChange={handleFilterChange} 
          />
        </div>

        <div className="filter-group">
          <label>Date / Time</label>
          <input 
            type="date" 
            name="date" 
            value={filters.date} 
            onChange={handleFilterChange} 
          />
        </div>

        <div className="checkbox-group">
          <input 
            type="checkbox" 
            name="availableNow" 
            checked={filters.availableNow} 
            onChange={handleFilterChange} 
          />
          <label>Available Now</label>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <input 
            type="text" 
            placeholder="Search rooms..." 
            className="search-input" 
          />
          <div className="auth-buttons">
            <button className="btn-login" onClick={() => navigate('/login')}>Login</button>
            <button className="btn-register" onClick={() => navigate('/register')}>Register</button>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="map-background">
        {/* Map would go here */}
        </div>

        <div className="space-list-overlay">
          {spaces.map(space => (
            <div 
              key={space.id} 
              className="space-card" 
              onClick={() => navigate(`/spaces/${space.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="space-header">
                <span className="space-name">{space.name}</span>
                <span className={`status ${space.status.toLowerCase()}`}>
                  {space.status}
                </span>
              </div>
              <div className="space-details">
                <p>Capacity: {space.capacity}</p>
                <p>Next available: {space.nextAvailable}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
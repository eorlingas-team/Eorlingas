import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './AdminDashboard.css'; // Reusing admin styles for consistency

const EditSpacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock data fetching based on ID
  const [formData, setFormData] = useState({
    name: '',
    capacity: '',
    status: 'Available'
  });

  useEffect(() => {
    // In a real app, fetch(API) here. For now, we simulate data:
    setFormData({
      name: `Room ${id}`, // Simulating fetching room details
      capacity: 28,
      status: 'Available'
    });
  }, [id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Changes saved! (Simulated)");
    navigate('/admin');
  };

  return (
    <div className="admin-container">
      <div className="dashboard-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2>Edit Room {id}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div className="form-group">
            <label>Room Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required 
            />
          </div>

          <div className="form-group">
            <label>Capacity</label>
            <input 
              type="number" 
              value={formData.capacity}
              onChange={(e) => setFormData({...formData, capacity: e.target.value})}
              required 
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select 
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              style={{ padding: '8px', width: '100%' }}
            >
              <option value="Available">Available</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Occupied">Occupied</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="confirm-btn">Save Changes</button>
            <button 
              type="button" 
              className="confirm-btn" 
              style={{ backgroundColor: '#6c757d' }}
              onClick={() => navigate('/admin')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSpacePage;
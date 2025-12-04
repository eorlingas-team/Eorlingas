import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const [rooms, setRooms] = useState([
    { id: 1, name: "Lecture Hall A", location: "4570", capacity: 28, status: "Available" },
    { id: 2, name: "Comp Lab 1", location: "1070", capacity: 28, status: "Maintenance" },
    { id: 3, name: "Meeting Room 3", location: "2070", capacity: 28, status: "Occupied" },
    { id: 4, name: "Study Zone B", location: "2000", capacity: 23, status: "Available" },
    { id: 5, name: "Quiet Room", location: "2070", capacity: 28, status: "Available" },
  ]);

  // Handle status change
  const handleStatusChange = (id, newStatus) => {
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.id === id ? { ...room, status: newStatus } : room
      )
    );
  };

  // Navigate to the edit page
  const handleEdit = (id) => {
    navigate(`/admin/edit/${id}`);
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          room.location.includes(searchTerm);
    const matchesBuilding = filterBuilding === 'All' || room.location === filterBuilding;
    const matchesStatus = filterStatus === 'All' || room.status === filterStatus;
    
    return matchesSearch && matchesBuilding && matchesStatus;
  });

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Administrative Dashboard</h1>
        <button onClick={() => navigate('/')} style={{marginTop: '10px', padding: '5px 10px'}}>
          &lt; Back to Home
        </button>
      </div>

      <div className="dashboard-card">
        <h2>Administrative Table</h2>
        
        <div className="filter-bar">
          <select 
            className="filter-select" 
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
          >
            <option value="All">All Buildings</option>
            <option value="4570">Bld 4570</option>
            <option value="1070">Bld 1070</option>
          </select>

          <select className="filter-select">
            <option value="All">All Room Types</option>
            <option value="Lab">Lab</option>
            <option value="Classroom">Classroom</option>
            <option value="Library">Library</option>
          </select>

          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Availabilities</option>
            <option value="Available">Available</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Occupied">Occupied</option>
          </select>

          <input 
            type="text" 
            placeholder="Search Rooms..." 
            className="search-rooms-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" /></th>
              <th>Room Name</th>
              <th>Location</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRooms.map(room => (
              <tr key={room.id}>
                <td><input type="checkbox" /></td>
                <td>{room.name}</td>
                <td>{room.location}</td>
                <td>{room.capacity}</td> 
                <td>
                  <select 
                    value={room.status}
                    onChange={(e) => handleStatusChange(room.id, e.target.value)}
                    className={`status-badge ${room.status.toLowerCase()}`}
                    style={{ border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    <option value="Available">Available</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Occupied">Occupied</option>
                  </select>
                </td>
                <td className="action-buttons">
                  <button className="btn-edit" onClick={() => handleEdit(room.id)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
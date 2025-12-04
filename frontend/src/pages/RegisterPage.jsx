import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css'; // Reusing the same styles

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleRegister = (e) => {
    e.preventDefault();
    if (!formData.email.endsWith('@itu.edu.tr')) {
      alert("Please use a valid ITU email address (@itu.edu.tr)");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    alert("Verification email sent! Please check your inbox.");
    navigate('/login');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-placeholder">Create Account</div>
        
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <input 
              type="text" 
              placeholder="Full Name" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <input 
              type="email" 
              placeholder="ITU Email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <input 
              type="password" 
              placeholder="Password" 
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <input 
              type="password" 
              placeholder="Confirm Password" 
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              required 
            />
          </div>

          <button type="submit" className="auth-btn">Sign Up</button>
        </form>

        <div className="auth-links" style={{justifyContent: 'center'}}>
          <span>Already have an account? <span className="link" onClick={() => navigate('/login')}>Login</span></span>
        </div>

        {/* Back to Home Link */}
        <div className="back-link" onClick={() => navigate('/')}>
          ← Back to Search
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
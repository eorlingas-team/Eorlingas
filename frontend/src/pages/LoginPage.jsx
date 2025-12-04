import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // Simulate login logic
    if(email.includes('admin')) {
      alert("Logged in as Admin");
      navigate('/admin');
    } else {
      alert("Logged in as Student");
      navigate('/profile');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-placeholder">
           {/* Logo placeholder */}
           ITU Study Space Finder
        </div>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <input 
              type="email" 
              placeholder="ITU Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="form-group">
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="auth-btn">Login</button>
        </form>

        <div className="auth-links">
          <span className="link">Forgot Password</span>
          <span className="link" onClick={() => navigate('/register')}>Register</span>
        </div>
        
        <div className="back-link" onClick={() => navigate('/')}>
          ← Back to Search
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
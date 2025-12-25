import React from 'react';

const rrd = {
  BrowserRouter: ({children}) => <div>{children}</div>,
  Routes: ({children}) => <div>{children}</div>,
  Route: ({children}) => <div>{children}</div>,
  Link: ({children, to, ...props}) => <a href={to} {...props}>{children}</a>,
  NavLink: ({children, to, ...props}) => <a href={to} {...props}>{children}</a>,
  useNavigate: jest.fn(() => jest.fn()),
  useLocation: jest.fn(() => ({ pathname: '/', search: '', hash: '', state: null })),
  useParams: jest.fn(() => ({})),
  Outlet: () => <div>Outlet</div>,
  Navigate: ({to}) => <div>Redirected to {to ? (typeof to === 'string' ? to : to.pathname) : 'unknown'}</div>
};

module.exports = rrd;

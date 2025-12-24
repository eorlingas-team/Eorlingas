import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { SpacesProvider } from '../contexts/SpacesContext';
import { BookingProvider } from '../contexts/BookingContext';
import { AdminProvider } from '../contexts/AdminContext';
import { SpaceManagerProvider } from '../contexts/SpaceManagerContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ConfirmProvider } from '../contexts/ConfirmContext';

export const AppProviders = ({ children }) => {
    return (
        <Router>
            <ThemeProvider>
                <ConfirmProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <AdminProvider>
                                <SpaceManagerProvider>
                                    <BookingProvider>
                                        <SpacesProvider>
                                            {children}
                                        </SpacesProvider>
                                    </BookingProvider>
                                </SpaceManagerProvider>
                            </AdminProvider>
                        </AuthProvider>
                    </ToastProvider>
                </ConfirmProvider>
            </ThemeProvider>
        </Router>
    );
};

// src/components/Layout/Layout.jsx - Enhanced with advanced responsive features

import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';
import QuickActions from './QuickActions';
import NotificationCenter from '../Notification/NotificationCenter';
import UserMenu from '../User/UserMenu';
import SearchBar from '../Common/SearchBar';
import Toasts from '../Common/Toasts';
import LoadingBar from '../Common/LoadingBar';
import CommandPalette from '../Common/CommandPalette';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Zap, Rocket, Sparkles, Search, Menu, X } from 'lucide-react';
import './Layout.css';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { user } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobileScreen = useMediaQuery('(max-width: 768px)');

  // Handle responsive changes
  useEffect(() => {
    setIsMobile(isMobileScreen);
    if (!isMobileScreen) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [isMobileScreen]);

  // Handle route changes
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [location]);

  // Close all overlays on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setShowQuickActions(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
        setSearchOpen(false);
        setCommandPaletteOpen(false);
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Quick action handlers
  const quickActions = [
    {
      icon: <Sparkles />,
      label: 'Generate Image',
      onClick: () => navigate('/image-generation'),
      color: 'purple',
      shortcut: 'Ctrl+I'
    },
    {
      icon: <Rocket />,
      label: 'Create Video',
      onClick: () => navigate('/video-generation'),
      color: 'blue',
      shortcut: 'Ctrl+V'
    },
    {
      icon: <Zap />,
      label: 'Process Audio',
      onClick: () => navigate('/audio-processing'),
      color: 'green',
      shortcut: 'Ctrl+A'
    },
    {
      icon: <Bell />,
      label: 'Notifications',
      onClick: () => setNotificationsOpen(true),
      color: 'yellow',
      badge: unreadCount,
      shortcut: 'Ctrl+N'
    }
  ];

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [sidebarOpen]);

  return (
    <div className={`layout theme-${theme} ${isMobile ? 'mobile' : 'desktop'}`}>
      <LoadingBar isLoading={loading} />
      
      {/* Mobile Header */}
      {isMobile && (
        <div className="mobile-header">
          <button 
            className="menu-toggle"
            onClick={handleSidebarToggle}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="mobile-brand">
            <span className="brand-text">Changex Neurix</span>
          </div>
          <button 
            className="search-toggle"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </div>
      )}

      <Navbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onSearchClick={() => setSearchOpen(true)}
        onNotificationsClick={() => setNotificationsOpen(true)}
        onUserMenuClick={() => setUserMenuOpen(true)}
        onQuickActionsClick={() => setShowQuickActions(!showQuickActions)}
        onCommandPaletteClick={() => setCommandPaletteOpen(true)}
      />
      
      <div className="layout-content">
        <Sidebar 
          open={sidebarOpen} 
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
        />
        
        <main className="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.3,
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <Footer />

      {/* Overlays and Modals */}
      <QuickActions
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        actions={quickActions}
      />
      
      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      
      <UserMenu
        isOpen={userMenuOpen}
        onClose={() => setUserMenuOpen(false)}
        user={user}
      />
      
      <SearchBar
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
      
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      
      <Toasts />
    </div>
  );
};

export default Layout;

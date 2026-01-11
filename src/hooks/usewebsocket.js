// src/hooks/useWebSocket.js - Enhanced with reconnection and error handling

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';
import { useNotification } from '../contexts/NotificationContext';
import { usePerformance } from '../contexts/PerformanceContext';

const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_ERROR: 'reconnect_error',
  RECONNECT_FAILED: 'reconnect_failed',
  PING: 'ping',
  PONG: 'pong',
  
  // Image Generation
  IMAGE_GENERATED: 'image_generated',
  GENERATION_PROGRESS: 'generation_progress',
  GENERATION_ERROR: 'generation_error',
  GENERATION_CANCELLED: 'generation_cancelled',
  
  // Video Generation
  VIDEO_GENERATED: 'video_generated',
  VIDEO_PROGRESS: 'video_progress',
  VIDEO_ERROR: 'video_error',
  
  // Audio Processing
  AUDIO_GENERATED: 'audio_generated',
  AUDIO_PROCESSED: 'audio_processed',
  AUDIO_ERROR: 'audio_error',
  
  // IoT
  IOT_MESSAGE: 'iot_message',
  IOT_RESPONSE: 'iot_response',
  IOT_ERROR: 'iot_error',
  IOT_STATUS_UPDATE: 'iot_status_update',
  
  // Self-Learning
  TRAINING_PROGRESS: 'training_progress',
  LEARNING_SESSION_COMPLETED: 'learning_session_completed',
  LEARNING_ERROR: 'learning_error',
  
  // General
  NOTIFICATION: 'notification',
  USER_UPDATED: 'user_updated',
  SYSTEM_ALERT: 'system_alert',
  SERVER_MESSAGE: 'server_message',
  
  // Custom events for frontend compatibility
  IMAGE_GENERATION_PROGRESS: 'image_generation_progress',
  VIDEO_GENERATION_PROGRESS: 'video_generation_progress',
  AUDIO_PROCESSING_PROGRESS: 'audio_processing_progress'
};

export const useWebSocket = () => {
  const { user, token, refreshToken } = useAuth();
  const { showNotification } = useNotification();
  const { trackEvent } = usePerformance();
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const [lastActivity, setLastActivity] = useState(null);
  
  const [eventListeners, setEventListeners] = useState(new Map());
  const [pendingEmits, setPendingEmits] = useState([]);

  // WebSocket configuration
  const config = useMemo(() => ({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 30000,
    autoConnect: false,
    forceNew: true,
    query: {
      clientType: 'web',
      version: process.env.REACT_APP_VERSION || '2.0.0',
      platform: navigator.platform,
      language: navigator.language
    }
  }), []);

  // Get WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      return 'ws://localhost:3001';
    }
    return process.env.REACT_APP_WS_URL || 'wss://api.changexneurix.com';
  }, []);

  // Create socket connection
  const createSocket = useCallback(() => {
    if (!user || !token) return null;

    const url = getWebSocketUrl();
    const socket = io(url, {
      ...config,
      auth: {
        token,
        userId: user.id,
        refreshToken
      }
    });

    return socket;
  }, [user, token, refreshToken, config, getWebSocketUrl]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!user || !token) {
      console.log('No user or token, skipping WebSocket connection');
      return;
    }

    if (socketRef.current?.connected) {
      console.log('Socket already connected');
      return;
    }

    if (isConnecting) {
      console.log('Already connecting...');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Disconnect existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Create new socket
      const socket = createSocket();
      if (!socket) {
        throw new Error('Failed to create socket');
      }

      socketRef.current = socket;

      // Connection events
      socket.on(SOCKET_EVENTS.CONNECT, () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        setConnectionError(null);
        setLastActivity(Date.now());
        
        trackEvent('websocket_connected');
        showNotification('success', 'Connected to Changex Neurix servers', {
          icon: '🔗',
          duration: 2000
        });

        // Process pending emits
        processPendingEmits();
      });

      socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        setIsConnecting(false);
        setLastActivity(null);

        if (reason === 'io server disconnect') {
          // Server initiated disconnect
          showNotification('warning', 'Disconnected from server', {
            icon: '⚠️',
            duration: 3000
          });
          
          // Attempt reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      });

      socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
        console.error('WebSocket connection error:', error);
        setConnectionError(error.message);
        setIsConnecting(false);
        
        const attempt = reconnectAttempts + 1;
        setReconnectAttempts(attempt);
        
        if (attempt <= 3) {
          showNotification('warning', `Connection attempt ${attempt} failed. Retrying...`, {
            icon: '🔄',
            duration: 3000
          });
        } else {
          showNotification('error', 'Connection failed. Please check your network.', {
            icon: '❌',
            duration: 5000
          });
        }
      });

      socket.on(SOCKET_EVENTS.RECONNECT, (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        setIsConnected(true);
        setReconnectAttempts(0);
        setConnectionError(null);
        
        showNotification('success', 'Reconnected successfully', {
          icon: '✅',
          duration: 2000
        });
        
        trackEvent('websocket_reconnected', { attempts: attemptNumber });
      });

      socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attemptNumber) => {
        console.log(`Reconnection attempt: ${attemptNumber}`);
        setReconnectAttempts(attemptNumber);
      });

      socket.on(SOCKET_EVENTS.RECONNECT_FAILED, () => {
        console.error('Reconnection failed');
        showNotification('error', 'Failed to reconnect. Please refresh the page.', {
          icon: '🔄',
          duration: 5000,
          action: {
            label: 'Refresh',
            onClick: () => window.location.reload()
          }
        });
        
        trackEvent('websocket_reconnect_failed');
      });

      socket.on(SOCKET_EVENTS.PONG, () => {
        setLastActivity(Date.now());
      });

      // Register event listeners
      eventListeners.forEach((handlers, event) => {
        handlers.forEach(handler => {
          socket.on(event, handler);
        });
      });

      // Connect socket
      socket.connect();
      
      // Start ping interval
      startPingInterval();

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setIsConnecting(false);
      setConnectionError(error.message);
      
      showNotification('error', 'Failed to establish connection', {
        icon: '❌',
        duration: 5000
      });
    }
  }, [user, token, refreshToken, createSocket, eventListeners, reconnectAttempts, showNotification, trackEvent]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionError(null);
    
    // Clear intervals and timeouts
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    console.log('WebSocket disconnected');
  }, []);

  // Start ping interval
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(SOCKET_EVENTS.PING, { timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds
  }, []);

  // Process pending emits
  const processPendingEmits = useCallback(() => {
    if (pendingEmits.length > 0 && socketRef.current?.connected) {
      pendingEmits.forEach(({ event, data, callback }) => {
        emit(event, data, callback);
      });
      setPendingEmits([]);
    }
  }, [pendingEmits]);

  // Emit event
  const emit = useCallback((event, data, callback) => {
    if (!socketRef.current || !isConnected) {
      // Store for later
      setPendingEmits(prev => [...prev, { event, data, callback }]);
      
      if (callback) {
        callback({ error: 'Socket not connected', queued: true });
      }
      
      // Try to reconnect
      if (!isConnecting) {
        connect();
      }
      
      return;
    }

    try {
      const emitData = {
        ...data,
        timestamp: Date.now(),
        requestId: crypto.randomUUID()
      };
      
      socketRef.current.emit(event, emitData, (response) => {
        setLastActivity(Date.now());
        
        if (callback) {
          callback(response);
        }
      });
    } catch (error) {
      console.error('Emit error:', error);
      
      if (callback) {
        callback({ error: error.message });
      }
    }
  }, [isConnected, isConnecting, connect]);

  // Add event listener
  const on = useCallback((event, handler) => {
    const handlerWithLogging = (...args) => {
      console.log(`WebSocket event received: ${event}`, args[0]);
      handler(...args);
    };

    setEventListeners(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(event)) {
        newMap.set(event, new Set());
      }
      newMap.get(event).add(handlerWithLogging);
      return newMap;
    });

    // If socket exists, add listener
    if (socketRef.current) {
      socketRef.current.on(event, handlerWithLogging);
    }

    return () => {
      off(event, handlerWithLogging);
    };
  }, []);

  // Remove event listener
  const off = useCallback((event, handler) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      if (newMap.has(event)) {
        newMap.get(event).delete(handler);
        if (newMap.get(event).size === 0) {
          newMap.delete(event);
        }
      }
      return newMap;
    });

    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  // Remove all listeners for an event
  const removeAllListeners = useCallback((event) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      newMap.delete(event);
      return newMap;
    });

    if (socketRef.current) {
      socketRef.current.removeAllListeners(event);
    }
  }, []);

  // Auto-connect on user login
  useEffect(() => {
    if (user && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, token, connect, disconnect]);

  // Auto-reconnect on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user && !isConnected && !isConnecting) {
        console.log('Reconnecting due to visibility change');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isConnected, isConnecting, connect]);

  // Check connection health
  useEffect(() => {
    if (!isConnected || !lastActivity) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      
      if (timeSinceLastActivity > 60000) { // 60 seconds
        console.log('No activity for 60 seconds, reconnecting...');
        disconnect();
        connect();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [isConnected, lastActivity, connect, disconnect]);

  // Expose socket methods
  const socketMethods = useMemo(() => ({
    socket: socketRef.current,
    isConnected,
    isConnecting,
    reconnectAttempts,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off,
    removeAllListeners,
    SOCKET_EVENTS
  }), [
    isConnected,
    isConnecting,
    reconnectAttempts,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off,
    removeAllListeners
  ]);

  return socketMethods;
};

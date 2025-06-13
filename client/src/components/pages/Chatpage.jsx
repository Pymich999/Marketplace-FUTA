import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ref, onValue, push, get, off } from "firebase/database";
import { database } from "../../firebase";
import axios from "axios";
import { ArrowLeft, Send, Image, Smile } from "lucide-react";
import authService from "../../features/auth/authService";
import '../pages-styles/chat.css'

const ChatPage = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector(state => state.auth.user.user);
  
  // State management
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [otherUser, setOtherUser] = useState({ id: "", name: "Loading..." });
  const [threadDetails, setThreadDetails] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [debugInfo, setDebugInfo] = useState([]); // DEBUG: Track what's happening

  // Refs for optimization
  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  const firebaseUnsubscribeRef = useRef(null);
  const axiosSourceRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Cache refs
  const userCacheRef = useRef(new Map());
  const threadCacheRef = useRef(new Map());

  // DEBUG: Helper function to add debug info
  const addDebugInfo = useCallback((message, data = null) => {
    console.log(`🔧 [ChatPage DEBUG] ${message}`, data || '');
    setDebugInfo(prev => [...prev, { 
      timestamp: new Date().toLocaleTimeString(), 
      message, 
      data: data ? JSON.stringify(data, null, 2) : null 
    }]);
  }, []);

  // Memoized axios instance with auth
  const axiosWithAuth = useMemo(() => {
    const token = currentUser?.accessToken || currentUser?.token;
    if (!token) {
      addDebugInfo("❌ No auth token found", { 
        accessToken: !!currentUser?.accessToken, 
        token: !!currentUser?.token 
      });
      return null;
    }

    // Cancel previous requests
    if (axiosSourceRef.current) {
      axiosSourceRef.current.cancel('New request initiated');
    }

    axiosSourceRef.current = axios.CancelToken.source();
    addDebugInfo("✅ Created axios instance with auth");

    return axios.create({
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
      cancelToken: axiosSourceRef.current.token
    });
  }, [currentUser?.accessToken, currentUser?.token, addDebugInfo]);

  // Memoized user validation
  const isUserAuthorized = useMemo(() => {
    if (!currentUser || !threadId) {
      addDebugInfo("❌ User not authorized", { 
        currentUser: !!currentUser, 
        threadId: !!threadId 
      });
      return false;
    }
    const userUid = currentUser._id;
    const isAuthorized = threadId.includes(userUid) && threadId.split("_").includes(userUid);
    addDebugInfo(isAuthorized ? "✅ User authorized" : "❌ User not authorized", { 
      userUid, 
      threadId, 
      isAuthorized 
    });
    return isAuthorized;
  }, [currentUser, threadId, addDebugInfo]);

  // FIXED: Enhanced optimized chat fetching (same as ChatList)
  const fetchOptimizedChats = useCallback(async () => {
    if (!axiosWithAuth) {
      addDebugInfo("❌ No axiosWithAuth for optimized fetch");
      return null;
    }

    try {
      addDebugInfo("🔄 Attempting optimized chats fetch...");
      const response = await axiosWithAuth.get('/api/chats/optimized');
      
      if (response.data && response.data.threads && response.data.users) {
        addDebugInfo("✅ Optimized chats fetch successful", {
          threadsCount: response.data.threads.length,
          usersCount: Object.keys(response.data.users).length,
          sampleUsers: Object.entries(response.data.users).slice(0, 3)
        });
        
        return {
          threads: response.data.threads,
          users: response.data.users
        };
      } else {
        addDebugInfo("⚠️ Optimized response missing data", response.data);
        return null;
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        addDebugInfo("❌ Optimized chats fetch failed", {
          error: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText
        });
      }
      return null;
    }
  }, [axiosWithAuth, addDebugInfo]);

  // FIXED: Get other user info from optimized data (same approach as ChatList)
  const getOtherUserFromOptimizedData = useCallback((chatData, otherId) => {
    if (!chatData || !chatData.users) {
      addDebugInfo("❌ No chat data or users in optimized data", { 
        hasChatData: !!chatData, 
        hasUsers: !!(chatData?.users) 
      });
      return null;
    }
    
    // The users object from controller has format: users[userId] = "Name String"
    const userName = chatData.users[otherId];
    
    if (userName && userName !== `User ${otherId?.substring(0, 5)}`) {
      addDebugInfo("✅ Found user in optimized data", { otherId, userName });
      return {
        id: otherId,
        name: userName,
        role: 'user'
      };
    } else {
      addDebugInfo("❌ User not found in optimized data or is fallback name", { 
        otherId, 
        userName, 
        allUsers: Object.keys(chatData.users) 
      });
      return null;
    }
  }, [addDebugInfo]);

  // FIXED: Enhanced thread details fetcher with debugging
  const fetchThreadDetails = useCallback(async () => {
    if (!axiosWithAuth || !threadId) {
      addDebugInfo("❌ Cannot fetch thread details", { 
        hasAuth: !!axiosWithAuth, 
        hasThreadId: !!threadId 
      });
      return null;
    }

    // Check cache first
    const cached = threadCacheRef.current.get(threadId);
    if (cached && Date.now() - cached.timestamp < 60000) {
      addDebugInfo("✅ Using cached thread details", cached.data);
      return cached.data;
    }

    try {
      addDebugInfo("🔄 Fetching thread details...", { threadId });
      const response = await axiosWithAuth.get(`/api/chats/thread/${threadId}`);
      
      if (response.data) {
        addDebugInfo("✅ Thread details fetch successful", {
          isArray: Array.isArray(response.data),
          length: Array.isArray(response.data) ? response.data.length : 'N/A',
          sampleData: Array.isArray(response.data) ? response.data[0] : response.data
        });

        // Cache the result
        threadCacheRef.current.set(threadId, {
          data: response.data,
          timestamp: Date.now()
        });
        
        return response.data;
      } else {
        addDebugInfo("⚠️ Thread details response empty", response);
        return null;
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        addDebugInfo("❌ Thread details fetch failed", {
          error: err.message,
          status: err.response?.status
        });
      }
      return null;
    }
  }, [axiosWithAuth, threadId, addDebugInfo]);

  // FIXED: Enhanced user details fetcher (same as ChatList)
  const fetchUserDetails = useCallback(async (userId) => {
    if (!axiosWithAuth || !userId) {
      addDebugInfo("❌ Cannot fetch user details", { 
        hasAuth: !!axiosWithAuth, 
        hasUserId: !!userId 
      });
      return null;
    }

    // Check cache first
    const cached = userCacheRef.current.get(userId);
    if (cached && Date.now() - cached.timestamp < 60000) {
      addDebugInfo("✅ Using cached user details", cached.data);
      return cached.data;
    }

    try {
      addDebugInfo("🔄 Fetching user details...", { userId });
      const response = await axiosWithAuth.get(`/api/users/${userId}`);
      const userData = response.data?.user || response.data;
      
      if (userData) {
        let displayName = `User ${userId.substring(0, 5)}`;
        
        // FIXED: Same name resolution logic as ChatList
        if (userData.role === 'seller' || userData.role === 'seller_pending') {
          displayName = userData.sellerProfile?.studentName ||
                      userData.sellerProfile?.businessName ||
                      userData.name || displayName;
        } else {
          displayName = userData.name || displayName;
        }
        
        const userInfo = {
          id: userId,
          name: displayName,
          role: userData.role,
          avatar: userData.avatar || null
        };

        addDebugInfo("✅ User details fetch successful", userInfo);

        // Cache the result
        userCacheRef.current.set(userId, {
          data: userInfo,
          timestamp: Date.now()
        });

        return userInfo;
      } else {
        addDebugInfo("⚠️ User data empty", response.data);
        return null;
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        addDebugInfo("❌ User details fetch failed", {
          error: err.message,
          status: err.response?.status,
          userId
        });
      }
      return null;
    }
  }, [axiosWithAuth, addDebugInfo]);

  // FIXED: Enhanced fallback using threads data
  const getOtherUserFromThreads = useCallback(async (threadsData, otherId) => {
    if (!Array.isArray(threadsData) || !otherId) {
      addDebugInfo("❌ Invalid threads data for user lookup", { 
        isArray: Array.isArray(threadsData), 
        otherId 
      });
      return null;
    }

    // Find the current thread in the threads data
    const currentThread = threadsData.find(thread => thread.threadId === threadId);
    
    if (currentThread) {
      addDebugInfo("✅ Found current thread in threads data", currentThread);
      
      // Try to get names from thread data
      const isUserBuyer = currentUser._id === currentThread.buyerId;
      let threadName = null;
      
      if (isUserBuyer && currentThread.sellerName) {
        threadName = currentThread.sellerName;
      } else if (!isUserBuyer && currentThread.buyerName) {
        threadName = currentThread.buyerName;
      }
      
      if (threadName && threadName !== `User ${otherId.substring(0, 8)}`) {
        addDebugInfo("✅ Got user name from thread data", { threadName, isUserBuyer });
        return {
          id: otherId,
          name: threadName,
          role: 'user'
        };
      } else {
        addDebugInfo("⚠️ Thread name not useful", { 
          threadName, 
          isUserBuyer, 
          sellerName: currentThread.sellerName,
          buyerName: currentThread.buyerName 
        });
      }
    } else {
      addDebugInfo("❌ Current thread not found in threads data", { 
        threadId, 
        availableThreads: threadsData.map(t => t.threadId) 
      });
    }

    return null;
  }, [threadId, currentUser, addDebugInfo]);

  // Network status handler
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addDebugInfo("🌐 Network status: Online");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addDebugInfo("🌐 Network status: Offline");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addDebugInfo]);

  // FIXED: Complete rewrite of main effect with better debugging and logic
  useEffect(() => {
    addDebugInfo("🔄 Main effect starting...", { 
      currentUser: !!currentUser, 
      threadId, 
      isUserAuthorized 
    });

    if (!currentUser) {
      setError("You must be logged in to view this chat");
      setLoading(false);
      addDebugInfo("❌ No current user");
      return;
    }

    if (!isUserAuthorized) {
      setError("You don't have permission to access this chat thread");
      setLoading(false);
      addDebugInfo("❌ User not authorized");
      return;
    }

    const userUid = currentUser._id;
    const otherId = threadId.split("_").find(id => id !== userUid);

    if (!otherId) {
      setError("Invalid thread ID");
      setLoading(false);
      addDebugInfo("❌ Invalid otherId", { threadId, userUid });
      return;
    }

    addDebugInfo("✅ Basic validation passed", { userUid, otherId });

    // Set up Firebase listener
    const setupFirebaseListener = async () => {
      try {
        addDebugInfo("🔄 Setting up Firebase listener...");
        const chatRef = ref(database, `chats/${threadId}`);
        
        // Set up real-time listener
        const unsubscribe = onValue(
          chatRef,
          (snapshot) => {
            const data = snapshot.val() || {};
            const messagesList = Object.entries(data)
              .map(([id, msg]) => ({ 
                id, 
                ...msg,
                timestamp: msg.timestamp || Date.now(),
                content: msg.content || '',
                senderId: msg.senderId || '',
                receiverId: msg.receiverId || ''
              }))
              .filter(msg => 
                // Security: ensure message involves current user
                msg.senderId === userUid || msg.receiverId === userUid
              )
              .sort((a, b) => a.timestamp - b.timestamp);
            
            addDebugInfo("✅ Firebase messages received", { 
              totalMessages: Object.keys(data).length,
              filteredMessages: messagesList.length 
            });
            
            setMessages(messagesList);
            setLoading(false);
            setError(null);
          },
          (err) => {
            addDebugInfo("❌ Firebase listener error", {
              code: err.code,
              message: err.message
            });
            
            if (err.code === "PERMISSION_DENIED") {
              setError("Permission denied. You don't have access to this chat.");
            } else {
              setError(`Connection error: ${err.message}`);
              
              // Retry logic for network errors
              if (isOnline && !retryTimeoutRef.current) {
                retryTimeoutRef.current = setTimeout(() => {
                  retryTimeoutRef.current = null;
                  setupFirebaseListener();
                }, 3000);
              }
            }
            setLoading(false);
          }
        );

        firebaseUnsubscribeRef.current = unsubscribe;
        addDebugInfo("✅ Firebase listener setup complete");

      } catch (err) {
        addDebugInfo("❌ Firebase listener setup failed", err.message);
        setError(`Failed to connect: ${err.message}`);
        setLoading(false);
      }
    };

    // FIXED: Multi-step user name resolution with comprehensive debugging
    const fetchUserName = async () => {
      addDebugInfo("🔄 Starting user name resolution for", { otherId });
      let finalUserInfo = null;

      // STEP 1: Try optimized chats endpoint (same as ChatList)
      try {
        addDebugInfo("🔄 STEP 1: Trying optimized endpoint...");
        const optimizedData = await fetchOptimizedChats();
        
        if (optimizedData) {
          const userFromOptimized = getOtherUserFromOptimizedData(optimizedData, otherId);
          if (userFromOptimized && userFromOptimized.name !== `User ${otherId.substring(0, 5)}`) {
            finalUserInfo = userFromOptimized;
            addDebugInfo("✅ STEP 1 SUCCESS: Got name from optimized endpoint", finalUserInfo);
          } else {
            addDebugInfo("❌ STEP 1 FAILED: Optimized endpoint didn't return useful name");
          }
        } else {
          addDebugInfo("❌ STEP 1 FAILED: No optimized data returned");
        }
      } catch (err) {
        addDebugInfo("❌ STEP 1 ERROR: Optimized endpoint failed", err.message);
      }

      // STEP 2: Try to get name from thread details messages
      if (!finalUserInfo) {
        try {
          addDebugInfo("🔄 STEP 2: Trying thread details...");
          const threadData = await fetchThreadDetails();
          
          if (threadData) {
            const userFromThreads = await getOtherUserFromThreads(
              Array.isArray(threadData) ? [{ threadId, ...threadData[0] }] : [threadData], 
              otherId
            );
            
            if (userFromThreads && userFromThreads.name !== `User ${otherId.substring(0, 8)}`) {
              finalUserInfo = userFromThreads;
              addDebugInfo("✅ STEP 2 SUCCESS: Got name from thread details", finalUserInfo);
            } else {
              addDebugInfo("❌ STEP 2 FAILED: Thread details didn't return useful name");
            }
          } else {
            addDebugInfo("❌ STEP 2 FAILED: No thread data returned");
          }
        } catch (err) {
          addDebugInfo("❌ STEP 2 ERROR: Thread details failed", err.message);
        }
      }

      // STEP 3: Direct user API call (last resort)
      if (!finalUserInfo) {
        try {
          addDebugInfo("🔄 STEP 3: Trying direct user API...");
          const userInfo = await fetchUserDetails(otherId);
          
          if (userInfo && userInfo.name !== `User ${otherId.substring(0, 5)}`) {
            finalUserInfo = userInfo;
            addDebugInfo("✅ STEP 3 SUCCESS: Got name from user API", finalUserInfo);
          } else {
            addDebugInfo("❌ STEP 3 FAILED: User API didn't return useful name", userInfo);
          }
        } catch (err) {
          addDebugInfo("❌ STEP 3 ERROR: User API failed", err.message);
        }
      }

      // FINAL: Set the user info
      if (finalUserInfo) {
        addDebugInfo("🎉 FINAL SUCCESS: Setting user info", finalUserInfo);
        setOtherUser(finalUserInfo);
      } else {
        const fallbackUser = { 
          id: otherId, 
          name: `User ${otherId.substring(0, 8)}`,
          role: 'user'
        };
        addDebugInfo("⚠️ FINAL FALLBACK: Using default name", fallbackUser);
        setOtherUser(fallbackUser);
      }
    };

    // Execute both operations
    setupFirebaseListener();
    fetchUserName();

    // Cleanup function
    return () => {
      addDebugInfo("🧹 Cleaning up main effect");
      
      if (firebaseUnsubscribeRef.current) {
        firebaseUnsubscribeRef.current();
        firebaseUnsubscribeRef.current = null;
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (axiosSourceRef.current) {
        axiosSourceRef.current.cancel('Component unmounting');
      }
    };
  }, [
    threadId, 
    currentUser, 
    isUserAuthorized, 
    fetchOptimizedChats, 
    getOtherUserFromOptimizedData, 
    fetchThreadDetails, 
    fetchUserDetails, 
    getOtherUserFromThreads,
    isOnline, 
    addDebugInfo
  ]);

  // Optimized scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth", 
        block: "end" 
      });
    }
  }, []);

  // Scroll effect with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, scrollToBottom]);

  // Optimized message sender with validation
  const sendMsg = useCallback(async () => {
    if (!input.trim() || !currentUser || !isOnline) return;
    
    const messageContent = input.trim();
    const otherId = threadId.split("_").find(id => id !== currentUser._id);
    
    if (!otherId) {
      setError("Invalid recipient");
      return;
    }

    try {
      const chatRef = ref(database, `chats/${threadId}`);
      const messageData = {
        senderId: currentUser._id,
        receiverId: otherId,
        content: messageContent,
        timestamp: Date.now(),
        type: 'text'
      };
      
      // Optimistic UI update
      const tempMessage = {
        id: `temp_${Date.now()}`,
        ...messageData,
        sending: true
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setInput(""); // Clear input immediately
      
      // Send to Firebase
      const newMessageRef = await push(chatRef, messageData);
      
      // Remove temp message and let Firebase listener handle the real message
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      
    } catch (err) {
      console.error("Error sending message:", err);
      
      // Revert optimistic update
      setMessages(prev => prev.filter(msg => !msg.sending));
      setInput(messageContent); // Restore input
      
      if (err.code === "PERMISSION_DENIED") {
        setError("Permission denied. Cannot send message.");
      } else {
        setError(`Failed to send message: ${err.message}`);
      }
    }
  }, [input, currentUser, threadId, isOnline]);

  // Optimized keyboard handler
  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  }, [sendMsg]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  // Navigation handler
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Thread title generator
  const getThreadTitle = useCallback(() => {
    if (threadDetails?.productTitle) {
      return `${threadDetails.productTitle}${threadDetails.quantity ? ` (${threadDetails.quantity}×)` : ''}`;
    }
    return null;
  }, [threadDetails]);

  // Retry connection handler
  const retryConnection = useCallback(() => {
    setError(null);
    setLoading(true);
    setDebugInfo([]); // Clear debug info
    
    // Clear caches and retry
    userCacheRef.current.clear();
    threadCacheRef.current.clear();
    
    // Force re-run of useEffect by changing a dependency
    window.location.reload();
  }, []);

  // DEBUG: Toggle debug panel
  const [showDebug, setShowDebug] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="chat-page loading-state">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading conversation...</p>
          
          {/* DEBUG: Show debug info even while loading */}
          {debugInfo.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={() => setShowDebug(!showDebug)}
                style={{ 
                  padding: '8px 16px', 
                  background: '#007bff', 
                  color: 'white', 
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showDebug ? 'Hide' : 'Show'} Debug Info ({debugInfo.length})
              </button>
              
              {showDebug && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '10px', 
                  background: '#f8f9fa', 
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  {debugInfo.map((info, index) => (
                    <div key={index} style={{ marginBottom: '8px', borderBottom: '1px solid #dee2e6', paddingBottom: '4px' }}>
                      <strong>[{info.timestamp}]</strong> {info.message}
                      {info.data && <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{info.data}</pre>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="chat-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
          <div className="error-actions">
            <button className="retry-button" onClick={retryConnection}>
              Try Again
            </button>
            <button className="back-button" onClick={goBack}>
              <ArrowLeft size={18} />
              <span>Go Back</span>
            </button>
          </div>
          
          {/* DEBUG: Show debug info in error state */}
          {debugInfo.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={() => setShowDebug(!showDebug)}
                style={{ 
                  padding: '8px 16px', 
                  background: '#dc3545', 
                  color: 'white', 
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showDebug ? 'Hide' : 'Show'} Debug Info ({debugInfo.length})
              </button>
              
              {showDebug && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '10px', 
                  background: '#f8f9fa', 
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  {debugInfo.map((info, index) => (
                    <div key={index} style={{ marginBottom: '8px', borderBottom: '1px solid #dee2e6', paddingBottom: '4px' }}>
                      <strong>[{info.timestamp}]</strong> {info.message}
                      {info.data && <pre style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{info.data}</pre>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Offline state
  if (!isOnline) {
    return (
      <div className="chat-page">
        <div className="offline-container">
          <div className="offline-icon">📶</div>
          <h3>You're offline</h3>
          <p>Check your internet connection and try again.</p>
          <button className="back-button" onClick={goBack}>
            <ArrowLeft size={18} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      {/* FIXED: Header with proper name display and debug info */}
      <div className="chat-header">
        <button className="back-button" onClick={goBack} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <div className="user-info">
          <div className="user-avatar">
            {otherUser.avatar ? (
              <img src={otherUser.avatar} alt={otherUser.name} />
            ) : (
              <span>{otherUser.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="user-details">
            <h2>{otherUser.name}</h2>
            <span className="status-indicator">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Product Info */}
      {threadDetails && (
        <div className="chat-subheader">
          <div className="product-info">
            {getThreadTitle() && (
              <div className="product-title">{getThreadTitle()}</div>
            )}
            {threadDetails.price && (
              <div className="product-price">₦{threadDetails.price}</div>
            )}
          </div>
        </div>
      )}
      
      {/* Messages Container */}
      <div className="message-container" ref={messageContainerRef}>
        <div className="message-list">
          {messages.length === 0 ? (
            <div className="no-messages">
              <div className="empty-state-icon">💬</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMine = message.senderId === currentUser._id;
              const showAvatar = index === 0 || 
                messages[index-1].senderId !== message.senderId;
              const showTimestamp = index === messages.length - 1 ||
                messages[index + 1].senderId !== message.senderId ||
                (messages[index + 1].timestamp - message.timestamp) > 300000; // 5 min gap
              
              return (
                <div 
                  key={message.id} 
                  className={`message-group ${isMine ? 'sent' : 'received'} ${message.sending ? 'sending' : ''}`}
                >
                  {!isMine && showAvatar && (
                    <div className="avatar-container">
                      <div className="avatar">
                        {otherUser.avatar ? (
                          <img src={otherUser.avatar} alt={otherUser.name} />
                        ) : (
                          otherUser.name.charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>
                  )}
                  <div className="message-bubble-container">
                    <div className="message-bubble">
                      <div className="message-content">{message.content}</div>
                      {showTimestamp && (
                        <div className="message-timestamp">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {message.sending && <span className="sending-indicator">...</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Input Container */}
      <div className="message-input-container">
        <button className="attachment-button" aria-label="Attach image">
          <Image size={20} />
        </button>
        <textarea 
          className="message-input"
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={isOnline ? "Message..." : "You're offline"}
          rows={1}
          disabled={!isOnline}
          maxLength={1000}
        />
        <button className="emoji-button" aria-label="Add emoji">
          <Smile size={20} />
        </button>
        <button 
          className="send-button"
          onClick={sendMsg}
          disabled={!input.trim() || !currentUser || !isOnline}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(ChatPage);
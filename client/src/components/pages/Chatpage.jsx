import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ref, onValue, push, get, off } from "firebase/database";
import { database } from "../../firebase";
import axios from "axios";
import { ArrowLeft, Send, Image, Smile } from "lucide-react";
import authService from "../../features/auth/authService";

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

  // Memoized axios instance with auth
  const axiosWithAuth = useMemo(() => {
    const token = currentUser?.accessToken || currentUser?.token;
    if (!token) return null;

    // Cancel previous requests
    if (axiosSourceRef.current) {
      axiosSourceRef.current.cancel('New request initiated');
    }

    axiosSourceRef.current = axios.CancelToken.source();

    return axios.create({
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
      cancelToken: axiosSourceRef.current.token
    });
  }, [currentUser?.accessToken, currentUser?.token]);

  // Memoized user validation
  const isUserAuthorized = useMemo(() => {
    if (!currentUser || !threadId) return false;
    const userUid = currentUser._id;
    return threadId.includes(userUid) && threadId.split("_").includes(userUid);
  }, [currentUser, threadId]);

  // FIXED: Use the same optimized chat fetching approach as ChatList
  const fetchOptimizedChats = useCallback(async () => {
    if (!axiosWithAuth) return null;

    try {
      const response = await axiosWithAuth.get('/api/chats/optimized');
      
      if (response.data && response.data.threads && response.data.users) {
        return {
          threads: response.data.threads,
          users: response.data.users // This is the users object from controller
        };
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.warn("Could not fetch optimized chats:", err);
      }
    }
    
    return null;
  }, [axiosWithAuth]);

  // FIXED: Get other user info from optimized chat data (same as ChatList)
  const getOtherUserFromOptimizedData = useCallback((chatData, otherId) => {
    if (!chatData || !chatData.users) return null;
    
    // The users object from controller has format: users[userId] = "Name String"
    const userName = chatData.users[otherId];
    
    if (userName) {
      return {
        id: otherId,
        name: userName,
        role: 'user' // We don't get role from optimized endpoint, but that's fine
      };
    }
    
    return null;
  }, []);

  // Enhanced thread details fetcher
  const fetchThreadDetails = useCallback(async () => {
    if (!axiosWithAuth || !threadId) return null;

    // Check cache first
    const cached = threadCacheRef.current.get(threadId);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    try {
      const response = await axiosWithAuth.get(`/api/chats/thread/${threadId}`);
      
      if (response.data) {
        // Cache the result
        threadCacheRef.current.set(threadId, {
          data: response.data,
          timestamp: Date.now()
        });
        
        return response.data;
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.warn("Could not fetch thread details:", err);
      }
    }
    
    return null;
  }, [axiosWithAuth, threadId]);

  // FIXED: Fallback user details fetcher (only used if optimized approach fails)
  const fetchUserDetails = useCallback(async (userId) => {
    if (!axiosWithAuth || !userId) return null;

    // Check cache first
    const cached = userCacheRef.current.get(userId);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    try {
      const response = await axiosWithAuth.get(`/api/users/${userId}`);
      const userData = response.data?.user || response.data;
      
      if (userData) {
        let displayName = `User ${userId.substring(0, 5)}`;
        
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

        // Cache the result
        userCacheRef.current.set(userId, {
          data: userInfo,
          timestamp: Date.now()
        });

        return userInfo;
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.error("Error fetching user details:", err);
      }
    }
    
    return null;
  }, [axiosWithAuth]);

  // Network status handler
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // FIXED: Enhanced main effect with proper name resolution using optimized endpoint
  useEffect(() => {
    if (!currentUser) {
      setError("You must be logged in to view this chat");
      setLoading(false);
      return;
    }

    if (!isUserAuthorized) {
      setError("You don't have permission to access this chat thread");
      setLoading(false);
      return;
    }

    const userUid = currentUser._id;
    const otherId = threadId.split("_").find(id => id !== userUid);

    if (!otherId) {
      setError("Invalid thread ID");
      setLoading(false);
      return;
    }

    // Set up Firebase listener
    const setupFirebaseListener = async () => {
      try {
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
            
            setMessages(messagesList);
            setLoading(false);
            setError(null);
          },
          (err) => {
            console.error("Firebase listener error:", err);
            
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

      } catch (err) {
        console.error("Error setting up Firebase listener:", err);
        setError(`Failed to connect: ${err.message}`);
        setLoading(false);
      }
    };

    // FIXED: Enhanced data fetching using optimized endpoint first
    const fetchInitialData = async () => {
      try {
        // Method 1: Try optimized chats endpoint first (same as ChatList)
        const optimizedData = await fetchOptimizedChats();
        let finalUserInfo = null;

        if (optimizedData) {
          const userFromOptimized = getOtherUserFromOptimizedData(optimizedData, otherId);
          if (userFromOptimized && userFromOptimized.name !== `User ${otherId.substring(0, 5)}`) {
            finalUserInfo = userFromOptimized;
            console.log("✅ Got user name from optimized endpoint:", finalUserInfo.name);
          }
        }

        // Method 2: Try thread details if optimized didn't work
        if (!finalUserInfo) {
          const threadInfo = await fetchThreadDetails();
          if (threadInfo) {
            setThreadDetails(threadInfo);
            
            // Get name from thread details
            const isUserBuyer = currentUser._id === threadInfo.buyerId;
            let threadName = null;
            
            if (isUserBuyer && threadInfo.sellerName) {
              threadName = threadInfo.sellerName;
            } else if (!isUserBuyer && threadInfo.buyerName) {
              threadName = threadInfo.buyerName;
            }
            
            if (threadName && threadName !== `User ${otherId.substring(0, 8)}`) {
              finalUserInfo = {
                id: otherId,
                name: threadName,
                role: 'user'
              };
              console.log("✅ Got user name from thread details:", finalUserInfo.name);
            }
          }
        }

        // Method 3: Fallback to individual user fetch
        if (!finalUserInfo) {
          const userInfo = await fetchUserDetails(otherId);
          if (userInfo && userInfo.name !== `User ${otherId.substring(0, 5)}`) {
            finalUserInfo = userInfo;
            console.log("✅ Got user name from user details:", finalUserInfo.name);
          }
        }

        // Set the final user info or fallback
        if (finalUserInfo) {
          setOtherUser(finalUserInfo);
        } else {
          console.warn("⚠️ Could not resolve user name, using fallback");
          setOtherUser({ 
            id: otherId, 
            name: `User ${otherId.substring(0, 8)}`,
            role: 'user'
          });
        }

      } catch (err) {
        console.warn("Error fetching initial data:", err);
        // Set fallback name
        setOtherUser({ 
          id: otherId, 
          name: `User ${otherId.substring(0, 8)}`,
          role: 'user'
        });
      }
    };

    // Execute both setup operations
    setupFirebaseListener();
    fetchInitialData();

    // Cleanup function
    return () => {
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
  }, [threadId, currentUser, isUserAuthorized, fetchOptimizedChats, getOtherUserFromOptimizedData, fetchThreadDetails, fetchUserDetails, isOnline]);

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
    
    // Clear caches and retry
    userCacheRef.current.clear();
    threadCacheRef.current.clear();
    
    // Force re-run of useEffect
    const event = new CustomEvent('retry-connection');
    window.dispatchEvent(event);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="chat-page loading-state">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading conversation...</p>
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
      {/* FIXED: Header with proper name display */}
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
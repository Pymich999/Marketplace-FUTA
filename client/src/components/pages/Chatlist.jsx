import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { format } from "date-fns";

const ChatList = () => {
  const [threads, setThreads] = useState([]);
  const [usernames, setUsernames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadFilter, setUnreadFilter] = useState(false);
  
  const user = JSON.parse(localStorage.getItem('user'));
  
  // Create axios instance with token for reuse
  const axiosWithAuth = useMemo(() => {
    const token = user?.token;
    return axios.create({
      headers: { Authorization: `Bearer ${token}` }
    });
  }, [user?.token]);
  
  // Fetch threads function moved outside useEffect for better code organization
  const fetchThreads = useCallback(async () => {
    if (!user?.token) {
      setError("No authentication token found. Please log in.");
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Use Promise.all to fetch threads and thread details in parallel
      const [threadsResponse] = await Promise.all([
        axiosWithAuth.get("/api/chats")
      ]);
      
      // Process threads data
      let threadsList = [];
      if (Array.isArray(threadsResponse.data)) {
        threadsList = threadsResponse.data;
      } else if (threadsResponse.data && typeof threadsResponse.data === 'object' && threadsResponse.data.threads) {
        threadsList = threadsResponse.data.threads;
      } else {
        throw new Error("Unexpected API response format");
      }
      
      // Use Promise.allSettled to fetch all thread details in parallel
      // This continues even if some requests fail
      const threadDetailsPromises = threadsList.map(thread => 
        axiosWithAuth.get(`/api/chats/thread/${thread.threadId}`)
          .then(res => ({
            ...thread,
            ...res.data,
            timestamp: res.data?.lastTimestamp || Date.now(),
            lastMessage: res.data?.lastMessage || ""
          }))
          .catch(err => ({
            ...thread,
            timestamp: Date.now() - (Math.random() * 1000000),
            lastMessage: "Conversation started"
          }))
      );
      
      const threadsWithDetailsResults = await Promise.allSettled(threadDetailsPromises);
      const threadsWithDetails = threadsWithDetailsResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      
      // Sort threads by timestamp (newest first)
      const sortedThreads = threadsWithDetails.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      setThreads(sortedThreads);
      
      // Collect unique user IDs efficiently
      const userIds = new Set();
      threadsWithDetails.forEach(thread => {
        if (thread.otherUserId) userIds.add(thread.otherUserId);
        if (thread.buyerId && thread.buyerId !== user._id) userIds.add(thread.buyerId);
        if (thread.sellerId && thread.sellerId !== user._id) userIds.add(thread.sellerId);
      });
      
      // Batch user info requests with Promise.allSettled
      const userPromises = Array.from(userIds).map(userId => 
        axiosWithAuth.get(`/api/users/${userId}`)
          .then(res => {
            const userData = res.data?.user;
            if (!userData) return [userId, `User ${userId.substring(0, 5)}...`];
            
            // Determine the appropriate name
            let name;
            if (userData.role === 'seller' || userData.role === 'seller_pending') {
              name = userData.sellerProfile?.studentName || 
                    userData.sellerProfile?.businessName || 
                    userData.name;
            } else {
              name = userData.name;
            }
            return [userId, name];
          })
          .catch(() => [userId, `User ${userId.substring(0, 5)}...`])
      );
      
      const userResults = await Promise.allSettled(userPromises);
      
      // Create username mapping object from results
      const namesObj = {};
      userResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const [id, name] = result.value;
          namesObj[id] = name;
        }
      });
      
      setUsernames(namesObj);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching threads:", err);
      setError(err.message || "Failed to fetch conversations");
      setLoading(false);
    }
  }, [axiosWithAuth, user?._id]);
  
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);
  
  // Memoize filtered threads to avoid recalculation on every render
  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      const otherId = thread.otherUserId;
      const relevantUserId = user._id === thread.buyerId ? thread.sellerId : 
                            user._id === thread.sellerId ? thread.buyerId : 
                            otherId;
      
      const username = usernames[relevantUserId] || '';
      const searchLower = searchQuery.toLowerCase();
      
      const matchesSearch = !searchQuery || 
                           username.toLowerCase().includes(searchLower) ||
                           (thread.lastMessage && thread.lastMessage.toLowerCase().includes(searchLower)) ||
                           (thread.productTitle && thread.productTitle.toLowerCase().includes(searchLower));
      
      return matchesSearch && (!unreadFilter || thread.unreadCount > 0);
    });
  }, [threads, usernames, searchQuery, unreadFilter, user?._id]);
  
  // Memoize total unread count
  const totalUnreadCount = useMemo(() => {
    return threads.reduce((total, thread) => total + (thread.unreadCount || 0), 0);
  }, [threads]);
  
  // Format message time function optimized to avoid unnecessary date parsing
  const formatMessageTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const messageDate = new Date(date);
      messageDate.setHours(0, 0, 0, 0);
      
      const isToday = messageDate.getTime() === today.getTime();
      const isYesterday = messageDate.getTime() === today.getTime() - 86400000;
      
      if (isToday) {
        return format(date, 'h:mm a');
      } else if (isYesterday) {
        return 'Yesterday';
      } else {
        return format(date, 'MM/dd/yy');
      }
    } catch {
      return '';
    }
  }, []);
  
  // Get thread name function optimized and memoized
  const getThreadName = useCallback((thread) => {
    if (thread.buyerId && thread.sellerId) {
      const isUserBuyer = user._id === thread.buyerId;
      const relevantUserId = isUserBuyer ? thread.sellerId : thread.buyerId;
      
      if (isUserBuyer && thread.sellerName) return thread.sellerName;
      if (!isUserBuyer && thread.buyerName) return thread.buyerName;
      
      return usernames[relevantUserId] || `User ${relevantUserId?.substring(0, 5)}...`;
    }
    
    return usernames[thread.otherUserId] || `User ${thread.otherUserId?.substring(0, 5)}...`;
  }, [usernames, user?._id]);
  
  // Event handlers
  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);
  
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);
  
  const toggleUnreadFilter = useCallback(() => {
    setUnreadFilter(prev => !prev);
  }, []);
  
  // Optimized skeleton loader using memo
  const renderSkeletonLoader = useMemo(() => (
    <div className="chat-list-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="chat-thread-skeleton">
          <div className="avatar-skeleton"></div>
          <div className="content-skeleton">
            <div className="name-skeleton"></div>
            <div className="message-skeleton"></div>
          </div>
        </div>
      ))}
    </div>
  ), []);
  
  if (loading) return <div className="chat-list-container">{renderSkeletonLoader}</div>;
  if (error) return <div className="chat-list-container error-message">{error}</div>;
  
  return (
    <div className="chat-list-container">
      <div className="chat-list-header">
        <button className="back-button" onClick={() => window.history.back()}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2>
          Messages
          {totalUnreadCount > 0 && (
            <span className="total-unread-badge">{totalUnreadCount}</span>
          )}
        </h2>
        <div className="header-actions">
          <button 
            className={`icon-button filter-button ${unreadFilter ? 'active' : ''}`}
            onClick={toggleUnreadFilter}
            title={unreadFilter ? "Show all messages" : "Show unread messages"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>
            {unreadFilter && <span className="filter-indicator"></span>}
          </button>
          <button className="icon-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="search-container">
        <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          placeholder="Search conversations..." 
          value={searchQuery} 
          onChange={handleSearchChange}
          className="search-input"
        />
        {searchQuery && (
          <button 
            className="clear-button" 
            onClick={handleClearSearch}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
      
      {filteredThreads.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            <line x1="9" y1="10" x2="15" y2="10"></line>
            <line x1="12" y1="7" x2="12" y2="13"></line>
          </svg>
          <p>
            {unreadFilter 
              ? "You don't have any unread messages"
              : searchQuery 
                ? "No conversations match your search" 
                : "You don't have any conversations yet."}
          </p>
          {!unreadFilter && <button className="new-chat-button">Start a new conversation</button>}
          {unreadFilter && (
            <button className="show-all-button" onClick={toggleUnreadFilter}>
              Show all messages
            </button>
          )}
        </div>
      ) : (
        <ul className="chat-threads">
          {filteredThreads.map(thread => {
            // Generate a preview that includes product info if available
            const previewText = thread.productTitle 
              ? `${thread.lastMessage || `About: ${thread.productTitle}`}`
              : (thread.lastMessage || 'Start a conversation');
              
            return (
              <li key={thread.threadId} className={`chat-thread-item ${thread.unreadCount > 0 ? 'unread' : ''}`}>
                <Link to={`/chats/${thread.threadId}`} className="chat-thread-link">
                  <div className="avatar-container">
                    <div className="avatar-image">
                      {getThreadName(thread)?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {thread.unreadCount > 0 && (
                      <div className="avatar-status-indicator"></div>
                    )}
                  </div>
                  
                  <div className="chat-preview">
                    <div className="chat-header">
                      <h4>{getThreadName(thread)}</h4>
                      <span className="chat-time">{formatMessageTime(thread.timestamp)}</span>
                    </div>
                    <div className="chat-content">
                      <p className={`last-message ${thread.unreadCount > 0 ? 'bold' : ''}`}>
                        {previewText && previewText.length > 40 
                          ? `${previewText.substring(0, 40)}...` 
                          : previewText}
                      </p>
                      {thread.unreadCount > 0 && (
                        <span className="unread-badge">{thread.unreadCount}</span>
                      )}
                    </div>
                    {thread.productTitle && (
                      <div className="product-preview">
                        <span className="product-tag">
                          {thread.productTitle} {thread.quantity ? `(${thread.quantity}×)` : ''}
                        </span>
                        {thread.price && (
                          <span className="price-tag">${thread.price}</span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      
      <button className="floating-action-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      
      <style jsx>{`
        /* Additional styles for unread features */
        .chat-thread-item.unread {
          background-color: rgba(0, 0, 255, 0.05);
        }
        
        .last-message.bold {
          font-weight: 600;
        }
        
        .avatar-status-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          background-color: #0084ff;
          border-radius: 50%;
          border: 2px solid white;
        }
        
        .total-unread-badge {
          margin-left: 8px;
          background-color: #0084ff;
          color: white;
          font-size: 0.75rem;
          border-radius: 12px;
          padding: 2px 6px;
          font-weight: normal;
        }
        
        .filter-button {
          position: relative;
        }
        
        .filter-button.active {
          color: #0084ff;
        }
        
        .filter-indicator {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 8px;
          height: 8px;
          background-color: #0084ff;
          border-radius: 50%;
        }
        
        .show-all-button {
          background-color: transparent;
          border: 1px solid #0084ff;
          color: #0084ff;
          border-radius: 20px;
          padding: 8px 16px;
          font-weight: 500;
          margin-top: 16px;
          cursor: pointer;
        }
        
        /* New styles for product preview */
        .product-preview {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
          font-size: 0.75rem;
        }
        
        .product-tag {
          background-color: #f0f0f0;
          padding: 2px 6px;
          border-radius: 10px;
          color: #555;
          max-width: 70%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .price-tag {
          font-weight: 600;
          color: #2a9d8f;
        }
      `}</style>
    </div>
  );
};

export default React.memo(ChatList);
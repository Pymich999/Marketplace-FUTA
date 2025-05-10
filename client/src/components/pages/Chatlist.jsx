import React, { useEffect, useState } from "react";
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
  
  useEffect(() => {
    const fetchThreads = async () => {
      try {
        setLoading(true);
        const token = user?.token;
        
        if (!token) {
          setError("No authentication token found. Please log in.");
          setLoading(false);
          return;
        }
        
        console.log("Fetching chat threads...");
        
        // Get all chat threads
        const res = await axios.get("/api/chats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("API response:", res.data);
        
        // Check if res.data is an array
        let threadsList = [];
        if (Array.isArray(res.data)) {
          threadsList = res.data;
        } else if (res.data && typeof res.data === 'object' && res.data.threads) {
          // If the API returns an object with a threads property
          threadsList = res.data.threads;
        } else {
          console.error("Unexpected API response format:", res.data);
          setError("Received unexpected data format from server");
          setLoading(false);
          return;
        }
        
        console.log("Original threads:", threadsList);
        
        // Ensure all threads have valid timestamps
        threadsList = threadsList.map(thread => {
          if (!thread.timestamp) {
            console.warn("Thread missing timestamp:", thread);
            return { ...thread, timestamp: new Date(0).toISOString() }; // Default timestamp
          }
          return thread;
        });
        
        // Sort threads by timestamp (newest first)
        const sortedThreads = [...threadsList].sort((a, b) => {
          console.log(`Comparing: ${a.threadId} (${a.timestamp}) vs ${b.threadId} (${b.timestamp})`);
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          console.log(`Converted dates: ${dateA} vs ${dateB}`);
          return dateB - dateA; // Newest first
        });
        
        console.log("Sorted threads:", sortedThreads);
        
        setThreads(sortedThreads);
        
        // Get unique user IDs from threads
        const userIds = new Set();
        threadsList.forEach(thread => {
          userIds.add(thread.otherUserId);
        });
        
        console.log("Fetching user info for:", Array.from(userIds));
        
        // Fetch user info for each unique user ID
        const names = {};
        await Promise.all(Array.from(userIds).map(async (userId) => {
          try {
            const userResponse = await axios.get(`/api/users/${userId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            const userData = userResponse.data?.user;
            if (userData) {
              // For sellers, prefer student name or business name; otherwise use regular name
              if (userData.role === 'seller' || userData.role === 'seller_pending') {
                const sellerName = userData.sellerProfile?.studentName || 
                                  userData.sellerProfile?.businessName || 
                                  userData.name;
                names[userId] = sellerName;
              } else {
                names[userId] = userData.name;
              }
              console.log(`User ${userId} name:`, names[userId]);
            } else {
              // Fallback to user ID if we couldn't get the name
              names[userId] = `User ${userId.substring(0, 5)}...`;
              console.log(`Could not get user data for ${userId}`);
            }
          } catch (err) {
            console.warn(`Couldn't fetch user info for ${userId}:`, err);
            names[userId] = `User ${userId.substring(0, 5)}...`;
          }
        }));
        
        setUsernames(names);
      } catch (err) {
        console.error("Error fetching threads:", err);
        setError(err.message || "Failed to fetch conversations");
      } finally {
        setLoading(false);
      }
    };
    
    fetchThreads();
  }, []);
  
  // Apply filters (search and unread)
  const filteredThreads = threads.filter(thread => {
    const username = usernames[thread.otherUserId] || '';
    const matchesSearch = username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (thread.lastMessage && thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // If unread filter is active, only show threads with unread messages
    if (unreadFilter) {
      return matchesSearch && thread.unreadCount > 0;
    }
    
    return matchesSearch;
  });
  
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      
      // Check if valid date
      if (isNaN(date.getTime())) {
        console.warn("Invalid timestamp:", timestamp);
        return '';
      }
      
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const messageDate = new Date(date);
      messageDate.setHours(0, 0, 0, 0);
      
      const isToday = messageDate.getTime() === today.getTime();
      const isYesterday = messageDate.getTime() === today.getTime() - 86400000;
      
      if (isToday) {
        return format(new Date(timestamp), 'h:mm a');
      } else if (isYesterday) {
        return 'Yesterday';
      } else {
        return format(new Date(timestamp), 'MM/dd/yy');
      }
    } catch (err) {
      console.error("Error formatting timestamp:", timestamp, err);
      return '';
    }
  };
  
  const renderSkeletonLoader = () => (
    <div className="chat-list-skeleton">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="chat-thread-skeleton">
          <div className="avatar-skeleton"></div>
          <div className="content-skeleton">
            <div className="name-skeleton"></div>
            <div className="message-skeleton"></div>
          </div>
        </div>
      ))}
    </div>
  );
  
  const totalUnreadCount = threads.reduce((total, thread) => total + (thread.unreadCount || 0), 0);
  
  if (loading) return <div className="chat-list-container">{renderSkeletonLoader()}</div>;
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
            onClick={() => setUnreadFilter(!unreadFilter)}
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
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button 
            className="clear-button" 
            onClick={() => setSearchQuery("")}
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
            <button className="show-all-button" onClick={() => setUnreadFilter(false)}>
              Show all messages
            </button>
          )}
        </div>
      ) : (
        <ul className="chat-threads">
          {filteredThreads.map(thread => (
            <li key={thread.threadId} className={`chat-thread-item ${thread.unreadCount > 0 ? 'unread' : ''}`}>
              <Link to={`/chats/${thread.threadId}`} className="chat-thread-link">
                <div className="avatar-container">
                  <div className="avatar-image">
                    {usernames[thread.otherUserId]?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  {thread.unreadCount > 0 && (
                    <div className="avatar-status-indicator"></div>
                  )}
                </div>
                
                <div className="chat-preview">
                  <div className="chat-header">
                    <h4>{usernames[thread.otherUserId] || `User ${thread.otherUserId?.substring(0, 5)}...`}</h4>
                    <span className="chat-time">{thread.timestamp ? formatMessageTime(thread.timestamp) : ''}</span>
                  </div>
                  <div className="chat-content">
                    <p className={`last-message ${thread.unreadCount > 0 ? 'bold' : ''}`}>
                      {thread.lastMessage && thread.lastMessage.length > 40 
                        ? `${thread.lastMessage.substring(0, 40)}...` 
                        : thread.lastMessage || 'Start a conversation'}
                    </p>
                    {thread.unreadCount > 0 && (
                      <span className="unread-badge">{thread.unreadCount}</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
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
      `}</style>
    </div>
  );
};

export default ChatList;
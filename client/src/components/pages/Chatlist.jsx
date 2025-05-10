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
        
        const res = await axios.get("/api/chats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
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
        
        setThreads(threadsList);
        
        // Instead of using mock names, use the shortened user ID for display
        const names = {};
        threadsList.forEach(thread => {
          const userId = thread.otherUserId;
          // Take the first part of the ID and add ellipsis for display
          names[userId] = `User ${userId.substring(0, 5)}...`;
        });
        
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
  
  const filteredThreads = threads.filter(thread => {
    const username = usernames[thread.otherUserId] || '';
    return username.toLowerCase().includes(searchQuery.toLowerCase()) ||
           thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.setHours(0, 0, 0, 0) === now.setHours(0, 0, 0, 0);
    
    if (isToday) {
      return format(new Date(timestamp), 'h:mm a');
    } else {
      return format(new Date(timestamp), 'MM/dd/yy');
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
        <h2>Messages</h2>
        <div className="header-actions">
          <button className="icon-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
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
          <p>{searchQuery ? "No conversations match your search" : "You don't have any conversations yet."}</p>
          <button className="new-chat-button">Start a new conversation</button>
        </div>
      ) : (
        <ul className="chat-threads">
          {filteredThreads.map(thread => (
            <li key={thread.threadId} className="chat-thread-item">
              <Link to={`/chats/${thread.threadId}`} className="chat-thread-link">
                <div className="avatar-container">
                  <div className="avatar-image">
                    {usernames[thread.otherUserId]?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
                
                <div className="chat-preview">
                  <div className="chat-header">
                    <h4>{usernames[thread.otherUserId] || `User ${thread.otherUserId.substring(0, 5)}...`}</h4>
                    <span className="chat-time">{thread.timestamp ? formatMessageTime(thread.timestamp) : ''}</span>
                  </div>
                  <div className="chat-content">
                    <p className="last-message">{
                      thread.lastMessage && thread.lastMessage.length > 40 
                        ? `${thread.lastMessage.substring(0, 40)}...` 
                        : thread.lastMessage || 'Start a conversation'
                    }</p>
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
    </div>
  );
};

export default ChatList;
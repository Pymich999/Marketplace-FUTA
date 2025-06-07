import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { format } from "date-fns";

const ChatList = () => {
  const [chatData, setChatData] = useState({ threads: [], users: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadFilter, setUnreadFilter] = useState(false);

  const abortControllerRef = useRef();
  const cacheRef = useRef(new Map());
  const timeoutRef = useRef();
  const timeCache = useRef(new Map());

  // Memoize user data to prevent unnecessary re-parsing
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const axiosWithAuth = useMemo(() => {
    const token = user?.accessToken || user?.token;
    if (!token) return null;

    return axios.create({
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
  }, [user?.accessToken, user?.token]);

  // Memory cache for API responses
  const getCachedData = useCallback((key) => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }
    return null;
  }, []);

  const setCachedData = useCallback((key, data) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now()
    });

    if (cacheRef.current.size > 100) {
      const entries = Array.from(cacheRef.current.entries());
      const oldEntries = entries
        .filter(([_, value]) => Date.now() - value.timestamp > 300000)
        .map(([key]) => key);

      oldEntries.forEach(key => cacheRef.current.delete(key));
    }
  }, []);

  // Fixed: Better error handling for aborted requests
  const isAbortError = useCallback((error) => {
    return error.name === 'AbortError' ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED' ||
      error?.message?.includes('canceled') ||
      error?.message?.includes('aborted');
  }, []);

  // FIX 1: Enhanced optimized fetch with better data handling
  const fetchOptimizedChats = useCallback(async () => {
    if (!axiosWithAuth) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await axiosWithAuth.get('/api/chats/optimized', {
        signal: abortControllerRef.current.signal
      });

      const data = response.data;

      // FIX: Ensure proper data structure
      const processedData = {
        threads: Array.isArray(data.threads) ? data.threads.map(thread => ({
          ...thread,
          // Ensure all required fields exist
          threadId: thread.threadId || '',
          otherUserId: thread.otherUserId || '',
          buyerId: thread.buyerId || '',
          sellerId: thread.sellerId || '',
          lastMessage: thread.lastMessage || 'Start a conversation',
          timestamp: thread.timestamp || Date.now(),
          unreadCount: thread.unreadCount || 0,
          productTitle: thread.productTitle || '',
          quantity: thread.quantity || 0,
          price: thread.price || '0.00'
        })) : [],
        users: data.users || {}
      };

      setChatData(processedData);
      const cacheKey = `chats_${user._id}`;
      setCachedData(cacheKey, processedData);

    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Chat fetch error:', err);
        setError(err.response?.data?.message || err.message || "Failed to load chats");

        // FIX: Fallback to original method if optimized fails
        if (err.response?.status === 404) {
          await fetchChatsOriginal();
          return;
        }
      }
    } finally {
      setLoading(false);
    }
  }, [axiosWithAuth, user._id, setCachedData, isAbortError]);

  // FIX 2: Enhanced fallback with better data processing
  const fetchChatsOriginal = useCallback(async () => {
    if (!axiosWithAuth) return;

    try {
      setLoading(true);
      setError(null);

      const threadsResponse = await axiosWithAuth.get("/api/chats", {
        signal: abortControllerRef.current.signal
      });

      let threadsList = Array.isArray(threadsResponse.data)
        ? threadsResponse.data
        : threadsResponse.data?.threads || [];

      if (threadsList.length === 0) {
        setChatData({ threads: [], users: {} });
        setLoading(false);
        return;
      }

      // Enhanced parallel processing with better error handling
      const threadDetailsPromises = threadsList.map(async (thread) => {
        try {
          const res = await axiosWithAuth.get(`/api/chats/thread/${thread.threadId}`, {
            signal: abortControllerRef.current.signal
          });

          // FIX: Better message processing
          const messages = Array.isArray(res.data) ? res.data : [];
          const lastMessage = messages.length > 0
            ? messages[messages.length - 1]?.content || 'Start a conversation'
            : 'Start a conversation';

          // FIX: Calculate unread count properly
          const unreadCount = messages.filter(msg =>
            msg &&
            msg.receiverId === user._id &&
            !msg.read &&
            msg.senderId !== user._id
          ).length;

          return {
            ...thread,
            lastMessage,
            timestamp: messages.length > 0
              ? Math.max(...messages.map(m => m.timestamp || 0))
              : Date.now(),
            unreadCount
          };
        } catch (err) {
          if (isAbortError(err)) throw err;
          return {
            ...thread,
            lastMessage: "Start a conversation",
            timestamp: Date.now(),
            unreadCount: 0
          };
        }
      });

      const threadsWithDetails = await Promise.all(threadDetailsPromises);

      // FIX 3: Better user data fetching
      const userIds = new Set();
      threadsWithDetails.forEach(thread => {
        if (thread.otherUserId) userIds.add(thread.otherUserId);
        if (thread.buyerId && thread.buyerId !== user._id) userIds.add(thread.buyerId);
        if (thread.sellerId && thread.sellerId !== user._id) userIds.add(thread.sellerId);
      });

      const userPromises = Array.from(userIds).map(async (userId) => {
        try {
          const res = await axiosWithAuth.get(`/api/users/${userId}`, {
            signal: abortControllerRef.current.signal
          });

          const userData = res.data?.user || res.data;
          let name = `User ${userId.substring(0, 5)}`;

          if (userData) {
            if (userData.role === 'seller' || userData.role === 'seller_pending') {
              name = userData.sellerProfile?.studentName ||
                userData.sellerProfile?.businessName ||
                userData.name || name;
            } else {
              name = userData.name || name;
            }
          }

          return { id: userId, name };
        } catch (err) {
          if (isAbortError(err)) throw err;
          return { id: userId, name: `User ${userId.substring(0, 5)}` };
        }
      });

      const users = await Promise.all(userPromises);
      const userMap = users.reduce((acc, user) => {
        acc[user.id] = user.name;
        return acc;
      }, {});

      const sortedThreads = threadsWithDetails.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      setChatData({
        threads: sortedThreads,
        users: userMap
      });

    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Original chat fetch error:', err);
        setError(err.message || "Failed to fetch conversations");
      }
    } finally {
      setLoading(false);
    }
  }, [axiosWithAuth, user._id, isAbortError]);

  // FIX 4: Mark messages as read when navigating to chat
  const markThreadAsRead = useCallback(async (threadId) => {
    if (!axiosWithAuth) return;

    try {
      // Find the thread and get unread message IDs
      const thread = chatData.threads.find(t => t.threadId === threadId);
      if (!thread || thread.unreadCount === 0) return;

      // Get messages to mark as read
      const messagesResponse = await axiosWithAuth.get(`/api/chats/thread/${threadId}`);
      const messages = Array.isArray(messagesResponse.data) ? messagesResponse.data : [];

      const unreadMessageIds = messages
        .filter(msg => msg.receiverId === user._id && !msg.read && msg.senderId !== user._id)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        await axiosWithAuth.post('/api/chats/mark-read', {
          threadId,
          messageIds: unreadMessageIds
        });

        // Update local state
        setChatData(prev => ({
          ...prev,
          threads: prev.threads.map(t =>
            t.threadId === threadId
              ? { ...t, unreadCount: 0 }
              : t
          )
        }));
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [axiosWithAuth, user._id, chatData.threads]);

  // Try optimized endpoint first, fallback to original
  const fetchChats = useCallback(async () => {
    try {
      await fetchOptimizedChats();
    } catch (err) {
      if (!isAbortError(err) && err.response?.status === 404) {
        await fetchChatsOriginal();
      }
    }
  }, [fetchOptimizedChats, fetchChatsOriginal, isAbortError]);

  // Debounced search
  const debouncedSearch = useCallback((query) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
    }, 300);
  }, []);

  useEffect(() => {
    fetchChats();

    // FIX 5: Add periodic refresh for real-time updates
    const refreshInterval = setInterval(() => {
      fetchChats();
    }, 30000); // Refresh every 30 seconds

    // Periodic cleanup
    const cleanupInterval = setInterval(() => {
      const now = Date.now();

      // Clean time cache
      const timeEntries = Array.from(timeCache.current.entries());
      timeEntries.forEach(([key]) => {
        if (now - (key * 60000) > 3600000) {
          timeCache.current.delete(key);
        }
      });

      // Clean main cache
      const cacheEntries = Array.from(cacheRef.current.entries());
      cacheEntries.forEach(([key, value]) => {
        if (now - value.timestamp > 300000) {
          cacheRef.current.delete(key);
        }
      });
    }, 300000);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      clearInterval(cleanupInterval);
      clearInterval(refreshInterval);
    };
  }, [fetchChats]);

  // Memoized filtered threads
  const filteredThreads = useMemo(() => {
    const { threads, users } = chatData;

    if (!threads?.length) return [];

    return threads.filter(thread => {
      const otherId = thread.otherUserId ||
        (user._id === thread.buyerId ? thread.sellerId : thread.buyerId);
      const username = users[otherId] || '';

      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = username.toLowerCase().includes(searchLower) ||
          (thread.lastMessage || '').toLowerCase().includes(searchLower) ||
          (thread.productTitle || '').toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      if (unreadFilter && (!thread.unreadCount || thread.unreadCount === 0)) {
        return false;
      }

      return true;
    });
  }, [chatData, searchQuery, unreadFilter, user._id]);

  // Memoized total unread count
  const totalUnreadCount = useMemo(() => {
    return chatData.threads?.reduce((total, thread) => total + (thread.unreadCount || 0), 0) || 0;
  }, [chatData.threads]);

  // Optimized time formatting with caching
  const formatMessageTime = useCallback((timestamp) => {
    if (!timestamp) return '';

    const cacheKey = Math.floor(timestamp / 60000);
    if (timeCache.current.has(cacheKey)) {
      return timeCache.current.get(cacheKey);
    }

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = diffMs / (1000 * 60 * 60);

      let formatted;
      if (diffHours < 1) {
        formatted = 'Now';
      } else if (diffHours < 24) {
        formatted = format(date, 'h:mm a');
      } else if (diffHours < 48) {
        formatted = 'Yesterday';
      } else {
        formatted = format(date, 'MM/dd/yy');
      }

      timeCache.current.set(cacheKey, formatted);

      if (timeCache.current.size > 1000) {
        const oldestKey = Math.min(...timeCache.current.keys());
        timeCache.current.delete(oldestKey);
      }

      return formatted;
    } catch {
      return '';
    }
  }, []);

  // FIX 6: Enhanced thread name getter with better fallbacks
  const getThreadName = useCallback((thread) => {
    const { users } = chatData;

    if (thread.buyerId && thread.sellerId) {
      const isUserBuyer = user._id === thread.buyerId;
      const relevantUserId = isUserBuyer ? thread.sellerId : thread.buyerId;

      // Try different name sources
      if (isUserBuyer && thread.sellerName) return thread.sellerName;
      if (!isUserBuyer && thread.buyerName) return thread.buyerName;

      const userName = users[relevantUserId];
      if (userName && userName !== `User ${relevantUserId?.substring(0, 5)}`) {
        return userName;
      }
    }

    const otherUserName = users[thread.otherUserId];
    if (otherUserName && otherUserName !== `User ${thread.otherUserId?.substring(0, 5)}`) {
      return otherUserName;
    }

    // Final fallback
    return `User ${(thread.otherUserId || thread.sellerId || thread.buyerId || '').substring(0, 8)}`;
  }, [chatData.users, user._id]);

  // Event handlers
  const handleSearchChange = useCallback((e) => {
    debouncedSearch(e.target.value);
  }, [debouncedSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const toggleUnreadFilter = useCallback(() => {
    setUnreadFilter(prev => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    cacheRef.current.clear();
    fetchChats();
  }, [fetchChats]);

  // FIX 7: Enhanced chat link handler
  const handleChatLinkClick = useCallback((threadId) => {
    markThreadAsRead(threadId);
  }, [markThreadAsRead]);

  // Optimized skeleton loader
  const SkeletonLoader = React.memo(() => (
    <div className="loading-skeleton">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-avatar"></div>
          <div className="skeleton-content">
            <div className="skeleton-line skeleton-name"></div>
            <div className="skeleton-line skeleton-message"></div>
          </div>
        </div>
      ))}
    </div>
  ));

  if (loading) {
    return (
      <div className="chat-list-container">
        <SkeletonLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-list-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Unable to load conversations</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-list-container">
      {/* Header */}
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
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
            </svg>
            {unreadFilter && <span className="filter-indicator"></span>}
          </button>
          <button className="icon-button" onClick={handleRefresh} title="Refresh">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          placeholder="Search conversations..."
          onChange={handleSearchChange}
          className="search-input"
        />
        {searchQuery && (
          <button className="clear-button" onClick={handleClearSearch}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Chat List */}
      {filteredThreads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>
            {unreadFilter
              ? "No unread messages"
              : searchQuery
                ? "No conversations found"
                : "No conversations yet"}
          </h3>
          <p>
            {unreadFilter
              ? "You're all caught up!"
              : searchQuery
                ? "Try adjusting your search terms"
                : "Start a conversation to see it here"}
          </p>
          {unreadFilter && (
            <button onClick={toggleUnreadFilter} className="show-all-button">
              Show all messages
            </button>
          )}
        </div>
      ) : (
        <ul className="chat-threads">
          {filteredThreads.map(thread => {
            const threadName = getThreadName(thread);
            const previewText = thread.lastMessage || 'Start a conversation';

            return (
              <li key={thread.threadId} className={`chat-thread-item ${thread.unreadCount > 0 ? 'unread' : ''}`}>
                <Link
                  to={`/chats/${thread.threadId}`}
                  className="chat-thread-link"
                  onClick={() => handleChatLinkClick(thread.threadId)}
                >
                  <div className="avatar-container">
                    <div className="avatar-image">
                      {threadName.charAt(0).toUpperCase()}
                    </div>
                    {thread.unreadCount > 0 && <div className="unread-indicator"></div>}
                  </div>

                  <div className="chat-preview">
                    <div className="chat-header">
                      <h4>{threadName}</h4>
                      <span className="chat-time">{formatMessageTime(thread.timestamp)}</span>
                    </div>
                    <div className="chat-content">
                      <p className={`last-message ${thread.unreadCount > 0 ? 'unread-message' : ''}`}>
                        {previewText.length > 50
                          ? `${previewText.substring(0, 50)}...`
                          : previewText}
                      </p>
                      {thread.unreadCount > 0 && (
                        <span className="unread-badge">{thread.unreadCount}</span>
                      )}
                    </div>
                    {thread.productTitle && (
                      <div className="product-preview">
                        <span className="product-tag">
                          {thread.productTitle}
                          {thread.quantity && thread.quantity > 0 && ` (${thread.quantity}×)`}
                        </span>
                        {thread.price && thread.price !== '0.00' && (
                          <span className="price-tag">₦{thread.price}</span>
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
    </div>
  );
};

export default React.memo(ChatList);
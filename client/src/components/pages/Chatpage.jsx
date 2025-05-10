
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ref, onValue, push, get } from "firebase/database";
import { database } from "../../firebase";
import axios from "axios";
import { ArrowLeft, Send, Image, Smile } from "lucide-react"; // Import icons

const ChatPage = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector(state => state.auth.user);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [otherUser, setOtherUser] = useState({
    id: "",
    name: "User"
  });
  const [threadDetails, setThreadDetails] = useState(null);
  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);

  // Set up chat listener and fetch user details
  useEffect(() => {
    if (!currentUser) {
      setError("You must be logged in to view this chat");
      setLoading(false);
      return;
    }
    
    // Ensure user has access to this chat thread
    const userUid = currentUser._id;
    if (!threadId.includes(userUid)) {
      console.error(`User ${userUid} not authorized for chat ${threadId}`);
      setError("You don't have permission to access this chat thread");
      setLoading(false);
      return;
    }

    // Set up Firebase chat listener
    console.log(`Setting up listener for chat: chats/${threadId}`);
    const chatRef = ref(database, `chats/${threadId}`);
    
    // Identify the other user in this thread
    const otherId = threadId.split("_").find(id => id !== userUid);
    if (otherId) {
      setOtherUser(prev => ({ ...prev, id: otherId }));
      
      // Fetch other user's details
      const fetchUserDetails = async () => {
        try {
          const response = await axios.get(`/api/users/${otherId}`, {
            headers: { Authorization: `Bearer ${currentUser.token}` }
          });
          
          const userData = response.data?.user;
          if (userData) {
            // Use the appropriate name based on role
            let displayName = userData.name;
            
            if (userData.role === 'seller' || userData.role === 'seller_pending') {
              displayName = userData.sellerProfile?.studentName || 
                          userData.sellerProfile?.businessName || 
                          userData.name;
            }
            
            setOtherUser({
              id: otherId,
              name: displayName,
              role: userData.role
            });
          }
        } catch (err) {
          console.error("Error fetching user details:", err);
          // Keep the default ID-based name as fallback
        }
      };
      
      fetchUserDetails();
      
      // Also fetch thread details from Firestore (if available)
      const fetchThreadDetails = async () => {
        try {
          const response = await axios.get(`/api/chats/thread/${threadId}`, {
            headers: { Authorization: `Bearer ${currentUser.token}` }
          });
          
          if (response.data) {
            setThreadDetails(response.data);
            
            // If thread details include names, use them
            if (response.data.buyerId === currentUser._id && response.data.sellerName) {
              setOtherUser(prev => ({ ...prev, name: response.data.sellerName }));
            } else if (response.data.sellerId === currentUser._id && response.data.buyerName) {
              setOtherUser(prev => ({ ...prev, name: response.data.buyerName }));
            }
          }
        } catch (err) {
          console.warn("Could not fetch thread details:", err);
          // Non-critical error, continue without thread details
        }
      };
      
      fetchThreadDetails();
    }
    
    // Try to fetch data first to validate access
    get(chatRef)
      .then((snapshot) => {
        console.log("Initial data check successful");
        
        // Now set up the real-time listener
        const unsubscribe = onValue(chatRef, (snapshot) => {
          console.log("Got real-time data update");
          const data = snapshot.val() || {};
          const list = Object.entries(data)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => a.timestamp - b.timestamp);
          setMessages(list);
          setLoading(false);
        }, (err) => {
          console.error("Firebase listener error:", err);
          setError(`Error loading messages: ${err.message}`);
          setLoading(false);
        });
        
        return () => unsubscribe();
      })
      .catch((err) => {
        console.error("Error checking chat path:", err);
        if (err.code === "PERMISSION_DENIED") {
          setError("Permission denied. Security rules are preventing access to this chat.");
        } else {
          setError(`Error: ${err.message}`);
        }
        setLoading(false);
      });
    
  }, [threadId, currentUser]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMsg = () => {
    if (!input.trim() || !currentUser) return;
    
    try {
      const chatRef = ref(database, `chats/${threadId}`);
      const otherId = threadId.split("_")
        .find(id => id !== currentUser._id);
      
      const messageData = {
        senderId: currentUser._id,
        receiverId: otherId,
        content: input.trim(),
        timestamp: Date.now()
      };
      
      console.log("Sending message:", messageData);
      
      push(chatRef, messageData)
        .then(() => {
          console.log("Message sent successfully");
          setInput("");
        })
        .catch((err) => {
          console.error("Error sending message:", err);
          alert(`Failed to send message: ${err.message}`);
        });
    } catch (err) {
      console.error("Error in send message function:", err);
      alert(`Error: ${err.message}`);
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };
  
  // Get details to display about the thread
  const getThreadTitle = () => {
    // First try to use thread details if available
    if (threadDetails?.productTitle) {
      return `${threadDetails.productTitle} (${threadDetails.quantity}×)`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="chat-page loading-state">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="chat-page">
        <div className="error-container">
          <div className="error-message">{error}</div>
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
      <div className="chat-header">
        <button className="back-button" onClick={goBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="user-info">
          <h2>{otherUser.name}</h2>
          <span className="status-indicator">Active now</span>
        </div>
      </div>
      
      {threadDetails && (
        <div className="chat-subheader">
          <div className="product-info">
            {getThreadTitle() && (
              <div className="product-title">{getThreadTitle()}</div>
            )}
            {threadDetails.price && (
              <div className="product-price">${threadDetails.price}</div>
            )}
          </div>
        </div>
      )}
      
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
              
              return (
                <div 
                  key={message.id} 
                  className={`message-group ${isMine ? 'sent' : 'received'}`}
                >
                  {!isMine && showAvatar && (
                    <div className="avatar-container">
                      <div className="avatar">
                        {otherUser.name ? otherUser.name[0] : "U"}
                      </div>
                    </div>
                  )}
                  <div className="message-bubble-container">
                    <div className="message-bubble">
                      <div className="message-content">{message.content}</div>
                      <div className="message-timestamp">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="message-input-container">
        <button className="attachment-button">
          <Image size={20} />
        </button>
        <textarea 
          className="message-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Message..."
          rows={1}
        />
        <button className="emoji-button">
          <Smile size={20} />
        </button>
        <button 
          className="send-button"
          onClick={sendMsg}
          disabled={!input.trim() || !currentUser}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
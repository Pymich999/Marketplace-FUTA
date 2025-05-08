import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const ChatList = () => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
        if (Array.isArray(res.data)) {
          setThreads(res.data);
        } else if (res.data && typeof res.data === 'object' && res.data.threads) {
          // If the API returns an object with a threads property
          setThreads(res.data.threads);
        } else {
          // If it's neither an array nor has a threads property
          console.error("Unexpected API response format:", res.data);
          setThreads([]);
          setError("Received unexpected data format from server");
        }
      } catch (err) {
        console.error("Error fetching threads:", err);
        setError(err.message || "Failed to fetch conversations");
      } finally {
        setLoading(false);
      }
    };
    
    fetchThreads();
  }, []);
  
  if (loading) return <div>Loading conversations...</div>;
  if (error) return <div className="error-message">{error}</div>;
  
  return (
    <div>
      <h2>Your Conversations</h2>
      {threads.length === 0 ? (
        <p>You don't have any conversations yet.</p>
      ) : (
        <ul>
          {threads.map(t => (
            <li key={t.threadId}>
              <Link to={`/chats/${t.threadId}`}>
                Chat with user {t.otherUserId}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChatList;
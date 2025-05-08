// client/src/pages/ChatPage.jsx
import React, { useEffect, useState } from "react";
import { useParams }      from "react-router-dom";
import {firebase}           from "../../firebase";
import { useSelector }    from "react-redux";

const ChatPage = () => {
  const { threadId } = useParams();
  const currentUser = useSelector(state => state.auth.user);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");

  useEffect(() => {
    const ref = firebase.database().ref(`chats/${threadId}`);
    ref.on("value", snap => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id,msg]) => ({ id, ...msg }))
        .sort((a,b) => a.timestamp - b.timestamp);
      setMessages(list);
    });
    return () => ref.off();
  }, [threadId]);

  const sendMsg = () => {
    const ref = firebase.database().ref(`chats/${threadId}`);
    const otherId = threadId.split("_")
      .find(id => id !== currentUser._id);
    ref.push({
      senderId:   currentUser._id,
      receiverId: otherId,
      content:    input,
      timestamp:  Date.now()
    });
    setInput("");
  };

  return (
    <div>
      <h2>Chat</h2>
      <div className="message-list" style={{ maxHeight: 400, overflowY: "auto" }}>
        {messages.map(m => (
          <div key={m.id} className={m.senderId === currentUser._id ? "mine" : "theirs"}>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      <input 
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Type a message…"
      />
      <button onClick={sendMsg}>Send</button>
    </div>
  );
};

export default ChatPage;

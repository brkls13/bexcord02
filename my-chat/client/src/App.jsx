import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER = 'http://localhost:4000';
const socket = io(SERVER);

export default function App() {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState(null);
  const [channel, setChannel] = useState('general');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const bottomRef = useRef();

  useEffect(() => {
    socket.on('message', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('system', (m) => setMessages(prev => [...prev, { id: 'sys'+Date.now(), username: 'system', text: m.text, ts: new Date().toISOString() }]));
    socket.on('typing', ({ username, typing }) => {
      setTypingUsers(prev => {
        const copy = { ...prev };
        if (typing) copy[username] = true; else delete copy[username];
        return copy;
      });
    });
    return () => {
      socket.off('message');
      socket.off('system');
      socket.off('typing');
    };
  }, []);

  useEffect(() => {
    axios.get(`${SERVER}/channels/${channel}/messages`).then(res => setMessages(res.data)).catch(()=>{});
  }, [channel]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const doLogin = async () => {
    if (!username) return alert('Kullanıcı adı gir');
    const res = await axios.post(`${SERVER}/login`, { username });
    setToken(res.data.token);
    socket.emit('join', { channel, username });
  };

  const sendMessage = () => {
    if (!text) return;
    socket.emit('message', { channel, username, text });
    setText('');
    socket.emit('typing', { channel, username, typing: false });
  };

  const onTyping = (v) => {
    setText(v);
    socket.emit('typing', { channel, username, typing: v.length > 0 });
  };

  const sendFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${SERVER}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data.url;
      socket.emit('message', { channel, username, text: fileUrl });
    } catch {
      alert('Dosya yüklenemedi');
    }
  };

  if (!token) {
    return (
      <div style={{padding:20}}>
        <h2>Basit Chat - Giriş</h2>
        <input placeholder="Kullanıcı adı" value={username} onChange={e=>setUsername(e.target.value)} />
        <button onClick={doLogin}>Giriş</button>
      </div>
    );
  }

  return (
    <div style={{display:'flex', height:'100vh'}}>
      <aside style={{width:220, borderRight:'1px solid #ddd', padding:10}}>
        <h3>Kanallar</h3>
        <ul>
          <li onClick={()=>setChannel('general')} style={{cursor:'pointer',fontWeight: channel==='general' ? 'bold':''}}># general</li>
          <li onClick={()=>setChannel('random')} style={{cursor:'pointer',fontWeight: channel==='random' ? 'bold':''}}># random</li>
        </ul>
        <div style={{marginTop:20}}>Kullanıcı: <b>{username}</b></div>
      </aside>
      <main style={{flex:1, display:'flex', flexDirection:'column'}}>
        <header style={{padding:10, borderBottom:'1px solid #eee'}}>Kanal: #{channel}</header>
        <div style={{flex:1, overflow:'auto', padding:10}}>
          {messages.map(m => (
            <div key={m.id} style={{marginBottom:8}}>
              <div style={{fontSize:12, color:'#666'}}>{m.username} • {new Date(m.ts).toLocaleTimeString()}</div>
              <div>
                {m.text.startsWith('http') && (m.text.endsWith('.png') || m.text.endsWith('.jpg') || m.text.endsWith('.jpeg') || m.text.endsWith('.gif'))
                  ? <img src={m.text} alt="dosya" style={{maxWidth:'200px'}} />
                  : m.text
                }
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:10, borderTop:'1px solid #eee'}}>
          <div style={{height:18, color:'#666'}}>{Object.keys(typingUsers).length > 0 ? `${Object.keys(typingUsers).join(', ')} yazıyor...` : ''}</div>
          <input
            style={{width:'70%'}}
            value={text}
            onChange={e=>onTyping(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') sendMessage(); }}
            placeholder="Mesaj yaz... (Enter ile gönder)"
          />
          <button onClick={sendMessage}>Gönder</button>
          <input type="file" onChange={sendFile} />
        </div>
      </main>
    </div>
  );
}

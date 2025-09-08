"use client";

import React, { useState, useEffect } from 'react';

const TestWebSocket = () => {
  const [message, setMessage] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3000/test');

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: 'subscribeOrder', orderId: 1 }));
    };

    socket.onmessage = (event) => {
      setMessage(event.data);
    };

    socket.onclose = () => {
      setConnected(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  return (
    <div>
      <h1>Test WebSocket</h1>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <p>Message from server: {message}</p>
    </div>
  );
};

export default TestWebSocket;
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../mocks/chrome.js';
import Home from './Home.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>
);

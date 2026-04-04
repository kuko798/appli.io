
import React from 'react'
import ReactDOM from 'react-dom/client'
import '../mocks/webShim.js';
import Dashboard from './Dashboard.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Dashboard />
    </React.StrictMode>,
)

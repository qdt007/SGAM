import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerIcons } from './constants/icons';
import './index.css';

// Before the first render, so no icon ever has to wait on a network round trip.
registerIcons();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

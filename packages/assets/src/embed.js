import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';

const loading = document.getElementById('PreLoading');
if (loading !== null) {
  loading.style.display = 'none';
}

createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

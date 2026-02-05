import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const loading = document.getElementById('PreLoading');
if (loading !== null) {
  loading.style.display = 'none';
}

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

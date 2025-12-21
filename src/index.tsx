import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Import App từ cùng thư mục src (Super App)
import '../index.css';   // Import CSS từ thư mục cha (root)

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
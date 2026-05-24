import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.jsx';
import './styles.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn('Clerk publishable key not set. Using mock auth for development.');
}

const AppWithClerk = () => {
  if (!PUBLISHABLE_KEY) {
    // Dev mode: mock Clerk
    return <App mockAuth={true} />;
  }
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignInUrl="/" afterSignUpUrl="/">
      <App />
    </ClerkProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWithClerk />
  </React.StrictMode>
);

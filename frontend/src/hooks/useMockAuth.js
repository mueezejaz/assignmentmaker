import { useState } from 'react';

// Mock auth for development (when Clerk key not set)
export function useMockAuth() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mock_user');
    return saved ? JSON.parse(saved) : null;
  });

  const signIn = (email = 'dev@university.edu', name = 'Developer') => {
    const u = {
      id: `user_mock_${btoa(email).slice(0,8)}`,
      fullName: name,
      primaryEmailAddress: { emailAddress: email },
      imageUrl: null,
    };
    localStorage.setItem('mock_user', JSON.stringify(u));
    setUser(u);
  };

  const signOut = () => {
    localStorage.removeItem('mock_user');
    setUser(null);
  };

  return { user, signIn, signOut, isLoaded: true };
}

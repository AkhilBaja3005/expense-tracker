import { useState, useEffect, useCallback } from 'react';

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function useAuth(onSignIn) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('expenser_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleCredentialResponse = useCallback((response) => {
    const profile = decodeJwt(response.credential);
    if (profile) {
      const userData = {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        picture: profile.picture
      };
      localStorage.setItem('expenser_user', JSON.stringify(userData));
      setUser(userData);
      if (onSignIn) onSignIn(userData.id);
    }
  }, [onSignIn]);

  const handleSignOut = () => {
    localStorage.removeItem('expenser_user');
    setUser(null);
  };

  // Initialize Google login button if not logged in
  useEffect(() => {
    if (!user && typeof window.google !== 'undefined') {
      window.google.accounts.id.initialize({
        client_id: "381822591589-cnbic33i53ra1puqr4jkj2hrqreub02e.apps.googleusercontent.com",
        callback: handleCredentialResponse
      });

      const btnElement = document.getElementById("google-signin-btn");
      if (btnElement) {
        window.google.accounts.id.renderButton(
          btnElement,
          { theme: "outline", size: "large", width: "100%", alignment: "center" }
        );
      }
    }
  }, [user, handleCredentialResponse]);

  return { user, handleCredentialResponse, handleSignOut };
}

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePwaInstall(user) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });

  // Service Worker registration and Web Push status query
  // Only register in production builds — in dev, the SW's cache-first fetch handler
  // would serve stale JS across Vite HMR reloads, hiding source changes from the browser.
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js')
        .then(async (reg) => {
          console.log('SW registered successfully:', reg);
          if ('PushManager' in window) {
            setIsPushSupported(true);
            const sub = await reg.pushManager.getSubscription();
            setIsPushEnabled(!!sub);
          }
        })
        .catch((err) => {
          console.error('SW registration failed:', err);
        });
    }
  }, [user]);

  // Notify the user when a new Service Worker version has taken control.
  // Ignore the very first controllerchange (no prior controller = fresh install, not an update).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const hadControllerAtMount = !!navigator.serviceWorker.controller;

    const handleControllerChange = () => {
      if (hadControllerAtMount) {
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  const applyUpdate = () => {
    window.location.reload();
  };

  // Version redeployment test notification notifier
  useEffect(() => {
    const CURRENT_VERSION = 'v2.3.0';
    const lastVersion = localStorage.getItem('expenser_app_version');
    if (lastVersion && lastVersion !== CURRENT_VERSION) {
      if (Notification.permission === 'granted') {
        new Notification("Expense Tracker Updated! 🚀", {
          body: `New version ${CURRENT_VERSION} has been successfully redeployed and is now live.`,
          icon: "/icon.svg",
          badge: "/icon.svg"
        });
      }
    }
    localStorage.setItem('expenser_app_version', CURRENT_VERSION);
  }, [user]);

  // Listen for native beforeinstallprompt PWA event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (!isStandalone) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User PWA install prompt choice: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Toggle push notifications (subscribe / unsubscribe)
  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) return;
    if (!user?.id) {
      alert('Please sign in to configure daily push reminders.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      if (isPushEnabled) {
        // Unsubscribe active registration
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
        setIsPushEnabled(false);
        console.log('Push notifications disabled.');
      } else {
        // Subscribe to push notifications
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Notification permissions are required to enable daily reminders.');
          return;
        }

        const pubKey = 'BNT0tNWiED6i5vaUz_yFbNY4tEJIP9Rs1G4HeVcrT7wK9GcDNc2lUR7oBJYB91x86jfpk_JTIx8pYlB4bx7qn9w';
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pubKey)
        });

        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        if (!p256dhKey || !authKey) {
          throw new Error("Web Push subscription keys are missing or unsupported by the browser.");
        }

        const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(p256dhKey)));
        const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(authKey)));

        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth
        });

        setIsPushEnabled(true);
        console.log('Push notifications enabled.');
      }
    } catch (err) {
      console.error('Push notification toggle failed:', err);
      alert('Failed to modify push reminders: ' + err.message);
    }
  };

  const sendTestNotification = () => {
    if (!('Notification' in window)) {
      alert("This browser does not support push notifications.");
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification("Expense Tracker Test Alert 🔔", {
        body: "Success! PWA push notifications are configured and working correctly.",
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "test-notification"
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification("Expense Tracker Test Alert 🔔", {
            body: "Success! PWA push notifications are configured and working correctly.",
            icon: "/icon.svg",
            badge: "/icon.svg",
            tag: "test-notification"
          });
          setNotificationStatus('granted');
        } else {
          alert("Notification permission was denied.");
        }
      });
    } else {
      alert("Notification permission is blocked. Please reset/enable notification permissions in your browser site settings to receive notifications.");
    }
  };

  return {
    showInstallBanner, setShowInstallBanner,
    handleInstallPWA,
    isPushSupported, isPushEnabled, handleTogglePush,
    notificationStatus,
    sendTestNotification,
    updateAvailable, applyUpdate
  };
}

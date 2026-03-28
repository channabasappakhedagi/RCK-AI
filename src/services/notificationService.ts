
export type NotificationType = 'threat' | 'info' | 'success' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

type NotificationListener = (notifications: Notification[]) => void;

class NotificationService {
  private notifications: Notification[] = [];
  private listeners: NotificationListener[] = [];
  private readonly STORAGE_KEY = 'sentinel_notifications';

  constructor() {
    this.loadNotifications();
  }

  private loadNotifications() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.notifications = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse notifications', e);
        this.notifications = [];
      }
    }
  }

  private saveNotifications() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notifications.slice(-50))); // Keep last 50
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.notifications]));
  }

  subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      read: false,
    };

    this.notifications = [newNotification, ...this.notifications];
    this.saveNotifications();
    
    // Also trigger a browser notification if permitted
    if (Notification.permission === 'granted') {
      new window.Notification(newNotification.title, {
        body: newNotification.message,
        icon: '/favicon.ico'
      });
    }
  }

  markAsRead(id: string) {
    this.notifications = this.notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    this.saveNotifications();
  }

  markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.saveNotifications();
  }

  clearAll() {
    this.notifications = [];
    this.saveNotifications();
  }

  getNotifications() {
    return [...this.notifications];
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }
}

export const notificationService = new NotificationService();

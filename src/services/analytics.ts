
export type AnalyticsEvent = {
  category: 'media_analysis' | 'web_sentinel' | 'chat' | 'navigation';
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: string;
};

class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private readonly STORAGE_KEY = 'sentinel_analytics_events';

  constructor() {
    this.loadEvents();
  }

  private loadEvents() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.events = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse analytics events', e);
        this.events = [];
      }
    }
  }

  private saveEvents() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events.slice(-100))); // Keep last 100 events
  }

  track(event: Omit<AnalyticsEvent, 'timestamp'>) {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);
    this.saveEvents();

    // In a real app, we would send this to a server
    console.log(`[Analytics] ${fullEvent.category}:${fullEvent.action}`, fullEvent.metadata || '');
  }

  getEvents() {
    return [...this.events];
  }

  getStats() {
    const stats = {
      mediaAnalyses: 0,
      sentinelScans: 0,
      chatMessages: 0,
      tabViews: {} as Record<string, number>,
    };

    this.events.forEach(event => {
      if (event.category === 'media_analysis') stats.mediaAnalyses++;
      if (event.category === 'web_sentinel') stats.sentinelScans++;
      if (event.category === 'chat') stats.chatMessages++;
      if (event.category === 'navigation') {
        const tab = event.label || 'unknown';
        stats.tabViews[tab] = (stats.tabViews[tab] || 0) + 1;
      }
    });

    return stats;
  }
}

export const analytics = new AnalyticsService();

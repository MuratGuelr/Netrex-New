'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export type NotificationLevel = 'all' | 'mentions' | 'none';
export type NotificationSound = 'default' | 'none' | 'custom';

export interface ChannelNotificationSettings {
  level: NotificationLevel;
  muted: boolean;
}

export interface NotificationSettings {
  globalLevel: NotificationLevel;
  globalMuted: boolean;
  mentionNotifications: boolean;
  notificationSound: NotificationSound;
  channelSettings: Record<string, ChannelNotificationSettings>;
  lastReadMessages: Record<string, string>; // channelId -> lastReadMessageId
}

const defaultSettings: NotificationSettings = {
  globalLevel: 'all',
  globalMuted: false,
  mentionNotifications: true,
  notificationSound: 'default',
  channelSettings: {},
  lastReadMessages: {},
};

export function useNotificationSettings(user: User | null) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const settingsRef = doc(db, 'users', user.uid, 'settings', 'notifications');
    
    // İlk yükleme
    getDoc(settingsRef).then((snap) => {
      if (snap.exists()) {
        setSettings({ ...defaultSettings, ...snap.data() } as NotificationSettings);
      }
      setLoading(false);
    });

    // Real-time dinleme
    const unsubscribe = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        setSettings({ ...defaultSettings, ...snap.data() } as NotificationSettings);
      } else {
        setSettings(defaultSettings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    if (!user || !db) return;

    const settingsRef = doc(db, 'users', user.uid, 'settings', 'notifications');
    const currentData = settings;
    const newSettings = { ...currentData, ...updates };

    await setDoc(settingsRef, newSettings, { merge: true });
    setSettings(newSettings);
  };

  const updateChannelSettings = async (channelId: string, channelSettings: ChannelNotificationSettings) => {
    if (!user || !db) return;

    const newChannelSettings = {
      ...settings.channelSettings,
      [channelId]: channelSettings,
    };

    await updateSettings({ channelSettings: newChannelSettings });
  };

  const updateLastReadMessage = async (channelId: string, messageId: string) => {
    if (!user || !db) return;

    const newLastReadMessages = {
      ...settings.lastReadMessages,
      [channelId]: messageId,
    };

    await updateSettings({ lastReadMessages: newLastReadMessages });
  };

  const getChannelNotificationLevel = (channelId: string): NotificationLevel => {
    const channelSetting = settings.channelSettings[channelId];
    if (channelSetting?.muted) return 'none';
    if (channelSetting?.level) return channelSetting.level;
    if (settings.globalMuted) return 'none';
    return settings.globalLevel;
  };

  const isChannelMuted = (channelId: string): boolean => {
    const channelSetting = settings.channelSettings[channelId];
    if (channelSetting?.muted !== undefined) return channelSetting.muted;
    return settings.globalMuted;
  };

  return {
    settings,
    loading,
    updateSettings,
    updateChannelSettings,
    updateLastReadMessage,
    getChannelNotificationLevel,
    isChannelMuted,
  };
}


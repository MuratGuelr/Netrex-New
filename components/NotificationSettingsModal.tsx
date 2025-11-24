'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  useNotificationSettings,
  NotificationLevel,
  NotificationSound,
  ChannelNotificationSettings,
} from '@/hooks/useNotificationSettings';

interface NotificationSettingsModalProps {
  show: boolean;
  onClose: () => void;
  currentUser: User;
  channelId?: string | null;
  channelName?: string;
}

export default function NotificationSettingsModal({
  show,
  onClose,
  currentUser,
  channelId,
  channelName,
}: NotificationSettingsModalProps) {
  const {
    settings,
    updateSettings,
    updateChannelSettings,
    getChannelNotificationLevel,
    isChannelMuted,
  } = useNotificationSettings(currentUser);

  const [localLevel, setLocalLevel] = useState<NotificationLevel>(
    channelId ? getChannelNotificationLevel(channelId) : settings.globalLevel
  );
  const [localMuted, setLocalMuted] = useState(
    channelId ? isChannelMuted(channelId) : settings.globalMuted
  );
  const [localMentionNotifications, setLocalMentionNotifications] = useState(
    settings.mentionNotifications
  );
  const [localNotificationSound, setLocalNotificationSound] = useState<NotificationSound>(
    settings.notificationSound
  );

  if (!show) return null;

  const handleSave = async () => {
    if (channelId) {
      // Kanal bazlı ayarlar
      const channelSettings: ChannelNotificationSettings = {
        level: localLevel,
        muted: localMuted,
      };
      await updateChannelSettings(channelId, channelSettings);
    } else {
      // Global ayarlar
      await updateSettings({
        globalLevel: localLevel,
        globalMuted: localMuted,
        mentionNotifications: localMentionNotifications,
        notificationSound: localNotificationSound,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-[#313338] rounded-lg p-6 w-full max-w-md border border-[#1e1f22]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {channelId ? `${channelName} Bildirim Ayarları` : 'Bildirim Ayarları'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-4">
          {/* Bildirim Seviyesi */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bildirim Seviyesi
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 bg-[#2b2d31] rounded cursor-pointer hover:bg-[#35373C] transition-colors">
                <input
                  type="radio"
                  name="level"
                  value="all"
                  checked={localLevel === 'all'}
                  onChange={() => setLocalLevel('all')}
                  className="mr-3"
                />
                <div>
                  <div className="text-white font-medium">Tüm Mesajlar</div>
                  <div className="text-xs text-gray-400">Her mesaj için bildirim al</div>
                </div>
              </label>
              <label className="flex items-center p-3 bg-[#2b2d31] rounded cursor-pointer hover:bg-[#35373C] transition-colors">
                <input
                  type="radio"
                  name="level"
                  value="mentions"
                  checked={localLevel === 'mentions'}
                  onChange={() => setLocalLevel('mentions')}
                  className="mr-3"
                />
                <div>
                  <div className="text-white font-medium">Sadece Mention&apos;lar</div>
                  <div className="text-xs text-gray-400">Sadece @mention olduğunda bildirim al</div>
                </div>
              </label>
              <label className="flex items-center p-3 bg-[#2b2d31] rounded cursor-pointer hover:bg-[#35373C] transition-colors">
                <input
                  type="radio"
                  name="level"
                  value="none"
                  checked={localLevel === 'none'}
                  onChange={() => setLocalLevel('none')}
                  className="mr-3"
                />
                <div>
                  <div className="text-white font-medium">Hiçbiri</div>
                  <div className="text-xs text-gray-400">Bildirim alma</div>
                </div>
              </label>
            </div>
          </div>

          {/* Sessiz Mod */}
          <div className="flex items-center justify-between p-3 bg-[#2b2d31] rounded">
            <div>
              <div className="text-white font-medium">Sessiz Mod</div>
              <div className="text-xs text-gray-400">Bu kanalı sessize al</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localMuted}
                onChange={(e) => setLocalMuted(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
            </label>
          </div>

          {/* Global ayarlar (sadece global modal için) */}
          {!channelId && (
            <>
              {/* Mention Bildirimleri */}
              <div className="flex items-center justify-between p-3 bg-[#2b2d31] rounded">
                <div>
                  <div className="text-white font-medium">Mention Bildirimleri</div>
                  <div className="text-xs text-gray-400">@mention olduğunda bildirim al</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localMentionNotifications}
                    onChange={(e) => setLocalMentionNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                </label>
              </div>

              {/* Bildirim Sesi */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bildirim Sesi
                </label>
                <select
                  value={localNotificationSound}
                  onChange={(e) => setLocalNotificationSound(e.target.value as NotificationSound)}
                  className="w-full px-4 py-2 bg-[#1e1f22] border border-[#3f4147] rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                >
                  <option value="default">Varsayılan</option>
                  <option value="none">Sessiz</option>
                </select>
              </div>
            </>
          )}

          {/* Butonlar */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded bg-[#5865F2] hover:bg-[#4752c4] text-white transition-colors"
            >
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


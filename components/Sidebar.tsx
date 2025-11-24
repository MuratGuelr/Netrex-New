"use client";

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { db, ADMIN_EMAIL } from "@/lib/firebase/config";
import { generateAvatar } from "@/utils/avatarGenerator";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import NotificationSettingsModal from "./NotificationSettingsModal";

interface Channel {
  id: string;
  name: string;
  type?: "text" | "voice" | "dm";
  participants?: string[];
  createdBy?: string;
  bitrate?: number;
}

interface SidebarProps {
  currentUser: User;
  currentChannelId: string | null;
  currentTextChannelId?: string | null;
  currentVoiceChannelId?: string | null;
  onChannelSelect: (channel: Channel) => void;
  usersMap: Record<string, any>;
  onLogout: () => void;
  onToggle?: () => void;
}

interface VoiceParticipant {
  uid: string;
  displayName: string;
  photoURL?: string;
  joinedAt?: any;
}

export default function Sidebar({
  currentUser,
  currentChannelId,
  currentTextChannelId,
  currentVoiceChannelId,
  onChannelSelect,
  usersMap,
  onLogout,
  onToggle,
}: SidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelType, setChannelType] = useState<"text" | "voice">("text");
  const [voiceParticipants, setVoiceParticipants] = useState<
    Record<string, VoiceParticipant[]>
  >({});
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    channel: Channel | null;
  }>({ show: false, x: 0, y: 0, channel: null });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [channelToEdit, setChannelToEdit] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationChannelId, setNotificationChannelId] = useState<string | null>(null);
  const { settings, getChannelNotificationLevel, updateLastReadMessage } = useNotificationSettings(currentUser);

  // Kanal seçildiğinde son okunan mesajı güncelle
  useEffect(() => {
    if (!currentTextChannelId || !db) return;
    
    const messagesRef = collection(db, 'channels', currentTextChannelId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), where('uid', '!=', currentUser.uid));
    
    getDocs(q).then((snapshot) => {
      if (!snapshot.empty) {
        const lastMessage = snapshot.docs[0];
        updateLastReadMessage(currentTextChannelId, lastMessage.id);
      }
    });
  }, [currentTextChannelId, currentUser.uid, updateLastReadMessage]);

  useEffect(() => {
    if (!db) return;

    // Genel kanalı oluştur
    const initGeneralChannel = async () => {
      if (!db) return; // Double check for TypeScript
      const generalRef = doc(db, "channels", "genel");
      const snap = await getDoc(generalRef);
      if (!snap.exists()) {
        await setDoc(generalRef, {
          name: "genel-sohbet",
          createdBy: "system",
          createdAt: serverTimestamp(),
          type: "text",
        });
      }
    };
    initGeneralChannel();

    // Kanalları dinle
    if (!db) return; // TypeScript null check
    const q = query(collection(db, "channels"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const channelsData: Channel[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // DM kanallarını filtrele
        if (data.type === "dm" && data.participants) {
          if (!data.participants.includes(currentUser.uid)) {
            return;
          }
        }
        channelsData.push({ id: doc.id, ...data } as Channel);
      });
      setChannels(channelsData);

      // İlk kanalı otomatik seç (sadece metin kanalları için)
      if (
        !currentTextChannelId &&
        !currentVoiceChannelId &&
        channelsData.length > 0
      ) {
        const textChannels = channelsData.filter(
          (c) => c.type !== "voice" && c.type !== "dm"
        );
        if (textChannels.length > 0) {
          const lastTextId =
            typeof window !== "undefined"
              ? localStorage.getItem("lastTextChannel")
              : null;
          const target =
            lastTextId && textChannels.find((c) => c.id === lastTextId)
              ? lastTextId
              : textChannels[0].id;
          const targetChannel =
            textChannels.find((c) => c.id === target) || textChannels[0];
          if (targetChannel) {
            onChannelSelect(targetChannel);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser.uid, currentTextChannelId, currentVoiceChannelId, onChannelSelect]);

  // Sesli kanallardaki katılımcıları dinle
  useEffect(() => {
    if (!db) return;

    const voiceChannels = channels.filter((c) => c.type === "voice");
    const unsubscribes: (() => void)[] = [];
    const participantsMap: Record<string, VoiceParticipant[]> = {};

    voiceChannels.forEach((channel) => {
      if (!db) return;
      const participantsRef = collection(
        db,
        "channels",
        channel.id,
        "participants"
      );
      const unsubscribe = onSnapshot(participantsRef, (snapshot) => {
        const participants: VoiceParticipant[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          participants.push({
            uid: doc.id,
            displayName: data.displayName || "Kullanıcı",
            photoURL: data.photoURL || null,
            joinedAt: data.joinedAt,
          });
        });
        participantsMap[channel.id] = participants;
        setVoiceParticipants({ ...participantsMap });
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [channels]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !db) return;
    const name = newChannelName.trim().replace(/\s+/g, "-").toLowerCase();
    if (!db) return; // TypeScript null check
    await addDoc(collection(db, "channels"), {
      name,
      createdBy: currentUser.email,
      createdAt: serverTimestamp(),
      type: channelType,
    });
    setNewChannelName("");
    setChannelType("text");
    setShowCreateModal(false);
  };

  const getChannelDisplayName = (channel: Channel) => {
    if (channel.type === "dm" && channel.participants) {
      const otherUid = channel.participants.find(
        (uid) => uid !== currentUser.uid
      );
      if (otherUid && usersMap[otherUid]) {
        return usersMap[otherUid].displayName;
      }
    }
    return channel.name;
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.type === "voice") {
      return <i className="fas fa-volume-up text-xs mr-2 text-[#72767d]"></i>;
    }
    if (channel.type === "dm" && channel.participants) {
      const otherUid = channel.participants.find(
        (uid) => uid !== currentUser.uid
      );
      if (otherUid && usersMap[otherUid]) {
        return (
          <img
            src={
              usersMap[otherUid].photoURL ||
              generateAvatar(usersMap[otherUid].displayName, 20)
            }
            className="w-5 h-5 rounded-full mr-2 object-cover"
            alt=""
          />
        );
      }
    }
    return <i className="fas fa-hashtag text-xs mr-2 text-[#72767d]"></i>;
  };

  const canDeleteChannel = (channel: Channel) => {
    if (channel.id === "genel") return false; // Genel kanal silinemez
    if (!currentUser.email) return false;
    const isAdmin = currentUser.email === ADMIN_EMAIL;
    const isCreator = channel.createdBy === currentUser.email;
    return isAdmin || isCreator;
  };

  const handleChannelContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    e.stopPropagation();
    if (canDeleteChannel(channel) || canEditChannel(channel)) {
      setContextMenu({
        show: true,
        x: e.clientX,
        y: e.clientY,
        channel,
      });
    }
  };

  const handleEllipsisClick = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    e.stopPropagation();
    if (canDeleteChannel(channel) || canEditChannel(channel)) {
      // İkonun pozisyonunu al
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setContextMenu({
        show: true,
        x: rect.right + 5,
        y: rect.top,
        channel,
      });
    }
  };

  const canEditChannel = (channel: Channel) => {
    if (channel.id === "genel") return false; // Genel kanal düzenlenemez
    if (!currentUser.email) return false;
    const isAdmin = currentUser.email === ADMIN_EMAIL;
    const isCreator = channel.createdBy === currentUser.email;
    return isAdmin || isCreator;
  };

  const handleDeleteChannel = async () => {
    if (!channelToDelete || !db) return;

    if (!db) return;
    try {
      // Kanalı sil
      await deleteDoc(doc(db, "channels", channelToDelete.id));
      setShowDeleteModal(false);
      setChannelToDelete(null);
      setContextMenu({ show: false, x: 0, y: 0, channel: null });

      // Eğer silinen kanal aktif kanalsa, genel kanala geç
      if (
        channelToDelete.id === currentTextChannelId ||
        channelToDelete.id === currentVoiceChannelId
      ) {
        const generalChannel = {
          id: "genel",
          name: "genel-sohbet",
          type: "text" as const,
        };
        onChannelSelect(generalChannel);
      }
    } catch (error) {
      console.error("Kanal silme hatası:", error);
    }
  };

  const handleEditChannel = () => {
    if (!contextMenu.channel) return;
    setChannelToEdit(contextMenu.channel);
    setEditChannelName(contextMenu.channel.name);
    setShowEditModal(true);
    setContextMenu({ show: false, x: 0, y: 0, channel: null });
  };

  const handleSaveEdit = async () => {
    if (!channelToEdit || !editChannelName.trim() || !db) return;

    if (!db) return;
    try {
      const name = editChannelName.trim().replace(/\s+/g, "-").toLowerCase();
      await setDoc(
        doc(db, "channels", channelToEdit.id),
        {
          name: name,
        },
        { merge: true }
      );
      setShowEditModal(false);
      setChannelToEdit(null);
      setEditChannelName("");
    } catch (error) {
      console.error("Kanal düzenleme hatası:", error);
    }
  };

  return (
    <>
      <div className="w-72 bg-[#2b2d31] flex flex-col flex-shrink-0 border-r border-[#1f2023] h-full">
        <div className="h-12 flex items-center justify-between px-4 font-bold text-white border-b border-[#1f2023]">
          <div className="flex items-center justify-center flex-1">
            <img
              src="/logo.png"
              alt="Netrex"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                // Fallback if logo doesn't load
                (e.target as HTMLImageElement).style.display = "none";
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.textContent = "Netrex";
                }
              }}
            />
          </div>
          {onToggle && (
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#35373C] transition-colors"
              title="Kanalları Gizle"
            >
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex justify-between items-center px-2 mb-2 mt-2 group">
            <span className="text-xs font-bold text-gray-400 uppercase">
              Kanallar
            </span>
            <i
              onClick={() => setShowCreateModal(true)}
              className="fas fa-plus text-xs text-gray-400 hover:text-white cursor-pointer"
            ></i>
          </div>

          {/* Metin Kanalları */}
          {channels.filter((c) => c.type !== "voice" && c.type !== "dm")
            .length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 mb-1 mt-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Metin Kanalları
                </span>
              </div>
              <ul className="space-y-[2px]">
                {channels
                  .filter(
                    (channel) =>
                      channel.type !== "voice" && channel.type !== "dm"
                  )
                  .map((channel) => {
                    const isActive =
                      channel.id === (currentTextChannelId || currentChannelId);
                    const displayName = getChannelDisplayName(channel);
                    const icon = getChannelIcon(channel);

                    return (
                      <li
                        key={channel.id}
                        onClick={() => onChannelSelect(channel)}
                        onContextMenu={(e) =>
                          handleChannelContextMenu(e, channel)
                        }
                        className={`flex items-center px-2 py-1.5 rounded cursor-pointer mx-2 group ${
                          isActive
                            ? "bg-[#404249] text-white"
                            : "text-[#949BA4] hover:bg-[#35373C] hover:text-gray-200"
                        }`}
                      >
                        <div className="truncate flex items-center flex-1 min-w-0">
                          {icon}
                          <span className="truncate">{displayName}</span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotificationChannelId(channel.id);
                              setShowNotificationSettings(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#404249] rounded transition-opacity"
                            title="Bildirim Ayarları"
                          >
                            <i className="fas fa-bell text-xs text-gray-500 hover:text-gray-300"></i>
                          </button>
                          {(canDeleteChannel(channel) || canEditChannel(channel)) && (
                            <button
                              onClick={(e) => handleEllipsisClick(e, channel)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#404249] rounded transition-opacity"
                              title="Kanal Seçenekleri"
                            >
                              <i className="fas fa-ellipsis-v text-xs text-gray-500 hover:text-gray-300"></i>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}

          {/* Özel Mesajlar */}
          {channels.filter((c) => c.type === "dm").length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between px-2 mb-1 mt-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Özel Mesajlar
                </span>
              </div>
              <ul className="space-y-[2px]">
                {channels
                  .filter((channel) => channel.type === "dm")
                  .map((channel) => {
                    const isActive =
                      channel.id === (currentTextChannelId || currentChannelId);
                    const displayName = getChannelDisplayName(channel);
                    const icon = getChannelIcon(channel);

                    return (
                      <li
                        key={channel.id}
                        onClick={() => onChannelSelect(channel)}
                        className={`flex items-center px-2 py-1.5 rounded cursor-pointer mx-2 group ${
                          isActive
                            ? "bg-[#404249] text-white"
                            : "text-[#949BA4] hover:bg-[#35373C] hover:text-gray-200"
                        }`}
                      >
                        <div className="truncate flex items-center flex-1 min-w-0">
                          {icon}
                          <span className="truncate">{displayName}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotificationChannelId(channel.id);
                            setShowNotificationSettings(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 ml-auto p-1 hover:bg-[#404249] rounded transition-opacity"
                          title="Bildirim Ayarları"
                        >
                          <i className="fas fa-bell text-xs text-gray-500 hover:text-gray-300"></i>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}

          {/* Ses Kanalları */}
          {channels.filter((c) => c.type === "voice").length > 0 && (
            <div>
              <div className="flex items-center justify-between px-2 mb-1 mt-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Ses Kanalları
                </span>
              </div>
              <ul className="space-y-[2px]">
                {channels
                  .filter((channel) => channel.type === "voice")
                  .map((channel) => {
                    const isActive =
                      channel.id ===
                      (currentVoiceChannelId || currentChannelId);
                    const displayName = getChannelDisplayName(channel);
                    const icon = getChannelIcon(channel);
                    const participants = voiceParticipants[channel.id] || [];
                    const isVoiceChannel = channel.type === "voice";

                    return (
                      <li key={channel.id}>
                        <div
                          onClick={() => onChannelSelect(channel)}
                          onContextMenu={(e) =>
                            handleChannelContextMenu(e, channel)
                          }
                          className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer mx-2 group ${
                            isActive
                              ? "bg-[#404249] text-white"
                              : "text-[#949BA4] hover:bg-[#35373C] hover:text-gray-200"
                          }`}
                        >
                          <div className="truncate flex items-center flex-1 min-w-0">
                            {icon}
                            <span className="truncate">{displayName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {channel.bitrate && (
                              <span className="text-[10px] text-gray-500 flex-shrink-0">
                                {channel.bitrate / 1000}k
                              </span>
                            )}
                            {(canDeleteChannel(channel) || canEditChannel(channel)) && (
                              <button
                                onClick={(e) => handleEllipsisClick(e, channel)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#404249] rounded transition-opacity"
                                title="Kanal Seçenekleri"
                              >
                                <i className="fas fa-ellipsis-v text-xs text-gray-500 hover:text-gray-300"></i>
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Sesli kanaldaki katılımcıları göster */}
                        {isVoiceChannel && participants.length > 0 && (
                          <ul className="ml-4 mt-1 space-y-0.5">
                            {participants.map((participant) => {
                              const avatarUrl =
                                participant.photoURL ||
                                generateAvatar(participant.displayName, 20);
                              return (
                                <li
                                  key={participant.uid}
                                  className="flex items-center px-2 py-1 rounded hover:bg-[#35373C] cursor-pointer group/item"
                                >
                                  <img
                                    src={avatarUrl}
                                    alt={participant.displayName}
                                    className="w-4 h-4 rounded-full object-cover mr-2 flex-shrink-0"
                                  />
                                  <span className="text-xs text-gray-400 truncate group-hover/item:text-gray-300">
                                    {participant.displayName}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
        <div className="p-2 bg-[#232428] flex items-center">
          <img
            src={currentUser.photoURL || ""}
            className="w-8 h-8 rounded-full mr-2 bg-gray-600 object-cover"
            alt={currentUser.displayName || ""}
          />
          <div className="flex-1 overflow-hidden">
            <div className="font-semibold text-sm text-white truncate">
              {currentUser.displayName}
            </div>
            <div className="text-[10px] text-gray-400">🟢 Online</div>
          </div>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white p-2"
            title="Çıkış Yap"
          >
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <>
          <div
            className="fixed inset-0 z-[50]"
            onClick={() =>
              setContextMenu({ show: false, x: 0, y: 0, channel: null })
            }
          />
          <div
            className="fixed z-[60] bg-[#2b2d31] border border-[#1e1f22] rounded shadow-lg py-1 min-w-[150px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            {canEditChannel(contextMenu.channel!) && (
              <button
                onClick={handleEditChannel}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#35373C] flex items-center gap-2"
              >
                <i className="fas fa-edit"></i>
                Düzenle
              </button>
            )}
            {canDeleteChannel(contextMenu.channel!) && (
              <button
                onClick={() => {
                  if (contextMenu.channel) {
                    setChannelToDelete(contextMenu.channel);
                    setShowDeleteModal(true);
                    setContextMenu({ show: false, x: 0, y: 0, channel: null });
                  }
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#35373C] flex items-center gap-2"
              >
                <i className="fas fa-trash"></i>
                Kanalı Sil
              </button>
            )}
          </div>
        </>
      )}

      {/* Edit Channel Modal */}
      {showEditModal && channelToEdit && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#313338] rounded p-6 max-w-md w-full border border-[#1e1f22]">
            <h3 className="text-xl font-bold text-white mb-4">Kanalı Düzenle</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Kanal Adı
              </label>
              <input
                type="text"
                value={editChannelName}
                onChange={(e) => setEditChannelName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSaveEdit()}
                className="w-full px-4 py-2 bg-[#1e1f22] border border-[#3f4147] rounded text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]"
                placeholder="Kanal adı"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setChannelToEdit(null);
                  setEditChannelName("");
                }}
                className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white"
              >
                İptal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editChannelName.trim()}
                className="px-4 py-2 rounded bg-[#5865F2] hover:bg-[#4752c4] disabled:bg-gray-600 disabled:cursor-not-allowed text-white"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Channel Modal */}
      {showDeleteModal && channelToDelete && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#313338] rounded p-6 max-w-md w-full border border-[#1e1f22]">
            <h3 className="text-xl font-bold text-white mb-2">Kanalı Sil</h3>
            <p className="text-gray-300 text-sm mb-4">
              <span className="font-semibold">
                {getChannelDisplayName(channelToDelete)}
              </span>{" "}
              kanalını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setChannelToDelete(null);
                }}
                className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white"
              >
                İptal
              </button>
              <button
                onClick={handleDeleteChannel}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded p-6 w-80 shadow-lg">
            <h3 className="font-bold text-white mb-4 text-xs uppercase text-gray-400">
              Kanal Oluştur
            </h3>
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setChannelType("text")}
                className={`flex-1 px-4 py-2 rounded text-sm ${
                  channelType === "text"
                    ? "bg-[#5865F2] text-white"
                    : "bg-[#1e1f22] text-gray-400 hover:text-white"
                }`}
              >
                <i className="fas fa-hashtag mr-2"></i> Metin
              </button>
              <button
                onClick={() => setChannelType("voice")}
                className={`flex-1 px-4 py-2 rounded text-sm ${
                  channelType === "voice"
                    ? "bg-[#5865F2] text-white"
                    : "bg-[#1e1f22] text-gray-400 hover:text-white"
                }`}
              >
                <i className="fas fa-volume-up mr-2"></i> Sesli
              </button>
            </div>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreateChannel()}
              className="bg-[#1e1f22] rounded p-2 w-full text-white mb-4 focus:outline-none"
              placeholder={
                channelType === "voice" ? "Sesli kanal adı" : "#yeni-kanal"
              }
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewChannelName("");
                  setChannelType("text");
                }}
                className="text-sm text-white hover:underline"
              >
                İptal
              </button>
              <button
                onClick={handleCreateChannel}
                className="bg-[#5865F2] text-white px-4 py-2 rounded text-sm"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        show={showNotificationSettings}
        onClose={() => {
          setShowNotificationSettings(false);
          setNotificationChannelId(null);
        }}
        currentUser={currentUser}
        channelId={notificationChannelId}
        channelName={
          notificationChannelId
            ? channels.find((c) => c.id === notificationChannelId)?.name
            : undefined
        }
      />
    </>
  );
}

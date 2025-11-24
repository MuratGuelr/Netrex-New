'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import { Room } from 'livekit-client';
import { User } from 'firebase/auth';
import { Track } from 'livekit-client';
import { generateAvatar } from '@/utils/avatarGenerator';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface VoiceChannelProps {
  currentUser: User;
  roomName: string;
  channelId: string;
  onLeave: () => void;
}

function VoiceControls({ onDeafenChange }: { onDeafenChange?: (deafened: boolean) => void }) {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  useEffect(() => {
    if (!localParticipant) return;

    const updateMuteState = () => {
      try {
        const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
        setIsMuted(micTrack?.isMuted ?? false);
      } catch (error) {
        console.error('Error updating mute state:', error);
      }
    };

    updateMuteState();

    const handleTrackPublished = (publication: any) => {
      if (publication?.source === Track.Source.Microphone) {
        setTimeout(updateMuteState, 100);
      }
    };
    
    const handleTrackUnpublished = (publication: any) => {
      if (publication?.source === Track.Source.Microphone) {
        setTimeout(updateMuteState, 100);
      }
    };

    const handleTrackMuted = () => {
      updateMuteState();
    };

    const handleTrackUnmuted = () => {
      updateMuteState();
    };

    localParticipant.on('trackPublished', handleTrackPublished);
    localParticipant.on('trackUnpublished', handleTrackUnpublished);
    localParticipant.on('trackMuted', handleTrackMuted);
    localParticipant.on('trackUnmuted', handleTrackUnmuted);

    return () => {
      localParticipant.off('trackPublished', handleTrackPublished);
      localParticipant.off('trackUnpublished', handleTrackUnpublished);
      localParticipant.off('trackMuted', handleTrackMuted);
      localParticipant.off('trackUnmuted', handleTrackUnmuted);
    };
  }, [localParticipant]);

  const toggleMute = async () => {
    if (!localParticipant) return;
    try {
      const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
      const isCurrentlyMuted = micTrack?.isMuted ?? false;
      
      // Ters mantık: eğer muted ise unmute et, değilse mute et
      await localParticipant.setMicrophoneEnabled(isCurrentlyMuted);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const toggleDeafen = async () => {
    const newDeafenedState = !isDeafened;
    setIsDeafened(newDeafenedState);
    
    // Parent component'e deafen durumunu bildir
    onDeafenChange?.(newDeafenedState);
    
    // Deafen durumunda hem mute et hem de ses seviyesini 0 yap
    if (newDeafenedState) {
      // Deafen olduğunda mute et
      await localParticipant?.setMicrophoneEnabled(false);
    } else {
      // Deafen kaldırıldığında unmute et
      await localParticipant?.setMicrophoneEnabled(true);
    }
  };

  if (!localParticipant) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        className={`p-2.5 rounded-lg transition-all duration-200 ${
          isMuted
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
            : 'bg-[#2b2d31] hover:bg-[#35373C] text-gray-300 hover:text-white'
        }`}
        title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
      >
        <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-sm`}></i>
      </button>
      <button
        onClick={toggleDeafen}
        className={`p-2.5 rounded-lg transition-all duration-200 ${
          isDeafened
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
            : 'bg-[#2b2d31] hover:bg-[#35373C] text-gray-300 hover:text-white'
        }`}
        title={isDeafened ? 'Sesi Aç' : 'Sesi Kapat'}
      >
        <i className={`fas ${isDeafened ? 'fa-volume-mute' : 'fa-volume-up'} text-sm`}></i>
      </button>
    </div>
  );
}

function ParticipantItem({
  participant,
  isLocal,
  currentUser,
}: {
  participant: any;
  isLocal: boolean;
  currentUser: User;
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!participant) return;

    const updateMuteState = () => {
      try {
        const micTrack = participant.getTrackPublication(Track.Source.Microphone);
        setIsMuted(micTrack?.isMuted ?? true);
      } catch (error) {
        console.error('Error updating participant mute state:', error);
      }
    };

    const updateSpeakingState = () => {
      try {
        const audioTrack = participant.getTrackPublication(Track.Source.Microphone)?.track;
        if (audioTrack && 'isMuted' in audioTrack) {
          // Speaking detection için audio level kontrolü
          // Bu basit bir implementasyon, gerçek speaking detection için daha gelişmiş yöntemler kullanılabilir
        }
      } catch (error) {
        // Ignore
      }
    };

    updateMuteState();

    const handleTrackPublished = (publication: any) => {
      if (publication?.source === Track.Source.Microphone) {
        setTimeout(updateMuteState, 100);
      }
    };
    
    const handleTrackUnpublished = (publication: any) => {
      if (publication?.source === Track.Source.Microphone) {
        setTimeout(updateMuteState, 100);
      }
    };

    const handleTrackMuted = () => {
      updateMuteState();
    };

    const handleTrackUnmuted = () => {
      updateMuteState();
    };

    participant.on('trackPublished', handleTrackPublished);
    participant.on('trackUnpublished', handleTrackUnpublished);
    participant.on('trackMuted', handleTrackMuted);
    participant.on('trackUnmuted', handleTrackUnmuted);

    return () => {
      participant.off('trackPublished', handleTrackPublished);
      participant.off('trackUnpublished', handleTrackUnpublished);
      participant.off('trackMuted', handleTrackMuted);
      participant.off('trackUnmuted', handleTrackUnmuted);
    };
  }, [participant]);

  if (!participant) return null;

  // Participant name'i al - token'da name olarak gönderiliyor
  let displayName = participant.name || participant.identity || '';
  
  // Eğer name yoksa veya unique identity formatındaysa, identity'den username çıkar
  if (!displayName || displayName.includes('-')) {
    // Identity formatı: "username-timestamp-random" şeklinde
    const parts = participant.identity?.split('-') || [];
    if (parts.length > 0 && parts[0]) {
      displayName = parts[0];
    } else {
      displayName = isLocal ? (currentUser.displayName || currentUser.email?.split('@')[0] || 'Sen') : 'Kullanıcı';
    }
  }
  
  // Local participant için currentUser bilgilerini kullan
  if (isLocal) {
    displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Sen';
  }
  
  const avatarUrl = isLocal
    ? currentUser.photoURL || generateAvatar(displayName, 40)
    : generateAvatar(displayName, 40);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 transition-all duration-200 ${
        isSpeaking
          ? 'bg-[#2b2d31] border-l-2 border-[#5865F2] shadow-sm'
          : 'hover:bg-[#2b2d31]'
      }`}
    >
      <div className="relative flex-shrink-0">
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
        {isMuted && (
          <div className="absolute -bottom-1 -right-1 bg-[#1e1f22] rounded-full p-1 shadow-md">
            <i className="fas fa-microphone-slash text-xs text-red-500"></i>
          </div>
        )}
        {isSpeaking && !isMuted && (
          <div className="absolute inset-0 rounded-full border-2 border-[#5865F2] animate-pulse"></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-200 truncate">{displayName}</div>
        {isLocal && <div className="text-xs text-gray-400">Sen</div>}
      </div>
      {isMuted && (
        <div className="text-gray-500 flex-shrink-0">
          <i className="fas fa-microphone-slash text-sm"></i>
        </div>
      )}
    </div>
  );
}

function VoiceChannelContent({
  currentUser,
  roomName,
  channelId,
  onLeave,
  bitrate,
  onBitrateChange,
}: VoiceChannelProps & { bitrate: number; onBitrateChange: (bitrate: number) => void }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const remoteParticipants = participants.filter((p) => !p.isLocal);
  const [showBitrateModal, setShowBitrateModal] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('');
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);
  const [audioThreshold, setAudioThreshold] = useState(50); // 0-100 arası
  const [microphoneGain, setMicrophoneGain] = useState(100); // 0-200 arası mikrofon ses seviyesi
  const [showKeyboardShortcutsModal, setShowKeyboardShortcutsModal] = useState(false);
  // Klavye kısayolu formatı: { key: string, code?: string, ctrl?: boolean, shift?: boolean, alt?: boolean, meta?: boolean }
  // veya basit string formatı: "m", "ShiftLeft+m", "CtrlRight+ArrowUp" gibi
  const [keyboardShortcuts, setKeyboardShortcuts] = useState<{
    mute: string | { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean };
    deafen: string | { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean };
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voiceChannelKeyboardShortcuts');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // Fallback to defaults
        }
      }
    }
    return { mute: 'm', deafen: 'd' };
  });
  const [capturingKey, setCapturingKey] = useState<'mute' | 'deafen' | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const microphoneGainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isUpdatingTrackRef = useRef(false);
  const roomEventListenersRef = useRef<Array<{ event: string; handler: any }>>([]);
  const currentAudioTrackRef = useRef<MediaStreamTrack | null>(null);

  const handleBitrateChange = async (newBitrate: number) => {
    try {
      if (db) {
        const channelRef = doc(db, 'channels', channelId);
        await updateDoc(channelRef, { bitrate: newBitrate });
        onBitrateChange(newBitrate);
        setShowBitrateModal(false);
      }
    } catch (error) {
      console.error('Error updating bitrate:', error);
    }
  };

  // Ses cihazlarını yükle
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) return;
    
    const loadDevices = async () => {
      try {
        // Önce mikrofon izni al (cihaz isimlerini görmek için)
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === 'audioinput');
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        
        setAudioInputDevices(inputs);
        setAudioOutputDevices(outputs);

        // Varsayılan cihazları bul
        const defaultInput = inputs.find((d) => d.deviceId === 'default') || inputs[0];
        const defaultOutput = outputs.find((d) => d.deviceId === 'default') || outputs[0];
        
        if (defaultInput && !selectedInputDevice) setSelectedInputDevice(defaultInput.deviceId);
        if (defaultOutput && !selectedOutputDevice) setSelectedOutputDevice(defaultOutput.deviceId);
      } catch (error) {
        console.error('Error loading devices:', error);
      }
    };

    loadDevices();

    // Cihaz değişikliklerini dinle
    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      if (typeof window !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AudioContext ve ses eşiği için cleanup
  useEffect(() => {
    return () => {
      // Cleanup audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Event listener'ları temizle
      if (room) {
        roomEventListenersRef.current.forEach(({ event, handler }) => {
          try {
            (room as any).off(event, handler);
          } catch (e) {
            // Ignore
          }
        });
        roomEventListenersRef.current = [];
      }
    };
  }, [room]);

  // Mikrofon cihazını değiştir
  const handleInputDeviceChange = async (deviceId: string) => {
    // Eğer zaten bir güncelleme yapılıyorsa, yeni isteği bekle
    if (isUpdatingTrackRef.current) {
      return;
    }

    try {
      isUpdatingTrackRef.current = true;
      setSelectedInputDevice(deviceId);
      
      if (!localParticipant) {
        isUpdatingTrackRef.current = false;
        return;
      }
      
      // Mevcut mikrofon track'ini durdur ve temizle
      const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (micTrack) {
        const track = micTrack.track;
        if (track) {
          // Track'i unpublish et
          await localParticipant.unpublishTrack(track);
          
          // MediaStreamTrack'i durdur
          if (track instanceof MediaStreamTrack) {
            track.stop();
          } else if (track.mediaStreamTrack) {
            track.mediaStreamTrack.stop();
          }
        }
      }

      // Eski audio context'i temizle
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Yeni cihazla mikrofonu aç
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        isUpdatingTrackRef.current = false;
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });

      mediaStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      
      if (audioTrack && localParticipant) {
        // AudioContext oluştur ve ses eşiği uygula
        try {
          if (typeof window === 'undefined') {
            isUpdatingTrackRef.current = false;
            return;
          }
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioContext;
          
          const source = audioContext.createMediaStreamSource(stream);
          analyserRef.current = audioContext.createAnalyser();
          analyserRef.current.fftSize = 256;
          
          // Ses eşiği için gain node
          gainNodeRef.current = audioContext.createGain();
          const thresholdGain = audioThreshold / 50;
          gainNodeRef.current.gain.value = thresholdGain;
          
          // Mikrofon ses seviyesi için gain node
          microphoneGainNodeRef.current = audioContext.createGain();
          const micGain = microphoneGain / 100; // 0-200 -> 0-2 aralığı
          microphoneGainNodeRef.current.gain.value = micGain;
          
          // Yeni stream oluştur (gain node'lardan sonra)
          const processedStream = audioContext.createMediaStreamDestination();
          
          // Bağlantıları yap: source -> mic gain -> threshold gain -> analyser -> destination
          source.connect(microphoneGainNodeRef.current);
          microphoneGainNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(analyserRef.current);
          gainNodeRef.current.connect(processedStream);
          
          // Processed stream'den track al ve referansı sakla
          const processedTrack = processedStream.stream.getAudioTracks()[0];
          currentAudioTrackRef.current = processedTrack;
          
          // Önce mevcut track'i tamamen temizle
          const existingMicTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
          if (existingMicTrack && existingMicTrack.track) {
            try {
              await localParticipant.unpublishTrack(existingMicTrack.track);
            } catch (e) {
              // Ignore if already unpublished
            }
          }
          
          // Kısa bir gecikme ekle (track temizleme için)
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await localParticipant.publishTrack(processedTrack, {
            source: Track.Source.Microphone,
          });
        } catch (audioContextError) {
          // AudioContext hatası durumunda direkt track'i publish et
          console.warn('AudioContext kullanılamadı, direkt track publish ediliyor:', audioContextError);
          
          // Önce mevcut track'i temizle
          const existingMicTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
          if (existingMicTrack && existingMicTrack.track) {
            try {
              await localParticipant.unpublishTrack(existingMicTrack.track);
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
              // Ignore
            }
          }
          
          await localParticipant.publishTrack(audioTrack, {
            source: Track.Source.Microphone,
          });
        }
      }
    } catch (error) {
      console.error('Error changing input device:', error);
    } finally {
      isUpdatingTrackRef.current = false;
    }
  };

  // Hoparlör cihazını değiştir
  const handleOutputDeviceChange = async (deviceId: string) => {
    try {
      setSelectedOutputDevice(deviceId);
      
      if (typeof document === 'undefined') return;
      
      // HTMLAudioElement'lerin sinkId'sini değiştir
      const audioElements = document.querySelectorAll('audio');
      for (const audio of audioElements) {
        if ('setSinkId' in audio) {
          try {
            await (audio as any).setSinkId(deviceId);
          } catch (err) {
            console.error('Error setting sink ID:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error changing output device:', error);
    }
  };

  // Ses işleme ayarlarını güncelle
  const handleAudioProcessingChange = async (setting: 'noiseSuppression' | 'echoCancellation' | 'autoGainControl', value: boolean) => {
    // State'i güncelle
    if (setting === 'noiseSuppression') {
      setNoiseSuppression(value);
    } else if (setting === 'echoCancellation') {
      setEchoCancellation(value);
    } else if (setting === 'autoGainControl') {
      setAutoGainControl(value);
    }

    // Mikrofonu yeniden başlat (sadece cihaz değiştiğinde)
    if (selectedInputDevice && localParticipant && !isUpdatingTrackRef.current) {
      await handleInputDeviceChange(selectedInputDevice);
    }
  };

  // Ses eşiği değiştiğinde gain node'u güncelle (gerçek zamanlı)
  // Not: Bu useEffect slider onChange'den sonra çalışır, bu yüzden slider'da direkt güncelleme yapıyoruz
  // useEffect sadece yedek olarak kalıyor
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      const thresholdGain = Math.max(0.001, audioThreshold / 50);
      const currentTime = audioContextRef.current.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(currentTime);
      gainNodeRef.current.gain.setValueAtTime(thresholdGain, currentTime);
    }
  }, [audioThreshold]);

  // Mikrofon ses seviyesi değiştiğinde gain node'u güncelle (gerçek zamanlı)
  // Not: Bu useEffect slider onChange'den sonra çalışır, bu yüzden slider'da direkt güncelleme yapıyoruz
  // useEffect sadece yedek olarak kalıyor
  useEffect(() => {
    if (microphoneGainNodeRef.current && audioContextRef.current) {
      const micGain = Math.max(0.001, microphoneGain / 100);
      const currentTime = audioContextRef.current.currentTime;
      microphoneGainNodeRef.current.gain.cancelScheduledValues(currentTime);
      microphoneGainNodeRef.current.gain.setValueAtTime(micGain, currentTime);
    }
  }, [microphoneGain]);

  // Klavye kısayollarını localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('voiceChannelKeyboardShortcuts', JSON.stringify(keyboardShortcuts));
    }
  }, [keyboardShortcuts]);

  // Menü dışına tıklandığında kapat
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.settings-menu-container')) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSettingsMenu]);

  // Klavye kısayolu formatını parse et
  const parseShortcut = useCallback((shortcut: string | { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }) => {
    if (typeof shortcut === 'object') {
      return shortcut;
    }
    
    // String formatını parse et: "ShiftLeft+m", "CtrlRight+ArrowUp", "m" gibi
    const parts = shortcut.split('+');
    if (parts.length === 1) {
      return { key: parts[0].toLowerCase() };
    }
    
    const modifiers: { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = { key: parts[parts.length - 1].toLowerCase() };
    
    for (let i = 0; i < parts.length - 1; i++) {
      const mod = parts[i].toLowerCase();
      if (mod.includes('ctrl') || mod.includes('control')) {
        modifiers.ctrl = true;
        if (mod.includes('left')) modifiers.code = 'ControlLeft';
        else if (mod.includes('right')) modifiers.code = 'ControlRight';
      } else if (mod.includes('shift')) {
        modifiers.shift = true;
        if (mod.includes('left')) modifiers.code = 'ShiftLeft';
        else if (mod.includes('right')) modifiers.code = 'ShiftRight';
      } else if (mod.includes('alt')) {
        modifiers.alt = true;
        if (mod.includes('left')) modifiers.code = 'AltLeft';
        else if (mod.includes('right')) modifiers.code = 'AltRight';
      } else if (mod.includes('meta') || mod.includes('cmd') || mod.includes('win')) {
        modifiers.meta = true;
        if (mod.includes('left')) modifiers.code = 'MetaLeft';
        else if (mod.includes('right')) modifiers.code = 'MetaRight';
      }
    }
    
    return modifiers;
  }, []);

  // Klavye kısayolunu string formatına çevir
  const formatShortcut = useCallback((shortcut: string | { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }): string => {
    if (typeof shortcut === 'string') {
      return shortcut;
    }
    
    const parts: string[] = [];
    if (shortcut.ctrl) {
      if (shortcut.code === 'ControlLeft') parts.push('CtrlLeft');
      else if (shortcut.code === 'ControlRight') parts.push('CtrlRight');
      else parts.push('Ctrl');
    }
    if (shortcut.shift) {
      if (shortcut.code === 'ShiftLeft') parts.push('ShiftLeft');
      else if (shortcut.code === 'ShiftRight') parts.push('ShiftRight');
      else parts.push('Shift');
    }
    if (shortcut.alt) {
      if (shortcut.code === 'AltLeft') parts.push('AltLeft');
      else if (shortcut.code === 'AltRight') parts.push('AltRight');
      else parts.push('Alt');
    }
    if (shortcut.meta) {
      if (shortcut.code === 'MetaLeft') parts.push('MetaLeft');
      else if (shortcut.code === 'MetaRight') parts.push('MetaRight');
      else parts.push('Meta');
    }
    parts.push(shortcut.key);
    
    return parts.join('+');
  }, []);

  // Klavye kısayolunu kontrol et
  const checkShortcut = useCallback((
    event: KeyboardEvent,
    shortcut: string | { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }
  ): boolean => {
    const parsed = parseShortcut(shortcut);
    const key = event.key.toLowerCase();
    const code = event.code.toLowerCase();
    const parsedKey = parsed.key.toLowerCase();
    const parsedCode = parsed.code?.toLowerCase() || '';
    
    // Ana tuş kontrolü
    // 1. Key ile direkt eşleşme
    // 2. Code ile eşleşme (KeyM -> m, Digit1 -> 1, ArrowUp -> arrowup)
    // 3. Modifier tuşlar için code kontrolü
    const keyMatch = key === parsedKey;
    const codeMatch = code === parsedCode || 
                      code.replace(/^(key|digit|numpad)/, '') === parsedKey ||
                      (parsedCode && code.includes(parsedCode.replace(/left|right/, '')));
    
    // Modifier tuşlar için özel kontrol
    const isModifierKey = ['control', 'shift', 'alt', 'meta'].some(m => parsedKey.includes(m));
    if (isModifierKey) {
      // Modifier tuş için code kontrolü
      if (parsedCode) {
        if (code !== parsedCode) return false;
      } else {
        // Code belirtilmemişse, herhangi bir modifier tuşu kabul et
        if (!keyMatch && !code.includes(parsedKey)) return false;
      }
    } else {
      // Normal tuş için
      if (!keyMatch && !codeMatch) {
        return false;
      }
    }
    
    // Modifier kontrolleri - eğer shortcut'ta belirtilmişse kontrol et
    if (parsed.ctrl === true && !(event.ctrlKey || event.metaKey)) {
      return false;
    }
    if (parsed.ctrl === false && (event.ctrlKey || event.metaKey)) {
      return false;
    }
    
    if (parsed.shift === true && !event.shiftKey) {
      return false;
    }
    if (parsed.shift === false && event.shiftKey) {
      return false;
    }
    
    if (parsed.alt === true && !event.altKey) {
      return false;
    }
    if (parsed.alt === false && event.altKey) {
      return false;
    }
    
    if (parsed.meta === true && !event.metaKey) {
      return false;
    }
    if (parsed.meta === false && event.metaKey) {
      return false;
    }
    
    // Sağ/sol ayrımı kontrolü (eğer belirtilmişse)
    if (parsed.code) {
      const location = event.location;
      if (parsed.code.includes('Left') && location !== 1) return false;
      if (parsed.code.includes('Right') && location !== 2) return false;
    }
    
    return true;
  }, [parseShortcut]);

  // Klavye kısayolları
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Klavye kısayolu yakalama modunda ise
      if (capturingKey) {
        event.preventDefault();
        
        // Tüm tuşları yakala (modifier tuşlar dahil)
        const key = event.key;
        const code = event.code;
        
        // Modifier tuşlar için özel işleme
        const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].some(m => key.includes(m));
        
        // Tüm tuşları yakala (modifier tuşlar dahil)
        const shortcut: { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {
          key: key.toLowerCase(),
        };
        
        // Basılan tuşun kendisi bir modifier tuşu mu?
        const isModifierKey = ['Control', 'Shift', 'Alt', 'Meta'].some(m => key.includes(m));
        
        if (isModifierKey) {
          // Modifier tuşun kendisi basıldıysa, code'u sakla
          shortcut.code = code;
          if (key.includes('Control')) shortcut.ctrl = true;
          if (key.includes('Shift')) shortcut.shift = true;
          if (key.includes('Alt')) shortcut.alt = true;
          if (key.includes('Meta')) shortcut.meta = true;
        } else {
          // Normal tuş + modifier kombinasyonu
          // Basılı modifier tuşları kontrol et ve code'u belirle
          if (event.ctrlKey) {
            shortcut.ctrl = true;
            // Ctrl tuşunun hangi tarafı basılı?
            if (code.includes('ControlLeft')) {
              shortcut.code = 'ControlLeft';
            } else if (code.includes('ControlRight')) {
              shortcut.code = 'ControlRight';
            } else {
              // Ctrl tuşu basılı ama hangi taraf olduğunu bilmiyoruz
              // Bu durumda code belirtmeyiz, sadece ctrl: true yeterli
            }
          }
          if (event.shiftKey) {
            shortcut.shift = true;
            // Shift tuşunun hangi tarafı basılı?
            // Not: Shift basılıyken normal tuşun code'u değişmez, sadece key değişir
            // Shift tuşunun code'unu bulmak için event'teki location'ı kullanabiliriz
            // Ama bu bilgi event'te yok, bu yüzden code'u belirtmeyiz
            // Kullanıcı ShiftLeft+M basarsa, shortcut { key: "m", shift: true } olur
            // ShiftRight+M basarsa da aynı olur
            // Eğer sağ/sol ayrımı önemliyse, kullanıcı sadece Shift tuşuna basmalı
          }
          if (event.altKey) {
            shortcut.alt = true;
            if (code.includes('AltLeft')) {
              shortcut.code = 'AltLeft';
            } else if (code.includes('AltRight')) {
              shortcut.code = 'AltRight';
            }
          }
          if (event.metaKey) {
            shortcut.meta = true;
            if (code.includes('MetaLeft')) {
              shortcut.code = 'MetaLeft';
            } else if (code.includes('MetaRight')) {
              shortcut.code = 'MetaRight';
            }
          }
          
          // Eğer modifier tuşların code'u belirtilmişse, onu sakla
          // Örneğin, ShiftLeft tuşuna basıldıysa ve sonra M'ye basıldıysa
          // Ama bu durumda event'te sadece M tuşu gelir, ShiftLeft'in code'u gelmez
          // Bu yüzden, eğer kullanıcı sağ/sol ayrımı istiyorsa, sadece modifier tuşuna basmalı
        }
        
        setKeyboardShortcuts(prev => ({
          ...prev,
          [capturingKey]: shortcut
        }));
        setCapturingKey(null);
        return;
      }

      // Input alanlarında kısayolları devre dışı bırak
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Mute/Unmute kısayolu
      if (checkShortcut(event, keyboardShortcuts.mute)) {
        event.preventDefault();
        if (localParticipant) {
          const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
          const isCurrentlyMuted = micTrack?.isMuted ?? false;
          localParticipant.setMicrophoneEnabled(isCurrentlyMuted).catch(console.error);
        }
      }

      // Deafen/Undeafen kısayolu
      if (checkShortcut(event, keyboardShortcuts.deafen)) {
        event.preventDefault();
        const newDeafenedState = !isDeafened;
        setIsDeafened(newDeafenedState);
        
        if (localParticipant) {
          // Deafen durumunda mikrofonu kapat, undeafen durumunda aç
          localParticipant.setMicrophoneEnabled(!newDeafenedState).catch(console.error);
        }
        
        // Remote audio track'leri mute/unmute et
        if (room) {
          remoteParticipants.forEach((participant) => {
            try {
              const audioTrack = participant.getTrackPublication(Track.Source.Microphone)?.track;
              if (audioTrack && audioTrack.mediaStreamTrack) {
                audioTrack.mediaStreamTrack.enabled = !newDeafenedState;
              }
            } catch (error) {
              // Ignore
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [localParticipant, isDeafened, keyboardShortcuts, capturingKey, room, remoteParticipants, checkShortcut]);

  // Deafen durumunda remote audio track'leri mute et
  useEffect(() => {
    if (!room) return;

    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      try {
        if (track && track.kind === 'audio' && !participant.isLocal && isDeafened) {
          // Deafen durumunda remote audio'yu mute et
          if (track.mediaStreamTrack) {
            track.mediaStreamTrack.enabled = false;
          }
        }
      } catch (error) {
        // Ignore subscription errors
        console.debug('Track subscription handler error:', error);
      }
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      // Cleanup - no action needed
    };

    // Önceki listener'ları temizle
    roomEventListenersRef.current.forEach(({ event, handler }) => {
      try {
        (room as any).off(event, handler);
      } catch (e) {
        // Ignore
      }
    });
    roomEventListenersRef.current = [];

    // Yeni listener'ları ekle
    room.on('trackSubscribed', handleTrackSubscribed);
    room.on('trackUnsubscribed', handleTrackUnsubscribed);
    
    roomEventListenersRef.current.push(
      { event: 'trackSubscribed', handler: handleTrackSubscribed },
      { event: 'trackUnsubscribed', handler: handleTrackUnsubscribed }
    );

    // Mevcut remote track'leri güncelle
    remoteParticipants.forEach((participant) => {
      try {
        const audioTrack = participant.getTrackPublication(Track.Source.Microphone)?.track;
        if (audioTrack && audioTrack.mediaStreamTrack) {
          audioTrack.mediaStreamTrack.enabled = !isDeafened;
        }
      } catch (error) {
        // Ignore
      }
    });

    return () => {
      roomEventListenersRef.current.forEach(({ event, handler }) => {
        try {
          (room as any).off(event, handler);
        } catch (e) {
          // Ignore
        }
      });
      roomEventListenersRef.current = [];
    };
  }, [room, isDeafened, remoteParticipants]);

  return (
    <div className="flex flex-col h-full bg-[#313338]">
      <RoomAudioRenderer />

      {/* Header */}
      <div className="h-14 border-b border-[#26272d] flex items-center px-4 bg-[#313338] shadow-sm">
        <i className="fas fa-volume-up text-gray-400 mr-3 text-lg"></i>
        <div className="flex-1">
          <h3 className="font-semibold text-white text-base">{roomName}</h3>
          <div className="text-xs text-gray-400 mt-0.5">
            {participants.length} {participants.length === 1 ? 'üye' : 'üye'}
          </div>
        </div>
        <button
          onClick={() => setShowBitrateModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#2b2d31] rounded-lg hover:bg-[#35373C] transition cursor-pointer"
          title="Bitrate Ayarları"
        >
          <i className="fas fa-signal text-xs text-gray-400"></i>
          <span className="text-xs font-medium text-gray-300">{bitrate / 1000}kbps</span>
          <i className="fas fa-cog text-xs text-gray-500 ml-1"></i>
        </button>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {localParticipant && (
          <div className="mb-3">
            <div className="text-xs font-bold text-gray-400 uppercase px-2 mb-2 tracking-wider">
              Sen
            </div>
            <ParticipantItem
              participant={localParticipant}
              isLocal={true}
              currentUser={currentUser}
            />
          </div>
        )}

        {remoteParticipants.length > 0 && (
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase px-2 mb-2 tracking-wider">
              Üyeler — {remoteParticipants.length}
            </div>
            {remoteParticipants.map((participant) => (
              <ParticipantItem
                key={participant.identity}
                participant={participant}
                isLocal={false}
                currentUser={currentUser}
              />
            ))}
          </div>
        )}

        {participants.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <i className="fas fa-users text-5xl mb-4 opacity-30"></i>
              <p className="text-sm">Henüz kimse yok</p>
              <p className="text-xs mt-1 opacity-70">İlk sen ol!</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls - Discord Style */}
      <div className="bg-[#2b2d31] border-t border-[#1f2023] p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={
                currentUser.photoURL ||
                generateAvatar(currentUser.displayName || 'User', 40)
              }
              alt={currentUser.displayName || 'User'}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-md"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {currentUser.displayName || 'Kullanıcı'}
              </div>
              <div className="text-xs text-gray-400">Sesli kanalda</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <VoiceControls onDeafenChange={setIsDeafened} />

          <div className="flex-1"></div>

          {/* Settings Menu Button */}
          <div className="relative settings-menu-container">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373C] text-gray-300 hover:text-white transition-all duration-200"
              title="Ses Ayarları"
            >
              <i className="fas fa-cog text-sm"></i>
            </button>

            {/* Settings Dropdown Menu */}
            {showSettingsMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#2b2d31] rounded-lg shadow-xl border border-[#1f2023] z-50">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white text-sm">Ses Ayarları</h3>
                    <button
                      onClick={() => setShowSettingsMenu(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>

                  {/* Mikrofon Seçimi */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      <i className="fas fa-microphone mr-2"></i>Mikrofon
                    </label>
                    <select
                      value={selectedInputDevice}
                      onChange={(e) => handleInputDeviceChange(e.target.value)}
                      className="w-full bg-[#1e1f22] text-white text-sm rounded-lg px-3 py-2 border border-[#35373C] focus:outline-none focus:border-[#5865F2]"
                    >
                      {audioInputDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Mikrofon ${audioInputDevices.indexOf(device) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hoparlör Seçimi */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      <i className="fas fa-volume-up mr-2"></i>Hoparlör
                    </label>
                    <select
                      value={selectedOutputDevice}
                      onChange={(e) => handleOutputDeviceChange(e.target.value)}
                      className="w-full bg-[#1e1f22] text-white text-sm rounded-lg px-3 py-2 border border-[#35373C] focus:outline-none focus:border-[#5865F2]"
                    >
                      {audioOutputDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Hoparlör ${audioOutputDevices.indexOf(device) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-[#35373C] my-4"></div>

                  {/* Ses İşleme Ayarları */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">Gürültü Azaltma</div>
                        <div className="text-xs text-gray-400">Arka plan gürültüsünü azaltır</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noiseSuppression}
                          onChange={(e) => handleAudioProcessingChange('noiseSuppression', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#1e1f22] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">Yankı İptali</div>
                        <div className="text-xs text-gray-400">Echo ve geri bildirimi önler</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={echoCancellation}
                          onChange={(e) => handleAudioProcessingChange('echoCancellation', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#1e1f22] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">Otomatik Ses Kontrolü</div>
                        <div className="text-xs text-gray-400">Ses seviyesini otomatik ayarlar</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoGainControl}
                          onChange={(e) => handleAudioProcessingChange('autoGainControl', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#1e1f22] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-[#35373C] my-4"></div>

                  {/* Mikrofon Ses Seviyesi */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white">Mikrofon Ses Seviyesi</div>
                        <div className="text-xs text-gray-400">Mikrofon çıkış ses seviyesi</div>
                      </div>
                      <span className="text-xs font-medium text-gray-300">{microphoneGain}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={microphoneGain}
                      onChange={(e) => {
                        const newValue = Number(e.target.value);
                        setMicrophoneGain(newValue);
                        // Gain node'u gerçek zamanlı güncelle
                        if (microphoneGainNodeRef.current && audioContextRef.current) {
                          const micGain = Math.max(0.001, newValue / 100);
                          const currentTime = audioContextRef.current.currentTime;
                          microphoneGainNodeRef.current.gain.cancelScheduledValues(currentTime);
                          microphoneGainNodeRef.current.gain.setValueAtTime(micGain, currentTime);
                        }
                      }}
                      className="w-full h-2 bg-[#1e1f22] rounded-lg appearance-none cursor-pointer accent-[#5865F2]"
                      style={{
                        background: `linear-gradient(to right, #5865F2 0%, #5865F2 ${microphoneGain / 2}%, #1e1f22 ${microphoneGain / 2}%, #1e1f22 100%)`
                      }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>0%</span>
                      <span>100%</span>
                      <span>200%</span>
                    </div>
                  </div>

                  <div className="border-t border-[#35373C] my-4"></div>

                  {/* Ses Eşiği (Threshold) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white">Ses Eşiği</div>
                        <div className="text-xs text-gray-400">Mikrofon hassasiyeti</div>
                      </div>
                      <span className="text-xs font-medium text-gray-300">{audioThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={audioThreshold}
                      onChange={(e) => {
                        const newValue = Number(e.target.value);
                        setAudioThreshold(newValue);
                        // Gain node'u gerçek zamanlı güncelle
                        if (gainNodeRef.current && audioContextRef.current) {
                          const thresholdGain = Math.max(0.001, newValue / 50);
                          const currentTime = audioContextRef.current.currentTime;
                          gainNodeRef.current.gain.cancelScheduledValues(currentTime);
                          gainNodeRef.current.gain.setValueAtTime(thresholdGain, currentTime);
                        }
                      }}
                      className="w-full h-2 bg-[#1e1f22] rounded-lg appearance-none cursor-pointer accent-[#5865F2]"
                      style={{
                        background: `linear-gradient(to right, #5865F2 0%, #5865F2 ${audioThreshold}%, #1e1f22 ${audioThreshold}%, #1e1f22 100%)`
                      }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Düşük</span>
                      <span>Yüksek</span>
                    </div>
                  </div>

                  {/* Klavye Kısayolları */}
                  <div className="border-t border-[#35373C] my-4"></div>
                  <div className="text-xs text-gray-400">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-300">Klavye Kısayolları</div>
                      <button
                        onClick={() => {
                          setShowSettingsMenu(false);
                          setShowKeyboardShortcutsModal(true);
                        }}
                        className="text-[#5865F2] hover:text-[#4752c4] text-xs"
                      >
                        Özelleştir
                      </button>
                    </div>
                    <div className="space-y-1">
                      <div>
                        <kbd className="px-1.5 py-0.5 bg-[#1e1f22] rounded text-[10px]">
                          {formatShortcut(keyboardShortcuts.mute).split('+').map((k, i) => (
                            <span key={i}>
                              {i > 0 && <span className="mx-0.5">+</span>}
                              {k.charAt(0).toUpperCase() + k.slice(1)}
                            </span>
                          ))}
                        </kbd> - Mikrofonu Aç/Kapat
                      </div>
                      <div>
                        <kbd className="px-1.5 py-0.5 bg-[#1e1f22] rounded text-[10px]">
                          {formatShortcut(keyboardShortcuts.deafen).split('+').map((k, i) => (
                            <span key={i}>
                              {i > 0 && <span className="mx-0.5">+</span>}
                              {k.charAt(0).toUpperCase() + k.slice(1)}
                            </span>
                          ))}
                        </kbd> - Sesi Aç/Kapat (Deafen)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onLeave}
            className="p-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all duration-200 shadow-md hover:shadow-lg"
            title="Kanaldan Ayrıl"
          >
            <i className="fas fa-phone-slash text-sm"></i>
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcutsModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded-lg p-6 w-96 shadow-xl">
            <h3 className="font-bold text-white mb-4 text-lg">Klavye Kısayolları</h3>
            <p className="text-sm text-gray-400 mb-6">
              Mikrofon ve ses kontrolü için klavye kısayollarını özelleştirin.
            </p>
            <div className="space-y-4">
              {/* Mute Shortcut */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mikrofonu Aç/Kapat
                </label>
                <button
                  onClick={() => setCapturingKey(capturingKey === 'mute' ? null : 'mute')}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    capturingKey === 'mute'
                      ? 'bg-[#5865F2] text-white border-2 border-[#4752c4]'
                      : 'bg-[#2b2d31] text-gray-300 hover:bg-[#35373C] border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {capturingKey === 'mute' ? (
                        'Tuşa basın...'
                      ) : (
                        <span>
                          Mevcut:{' '}
                          {formatShortcut(keyboardShortcuts.mute).split('+').map((k, i) => (
                            <span key={i}>
                              {i > 0 && <span className="mx-1">+</span>}
                              <kbd className="px-1.5 py-0.5 bg-[#1e1f22] rounded text-[10px]">
                                {k.charAt(0).toUpperCase() + k.slice(1)}
                              </kbd>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    {capturingKey === 'mute' && (
                      <i className="fas fa-keyboard animate-pulse"></i>
                    )}
                  </div>
                </button>
                {capturingKey === 'mute' && (
                  <p className="text-xs text-gray-400 mt-2">Herhangi bir tuşa veya tuş kombinasyonuna basın (tüm tuşlar desteklenir)</p>
                )}
              </div>

              {/* Deafen Shortcut */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sesi Aç/Kapat (Deafen)
                </label>
                <button
                  onClick={() => setCapturingKey(capturingKey === 'deafen' ? null : 'deafen')}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    capturingKey === 'deafen'
                      ? 'bg-[#5865F2] text-white border-2 border-[#4752c4]'
                      : 'bg-[#2b2d31] text-gray-300 hover:bg-[#35373C] border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {capturingKey === 'deafen' ? (
                        'Tuşa basın...'
                      ) : (
                        <span>
                          Mevcut:{' '}
                          {formatShortcut(keyboardShortcuts.deafen).split('+').map((k, i) => (
                            <span key={i}>
                              {i > 0 && <span className="mx-1">+</span>}
                              <kbd className="px-1.5 py-0.5 bg-[#1e1f22] rounded text-[10px]">
                                {k.charAt(0).toUpperCase() + k.slice(1)}
                              </kbd>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    {capturingKey === 'deafen' && (
                      <i className="fas fa-keyboard animate-pulse"></i>
                    )}
                  </div>
                </button>
                {capturingKey === 'deafen' && (
                  <p className="text-xs text-gray-400 mt-2">Herhangi bir tuşa veya tuş kombinasyonuna basın (tüm tuşlar desteklenir)</p>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6 gap-2">
              <button
                onClick={() => {
                  setKeyboardShortcuts({ mute: 'm', deafen: 'd' });
                  setCapturingKey(null);
                }}
                className="px-4 py-2 bg-[#2b2d31] text-gray-300 rounded-lg hover:bg-[#35373C] transition text-sm"
              >
                Varsayılanlara Dön
              </button>
              <button
                onClick={() => {
                  setShowKeyboardShortcutsModal(false);
                  setCapturingKey(null);
                }}
                className="px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752c4] transition text-sm"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bitrate Settings Modal */}
      {showBitrateModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded-lg p-6 w-96 shadow-xl">
            <h3 className="font-bold text-white mb-4 text-lg">Ses Kalitesi Ayarları</h3>
            <p className="text-sm text-gray-400 mb-6">
              Kanal için ses kalitesini seçin. Daha yüksek bitrate daha iyi kalite sağlar ancak daha fazla bant genişliği kullanır.
            </p>
            <div className="space-y-3">
              {[
                { value: 64000, label: '64 kbps', desc: 'Standart Kalite' },
                { value: 96000, label: '96 kbps', desc: 'Yüksek Kalite' },
                { value: 128000, label: '128 kbps', desc: 'Maksimum Kalite' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleBitrateChange(option.value)}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    bitrate === option.value
                      ? 'bg-[#5865F2] text-white shadow-lg'
                      : 'bg-[#2b2d31] text-gray-300 hover:bg-[#35373C]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{option.label}</div>
                      <div className={`text-xs mt-1 ${bitrate === option.value ? 'text-gray-200' : 'text-gray-400'}`}>
                        {option.desc}
                      </div>
                    </div>
                    {bitrate === option.value && (
                      <i className="fas fa-check text-white"></i>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowBitrateModal(false)}
                className="px-4 py-2 bg-[#2b2d31] text-gray-300 rounded-lg hover:bg-[#35373C] transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoiceChannel({
  currentUser,
  roomName,
  channelId,
  onLeave,
}: VoiceChannelProps) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bitrate, setBitrate] = useState(64000);
  const roomRef = useRef<any>(null);

  // Kanal bitrate ayarını yükle
  useEffect(() => {
    const loadChannelSettings = async () => {
      if (!db) return;
      try {
        const channelRef = doc(db, 'channels', channelId);
        const channelSnap = await getDoc(channelRef);
        if (channelSnap.exists()) {
          const data = channelSnap.data();
          setBitrate(data.bitrate || 64000);
        }
      } catch (error) {
        console.error('Error loading channel settings:', error);
      }
    };

    if (channelId) {
      loadChannelSettings();
    }
  }, [channelId]);

  useEffect(() => {
    let isMounted = true;

    const fetchToken = async () => {
      try {
        const username = currentUser.displayName || currentUser.email || 'User';
        
        // Absolute URL kullan - window.location.origin ile
        const apiUrl = typeof window !== 'undefined' 
          ? `${window.location.origin}/api/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`
          : `/api/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || `HTTP ${response.status}: Token alınamadı`;
          
          // Connection refused hatası için özel mesaj
          if (response.status === 0 || errorMessage.includes('Failed to fetch')) {
            throw new Error(
              'API endpoint\'e ulaşılamıyor. Lütfen Next.js dev server\'ın çalıştığından emin olun (npm run dev).'
            );
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (isMounted) {
          setToken(data.token);
          setError(null);
        }
      } catch (err: any) {
        console.error('Error fetching token:', err);
        if (isMounted) {
          let errorMessage = err.message || 'Sesli kanala bağlanırken bir hata oluştu.';
          
          // Network hataları için daha açıklayıcı mesajlar
          if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_CONNECTION_REFUSED')) {
            errorMessage = 'API sunucusuna bağlanılamıyor. Lütfen Next.js dev server\'ın çalıştığından emin olun (npm run dev).';
          } else if (err.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
            errorMessage = 'İstek tarayıcı tarafından engellendi. Lütfen ad blocker veya güvenlik ayarlarını kontrol edin.';
          }
          
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchToken();

    return () => {
      isMounted = false;
    };
  }, [roomName, currentUser]);

  const handleDisconnected = () => {
    roomRef.current = null;
    onLeave();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#313338]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5865F2] mx-auto mb-4"></div>
          <div className="text-xl font-semibold mb-2 text-gray-300">Bağlanıyor...</div>
          <div className="text-sm text-gray-400">Sesli kanala bağlanılıyor</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#313338]">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2 text-red-400">{error}</div>
          <button
            onClick={onLeave}
            className="mt-4 px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752c4] transition"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!token || !livekitUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#313338]">
        <div className="text-center">
          <div className="text-xl font-semibold mb-2 text-red-400">
            LiveKit yapılandırması eksik
          </div>
          <div className="text-sm text-gray-400 mb-4">
            Lütfen .env.local dosyasında NEXT_PUBLIC_LIVEKIT_URL değişkenini kontrol edin.
          </div>
          <button
            onClick={onLeave}
            className="px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752c4] transition"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#313338]">
      <LiveKitRoom
        video={false}
        audio={true}
        token={token}
        serverUrl={livekitUrl}
        onDisconnected={handleDisconnected}
        onError={(error) => {
          const errorMsg = error?.message || error?.toString() || '';
          if (
            !errorMsg.includes('Client initiated') &&
            !errorMsg.includes('could not establish pc connection') &&
            !errorMsg.includes('Retrying') &&
            !errorMsg.includes('already connected')
          ) {
            console.error('LiveKit error:', error);
            if (errorMsg.includes('timeout') || errorMsg.includes('PublishTrackError')) {
              setError('Bağlantı hatası. Lütfen sayfayı yenileyin.');
            }
          }
        }}
        options={{
          adaptiveStream: false,
          dynacast: false,
          publishDefaults: {
            audioPreset: {
              maxBitrate: bitrate,
            },
          },
        }}
        connectOptions={{
          autoSubscribe: true,
          maxRetries: 1,
        }}
        className="h-full"
      >
        <VoiceChannelContent
          currentUser={currentUser}
          roomName={roomName}
          channelId={channelId}
          onLeave={onLeave}
          bitrate={bitrate}
          onBitrateChange={setBitrate}
        />
      </LiveKitRoom>
    </div>
  );
}

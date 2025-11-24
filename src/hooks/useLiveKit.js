import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { LIVEKIT_URL } from "../firebase/livekit-config";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

export function useLiveKit(channelId, currentUser, usersMap) {
  const [room, setRoom] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioTracks, setAudioTracks] = useState(new Map());

  const roomRef = useRef(null);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const connectToRoom = useCallback(async () => {
    if (!channelId || !currentUser) return;

    try {
      // Token oluştur (basit versiyon - production'da backend'den alınmalı)
      const token = await generateToken(
        channelId,
        currentUser.uid,
        currentUser.displayName
      );

      const newRoom = new Room();
      roomRef.current = newRoom;

      // Event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log("Connected to LiveKit room");
        setIsConnected(true);

        // Add to Firestore participants
        const participantRef = doc(
          db,
          "channels",
          channelId,
          "participants",
          currentUser.uid
        );
        setDoc(participantRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          joinedAt: serverTimestamp(),
          isMuted: false,
          isDeafened: false,
        });
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log("Disconnected from LiveKit room");
        setIsConnected(false);
        setParticipants([]);
        setAudioTracks(new Map());
      });

      const updateParticipants = () => {
        const remoteParticipants = Array.from(
          newRoom.remoteParticipants.values()
        );
        setParticipants(
          remoteParticipants.map((p) => ({
            identity: p.identity,
            uid: p.identity, // Firebase UID ile eşleştirme için
            name: p.name || p.identity,
            metadata: p.metadata,
            isMuted: p.isMicrophoneEnabled === false,
          }))
        );
      };

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("Participant connected:", participant.identity);
        updateParticipants();
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log("Participant disconnected:", participant.identity);
        updateParticipants();
      });

      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        updateParticipants();
      });

      newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        updateParticipants();
      });

      newRoom.on(
        RoomEvent.TrackSubscribed,
        (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const audioElement = new Audio();
            audioElement.srcObject = new MediaStream([track.mediaStreamTrack]);
            audioElement.autoplay = true;
            audioElement.volume = isDeafened ? 0 : 1;
            audioElement.play().catch(console.error);

            setAudioTracks((prev) => {
              const newMap = new Map(prev);
              newMap.set(participant.identity, audioElement);
              return newMap;
            });
          }
        }
      );

      newRoom.on(
        RoomEvent.TrackUnsubscribed,
        (track, publication, participant) => {
          setAudioTracks((prev) => {
            const newMap = new Map(prev);
            const audioElement = newMap.get(participant.identity);
            if (audioElement) {
              audioElement.srcObject = null;
              newMap.delete(participant.identity);
            }
            return newMap;
          });
        }
      );

      // Connect to room
      await newRoom.connect(LIVEKIT_URL, token);
      setRoom(newRoom);

      // Enable microphone
      await newRoom.localParticipant.setMicrophoneEnabled(true);

      // Initial participants update
      updateParticipants();
    } catch (error) {
      console.error("Error connecting to LiveKit room:", error);
      alert("Sesli kanala bağlanırken hata oluştu!");
    }
  }, [channelId, currentUser, isDeafened]);

  const disconnectFromRoom = useCallback(async () => {
    if (roomRef.current) {
      // Remove from Firestore
      if (channelId) {
        const participantRef = doc(
          db,
          "channels",
          channelId,
          "participants",
          currentUserRef.current.uid
        );
        await deleteDoc(participantRef);
      }

      // Close all audio tracks
      audioTracks.forEach((audioElement) => {
        audioElement.srcObject = null;
      });
      setAudioTracks(new Map());

      await roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
    }
  }, [channelId, audioTracks]);

  const toggleMute = useCallback(async () => {
    if (roomRef.current) {
      const newMutedState = !isMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(
        !newMutedState
      );
      setIsMuted(newMutedState);

      // Update Firestore
      if (channelId) {
        const participantRef = doc(
          db,
          "channels",
          channelId,
          "participants",
          currentUserRef.current.uid
        );
        await setDoc(
          participantRef,
          {
            isMuted: newMutedState,
          },
          { merge: true }
        );
      }
    }
  }, [room, isMuted, channelId]);

  const toggleDeafen = useCallback(async () => {
    const newDeafenedState = !isDeafened;
    setIsDeafened(newDeafenedState);

    // Mute all remote audio tracks
    audioTracks.forEach((audioElement) => {
      audioElement.volume = newDeafenedState ? 0 : 1;
    });

    // Update Firestore
    if (channelId) {
      const participantRef = doc(
        db,
        "channels",
        channelId,
        "participants",
        currentUserRef.current.uid
      );
      await setDoc(
        participantRef,
        {
          isDeafened: newDeafenedState,
        },
        { merge: true }
      );
    }
  }, [isDeafened, audioTracks, channelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return {
    room,
    isConnected,
    participants,
    isMuted,
    isDeafened,
    connectToRoom,
    disconnectFromRoom,
    toggleMute,
    toggleDeafen,
  };
}

// Token generation - Vercel Serverless Function'dan token al
// NOT: Localhost'ta (npm run dev) bu endpoint çalışmayabilir çünkü Vite dev server API dosyalarını çalıştırmaz.
// Vercel'e deploy edildiğinde otomatik olarak çalışacaktır.
// Local test için: `npm i -g vercel && vercel dev` komutunu kullanabilirsiniz.
async function generateToken(roomName, userId, userName) {
  try {
    // Vercel'de /api/livekit-token endpoint'i otomatik olarak serverless function olarak çalışır
    const tokenUrl = "/api/livekit-token";

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roomName, userId, userName }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || `HTTP ${response.status}: Token alınamadı`;

      // Debug bilgilerini console'a yazdır
      if (errorData.debug) {
        console.error("API Debug:", errorData.debug);
      }

      // 404 hatası localhost'ta normaldir (Vite dev server API'yi çalıştırmaz)
      if (response.status === 404) {
        throw new Error(
          "API endpoint bulunamadı. Bu normaldir - Vercel'e deploy edildiğinde çalışacaktır. Local test için: `vercel dev`"
        );
      }

      // 500 hatası için detaylı mesaj
      if (response.status === 500) {
        const debugInfo = errorData.debug
          ? `\nDebug: ${JSON.stringify(errorData.debug, null, 2)}`
          : "";
        throw new Error(`${errorMessage}${debugInfo}`);
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error("Token generation error:", error);

    // Network hatası (404 gibi) localhost'ta normaldir
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("404")
    ) {
      throw new Error(
        "API endpoint'e ulaşılamıyor. Vercel'e deploy edildiğinde çalışacaktır. Local test için Vercel CLI kullanın: `npm i -g vercel && vercel dev`"
      );
    }

    throw new Error(
      `LiveKit token alınamadı: ${error.message}. Vercel Environment Variables'ı kontrol edin: LIVEKIT_API_KEY ve LIVEKIT_API_SECRET`
    );
  }
}

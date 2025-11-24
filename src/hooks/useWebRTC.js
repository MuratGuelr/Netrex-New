import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useWebRTC(channelId, currentUser, usersMap) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState([]);
  
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const signalingRef = useRef(null);
  const participantsListRef = useRef([]);
  const currentUserRef = useRef(currentUser);

  // Update currentUser ref
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // STUN servers (ücretsiz)
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  const sendSignaling = useCallback(async (signal) => {
    if (!signalingRef.current) return;
    
    try {
      // Serialize RTCSessionDescription and RTCIceCandidate for Firestore
      const serializedSignal = { ...signal };
      
      if (signal.offer) {
        serializedSignal.offer = {
          type: signal.offer.type,
          sdp: signal.offer.sdp,
        };
      }
      
      if (signal.answer) {
        serializedSignal.answer = {
          type: signal.answer.type,
          sdp: signal.answer.sdp,
        };
      }
      
      if (signal.candidate) {
        // Serialize RTCIceCandidate
        serializedSignal.candidate = {
          candidate: signal.candidate.candidate,
          sdpMLineIndex: signal.candidate.sdpMLineIndex,
          sdpMid: signal.candidate.sdpMid,
        };
      }
      
      await setDoc(doc(signalingRef.current), {
        ...serializedSignal,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error sending signaling:', error);
    }
  }, []);

  const createPeerConnection = useCallback(async (otherUid) => {
    // Don't create duplicate connection
    if (peerConnectionsRef.current[otherUid]) {
      const existing = peerConnectionsRef.current[otherUid];
      if (existing.signalingState !== 'closed' && existing.connectionState !== 'closed') {
        console.log('Connection already exists for', otherUid);
        return;
      }
    }

    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[otherUid] = peerConnection;

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => ({
        ...prev,
        [otherUid]: remoteStream,
      }));
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingRef.current) {
        // Send candidate with error handling
        sendSignaling({
          type: 'ice-candidate',
          from: currentUserRef.current.uid,
          to: otherUid,
          candidate: event.candidate,
        }).catch((error) => {
          console.error('Error sending ICE candidate:', error);
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState, 'for', otherUid);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        // Try to reconnect
        setTimeout(() => {
          if (peerConnection.connectionState === 'failed') {
            peerConnection.restartIce();
          }
        }, 1000);
      }
    };

    try {
      // Create offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await peerConnection.setLocalDescription(offer);

      await sendSignaling({
        type: 'offer',
        from: currentUserRef.current.uid,
        to: otherUid,
        offer: offer,
      });
    } catch (error) {
      console.error('Error creating peer connection:', error);
      try {
        peerConnection.close();
      } catch (e) {
        // Ignore close errors
      }
      delete peerConnectionsRef.current[otherUid];
    }
  }, [sendSignaling]);

  const handleOffer = useCallback(async (signal, signalId) => {
    // Don't create duplicate connection
    if (peerConnectionsRef.current[signal.from]) {
      const existing = peerConnectionsRef.current[signal.from];
      if (existing.signalingState !== 'closed') {
        console.log('Connection already exists for', signal.from);
        return;
      }
    }

    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[signal.from] = peerConnection;

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => ({
        ...prev,
        [signal.from]: remoteStream,
      }));
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingRef.current) {
        // Send candidate with error handling
        sendSignaling({
          type: 'ice-candidate',
          from: currentUserRef.current.uid,
          to: signal.from,
          candidate: event.candidate,
        }).catch((error) => {
          console.error('Error sending ICE candidate:', error);
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState, 'for', signal.from);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        // Try to reconnect
        setTimeout(() => {
          if (peerConnection.connectionState === 'failed') {
            peerConnection.restartIce();
          }
        }, 1000);
      }
    };

    try {
      // Deserialize offer
      const offer = new RTCSessionDescription({
        type: signal.offer.type,
        sdp: signal.offer.sdp,
      });
      
      await peerConnection.setRemoteDescription(offer);
      
      // Add pending ICE candidates if any
      if (peerConnection.pendingRemoteCandidates) {
        for (const candidate of peerConnection.pendingRemoteCandidates) {
          try {
            await peerConnection.addIceCandidate(candidate);
          } catch (e) {
            console.error('Error adding pending ICE candidate:', e);
          }
        }
        peerConnection.pendingRemoteCandidates = [];
      }
      
      const answer = await peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await peerConnection.setLocalDescription(answer);

      await sendSignaling({
        type: 'answer',
        from: currentUserRef.current.uid,
        to: signal.from,
        answer: answer,
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      try {
        peerConnection.close();
      } catch (e) {
        // Ignore close errors
      }
      delete peerConnectionsRef.current[signal.from];
    }

    // Delete processed signal
    if (signalingRef.current) {
      try {
        await deleteDoc(doc(signalingRef.current, signalId));
      } catch (error) {
        console.error('Error deleting signal:', error);
      }
    }
  }, [sendSignaling]);

  const handleAnswer = useCallback(async (signal, signalId) => {
    const peerConnection = peerConnectionsRef.current[signal.from];
    if (peerConnection) {
      // Check connection state before setting remote description
      if (peerConnection.signalingState === 'have-local-offer') {
        try {
          // Deserialize answer
          const answer = new RTCSessionDescription({
            type: signal.answer.type,
            sdp: signal.answer.sdp,
          });
          
          await peerConnection.setRemoteDescription(answer);
          
          // Add pending ICE candidates if any
          if (peerConnection.pendingRemoteCandidates) {
            for (const candidate of peerConnection.pendingRemoteCandidates) {
              try {
                await peerConnection.addIceCandidate(candidate);
              } catch (e) {
                console.error('Error adding pending ICE candidate:', e);
              }
            }
            peerConnection.pendingRemoteCandidates = [];
          }
        } catch (error) {
          console.error('Error setting remote answer:', error);
          // If connection is in wrong state, close and recreate
          if (error.message.includes('stable') || error.message.includes('have-remote-offer')) {
            try {
              peerConnection.close();
            } catch (e) {
              // Ignore close errors
            }
            delete peerConnectionsRef.current[signal.from];
            // Recreate connection if we have local stream
            if (localStreamRef.current) {
              setTimeout(() => {
                createPeerConnection(signal.from);
              }, 500);
            }
          }
        }
      } else {
        console.log('Cannot set remote answer, signaling state:', peerConnection.signalingState);
      }
    }
    
    // Delete processed signal
    if (signalingRef.current) {
      try {
        await deleteDoc(doc(signalingRef.current, signalId));
      } catch (error) {
        console.error('Error deleting signal:', error);
      }
    }
  }, [createPeerConnection]);

  const handleIceCandidate = useCallback(async (signal, signalId) => {
    const peerConnection = peerConnectionsRef.current[signal.from];
    if (peerConnection && signal.candidate) {
      try {
        // Deserialize ICE candidate
        const candidate = new RTCIceCandidate({
          candidate: signal.candidate.candidate,
          sdpMLineIndex: signal.candidate.sdpMLineIndex,
          sdpMid: signal.candidate.sdpMid,
        });
        
        // Only add ICE candidate if connection is in valid state
        if (peerConnection.remoteDescription || peerConnection.localDescription) {
          await peerConnection.addIceCandidate(candidate);
        } else {
          // Store candidate for later if remote description not set yet
          if (!peerConnection.pendingRemoteCandidates) {
            peerConnection.pendingRemoteCandidates = [];
          }
          peerConnection.pendingRemoteCandidates.push(candidate);
        }
      } catch (error) {
        // Ignore duplicate candidate errors
        if (!error.message.includes('duplicate')) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    }
    
    // Delete processed signal
    if (signalingRef.current) {
      try {
        await deleteDoc(doc(signalingRef.current, signalId));
      } catch (error) {
        console.error('Error deleting signal:', error);
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current = {};

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams({});
  }, []);

  const handleSignalingRef = useRef(null);

  const handleSignaling = useCallback(async (signal, signalId) => {
    try {
      if (signal.type === 'offer') {
        await handleOffer(signal, signalId);
      } else if (signal.type === 'answer') {
        await handleAnswer(signal, signalId);
      } else if (signal.type === 'ice-candidate') {
        await handleIceCandidate(signal, signalId);
      }
    } catch (error) {
      console.error('Error handling signaling:', error);
    }
  }, [handleOffer, handleAnswer, handleIceCandidate]);

  // Update ref when handleSignaling changes
  useEffect(() => {
    handleSignalingRef.current = handleSignaling;
  }, [handleSignaling]);

  useEffect(() => {
    if (!channelId || !currentUser) return;

    // Signaling collection reference
    signalingRef.current = collection(db, 'channels', channelId, 'signaling');
    
    // Listen to participants - show ALL participants including current user
    const participantsCollection = collection(db, 'channels', channelId, 'participants');
    const unsubscribeParticipants = onSnapshot(participantsCollection, async (snapshot) => {
      const participantsList = [];
      const newParticipants = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        participantsList.push({ id: doc.id, uid: data.uid, ...data });
        // Check if this is a new participant (excluding current user)
        if (data.uid !== currentUser.uid && !participantsListRef.current.find((p) => p.uid === data.uid)) {
          newParticipants.push({ id: doc.id, uid: data.uid, ...data });
        }
      });
      
      participantsListRef.current = participantsList;
      // Filter out current user from display
      setParticipants(participantsList.filter((p) => p.uid !== currentUser.uid));
      
      // Create peer connections for new participants if we're already joined
      // Batch process to avoid overwhelming the system
      if (localStreamRef.current && newParticipants.length > 0) {
        // Process connections with a small delay between each to avoid rate limiting
        for (let i = 0; i < newParticipants.length; i++) {
          const participant = newParticipants[i];
          setTimeout(() => {
            createPeerConnection(participant.uid).catch((error) => {
              console.error('Error creating peer connection for', participant.uid, error);
            });
          }, i * 100); // 100ms delay between each connection
        }
      }
    });

    // Listen to signaling messages
    const q = query(signalingRef.current, where('to', '==', currentUserRef.current.uid));
    const unsubscribeSignaling = onSnapshot(q, (snapshot) => {
      snapshot.forEach((doc) => {
        const signal = doc.data();
        if (handleSignalingRef.current) {
          handleSignalingRef.current(signal, doc.id);
        }
      });
    });

    return () => {
      unsubscribeParticipants();
      unsubscribeSignaling();
      cleanup();
    };
  }, [channelId, currentUser, createPeerConnection, cleanup]);

  const joinChannel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Add to participants
      const participantRef = doc(
        db,
        'channels',
        channelId,
        'participants',
        currentUserRef.current.uid
      );
      await setDoc(participantRef, {
        uid: currentUserRef.current.uid,
        displayName: currentUserRef.current.displayName,
        photoURL: currentUserRef.current.photoURL,
        joinedAt: Date.now(),
        isMuted: false,
        isDeafened: false,
      });

      // Create offers for existing participants
      // Batch process to avoid overwhelming the system
      for (let i = 0; i < participantsListRef.current.length; i++) {
        const participant = participantsListRef.current[i];
        setTimeout(() => {
          createPeerConnection(participant.uid).catch((error) => {
            console.error('Error creating peer connection for', participant.uid, error);
          });
        }, i * 100); // 100ms delay between each connection
      }
    } catch (error) {
      console.error('Error joining channel:', error);
      alert('Mikrofon erişimi gerekli!');
    }
  }, [channelId, createPeerConnection]);

  const leaveChannel = useCallback(async () => {
    cleanup();
    
    // Remove from participants
    const participantRef = doc(
      db,
      'channels',
      channelId,
      'participants',
      currentUserRef.current.uid
    );
    await deleteDoc(participantRef);
  }, [channelId, cleanup]);

  const toggleMute = async () => {
    const newMutedState = !isMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = newMutedState;
      });
      setIsMuted(newMutedState);
      
      // Update mute status in Firestore
      if (channelId) {
        const participantRef = doc(
          db,
          'channels',
          channelId,
          'participants',
          currentUserRef.current.uid
        );
        await setDoc(participantRef, {
          isMuted: newMutedState,
        }, { merge: true });
      }
    }
  };

  const toggleDeafen = async () => {
    const newDeafenedState = !isDeafened;
    setIsDeafened(newDeafenedState);
    
    // Mute all remote streams when deafened
    Object.values(remoteStreams).forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = newDeafenedState;
      });
    });
    
    // Update deafen status in Firestore
    if (channelId) {
      const participantRef = doc(
        db,
        'channels',
        channelId,
        'participants',
        currentUserRef.current.uid
      );
      await setDoc(participantRef, {
        isDeafened: newDeafenedState,
      }, { merge: true });
    }
  };

  return {
    localStream,
    remoteStreams,
    isMuted,
    isDeafened,
    participants,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
  };
}


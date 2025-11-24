import { useState, useEffect } from 'react';
import { useLiveKit } from '../hooks/useLiveKit';

export default function VoiceChannel({ currentUser, channel, usersMap }) {
  const {
    isConnected,
    participants,
    isMuted,
    isDeafened,
    connectToRoom,
    disconnectFromRoom,
    toggleMute,
    toggleDeafen,
  } = useLiveKit(channel?.id, currentUser, usersMap);

  const handleJoin = async () => {
    await connectToRoom();
  };

  const handleLeave = async () => {
    await disconnectFromRoom();
  };

  const getChannelHeader = () => {
    return (
      <>
        <i className="fas fa-volume-up text-gray-400 mr-2 text-lg"></i>
        <h3 className="font-bold text-white">{channel.name}</h3>
      </>
    );
  };

  if (!channel) {
    return (
      <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Bir kanal seçin
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
      <div className="h-12 border-b border-[#26272d] flex items-center px-4 bg-[#313338] z-10 shadow-sm">
        {getChannelHeader()}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 bg-[#313338]">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center mb-6">
              <i className="fas fa-volume-up text-6xl text-gray-500 mb-4"></i>
              <h2 className="text-2xl font-bold text-white mb-2">Sesli Kanal</h2>
              <p className="text-gray-400">
                Bu kanala katılmak için aşağıdaki butona tıklayın
              </p>
            </div>
            <button
              onClick={handleJoin}
              className="bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <i className="fas fa-phone"></i>
              Kanal&apos;a Katıl
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Local user */}
              <div className="bg-[#2b2d31] rounded-lg p-4 border border-[#1e1f22]">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={currentUser.photoURL}
                    className="w-12 h-12 rounded-full object-cover"
                    alt=""
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-white">
                      {currentUser.displayName}
                    </div>
                    <div className="text-xs text-gray-400">Sen</div>
                  </div>
                  {isMuted && (
                    <i className="fas fa-microphone-slash text-red-400"></i>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#1e1f22] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isMuted ? 'bg-gray-600' : 'bg-green-500'
                      }`}
                      style={{ width: isMuted ? '0%' : '50%' }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Remote users */}
              {participants.map((participant) => {
                const user = usersMap[participant.identity] || usersMap[participant.uid];
                return (
                  <div
                    key={participant.identity || participant.uid}
                    className="bg-[#2b2d31] rounded-lg p-4 border border-[#1e1f22]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={user?.photoURL || participant.photoURL}
                        className="w-12 h-12 rounded-full object-cover"
                        alt=""
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-white flex items-center gap-2">
                          {user?.displayName || participant.name || participant.identity}
                          {participant.isMuted && (
                            <i className="fas fa-microphone-slash text-red-400 text-xs"></i>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          Bağlı
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#1e1f22] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            participant.isMuted ? 'bg-gray-600' : 'bg-green-500'
                          }`}
                          style={{ width: participant.isMuted ? '0%' : '30%' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {participants.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                <i className="fas fa-users text-4xl mb-4"></i>
                <p>Henüz başka katılımcı yok</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {isConnected && (
        <div className="px-4 py-4 bg-[#2b2d31] border-t border-[#1e1f22]">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                isMuted
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-[#5865F2] hover:bg-[#4752c4]'
              } text-white`}
              title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
            >
              <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
            </button>

            <button
              onClick={toggleDeafen}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                isDeafened
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-[#5865F2] hover:bg-[#4752c4]'
              } text-white`}
              title={isDeafened ? 'Sesi Aç' : 'Sesi Kapat'}
            >
              <i className={`fas ${isDeafened ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
            </button>

            <button
              onClick={handleLeave}
              className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition"
              title="Kanaldan Ayrıl"
            >
              <i className="fas fa-phone-slash"></i>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}


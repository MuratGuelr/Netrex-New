import { useState } from "react";
import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db, ADMIN_EMAIL } from "../firebase/config";
import { formatText } from "../utils/textFormatter";

export default function Message({
  message,
  isConsecutive,
  isMe,
  currentUser,
  channelId,
}) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isAdmin = currentUser.email === ADMIN_EMAIL;

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenuPos({ x: e.pageX, y: e.pageY });
    setShowContextMenu(true);
  };

  const handleEdit = () => {
    setEditText(message.text || "");
    setShowEditModal(true);
    setShowContextMenu(false);
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
    setShowContextMenu(false);
  };

  const handleDeleteStack = async () => {
    if (!channelId) return;
    const q = query(
      collection(db, "channels", channelId, "messages"),
      orderBy("timestamp", "asc")
    );
    const snapshot = await getDocs(q);
    const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const targetIndex = msgs.findIndex((m) => m.id === message.id);
    if (targetIndex === -1) return;

    const targetUid = msgs[targetIndex].uid;
    let idsToDelete = [msgs[targetIndex].id];

    for (let i = targetIndex - 1; i >= 0; i--) {
      if (msgs[i].uid === targetUid) {
        idsToDelete.push(msgs[i].id);
      } else {
        break;
      }
    }

    for (let i = targetIndex + 1; i < msgs.length; i++) {
      if (msgs[i].uid === targetUid) {
        idsToDelete.push(msgs[i].id);
      } else {
        break;
      }
    }

    const batch = writeBatch(db);
    idsToDelete.forEach((mid) => {
      batch.delete(doc(db, "channels", channelId, "messages", mid));
    });
    await batch.commit();
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!channelId) return;
    await deleteDoc(doc(db, "channels", channelId, "messages", message.id));
    setShowDeleteModal(false);
  };

  const confirmEdit = async () => {
    if (!channelId) return;
    const text = editText.trim();
    if (text) {
      await updateDoc(doc(db, "channels", channelId, "messages", message.id), {
        text: text,
        isEdited: true,
      });
    }
    setShowEditModal(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text || "");
    setShowContextMenu(false);
  };

  const date = message.timestamp ? message.timestamp.toDate() : new Date();
  const timeStr = date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedText = message.isGif ? "" : formatText(message.text || "");
  const editBadge =
    message.isEdited && !message.isGif ? (
      <span className="text-[10px] text-gray-500 ml-1 italic">
        (düzenlendi)
      </span>
    ) : null;

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        className={`flex w-full px-4 py-0.5 group hover:bg-[#2e3035]/80 message-enter ${
          isConsecutive ? "-mt-1.5" : "mt-5"
        } ${isMe ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`flex max-w-[85%] sm:max-w-[75%] ${
            isMe ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {isConsecutive ? (
            <div
              className={`w-10 flex-shrink-0 flex items-start ${
                isMe ? "ml-4 justify-start" : "mr-4 justify-end"
              }`}
            >
              <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 mt-1 select-none w-full text-center">
                {timeStr}
              </span>
            </div>
          ) : (
            <img
              src={message.photoURL}
              className={`w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 object-cover shadow-sm ${
                isMe ? "ml-4" : "mr-4"
              }`}
              alt=""
            />
          )}
          <div
            className={`flex-1 min-w-0 ${isMe ? "text-right" : "text-left"}`}
          >
            {!isConsecutive && (
              <div
                className={`flex items-baseline ${
                  isMe ? "flex-row-reverse" : "flex-row"
                } gap-2`}
              >
                <span
                  className="font-medium hover:underline cursor-pointer text-base"
                  style={{
                    color: isMe ? "#fff" : getUserColor(message.uid || ""),
                  }}
                >
                  {message.displayName}
                </span>
                <span
                  className={`text-xs text-gray-500 select-none ${
                    isMe ? "ml-2" : "mr-4"
                  }`}
                >
                  {timeStr}
                </span>
              </div>
            )}
            {message.isGif && message.gifUrl ? (
              <div className="my-2">
                <img
                  src={message.gifUrl}
                  alt={message.text || "GIF"}
                  className="max-w-[200px] rounded cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(message.gifUrl, "_blank")}
                />
              </div>
            ) : (
              <div className="text-[#dbdee1] leading-relaxed whitespace-pre-wrap break-words msg-content text-[0.95rem]">
                <span dangerouslySetInnerHTML={{ __html: formattedText }} />
                {editBadge}
              </div>
            )}
          </div>
        </div>
      </div>

      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="fixed z-[100] bg-[#111214] rounded w-52 py-1 text-sm shadow-xl border border-[#1e1f22]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            {isMe && (
              <div
                onClick={handleEdit}
                className="px-3 py-2 hover:bg-[#5865F2] text-gray-300 cursor-pointer flex gap-2 items-center"
              >
                <i className="fas fa-pen w-4"></i> Düzenle
              </div>
            )}
            <div
              onClick={handleCopy}
              className="px-3 py-2 hover:bg-[#5865F2] text-gray-300 cursor-pointer flex gap-2 items-center"
            >
              <i className="fas fa-copy w-4"></i> Kopyala
            </div>
            <div className="h-[1px] bg-[#2b2d31] my-1"></div>
            {(isMe || isAdmin) && (
              <>
                <div
                  onClick={handleDelete}
                  className="px-3 py-2 hover:bg-red-500 text-red-400 cursor-pointer flex gap-2 items-center"
                >
                  <i className="fas fa-trash w-4"></i> Sil
                </div>
                <div
                  onClick={handleDeleteStack}
                  className="px-3 py-2 hover:bg-red-800 text-red-400 cursor-pointer flex gap-2 items-center"
                >
                  <i className="fas fa-layer-group w-4"></i> Bu Grubu Sil
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded p-4 w-full max-w-lg shadow-lg">
            <h3 className="font-bold text-white mb-2">Düzenle</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) confirmEdit();
                if (e.key === "Escape") setShowEditModal(false);
              }}
              className="w-full bg-[#1e1f22] text-white rounded p-3 focus:outline-none min-h-[80px] mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="text-sm text-white hover:underline"
              >
                İptal
              </button>
              <button
                onClick={confirmEdit}
                className="bg-[#5865F2] text-white px-4 py-2 rounded text-sm"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
          <div className="bg-[#313338] rounded p-5 w-80 shadow-lg">
            <h3 className="font-bold text-white mb-2">Siliniyor</h3>
            <p className="text-gray-400 text-sm">Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-sm text-white hover:underline"
              >
                İptal
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-500 text-white px-4 py-2 rounded text-sm"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getUserColor(uid) {
  if (!uid) return "#fff";
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = uid.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h % 360)}, 70%, 75%)`;
}

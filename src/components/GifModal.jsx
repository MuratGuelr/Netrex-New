import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import Toast from './Toast';

const GIPHY_API_KEY = 'AXHobCmGicfQI3D0a5HGpcTtN6rOgkUX';

export default function GifModal({ currentUser, onClose, onSend }) {
  const [activeTab, setActiveTab] = useState('trending');
  const [gifs, setGifs] = useState([]);
  const [favoriteGifs, setFavoriteGifs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (activeTab === 'trending') {
      loadTrendingGifs();
    } else if (activeTab === 'favorites') {
      loadFavorites();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!currentUser) return;
    const favoritesRef = collection(db, 'users', currentUser.uid, 'favorites');
    const unsubscribe = onSnapshot(favoritesRef, (snapshot) => {
      const favorites = [];
      snapshot.forEach((doc) => {
        favorites.push({ id: doc.id, ...doc.data() });
      });
      setFavoriteGifs(favorites);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const loadTrendingGifs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Error loading trending GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=30&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Error searching GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = () => {
    setGifs(
      favoriteGifs.map((f) => ({
        id: f.id,
        images: {
          original: { url: f.url },
          fixed_height_small: { url: f.url },
        },
        title: f.title || 'GIF',
      }))
    );
  };

  const toggleFavorite = async (gif) => {
    if (!currentUser) return;
    const favoriteRef = doc(db, 'users', currentUser.uid, 'favorites', gif.id);
    const favoriteSnap = await getDoc(favoriteRef);

    if (favoriteSnap.exists()) {
      await deleteDoc(favoriteRef);
      setToast('Favorilerden kaldırıldı');
    } else {
      await setDoc(favoriteRef, {
        id: gif.id,
        url: gif.images.original.url,
        title: gif.title || 'GIF',
        addedAt: serverTimestamp(),
      });
      setToast('Favorilere eklendi ⭐');
    }
  };

  const isFavorite = (gifId) => {
    return favoriteGifs.some((f) => f.id === gifId);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchGifs(searchQuery);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
      <div className="bg-[#313338] rounded p-4 w-full max-w-4xl shadow-lg max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-white">GIF Ara</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            className="flex-1 bg-[#1e1f22] text-white rounded p-2 focus:outline-none"
            placeholder="GIF ara..."
          />
          <button
            onClick={handleSearch}
            className="bg-[#5865F2] text-white px-4 py-2 rounded"
          >
            Ara
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setActiveTab('trending');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded text-sm ${
              activeTab === 'trending' ? 'bg-[#5865F2]' : 'bg-[#1e1f22]'
            } text-white`}
          >
            Popüler
          </button>
          <button
            onClick={() => {
              setActiveTab('favorites');
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded text-sm ${
              activeTab === 'favorites' ? 'bg-[#5865F2]' : 'bg-[#1e1f22]'
            } text-white`}
          >
            Favorilerim
          </button>
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2">
          {loading ? (
            <div className="col-span-3 text-center text-gray-400 py-4">Yükleniyor...</div>
          ) : gifs.length === 0 ? (
            <div className="col-span-3 text-center text-gray-400 py-4">
              {activeTab === 'favorites' ? 'Henüz favori GIF yok.' : 'Sonuç bulunamadı.'}
            </div>
          ) : (
            gifs.map((gif) => (
              <div key={gif.id} className="relative group cursor-pointer">
                <img
                  src={gif.images.fixed_height_small?.url || gif.images.original.url}
                  alt={gif.title}
                  className="w-full h-auto rounded max-h-32 object-cover"
                  onClick={() => onSend(gif.images.original.url, gif.title)}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(gif);
                  }}
                  className={`absolute top-2 right-2 p-1.5 bg-black/70 rounded hover:bg-black/90 transition-colors ${
                    isFavorite(gif.id) ? 'text-yellow-400' : 'text-white'
                  }`}
                >
                  <i className="fas fa-star text-sm"></i>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}


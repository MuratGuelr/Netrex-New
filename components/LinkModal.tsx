'use client';

interface LinkModalProps {
  show: boolean;
  url: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LinkModal({ show, url, onConfirm, onCancel }: LinkModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-[#313338] rounded p-6 max-w-md w-full border border-[#1e1f22] text-center">
        <h3 className="text-xl font-bold text-white mb-2">Dikkat!</h3>
        <p className="text-gray-300 text-sm mb-4">
          Bu bağlantıya gitmek istiyor musunuz?
        </p>
        <div className="bg-[#1e1f22] p-3 rounded text-blue-400 text-xs break-all mb-4">
          {url}
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-[#5865F2] hover:bg-[#4752c4] text-white"
          >
            Git
          </button>
        </div>
      </div>
    </div>
  );
}


const emojis = [
  '😀', '😂', '😉', '😎', '😍', '🥰', '😘', '🤗', '🤔', '🤨',
  '😐', '🙄', '😏', '😣', '😥', '😮', '🤐', '😫', '😴', '😛',
  '😜', '😒', '😔', '😕', '🙃', '🤑', '😲', '☹️', '😖', '😞',
  '😤', '😢', '😭', '😨', '😩', '🤯', '😬', '😱', '🥵', '🥶',
  '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤢', '🤮', '🤧',
  '🥳', '🥺', '🤠', '🤡', '🤥', '🤫', '🤭', '🧐', '🤓', '😈',
  '👿', '💀', '👻', '👽', '🤖', '💩', '👍', '👎', '👊', '✌️',
  '👌', '👈', '👉', '👆', '👇', '👋', '👏', '💪', '🙏', '👀',
  '🧠', '🔥', '✨', '❤️', '💔',
];

export default function EmojiPicker({ show, onClose, onSelect }) {
  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 z-[50]" onClick={onClose} />
      <div className="absolute bottom-full left-0 mb-2 bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-xl p-2 grid grid-cols-8 gap-1 w-72 h-60 overflow-y-auto z-[60]">
        {emojis.map((emoji, index) => (
          <span
            key={index}
            onClick={() => onSelect(emoji)}
            className="cursor-pointer hover:bg-[#404249] p-2 rounded text-xl text-center"
          >
            {emoji}
          </span>
        ))}
      </div>
    </>
  );
}


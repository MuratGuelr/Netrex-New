export default function TypingIndicator({ typingUsers, usersMap }) {
  if (!typingUsers || typingUsers.size === 0) {
    return null;
  }

  const users = Array.from(typingUsers).map((u) => {
    try {
      return typeof u === 'string' ? JSON.parse(u) : u;
    } catch {
      return u;
    }
  });

  const firstUser = users[0];

  let content = '';
  if (users.length === 1) {
    content = (
      <>
        <img
          src={firstUser.photoURL}
          className="w-5 h-5 rounded-full object-cover typing-avatar"
          alt=""
        />
        <span>
          {firstUser.name}
          <span className="typing-dots">...</span>
        </span>
      </>
    );
  } else if (users.length === 2) {
    content = (
      <span>
        {users[0].name} ve {users[1].name}
        <span className="typing-dots">...</span>
      </span>
    );
  } else {
    content = (
      <span>
        {users[0].name} ve {users.length - 1} kişi daha
        <span className="typing-dots">...</span>
      </span>
    );
  }

  return (
    <div className="px-4 pb-2 text-sm text-gray-400 flex items-center gap-2">
      {content}
    </div>
  );
}


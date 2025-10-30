// public/script.js
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('id');
const isAuthor = urlParams.get('author') === 'true';

if (!roomId) {
  alert("Invalid Room ID");
  window.location.href = '/';
}

const socket = io();
let editor;

const languages = {
  python: { name: "Python", mode: "python" },
  java:   { name: "Java",   mode: "text/x-java" },
  cpp:    { name: "C++",    mode: "text/x-c++src" }
};

// ==============================
//  Initialize UI
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  const langSelect = document.getElementById('language');
  Object.keys(languages).forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = languages[lang].name;
    langSelect.appendChild(opt);
  });

  editor = CodeMirror(document.getElementById('editor'), {
    lineNumbers: true,
    theme: 'monokai',
    mode: 'python',
    readOnly: !isAuthor
  });

  socket.emit('join-room', { roomId, isAuthor });

  document.getElementById('runBtn').onclick = () => {
    if (isAuthor) socket.emit('run-code', { roomId });
  };

  langSelect.onchange = () => {
    if (isAuthor) {
      const lang = langSelect.value;
      editor.setOption('mode', languages[lang].mode);
      socket.emit('language-change', { roomId, language: lang });
    }
  };

  editor.on('changes', () => {
    if (isAuthor) {
      socket.emit('code-change', { roomId, code: editor.getValue() });
    }
  });
});

// ==============================
//  Socket Listeners
// ==============================

socket.on('room-data', ({ code, language, isAuthor: authorConfirmed, comments }) => {
  if (!editor.getValue()) editor.setValue(code);
  document.getElementById('language').value = language;
  editor.setOption('mode', languages[language].mode);
  editor.setOption('readOnly', !authorConfirmed);

  if (authorConfirmed) {
    document.getElementById('author-comments').classList.remove('hidden');
    renderComments(comments);
  } else {
    document.getElementById('viewer-comment-box').classList.remove('hidden');
    document.getElementById('sendCommentBtn').onclick = sendComment;
  }
});

socket.on('code-update', (code) => {
  if (!isAuthor) editor.setValue(code);
});

socket.on('language-update', (lang) => {
  document.getElementById('language').value = lang;
  editor.setOption('mode', languages[lang].mode);
});

socket.on('output', (output) => {
  const outputEl = document.getElementById('output');
  outputEl.textContent = output;
  outputEl.scrollTop = outputEl.scrollHeight;
});

socket.on('user-count', ({ author, viewers }) => {
  const countEl = document.getElementById('userCount');
  let text = '';
  if (author) text += 'Author';
  if (viewers > 0) text += ` ${viewers} Viewer${viewers > 1 ? 's' : ''}`;
  countEl.textContent = text.trim();
});

// New comment from viewer
socket.on('new-comment', (msg) => {
  if (isAuthor) {
    addCommentToList(msg);
  }
});

// Author reply to viewer
socket.on('author-reply', (reply) => {
  if (!isAuthor) {
    const commentEl = document.querySelector(`[data-id="${reply.commentId}"]`);
    if (commentEl) {
      const replyDiv = document.createElement('div');
      replyDiv.className = 'reply';
      replyDiv.innerHTML = `<strong>Author:</strong> ${reply.text}<br><small>${new Date(reply.time).toLocaleTimeString()}</small>`;
      commentEl.appendChild(replyDiv);
    }
  }
});

socket.on('author-left', () => {
  alert("Author left the room.");
  window.location.href = '/';
});

// ==============================
//  Helper Functions
// ==============================

function sendComment() {
  const txt = document.getElementById('commentText');
  const comment = txt.value.trim();
  if (comment) {
    socket.emit('send-comment', { roomId, comment });
    txt.value = '';
  }
}

// Add a viewer comment + reply input (author only)
function addCommentToList(msg) {
  const list = document.getElementById('commentList');
  const div = document.createElement('div');
  div.className = 'comment';
  div.dataset.id = msg.id;

  div.innerHTML = `
    <div class="comment-body">
      <strong>Viewer:</strong> ${msg.comment}
      <br><small>${new Date(msg.time).toLocaleTimeString()}</small>
    </div>
    <div class="reply-section">
      <textarea placeholder="Reply..." class="reply-input"></textarea>
      <button class="reply-btn">Send</button>
    </div>
  `;

  const replyBtn = div.querySelector('.reply-btn');
  const replyInput = div.querySelector('.reply-input');

  replyBtn.onclick = () => {
    const text = replyInput.value.trim();
    if (text) {
      socket.emit('author-reply', { roomId, commentId: msg.id, text });
      replyInput.value = '';
    }
  };

  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

function renderComments(comments) {
  const list = document.getElementById('commentList');
  list.innerHTML = '';
  comments.forEach(c => addCommentToList(c));
}
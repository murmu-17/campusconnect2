// ══════════════════════════════════════════════════
//  BADGE SYSTEM — add this block at the TOP of your
//  existing <script> in chat.html, right after the
//  BASE_URL / WS_URL constants.
// ══════════════════════════════════════════════════

// Derive user type from institute + batch + account_type
function getUserType(user) {
  var institute = (user.institute || "").toUpperCase();
  var batch     = parseInt(user.batch) || 0;
  var now       = new Date().getFullYear();
  if (user.account_type === "verified" && batch > 0 && batch < now) return "alumni";
  if (institute.startsWith("IIT") && !institute.startsWith("IIIT"))  return "iit";
  if (institute.startsWith("NIT") || institute.startsWith("IIIT"))   return "nit";
  if (user.account_type === "general" && !user.institute)            return "school";
  return "general";
}

// Returns an inline badge HTML string
function userBadgeHtml(user, size) {
  var type = getUserType(user);
  var map = {
    iit:     { label: "IITian",         cls: "ub-iit"     },
    nit:     { label: "NITian",         cls: "ub-nit"     },
    alumni:  { label: "Alumni",         cls: "ub-alumni"  },
    school:  { label: "School Student", cls: "ub-school"  },
    general: { label: "General",        cls: "ub-general" }
  };
  var info    = map[type] || map.general;
  var padding = size === "sm" ? "2px 7px" : "3px 10px";
  var fsize   = size === "sm" ? "10px"    : "11px";
  return '<span class="user-badge ' + info.cls + '" style="display:inline-flex;align-items:center;gap:4px;padding:' + padding + ';border-radius:999px;font-size:' + fsize + ';font-weight:600;letter-spacing:0.02em;white-space:nowrap;flex-shrink:0;">' +
         '<span style="width:5px;height:5px;border-radius:50%;flex-shrink:0;" class="ub-dot"></span>' +
         info.label + '</span>';
}

// Inject badge CSS into <head> once
(function injectBadgeCSS() {
  if (document.getElementById("ub-styles")) return;
  var s = document.createElement("style");
  s.id = "ub-styles";
  s.textContent = [
    ".ub-iit    { background:#EEEDFE; color:#3C3489; } .ub-iit    .ub-dot { background:#534AB7; }",
    ".ub-nit    { background:#E1F5EE; color:#085041; } .ub-nit    .ub-dot { background:#0F6E56; }",
    ".ub-alumni { background:#FAEEDA; color:#633806; } .ub-alumni .ub-dot { background:#854F0B; }",
    ".ub-school { background:#E6F1FB; color:#0C447C; } .ub-school .ub-dot { background:#185FA5; }",
    ".ub-general{ background:#F1EFE8; color:#5F5E5A; } .ub-general .ub-dot{ background:#888780; }"
  ].join("\n");
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════════
//  REPLACE your existing loadConversations() with:
// ══════════════════════════════════════════════════
async function loadConversations() {
  try {
    var res  = await fetch(BASE_URL + "/messages/inbox/" + currentUser.id);
    var data = await res.json();
    if (!data.success || data.conversations.length === 0) {
      document.getElementById("chatsPanel").innerHTML = '<div class="no-convs">No conversations yet.<br>Go to Network to start one.</div>';
      return;
    }
    var html = "";
    data.conversations.forEach(function(c) {
      var av = (c.full_name || "U").split(" ").map(function(w){ return w[0]; }).join("").toUpperCase().slice(0,2);
      var isActive = activeChatUser && activeChatUser.id == c.id;
      var time = formatTime(c.last_time);

      // Build badge from conversation data
      var badgeHtml = userBadgeHtml({
        account_type: c.account_type || "general",
        institute:    c.institute    || "",
        batch:        c.batch        || 0
      }, "sm");

      html += '<div class="conv-item' + (isActive ? " active" : "") + '" onclick="openChat(' + c.id + ',\'' + (c.full_name||"").replace(/'/g,"") + '\',\'' + (c.institute||"").replace(/'/g,"") + '\',\'' + (c.account_type||"general") + '\',' + (c.batch||0) + ')">';
      html += '<div class="conv-avatar">' + av + '</div>';
      html += '<div class="conv-info">';
      // Name + badge on same line
      html += '<div class="conv-name" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' + (c.full_name || "—") + ' ' + badgeHtml + '</div>';
      html += '<div class="conv-last">' + (c.last_message || "").substring(0, 30) + (c.last_message && c.last_message.length > 30 ? "..." : "") + '</div>';
      html += '</div>';
      html += '<div class="conv-meta"><span class="conv-time">' + time + '</span>';
      if (c.unread_count > 0) html += '<span class="unread-dot">' + c.unread_count + '</span>';
      html += '</div></div>';
    });
    document.getElementById("chatsPanel").innerHTML = html;
  } catch(e) { console.error("Load conversations error:", e); }
}

// ══════════════════════════════════════════════════
//  REPLACE your existing openChat() with:
//  (adds account_type + batch params for badge in header)
// ══════════════════════════════════════════════════
async function openChat(userId, userName, institute, accountType, batch) {
  activeChatUser = { id: userId, name: userName, institute: institute, account_type: accountType || "general", batch: batch || 0 };
  sessionStorage.removeItem("chatWith");
  var av = (userName || "U").split(" ").map(function(w){ return w[0]; }).join("").toUpperCase().slice(0,2);

  // Build badge for chat header
  var headerBadge = userBadgeHtml(activeChatUser, "sm");

  var isMobile = window.innerWidth <= 768;
  if (isMobile) {
    document.querySelector(".sidebar").classList.add("hidden");
    document.getElementById("chatArea").classList.add("mobile-active");
  }

  var chatHTML = `
    <div class="chat-header">
      <button class="btn-back-mobile" onclick="goBackToSidebar()" title="Back">←</button>
      <div class="chat-header-avatar">${av}</div>
      <div class="chat-header-info">
        <h3 style="display:flex;align-items:center;gap:8px;">${userName} ${headerBadge}</h3>
        <p>🏛️ ${institute || "—"}</p>
      </div>
      <div class="chat-header-actions">
        <button class="btn-delete-chat" onclick="openDeleteChatModal()" title="Delete entire chat">
          🗑️ Delete Chat
        </button>
        <button class="btn-danger-sm" onclick="blockUser(${userId}, '${userName.replace(/'/g,"")}')">Block</button>
        <button class="btn-danger-sm" onclick="openReport(${userId}, '${userName.replace(/'/g,"")}')">Report</button>
      </div>
    </div>
    <div class="messages-area" id="messagesArea"></div>
    <div class="chat-input-area">
      <textarea class="chat-input" id="msgInput" placeholder="Type a message..." rows="1"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage();}"
        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
      <button class="btn-send" id="sendBtn" onclick="sendMessage()">Send</button>
    </div>
  `;
  document.getElementById("chatArea").innerHTML = chatHTML;
  await loadMessages();
  loadConversations();
}

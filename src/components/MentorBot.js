import React, { useEffect, useRef, useState } from "react";
import "./MentorBot.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const MENTOR_API_BASE = `${API_BASE}/mentorbot`;
const MENTOR_FETCH_OPTIONS = { credentials: "include" };

const MENTOR_PROMPTS = [
  "Explain my current course outline in simple terms.",
  "Make a short revision plan for this week.",
  "Test me with 5 viva questions from the syllabus.",
  "Summarize the important topics I should study first.",
];

const BotIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SendIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const UploadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

function formatInlineText(text, keyPrefix) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-strong-${index}`}>
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-text-${index}`}>{segment}</React.Fragment>;
  });
}

function renderStructuredMessage(content) {
  const lines = String(content || "").replace(/\r/g, "").split("\n");
  const elements = [];
  let paragraphLines = [];
  let listItems = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(" ").trim();
    if (text) {
      elements.push(
        <p className="mentor-rich-paragraph" key={`p-${elements.length}`}>
          {formatInlineText(text, `p-${elements.length}`)}
        </p>
      );
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) return;
    const Tag = listType;
    elements.push(
      <Tag className="mentor-rich-list" key={`${listType}-${elements.length}`}>
        {listItems.map((item, index) => (
          <li key={`${listType}-item-${index}`}>
            {formatInlineText(item, `${listType}-${index}`)}
          </li>
        ))}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length, 3);
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      elements.push(
        <Tag className="mentor-rich-heading" key={`h-${elements.length}`}>
          {formatInlineText(headingMatch[2], `h-${elements.length}`)}
        </Tag>
      );
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(bulletMatch[1]);
      return;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(numberedMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  if (!elements.length) {
    return <p className="mentor-rich-paragraph">{content}</p>;
  }

  return <div className="mentor-rich-content">{elements}</div>;
}

export default function MentorBot() {
  const [mentorSessions, setMentorSessions] = useState([]);
  const [mentorSessionId, setMentorSessionId] = useState("");
  const [mentorMessages, setMentorMessages] = useState([]);
  const [mentorQuestion, setMentorQuestion] = useState("");
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorSessionsLoading, setMentorSessionsLoading] = useState(false);
  const [mentorHistoryLoading, setMentorHistoryLoading] = useState(false);
  const [mentorError, setMentorError] = useState("");
  const [mentorHealth, setMentorHealth] = useState(null);
  const [sessionDocuments, setSessionDocuments] = useState([]);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  const mentorFeedRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachMenuRef = useRef(null);
  const loadMentorHealthRef = useRef(() => {});
  const loadMentorSessionsRef = useRef(() => {});

  useEffect(() => {
    if (!mentorFeedRef.current) return;
    mentorFeedRef.current.scrollTo({
      top: mentorFeedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [mentorMessages, mentorLoading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.focus();
  }, [mentorMessages.length, mentorHistoryLoading]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target)
      ) {
        setAttachMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadMentorHealth = async () => {
    try {
      const res = await fetch(`${MENTOR_API_BASE}/health`, MENTOR_FETCH_OPTIONS);
      const data = await res.json();
      if (res.ok) setMentorHealth(data);
    } catch (_) {}
  };
  loadMentorHealthRef.current = loadMentorHealth;

  const openMentorSession = async (sessionId, knownSessions = null) => {
    if (!sessionId) return;

    setMentorSessionId(sessionId);
    setMentorHistoryLoading(true);
    setMentorError("");

    try {
      const res = await fetch(
        `${MENTOR_API_BASE}/chat-history/${sessionId}`,
        MENTOR_FETCH_OPTIONS
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to load chat history");
      }

      setMentorMessages(Array.isArray(data.messages) ? data.messages : []);
      if (knownSessions) setMentorSessions(knownSessions);
      await loadSessionDocuments(sessionId);
    } catch (err) {
      setMentorError(err.message || "Unable to load chat history");
    } finally {
      setMentorHistoryLoading(false);
    }
  };

  const createMentorChat = (clearInput = true) => {
    setMentorError("");
    setMentorSessionId("");
    setMentorMessages([]);
    setSessionDocuments([]);
    if (clearInput) setMentorQuestion("");
  };

  const loadMentorSessions = async (preferredSessionId = "") => {
    setMentorSessionsLoading(true);
    setMentorError("");

    try {
      const res = await fetch(`${MENTOR_API_BASE}/sessions`, MENTOR_FETCH_OPTIONS);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to load mentor sessions");
      }

      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      setMentorSessions(sessions);

      if (preferredSessionId) {
        await openMentorSession(preferredSessionId, sessions);
        return;
      }

      setMentorSessionId("");
      setMentorMessages([]);
      setSessionDocuments([]);
    } catch (err) {
      setMentorError(err.message || "Unable to connect to MentorBot");
    } finally {
      setMentorSessionsLoading(false);
    }
  };
  loadMentorSessionsRef.current = loadMentorSessions;

  const loadSessionDocuments = async (sessionId) => {
    if (!sessionId) {
      setSessionDocuments([]);
      return;
    }

    try {
      const res = await fetch(
        `${MENTOR_API_BASE}/documents/${sessionId}`,
        MENTOR_FETCH_OPTIONS
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to load documents");
      }
      setSessionDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (err) {
      setMentorError(err.message || "Unable to load documents");
    }
  };

  const deleteMentorChat = async (sessionId) => {
    if (!sessionId) return;

    setMentorError("");

    try {
      const res = await fetch(`${MENTOR_API_BASE}/delete-chat/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to delete chat");
      }

      const remaining = mentorSessions.filter(
        (session) => session.session_id !== sessionId
      );
      setMentorSessions(remaining);

      if (mentorSessionId === sessionId) {
        const nextId = remaining[0]?.session_id || "";
        if (nextId) {
          await openMentorSession(nextId, remaining);
        } else {
          setMentorSessionId("");
          setMentorMessages([]);
          setSessionDocuments([]);
          await createMentorChat();
        }
      }
    } catch (err) {
      setMentorError(err.message || "Unable to delete chat");
    }
  };

  const uploadSessionDocument = async (file) => {
    if (!file) return;
    setAttachMenuOpen(false);

    if (!mentorSessionId) {
      setMentorError("Start or open a chat before uploading a document.");
      return;
    }

    setDocumentUploading(true);
    setMentorError("");

    const formData = new FormData();
    formData.append("session_id", mentorSessionId);
    formData.append("file", file);

    try {
      const res = await fetch(`${MENTOR_API_BASE}/upload-document`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to upload document");
      }

      setSessionDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (err) {
      setMentorError(err.message || "Unable to upload document");
    } finally {
      setDocumentUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeSessionDocument = async (documentId) => {
    if (!mentorSessionId || !documentId) return;

    setMentorError("");

    try {
      const res = await fetch(
        `${MENTOR_API_BASE}/documents/${mentorSessionId}/${documentId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to remove document");
      }

      setSessionDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (err) {
      setMentorError(err.message || "Unable to remove document");
    }
  };

  const sendMentorMessage = async (promptOverride) => {
    const question = (promptOverride ?? mentorQuestion).trim();
    if (!question || mentorLoading) return;

    const optimisticMsg = {
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    setMentorLoading(true);
    setMentorError("");
    setMentorQuestion("");
    setMentorMessages((prev) => [...prev, optimisticMsg]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${MENTOR_API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          question,
          ...(mentorSessionId ? { session_id: mentorSessionId } : {}),
        }),
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error in connecting");
      }

      if (
        typeof data.answer === "string" &&
        data.answer.trim().toLowerCase().startsWith("error:")
      ) {
        throw new Error("Error in connecting");
      }

      setMentorSessionId(data.session_id || mentorSessionId);
      setMentorMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No response received.",
          timestamp: new Date().toISOString(),
        },
      ]);
      await loadMentorSessions(data.session_id || mentorSessionId);
    } catch (err) {
      setMentorMessages((prev) => prev.slice(0, -1));
      setMentorQuestion(question);
      setMentorError(
        err?.name === "AbortError"
          ? "Error in connecting"
          : err.message || "Error in connecting"
      );
    } finally {
      setMentorLoading(false);
    }
  };

  useEffect(() => {
    loadMentorHealthRef.current();
    loadMentorSessionsRef.current();
  }, []);

  const getSessionPreview = (session) => {
    const first = session?.messages?.find?.((message) => message.role === "user");
    const preview = first?.content || "New mentor chat";
    return preview.length > 40 ? `${preview.slice(0, 40)}...` : preview;
  };

  const formatSessionDate = (value) => {
    if (!value) return "Just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMentorMessage();
    }
  };

  const openDocumentPicker = () => {
    setAttachMenuOpen(false);
    fileInputRef.current?.click();
  };


  const hasConversation =
    mentorMessages.length > 0 || mentorLoading || mentorHistoryLoading;

  return (
    <div className="mentor-shell">
      <aside className="mentor-sidebar">
        <div className="mentor-sidebar-head">
          <div className="mentor-brand">
            <div className="mentor-brand-icon">
              <BotIcon />
            </div>
            <span className="mentor-brand-name">MentorBot</span>
          </div>
          <button
            className="mentor-new-btn"
            onClick={() => createMentorChat()}
            title="New chat"
          >
            <PlusIcon />
          </button>
        </div>

        <div className="mentor-health-card">
          <span
            className={`mentor-health-dot${
              mentorHealth?.status === "ok" ? " ok" : ""
            }`}
          />
          <p className="mentor-health-meta">
            {mentorHealth?.status === "ok"
              ? `${mentorHealth.active_sessions} sessions · ${mentorHealth.chroma_count} topics indexed`
              : "Connecting to backend..."}
          </p>
        </div>

        <div className="mentor-session-list">
          {mentorSessionsLoading && (
            <p className="sidebar-loading">Loading chats...</p>
          )}

          {!mentorSessionsLoading &&
            mentorSessions.map((session, index) => (
              <div
                key={session.session_id}
                className={`mentor-session-item${
                  mentorSessionId === session.session_id ? " active" : ""
                }`}
              >
                <button
                  type="button"
                  className="mentor-session-main"
                  onClick={() => openMentorSession(session.session_id)}
                >
                  <span className="mentor-session-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="mentor-session-copy">
                    <p className="mentor-session-title">
                      {getSessionPreview(session)}
                    </p>
                    <p className="mentor-session-meta">
                      {formatSessionDate(session.updated_at || session.created_at)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  className="mentor-delete-btn"
                  onClick={() => deleteMentorChat(session.session_id)}
                  aria-label="Delete chat"
                >
                  x
                </button>
              </div>
            ))}
        </div>
      </aside>

      <div className={`mentor-main${hasConversation ? " has-conversation" : " landing-mode"}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="mentor-hidden-file"
          onChange={(e) => uploadSessionDocument(e.target.files?.[0])}
        />

        <div className="mentor-topbar">
          <span className="mentor-topbar-title">AI Tutor · Course Assistant</span>
        </div>

        {mentorError && <p className="msg err">{mentorError}</p>}

        {sessionDocuments.length > 0 && (
          <div className="mentor-doc-strip">
            {sessionDocuments.map((document) => (
              <div className="mentor-doc-chip" key={document.document_id}>
                <div className="mentor-doc-copy">
                  <span className="mentor-doc-name">{document.file_name}</span>
                  <span className="mentor-doc-meta">
                    {document.chunk_count} chunks
                  </span>
                </div>
                <button
                  type="button"
                  className="mentor-doc-remove"
                  onClick={() => removeSessionDocument(document.document_id)}
                  aria-label={`Remove ${document.file_name}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {!hasConversation ? (
          <div className="mentor-landing">
            <div className="mentor-empty">
              <div className="mentor-empty-orb">
                <BotIcon />
              </div>
              <p className="mentor-empty-title">How can I help you today?</p>
              <p className="mentor-empty-sub">
                Ask about course topics, revision plans, viva prep, or concept
                explanations.
              </p>
            </div>

            <div className="mentor-composer-wrap landing">
              <div className="mentor-composer">
                <textarea
                  ref={textareaRef}
                  className="mentor-textarea"
                  placeholder="Ask about your course, assignments, viva prep, or any topic..."
                  value={mentorQuestion}
                  onChange={(e) => setMentorQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="mentor-composer-footer">
                  <div className="mentor-attach" ref={attachMenuRef}>
                    <button
                      type="button"
                      className="mentor-attach-btn"
                      onClick={() => setAttachMenuOpen((open) => !open)}
                      disabled={documentUploading}
                      aria-label="Add attachment"
                      aria-expanded={attachMenuOpen}
                    >
                      <PlusIcon />
                    </button>
                    {attachMenuOpen && (
                      <div className="mentor-attach-menu">
                        <button
                          type="button"
                          className="mentor-attach-option"
                          onClick={openDocumentPicker}
                          disabled={documentUploading}
                        >
                          <UploadIcon />
                          <span>
                            {documentUploading ? "Uploading..." : "Upload document"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="mentor-composer-hint">
                    Enter to send · Shift+Enter for new line
                  </span>
                  <button
                    className="mentor-send-btn"
                    onClick={() => sendMentorMessage()}
                    disabled={
                      mentorLoading ||
                      mentorHistoryLoading ||
                      !mentorQuestion.trim()
                    }
                  >
                    <SendIcon />
                    {mentorLoading ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mentor-quick-prompts landing">
              {MENTOR_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="mentor-prompt-chip"
                  onClick={() => sendMentorMessage(prompt)}
                  disabled={mentorLoading || mentorHistoryLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mentor-quick-prompts">
              {MENTOR_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="mentor-prompt-chip"
                  onClick={() => sendMentorMessage(prompt)}
                  disabled={mentorLoading || mentorHistoryLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mentor-feed" ref={mentorFeedRef}>
              {mentorHistoryLoading ? (
                <div className="history-loading">
                  <span className="spin" />
                  Loading conversation...
                </div>
              ) : (
                mentorMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${message.timestamp || index}-${index}`}
                    className={`mentor-bubble-row ${message.role}`}
                  >
                    <div
                      className={`mentor-avatar ${
                        message.role === "user" ? "user" : "bot"
                      }`}
                    >
                      {message.role === "user" ? "Y" : "M"}
                    </div>
                    <div className="mentor-bubble-body">
                      <div
                        className={`mentor-bubble ${
                          message.role === "user" ? "user" : "assistant"
                        }`}
                      >
                        {message.role === "assistant"
                          ? renderStructuredMessage(message.content)
                          : message.content}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {mentorLoading && (
                <div className="mentor-bubble-row assistant">
                  <div className="mentor-avatar bot">M</div>
                  <div className="mentor-bubble-body">
                    <div className="mentor-bubble assistant loading">
                      <div className="typing-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mentor-composer-wrap">
              <div className="mentor-composer">
                <textarea
                  ref={textareaRef}
                  className="mentor-textarea"
                  placeholder="Ask about your course, assignments, viva prep, or any topic..."
                  value={mentorQuestion}
                  onChange={(e) => setMentorQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="mentor-composer-footer">
                  <div className="mentor-attach" ref={attachMenuRef}>
                    <button
                      type="button"
                      className="mentor-attach-btn"
                      onClick={() => setAttachMenuOpen((open) => !open)}
                      disabled={documentUploading}
                      aria-label="Add attachment"
                      aria-expanded={attachMenuOpen}
                    >
                      <PlusIcon />
                    </button>
                    {attachMenuOpen && (
                      <div className="mentor-attach-menu">
                        <button
                          type="button"
                          className="mentor-attach-option"
                          onClick={openDocumentPicker}
                          disabled={documentUploading}
                        >
                          <UploadIcon />
                          <span>
                            {documentUploading ? "Uploading..." : "Upload document"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="mentor-composer-hint">
                    Enter to send · Shift+Enter for new line
                  </span>
                  <button
                    className="mentor-send-btn"
                    onClick={() => sendMentorMessage()}
                    disabled={
                      mentorLoading ||
                      mentorHistoryLoading ||
                      !mentorQuestion.trim()
                    }
                  >
                    <SendIcon />
                    {mentorLoading ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

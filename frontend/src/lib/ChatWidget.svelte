<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { sendMessage, getSessionHistory, type ChatMessage, ApiError } from './api';

  const SESSION_KEY = 'cozy_threads_session_id';

  let messages: ChatMessage[] = $state([]);
  let input = $state('');
  let sessionId = $state<string | undefined>(undefined);
  let loading = $state(false);
  let loadingHistory = $state(true);
  let error = $state<string | null>(null);
  let messagesEl: HTMLDivElement | undefined = $state();

  const suggestions = [
    "What's your return policy?",
    'Do you ship to the USA?',
    'What are your support hours?',
  ];

  onMount(async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      sessionId = stored;
      try {
        const history = await getSessionHistory(stored);
        messages = history.messages;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          localStorage.removeItem(SESSION_KEY);
          sessionId = undefined;
        }
      }
    }
    loadingHistory = false;
    await scrollToBottom();
  });

  async function scrollToBottom() {
    await tick();
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  async function handleSend(text?: string) {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    error = null;
    input = '';
    loading = true;

    const tempId = `temp-${Date.now()}`;
    messages = [
      ...messages,
      {
        id: tempId,
        sender: 'user',
        text: messageText,
        timestamp: new Date().toISOString(),
      },
    ];
    await scrollToBottom();

    try {
      const result = await sendMessage(messageText, sessionId);
      sessionId = result.sessionId;
      localStorage.setItem(SESSION_KEY, result.sessionId);

      messages = [
        ...messages,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: result.reply,
          timestamp: new Date().toISOString(),
        },
      ];

      if (result.error) {
        error = 'The agent had trouble responding. Please try again.';
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Unable to reach the server. Please check your connection.';
      error = msg;
      messages = messages.filter((m) => m.id !== tempId);
      input = messageText;
    } finally {
      loading = false;
      await scrollToBottom();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

<div class="chat-widget">
  <header class="chat-header">
    <div class="avatar">CT</div>
    <div class="header-text">
      <h2>Cozy Threads Support</h2>
      <p>{loading ? 'Agent is typing…' : 'Typically replies instantly'}</p>
    </div>
    <span class="status-dot" class:typing={loading}></span>
  </header>

  <div class="messages" bind:this={messagesEl}>
    {#if loadingHistory}
      <div class="empty-state">Loading conversation…</div>
    {:else if messages.length === 0}
      <div class="empty-state">
        <p>Hi there! 👋 How can we help you today?</p>
        <div class="suggestions">
          {#each suggestions as suggestion}
            <button
              class="suggestion"
              onclick={() => handleSend(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#each messages as msg (msg.id)}
      <div class="message" class:user={msg.sender === 'user'} class:ai={msg.sender === 'ai'}>
        {#if msg.sender === 'ai'}
          <div class="msg-avatar">CT</div>
        {/if}
        <div class="bubble">
          <p>{msg.text}</p>
          <time datetime={msg.timestamp}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        </div>
      </div>
    {/each}

    {#if loading}
      <div class="message ai typing-indicator">
        <div class="msg-avatar">CT</div>
        <div class="bubble typing-bubble">
          <span></span><span></span><span></span>
        </div>
      </div>
    {/if}
  </div>

  {#if error}
    <div class="error-banner" role="alert">{error}</div>
  {/if}

  <footer class="chat-input">
    <textarea
      bind:value={input}
      onkeydown={handleKeydown}
      placeholder="Type your message…"
      rows="1"
      disabled={loading}
      maxlength="4000"
    ></textarea>
    <button onclick={() => handleSend()} disabled={loading || !input.trim()} aria-label="Send message">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </button>
  </footer>
</div>

<style>
  .chat-widget {
    display: flex;
    flex-direction: column;
    height: 600px;
    max-height: 80vh;
    width: 100%;
    max-width: 420px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
    color: #fff;
  }

  .avatar, .msg-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #dfe6e9;
    color: #2d3436;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
  }

  .msg-avatar {
    width: 32px;
    height: 32px;
    font-size: 11px;
  }

  .header-text h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .header-text p {
    margin: 2px 0 0;
    font-size: 12px;
    opacity: 0.75;
  }

  .status-dot {
    margin-left: auto;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #55efc4;
    flex-shrink: 0;
  }

  .status-dot.typing {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #f8f9fa;
  }

  .empty-state {
    text-align: center;
    color: #636e72;
    padding: 24px 8px;
  }

  .empty-state p {
    margin: 0 0 16px;
    font-size: 15px;
  }

  .suggestions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .suggestion {
    background: #fff;
    border: 1px solid #dfe6e9;
    border-radius: 20px;
    padding: 10px 16px;
    font-size: 13px;
    color: #2d3436;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    font-family: inherit;
  }

  .suggestion:hover:not(:disabled) {
    background: #dfe6e9;
    border-color: #b2bec3;
  }

  .suggestion:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .message.user {
    justify-content: flex-end;
  }

  .bubble {
    max-width: 78%;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.45;
  }

  .message.user .bubble {
    background: #2d3436;
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .message.ai .bubble {
    background: #fff;
    color: #2d3436;
    border: 1px solid #dfe6e9;
    border-bottom-left-radius: 4px;
  }

  .bubble p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .bubble time {
    display: block;
    font-size: 10px;
    opacity: 0.5;
    margin-top: 4px;
    text-align: right;
  }

  .typing-bubble {
    display: flex;
    gap: 4px;
    padding: 14px 18px;
    align-items: center;
  }

  .typing-bubble span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #b2bec3;
    animation: bounce 1.2s ease-in-out infinite;
  }

  .typing-bubble span:nth-child(2) { animation-delay: 0.15s; }
  .typing-bubble span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }

  .error-banner {
    padding: 8px 16px;
    background: #ffeaa7;
    color: #6c5ce7;
    font-size: 13px;
    text-align: center;
    border-top: 1px solid #fdcb6e;
  }

  .chat-input {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #dfe6e9;
    background: #fff;
    align-items: flex-end;
  }

  .chat-input textarea {
    flex: 1;
    border: 1px solid #dfe6e9;
    border-radius: 20px;
    padding: 10px 16px;
    font-size: 14px;
    font-family: inherit;
    resize: none;
    outline: none;
    max-height: 100px;
    line-height: 1.4;
    transition: border-color 0.15s;
  }

  .chat-input textarea:focus {
    border-color: #636e72;
  }

  .chat-input textarea:disabled {
    opacity: 0.6;
    background: #f8f9fa;
  }

  .chat-input button {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: none;
    background: #2d3436;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, opacity 0.15s;
  }

  .chat-input button:hover:not(:disabled) {
    background: #636e72;
  }

  .chat-input button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>

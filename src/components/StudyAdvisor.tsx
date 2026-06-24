import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Key, X, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { Course } from '../types';
import { sendChat } from '../groqApi';
import type { ChatMessage } from '../groqApi';

const API_KEY_STORAGE = 'kth-grades-groq-key';

const SUGGESTIONS = [
  "What's the easiest way to improve my GPA?",
  "Which courses should I retake first?",
  "How realistic is it to reach 4.5?",
  "What's my strongest and weakest area?",
];

export function StudyAdvisor({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [keyInput, setKeyInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasKey = apiKey.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function saveKey() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(API_KEY_STORAGE, trimmed);
    setApiKey(trimmed);
    setKeyInput('');
    setError('');
  }

  function clearKey() {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKey('');
    setMessages([]);
    setError('');
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const reply = await sendChat(apiKey, courses, newMessages);
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
            <Sparkles size={20} />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900">AI Study Advisor</h2>
            <p className="text-xs text-gray-400">Ask personalized questions about your grades and GPA</p>
          </div>
        </div>
        {open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {!hasKey ? (
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm text-indigo-800 font-medium mb-1">Free AI-powered study advice</p>
                <p className="text-xs text-indigo-600">
                  This uses Groq's free Llama 3.3 70B model. Get a free API key (no credit card needed):
                </p>
                <ol className="text-xs text-indigo-600 mt-2 space-y-1 list-decimal list-inside">
                  <li>Go to <strong>console.groq.com</strong></li>
                  <li>Sign up with Google or GitHub</li>
                  <li>Go to API Keys and create one</li>
                  <li>Paste it below</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveKey()}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={saveKey}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium cursor-pointer"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Your key is stored only in your browser's localStorage. It's never sent anywhere except Groq's API.
              </p>
            </div>
          ) : (
            <div className="flex flex-col" style={{ height: '460px' }}>
              {/* Header bar */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <MessageCircle size={12} /> Llama 3.3 70B via Groq
                </span>
                <button
                  onClick={clearKey}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Remove API key
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 text-center">
                      Ask me anything about your grades, GPA, or study strategy.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => send(s)}
                          className="text-left text-xs px-3 py-2.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg border border-gray-200 transition-colors cursor-pointer text-gray-600"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 size={14} className="animate-spin" /> Thinking...
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                      <X size={12} /> {error}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about your grades..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
                    disabled={loading}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={loading || !input.trim()}
                    className="px-3 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

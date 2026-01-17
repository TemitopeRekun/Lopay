
import React, { useState, useRef, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { GoogleGenAI } from '@google/genai';
import { useApp } from '../context/AppContext';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

const SmartAssistant: React.FC = () => {
  const { childrenData, currentUser } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: `Hi ${currentUser?.name.split(' ')[0]}! I'm Lopa. Need help planning for the new term? I can calculate your initial deposit or help you track current installments. What's on your mind?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = childrenData.map(c => `- ${c.name} at ${c.school}: Plan ${c.status}, ₦${c.paidAmount} paid of ₦${c.totalFee}`).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMessage,
        config: {
          systemInstruction: `You are Lopa, the LOPAY Smart Assistant for Nigerian parents and students. 
          Your mission is to make school fee financing stress-free.
          
          LOPAY Core Values:
          - Transparency: Always mention the 25% activation deposit.
          - Ease: Encourage installments over lump sums.
          - Support: Remind them that installments (75%) go directly to the school verified accounts.
          
          Specific Platform Rules:
          - Plan Activation = 25% of tuition + 2.5% platform fee (escrowed by LOPAY).
          - Activation Bank Details: Bank Name: Lopay Technologies. Account Number: 9090390581. Bank: Moniepoint.
          - Remaining 75% = Split into 3 months (Semester) or 7 months (Session).
          - Payments after activation go directly to school bursary.
          
          User Status:
          ${context || 'No active plans found for this user.'}
          
          Tone: Empathetic, professional, and clear. Avoid overly technical financial jargon.`
        }
      });

      setMessages(prev => [...prev, { role: 'ai', text: response.text || "I'm having a little brain freeze. Could you ask that again?" }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', text: "Network issues are getting in our way. Please try again when your signal is stronger!" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav>
      <Header title="Lopa AI Assistant" />
      <div className="flex flex-col flex-1 h-[calc(100vh-160px)] pb-safe">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                m.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none shadow-lg shadow-primary/10' 
                : 'bg-gray-100 dark:bg-white/5 text-text-primary-light dark:text-text-primary-dark rounded-tl-none border border-gray-200 dark:border-gray-800'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
               <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-2xl rounded-tl-none border border-gray-200 dark:border-gray-800 flex gap-1">
                  <div className="size-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="size-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
               </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-card-dark border-t border-gray-100 dark:border-gray-800 mb-safe">
          <div className="relative flex items-center">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="How do installments work?"
              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-4 pr-14 outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-2 size-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
};

export default SmartAssistant;

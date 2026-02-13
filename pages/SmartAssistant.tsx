import React, { useState } from "react";
import { Layout } from "../components/Layout";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { useChildren } from "../hooks/useQueries";

const SmartAssistant: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { data: childrenData = [] } = useChildren();

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "Hello! I'm your Lopay smart assistant. Ask me about your pending payments, school updates, or transaction history.",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!query.trim()) return;

    const userMsg = query;
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setQuery("");
    setIsTyping(true);

    // Simulate AI processing
    setTimeout(() => {
      let response = "I'm not sure about that yet.";

      if (
        userMsg.toLowerCase().includes("how much") ||
        userMsg.toLowerCase().includes("pending")
      ) {
        const totalPending = childrenData.reduce((sum, child) => {
          const pending = (child.totalFee || 0) - (child.paidAmount || 0);
          return sum + Math.max(0, pending);
        }, 0);

        if (totalPending > 0) {
          response = `You have a total of ₦${totalPending.toLocaleString()} pending across all children. Would you like to pay now?`;
        } else {
          response = "You have no pending payments at the moment! 🎉";
        }
      } else if (
        userMsg.toLowerCase().includes("hello") ||
        userMsg.toLowerCase().includes("hi")
      ) {
        response = `Hi ${currentUser?.name.split(" ")[0]}! How can I help you today?`;
      } else if (userMsg.toLowerCase().includes("school")) {
        const schools = Array.from(new Set(childrenData.map((c) => c.school)));
        response = `Your children are enrolled in: ${schools.join(", ")}.`;
      }

      setMessages((prev) => [...prev, { role: "assistant", text: response }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <Layout>
      <Header title="Smart Assistant" />
      <div className="flex flex-col flex-1 overflow-hidden bg-gray-50 dark:bg-black/20">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-none"
                    : "bg-white dark:bg-card-dark border border-gray-100 dark:border-gray-800 rounded-bl-none shadow-sm"
                }`}
              >
                <p
                  className={`text-sm ${msg.role === "assistant" ? "text-text-primary-light dark:text-text-primary-dark" : "text-white"}`}
                >
                  {msg.text}
                </p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-card-dark p-4 rounded-2xl rounded-bl-none border border-gray-100 dark:border-gray-800 shadow-sm flex gap-1">
                <span className="size-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="size-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="size-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-card-dark border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask anything..."
              className="flex-1 bg-gray-100 dark:bg-white/5 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleSend}
              disabled={!query.trim() || isTyping}
              className="size-12 flex items-center justify-center bg-primary text-white rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SmartAssistant;

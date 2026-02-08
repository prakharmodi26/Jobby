"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Job } from "@/lib/types";
import { apiFetch } from "@/lib/api";

interface CoverLetterPanelProps {
  job: Job;
  onClose: () => void;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export function CoverLetterPanel({ job, onClose }: CoverLetterPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userMdEmpty, setUserMdEmpty] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const coverLetterRef = useRef<HTMLDivElement>(null);

  const latestCoverLetter = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

  // Slide-in animation on mount
  useEffect(() => {
    // Small delay to trigger CSS transition
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Initial generation
  useEffect(() => {
    generateCoverLetter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateCoverLetter(chatMessages?: ChatMessage[]) {
    setError(null);
    try {
      const body: { jobId: number; messages?: ChatMessage[] } = { jobId: job.id };
      if (chatMessages && chatMessages.length > 0) {
        body.messages = chatMessages;
      }

      const res = await apiFetch<{ coverLetter: string }>("/api/cover-letter/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const assistantMsg: ChatMessage = { role: "assistant", content: res.coverLetter };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate cover letter";
      if (msg.includes("userMd_empty") || msg.includes("Cover Letter Profile")) {
        setUserMdEmpty(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setSending(false);
    }
  }

  async function handleFollowUp() {
    if (!followUp.trim() || sending) return;
    setSending(true);

    const userMsg: ChatMessage = { role: "user", content: followUp.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setFollowUp("");

    await generateCoverLetter(updatedMessages);
  }

  function handleCopy() {
    if (!latestCoverLetter) return;
    navigator.clipboard.writeText(latestCoverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadPdf() {
    if (!latestCoverLetter || !coverLetterRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf()
      .set({
        margin: [20, 20, 20, 20],
        filename: `Cover_Letter_${job.company.replace(/\s+/g, "_")}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(coverLetterRef.current)
      .save();
  }

  return (
    <div
      className={`fixed left-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl border-r border-gray-200 flex flex-col z-[60] transition-transform duration-300 ease-out ${
        isVisible ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Cover Letter</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {job.title} at {job.company}
        </p>

        {/* Actions */}
        {latestCoverLetter && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleCopy}
              className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? "Copied!" : "Copy Text"}
            </button>
            <button
              onClick={handleDownloadPdf}
              className="text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <span className="ml-3 text-sm text-gray-500">Generating cover letter...</span>
          </div>
        )}

        {userMdEmpty && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 font-medium">
              Cover Letter Profile is empty
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Please fill in your Cover Letter Profile first.
            </p>
            <Link
              href="/profile"
              className="inline-block mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Go to Profile →
            </Link>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.role === "user" ? (
              <div className="bg-blue-50 text-blue-800 text-sm px-4 py-2 rounded-xl max-w-[85%]">
                {msg.content}
              </div>
            ) : (
              <div ref={i === messages.length - 1 && msg.role === "assistant" ? coverLetterRef : undefined}>
                <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-4">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            <span className="text-sm text-gray-500">Updating...</span>
          </div>
        )}
      </div>

      {/* Follow-up input */}
      {!userMdEmpty && !loading && messages.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleFollowUp();
                }
              }}
              placeholder="Ask for changes... (e.g., Make it shorter)"
              className="flex-1 text-sm border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              disabled={sending}
            />
            <button
              onClick={handleFollowUp}
              disabled={sending || !followUp.trim()}
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2.5 rounded-xl transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';

interface Attachment {
  type: 'image' | 'pdf';
  filename: string;
  mimeType: string;
  content: string;
}

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Skriv ett meddelande...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';

      if (!isImage && !isPDF) {
        alert(`Filtypen ${file.type} stöds inte. Endast PDF och bilder.`);
        continue;
      }

      // Validate size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert(`Filen ${file.name} är för stor. Max 10MB.`);
        continue;
      }

      // Read as base64
      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        type: isImage ? 'image' : 'pdf',
        filename: file.name,
        mimeType: file.type,
        content,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if ((!message.trim() && attachments.length === 0) || disabled) return;

    onSend(message.trim(), attachments.length > 0 ? attachments : undefined);
    setMessage('');
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  return (
    <div
      className={`border-t border-gray-800 bg-gray-900 p-4 ${
        isDragging ? 'ring-2 ring-emerald-500 ring-inset' : ''
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg text-sm"
            >
              <span>{att.type === 'pdf' ? '📄' : '🖼️'}</span>
              <span className="text-gray-300 max-w-[150px] truncate">
                {att.filename}
              </span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-gray-500 hover:text-red-400 ml-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-3">
        {/* File upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          title="Ladda upp rider (PDF eller bild)"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full bg-gray-800 text-gray-100 rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-500 disabled:opacity-50"
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />

          {/* Send button inside textarea */}
          <button
            onClick={handleSend}
            disabled={disabled || (!message.trim() && attachments.length === 0)}
            className="absolute right-2 bottom-2 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Drag hint */}
      {isDragging && (
        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900 px-6 py-3 rounded-xl text-emerald-400 font-medium">
            Släpp filen här
          </div>
        </div>
      )}

      {/* Hint text */}
      <p className="text-xs text-gray-500 mt-2 text-center">
        Dra och släpp PDF-rider eller skärmdumpar • Enter för att skicka • Shift+Enter för ny rad
      </p>
    </div>
  );
}

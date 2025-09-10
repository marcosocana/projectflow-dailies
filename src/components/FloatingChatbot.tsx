import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Trash2 } from 'lucide-react';
import { useChatbot } from '@/hooks/useChatbot';
import { cn } from '@/lib/utils';

interface FloatingChatbotProps {
  projectId?: string;
}

const FloatingChatbot: React.FC<FloatingChatbotProps> = ({ projectId }) => {
  const { messages, isLoading, isOpen, sendMessage, clearChat, toggleChat } = useChatbot(projectId);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    
    await sendMessage(inputValue);
    setInputValue('');
  };

  if (!projectId) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <Card className="mb-4 w-80 h-96 shadow-lg border-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Asistente IA del Proyecto
            </CardTitle>
            <div className="flex gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChat}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleChat}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex flex-col h-full p-3 pt-0">
            {/* Messages Area */}
            <ScrollArea className="flex-1 pr-3 mb-3">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    ¡Hola! Soy tu asistente IA. Puedo ayudarte con información sobre las tareas y contenido del proyecto.
                  </div>
                )}
                
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full",
                      message.isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {message.text}
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-muted-foreground max-w-[85%] rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Pregunta sobre las tareas..."
                disabled={isLoading}
                className="text-sm"
              />
              <Button 
                type="submit" 
                size="sm" 
                disabled={isLoading || !inputValue.trim()}
                className="px-3"
              >
                <Send className="h-3 w-3" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Floating Button */}
      <Button
        onClick={toggleChat}
        size="lg"
        className={cn(
          "rounded-full h-14 w-14 shadow-lg transition-all duration-300",
          isOpen ? "rotate-180" : "hover:scale-110"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Notification Badge */}
      {!isOpen && messages.length > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {messages.filter(m => !m.isUser).length}
        </div>
      )}
    </div>
  );
};

export default FloatingChatbot;
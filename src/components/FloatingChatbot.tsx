import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Trash2, Lock } from 'lucide-react';
import { useChatbot } from '@/hooks/useChatbot';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { cn } from '@/lib/utils';

interface FloatingChatbotProps {}

const FloatingChatbot: React.FC<FloatingChatbotProps> = () => {
  const { currentProject, accessProject, isAccessing } = useProjectAccess();
  const { messages, isLoading, isOpen, sendMessage, clearChat, toggleChat } = useChatbot(currentProject?.id);
  const [inputValue, setInputValue] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleChatToggle = () => {
    if (!currentProject) {
      setShowPasswordForm(true);
    }
    toggleChat();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    
    try {
      await accessProject(passwordInput);
      setPasswordInput('');
      setShowPasswordForm(false);
    } catch (error) {
      // El error ya se maneja en el hook
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !currentProject) return;
    
    await sendMessage(inputValue);
    setInputValue('');
  };

  console.log('FloatingChatbot currentProject:', currentProject); // Debug log
  
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <Card className="mb-4 w-80 h-96 shadow-lg border-2 absolute bottom-16 right-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {!currentProject ? "Acceso al Proyecto" : "Asistente IA del Proyecto"}
            </CardTitle>
            <div className="flex gap-1">
              {messages.length > 0 && currentProject && (
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
            {/* Password Form */}
            {!currentProject ? (
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-center text-muted-foreground text-sm mb-4">
                  <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Introduce la contraseña del proyecto para acceder al chatbot
                </div>
                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <Input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Contraseña del proyecto"
                    disabled={isAccessing}
                    className="text-sm"
                  />
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isAccessing || !passwordInput.trim()}
                  >
                    {isAccessing ? "Accediendo..." : "Acceder"}
                  </Button>
                </form>
              </div>
            ) : (
              <>
                {/* Messages Area */}
                <ScrollArea className="flex-1 pr-3 mb-3">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        ¡Hola! Soy tu asistente IA para el proyecto <strong>{currentProject.name}</strong>. 
                        Puedo ayudarte con información sobre las tareas y contenido del proyecto.
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
                <form onSubmit={handleChatSubmit} className="flex gap-2">
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
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Floating Button */}
      <Button
        onClick={handleChatToggle}
        size="lg"
        className={cn(
          "rounded-full h-14 w-14 shadow-lg transition-all duration-300",
          isOpen ? "rotate-180 bg-primary hover:bg-primary/90" : "hover:scale-110 bg-primary hover:bg-primary/90"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Notification Badge */}
      {!isOpen && messages.length > 0 && currentProject && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {messages.filter(m => !m.isUser).length}
        </div>
      )}
    </div>
  );
};

export default FloatingChatbot;
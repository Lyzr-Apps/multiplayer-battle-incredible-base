'use client'

import { useState, useEffect, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, Menu, Search, X } from 'lucide-react'
import { FiCalendar, FiSmile, FiMeh, FiFrown, FiSun } from 'react-icons/fi'

// TypeScript interfaces based on actual test responses
interface DiaryAgentResponse {
  status: string
  result: {
    response: string
    follow_up_questions: string[]
    insights: string
    mood_detected: string
  }
  metadata: {
    agent_name: string
    timestamp: string
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  mood?: string
  insights?: string
  followUpQuestions?: string[]
}

interface DiaryEntry {
  id: string
  date: Date
  preview: string
  mood: string
  messages: Message[]
}

const AGENT_ID = '6988355929694629a3a35973'

// Mood icon mapping
const getMoodIcon = (mood: string) => {
  const moodLower = mood.toLowerCase()
  if (moodLower.includes('happy') || moodLower.includes('joy') || moodLower.includes('celebrat')) {
    return <FiSmile className="text-accent" />
  }
  if (moodLower.includes('sad') || moodLower.includes('struggling') || moodLower.includes('anxious')) {
    return <FiFrown className="text-accent" />
  }
  if (moodLower.includes('calm') || moodLower.includes('peaceful') || moodLower.includes('inviting')) {
    return <FiSun className="text-primary" />
  }
  return <FiMeh className="text-muted-foreground" />
}

// Format date helper
const formatDate = (date: Date): string => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Format time helper
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Group entries by month
const groupByMonth = (entries: DiaryEntry[]) => {
  const groups: { [key: string]: DiaryEntry[] } = {}

  entries.forEach(entry => {
    const monthYear = entry.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!groups[monthYear]) {
      groups[monthYear] = []
    }
    groups[monthYear].push(entry)
  })

  return groups
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load entries from localStorage
  useEffect(() => {
    const savedEntries = localStorage.getItem('diaryEntries')
    if (savedEntries) {
      const parsed = JSON.parse(savedEntries)
      setEntries(parsed.map((e: any) => ({
        ...e,
        date: new Date(e.date),
        messages: e.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      })))
    }
  }, [])

  // Save entries to localStorage
  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem('diaryEntries', JSON.stringify(entries))
    }
  }, [entries])

  // Auto-save current conversation
  useEffect(() => {
    if (messages.length > 0) {
      saveCurrentEntry()
    }
  }, [messages])

  const saveCurrentEntry = () => {
    if (messages.length === 0) return

    const firstUserMessage = messages.find(m => m.role === 'user')
    const preview = firstUserMessage ? firstUserMessage.content.slice(0, 50) : 'New entry'
    const mood = messages.find(m => m.mood)?.mood || 'neutral'

    const entry: DiaryEntry = {
      id: currentEntryId || `entry-${Date.now()}`,
      date: new Date(),
      preview: preview + (firstUserMessage && firstUserMessage.content.length > 50 ? '...' : ''),
      mood,
      messages
    }

    setEntries(prev => {
      const existing = prev.findIndex(e => e.id === entry.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = entry
        return updated
      }
      return [entry, ...prev]
    })

    if (!currentEntryId) {
      setCurrentEntryId(entry.id)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const result = await callAIAgent(userMessage.content, AGENT_ID)

      if (result.success && result.response) {
        const agentData = result.response as DiaryAgentResponse

        if (agentData.status === 'success' && agentData.result) {
          const assistantMessage: Message = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: agentData.result.response,
            timestamp: new Date(),
            mood: agentData.result.mood_detected,
            insights: agentData.result.insights,
            followUpQuestions: agentData.result.follow_up_questions
          }

          setMessages(prev => [...prev, assistantMessage])
        } else {
          throw new Error('Invalid response format')
        }
      } else {
        throw new Error('Failed to get response')
      }
    } catch (error) {
      console.error('Error calling agent:', error)
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const loadEntry = (entry: DiaryEntry) => {
    setMessages(entry.messages)
    setCurrentEntryId(entry.id)
    setSidebarOpen(false)
  }

  const startNewEntry = () => {
    setMessages([])
    setCurrentEntryId(null)
    setInput('')
  }

  const filteredEntries = entries.filter(entry =>
    entry.preview.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedEntries = groupByMonth(filteredEntries)

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-foreground">Your Journal</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>

          <Button
            onClick={startNewEntry}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            New Entry
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.keys(groupedEntries).length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No entries yet. Start writing!
            </div>
          ) : (
            Object.entries(groupedEntries).map(([month, monthEntries]) => (
              <div key={month}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {month}
                </h3>
                <div className="space-y-2">
                  {monthEntries.map(entry => (
                    <Card
                      key={entry.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        currentEntryId === entry.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => loadEntry(entry)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <FiCalendar className="h-3 w-3" />
                            {formatDate(entry.date)}
                          </span>
                          {getMoodIcon(entry.mood)}
                        </div>
                        <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                          {entry.preview}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-serif text-xl font-semibold text-foreground">
                {getGreeting()}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formatDate(new Date())}
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center py-12">
              <div className="mb-6">
                <FiSun className="h-16 w-16 mx-auto text-primary mb-4" />
                <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  Welcome to your personal space
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Share your thoughts, feelings, and experiences. I'm here to listen and support you.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt('How was today?')}
                  className="border-border hover:bg-secondary"
                >
                  How was today?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt('I need to vent')}
                  className="border-border hover:bg-secondary"
                >
                  I need to vent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt('Celebrate a win')}
                  className="border-border hover:bg-secondary"
                >
                  Celebrate a win
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message, index) => {
                // Show date separator
                const showDateSeparator = index === 0 ||
                  formatDate(messages[index - 1].timestamp) !== formatDate(message.timestamp)

                return (
                  <div key={message.id}>
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-6">
                        <div className="bg-secondary px-3 py-1 rounded-full text-xs text-muted-foreground">
                          {formatDate(message.timestamp)}
                        </div>
                      </div>
                    )}

                    {message.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%]">
                          <div className="bg-accent text-primary-foreground rounded-lg p-4 shadow-sm">
                            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 text-right">
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="max-w-[80%]">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                <FiSun className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                                <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>

                                {message.insights && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                                      {message.insights}
                                    </p>
                                  </div>
                                )}

                                {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                                      Reflect on:
                                    </p>
                                    {message.followUpQuestions.map((question, i) => (
                                      <p key={i} className="text-sm text-foreground leading-relaxed">
                                        • {question}
                                      </p>
                                    ))}
                                  </div>
                                )}

                                {message.mood && (
                                  <div className="mt-3 flex items-center gap-2">
                                    {getMoodIcon(message.mood)}
                                    <span className="text-xs text-muted-foreground capitalize">
                                      {message.mood}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <FiSun className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card p-4">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt('How was today?')}
                  className="border-border hover:bg-secondary text-sm"
                >
                  How was today?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt('I need to vent')}
                  className="border-border hover:bg-secondary text-sm"
                >
                  I need to vent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrompt('Celebrate a win')}
                  className="border-border hover:bg-secondary text-sm"
                >
                  Celebrate a win
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Share what's on your mind..."
                rows={3}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                style={{ maxHeight: '144px', minHeight: '72px' }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="self-end bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

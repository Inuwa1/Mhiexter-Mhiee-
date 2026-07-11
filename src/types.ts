
export interface SelectionFile {
  name: string;
  type: string;
  data: string;
  textContent?: string;
  isVisualSearch?: boolean;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  images?: string[];
  videos?: string[];
  files?: { name: string, data: string, type: string }[];
  generatedImage?: string;
  suggestions?: string[];
  groundingMetadata?: any;
  isEdited?: boolean;
  isThinking?: boolean;
  replyTo?: { text: string, role: string };
  audio?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned?: boolean;
}

export interface UserPreferences {
  selectedVoiceId: string;
  themeChoice: 'dark' | 'light';
  defaultDownloadQuality: 'high' | 'medium' | 'low';
  elevenLabsApiKey?: string;
  preferredWakeWord?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: number;
  updatedAt: number;
  preferences: UserPreferences;
}

export interface MemoryItem {
  id?: string;
  uid: string;
  content: string;
  category: 'user_preference' | 'mechatronics' | 'coding' | 'general_knowledge' | 'preference' | 'episodic' | 'semantic' | 'project' | 'task';
  importance: number;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface TaskNode {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  type: 'coding' | 'electrical' | 'mechatronic' | 'testing' | 'agent_query' | 'agent_process';
  prerequisites?: string[];
  tool?: 'search' | 'memory_retrieve' | 'compare' | 'generate_report' | 'save_memory' | 'create_reminder';
  toolInput?: string;
  toolOutput?: string;
  reflection?: string;
}

export interface Reminder {
  id: string;
  uid: string;
  planId?: string;
  title: string;
  description: string;
  remindAt: number;
  status: 'pending' | 'triggered' | 'dismissed';
  createdAt: number;
}

export interface TaskPlan {
  id: string;
  uid: string;
  request: string;
  tasks: TaskNode[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface DownloadTask {
  id: string;
  uid: string;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  size: string;
  type: string;
  createdAt: number;
}


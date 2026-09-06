export type MessageRole = 'user' | 'model';

export type ReflectionMode = 
  | 'clear_mind' 
  | 'make_decision' 
  | 'capture_idea' 
  | 'plan_next_step' 
  | 'reflect' 
  | 'brainstorm' 
  | 'summarize' 
  | 'action_items';

export interface ExtractedCommitmentDraft {
  title: string;
  category?: MilestoneCategory;
  targetTimeframe?: string;
  notes?: string;
}

export interface ClarityCardData {
  whatIHeard: string;
  coreDilemma: string;
  suggestedNextStep: string;
  extractedCommitment?: ExtractedCommitmentDraft | null;
  commitmentConfirmed?: boolean;
  commitmentDismissed?: boolean;
  confirmedMilestoneId?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  mode?: ReflectionMode;
  clarityCard?: ClarityCardData | null;
}

export interface LocationTag {
  placeName: string;
  formattedAddress?: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  taggedAt?: string;
}

export interface ReflectionEntry {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  tags: string[];
  summary?: string;
  isPinned?: boolean;
  location?: LocationTag;
  webhookExportedAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAdmin?: boolean;
}

export type WebhookTargetType = 'slack' | 'discord' | 'custom_json' | 'email_digest';

export interface WebhookConfig {
  id: string;
  userId: string;
  targetType: WebhookTargetType;
  webhookUrl: string;
  isEnabled: boolean;
  createdAt: string;
  lastDispatchedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  targetType: string;
  timestamp: string;
  status: 'SUCCESS' | 'DENIED' | 'ERROR';
  metadata?: Record<string, string | number | boolean>;
}

export interface AdminSystemStats {
  totalReflections: number;
  activeUsersCount: number;
  totalMessagesCount: number;
  modeDistribution: Record<string, number>;
  recentAuditLogs: AuditLog[];
  serverHealth: {
    status: string;
    uptime: number;
    geminiLadderReady: boolean;
    firestoreConnected: boolean;
  };
}

export type MilestoneCategory =
  | 'project'
  | 'decision'
  | 'idea'
  | 'blocker'
  | 'learning'
  | 'personal'
  | 'general'
  | 'infrastructure'
  | 'scaling'
  | 'product'
  | 'architecture'
  | 'operations';

export type MilestoneStatus = 'planned' | 'in_progress' | 'achieved';

export interface Milestone {
  id: string;
  userId: string;
  title: string;
  category: MilestoneCategory;
  targetTimeframe?: string;
  status: MilestoneStatus;
  extractedFromSessionId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type FeedbackCategory = 'general' | 'bug' | 'feature' | 'praise';

export interface FeedbackEntry {
  id: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  message: string;
  category: FeedbackCategory;
  createdAt: string;
}

export type AppView = 
  | 'dashboard' 
  | 'reflections' 
  | 'milestones' 
  | 'patterns' 
  | 'export' 
  | 'locations'
  | 'settings' 
  | 'admin-dashboard' 
  | 'spatial-map';


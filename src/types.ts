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
  id?: string;
  placeName: string;
  formattedAddress?: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  taggedAt?: string;
  precision?: 'approximate' | 'neighborhood' | 'exact';
  category?: 'home' | 'nature' | 'work' | 'cafe' | 'study' | 'travel' | 'other';
  notes?: string;
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

export type ThemeSetting = 'light' | 'dark' | 'system';
export type TimeFormatSetting = '12h' | '24h' | 'system';
export type ReflectionIntentSetting = 
  | 'clear_mind' 
  | 'make_decision' 
  | 'capture_idea' 
  | 'plan_next_step' 
  | 'ask_each_time';

export type ReflectionToneSetting = 
  | 'calm' 
  | 'practical' 
  | 'curious';

export interface ReminderConfig {
  enabled: boolean;
  time: string; // e.g. "20:00"
  daysOfWeek: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  timezone: string;
}

export interface UserPreferences {
  defaultIntent: ReflectionIntentSetting;
  reflectionTone: ReflectionToneSetting;
  voiceInputEnabled: boolean;
  timeFormat: TimeFormatSetting;
  reminder: ReminderConfig;
  theme: ThemeSetting;
}

export type WebhookTargetType = 'slack' | 'discord' | 'custom_json' | 'email_digest';

export type WebhookEventTrigger = 'manual_only' | 'reflection_completed' | 'commitment_saved' | 'export_ready';
export type WebhookPayloadScope = 'title_only' | 'approved_summary' | 'full_reflection';

export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  timestamp: string;
  eventType: WebhookEventTrigger | string;
  statusCode: number;
  status: 'success' | 'failed';
  deliveryId: string;
  retryCount: number;
  durationMs: number;
  error?: string;
}

export interface WebhookConfig {
  id: string;
  userId: string;
  name: string;
  targetType: WebhookTargetType;
  webhookUrl: string;
  secret?: string;
  maskedSecret?: string;
  isEnabled: boolean;
  isPaused?: boolean;
  consecutiveFailures?: number;
  pauseReason?: string;
  triggerEvents: WebhookEventTrigger[];
  payloadScope: WebhookPayloadScope;
  includeTags: boolean;
  includeCommitments: boolean;
  includePlaceName: boolean;
  includeExactCoordinates?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastDispatchedAt?: string;
  lastDeliveryStatus?: 'success' | 'failed';
}

export type ExportDateScope = '30_days' | '90_days' | 'all' | 'custom';
export type ExportFormat = 'zip_markdown' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  dateScope: ExportDateScope;
  startDate?: string;
  endDate?: string;
  includeCommitments: boolean;
  includePlaces: boolean;
  includeExactCoordinates: boolean;
  includeInsights: boolean;
  includeTags: boolean;
  excludeDrafts: boolean;
  selectedTagFilter?: string;
  selectedPlaceFilter?: string;
}

export interface ExportManifest {
  exportDate: string;
  schemaVersion: string;
  totalReflections: number;
  totalMessages: number;
  totalCommitments: number;
  totalPlaces: number;
  dateRange: {
    scope: ExportDateScope;
    from?: string;
    to?: string;
  };
  includedCategories: string[];
  excludedCategories: string[];
  exactCoordinatesIncluded: boolean;
  appVersion: string;
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
  | 'personal'
  | 'work'
  | 'study'
  | 'wellbeing'
  | 'relationship'
  | 'decision'
  | 'idea'
  | 'project';

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

export interface FeedbackDiagnostics {
  appVersion: string;
  userAgent: string;
  platform: string;
  screenResolution: string;
  language: string;
  timezone: string;
}

export interface FeedbackEntry {
  id: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  allowContact?: boolean;
  message: string;
  category: FeedbackCategory;
  diagnostics?: FeedbackDiagnostics | null;
  createdAt: string;
}

export type AppView = 
  | 'dashboard' 
  | 'reflections' 
  | 'workspace'
  | 'milestones' 
  | 'patterns' 
  | 'export' 
  | 'locations'
  | 'settings' 
  | 'admin-dashboard' 
  | 'spatial-map';

export interface SupportingReflection {
  title: string;
  date: string;
}

export interface RecurringTheme {
  id: string;
  title: string;
  description: string;
  supporting_reflections: SupportingReflection[];
  validationStatus?: 'accurate' | 'inaccurate' | null;
  isSaved?: boolean;
  isHidden?: boolean;
}

export interface ChangeInPerspective {
  id: string;
  title: string;
  description: string;
  supporting_reflections: SupportingReflection[];
  validationStatus?: 'accurate' | 'inaccurate' | null;
  isSaved?: boolean;
  isHidden?: boolean;
}

export interface PossibleNextStep {
  id: string;
  title: string;
  description: string;
  isSavedAsCommitment?: boolean;
  isDismissed?: boolean;
}

export interface JourneyPatternResult {
  recurring_themes: RecurringTheme[];
  changes_in_perspective: ChangeInPerspective[];
  possible_next_steps: PossibleNextStep[];
  synthesisMarkdown?: string;
  modelUsed?: string;
  entriesAnalyzed?: number;
  dateRange?: string;
  analyzedAt?: string;
}

export interface SavedInsight {
  id: string;
  userId: string;
  type: 'theme' | 'perspective' | 'next_step';
  title: string;
  description: string;
  supportingReflections?: SupportingReflection[];
  savedAt: string;
}


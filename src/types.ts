export interface UserProfile {
  id: string;
  app_user_id: string;
  full_name: string;
  email: string;
  demo_virtual_number: string;
  avatar_url: string;
  bio: string;
  account_status: 'active' | 'suspended' | 'pending_verification';
  otp_verified: number;
  is_online: number;
  last_seen_at: string;
  created_at?: string;
  message_count?: number;
  call_count?: number;
}

export interface DemoOtpInfo {
  code: string;
  expiresAt: string;
  disclaimer: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface ConversationItem {
  peer: UserProfile;
  lastMessage: ChatMessage;
  unreadCount: number;
}

export interface CallRecord {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'audio';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  started_at: string;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  caller_name?: string;
  caller_number?: string;
  caller_avatar?: string;
  callee_name?: string;
  callee_number?: string;
  callee_avatar?: string;
}

export type MobileScreenId =
  | 'splash'
  | 'login'
  | 'register'
  | 'home'
  | 'contacts'
  | 'dialer'
  | 'incoming_call'
  | 'active_call'
  | 'chat_list'
  | 'private_chat'
  | 'demo_number'
  | 'profile'
  | 'settings';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  onlineUsers: number;
  verifiedUsers: number;
  totalCalls: number;
  totalCallDuration: number;
  totalMessages: number;
}

export interface AdminCallRecord extends CallRecord {
  caller_name: string;
  caller_number: string;
  callee_name: string;
  callee_number: string;
}

export interface AdminMessageRecord extends ChatMessage {
  sender_name: string;
  sender_number: string;
  receiver_name: string;
  receiver_number: string;
}

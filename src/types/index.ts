export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ContentType = 'text' | 'photo' | 'video';

export type BadgeType = 'cadet' | 'ex_cadet';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  verification_status: VerificationStatus;
  id_card_url: string | null;
  is_blocked: boolean;
  restricted_until: string | null;
  avatar_url?: string | null;
  badge?: BadgeType | null;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad';

export interface Post {
  id: string;
  user_id: string;
  content_type: ContentType;
  text_content: string | null;
  media_url: string | null;
  is_removed: boolean;
  created_at: string;
  author_name?: string;
  author_username?: string;
  author_avatar_url?: string | null;
  author_badge?: BadgeType | null;
  author_is_admin?: boolean;
  mentioned_by_me?: boolean;
  mentions_me?: boolean;
}

export interface SlideshowPhoto {
  id: string;
  photo_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminProfile {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  verification_status: VerificationStatus;
  id_card_url: string | null;
  is_blocked: boolean;
  restricted_until: string | null;
  created_at: string;
  badge: BadgeType | null;
  is_admin: boolean;
}

export interface FriendRequest {
  requester_id: string;
  requester_name: string;
  requester_username: string;
  requester_avatar_url?: string | null;
  requester_badge?: BadgeType | null;
  requester_is_admin?: boolean;
  created_at: string;
}

export interface SentRequest {
  addressee_id: string;
  addressee_name: string;
  addressee_username: string;
  addressee_avatar_url?: string | null;
  addressee_badge?: BadgeType | null;
  addressee_is_admin?: boolean;
  created_at: string;
}

export interface Friend {
  friend_id: string;
  friend_name: string;
  friend_username: string;
  friend_avatar_url?: string | null;
  friend_badge?: BadgeType | null;
  friend_is_admin?: boolean;
  since: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  full_name: string;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  created_at: string;
  friend_count: number;
  avatar_url?: string | null;
  badge?: BadgeType | null;
  is_admin?: boolean;
}

export interface Conversation {
  conversation_id: string;
  friend_id: string;
  friend_name: string;
  friend_username: string;
  friend_avatar_url?: string | null;
  friend_badge?: BadgeType | null;
  friend_is_admin?: boolean;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface Message {
  message_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface DiscoverUser {
  user_id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
  badge?: BadgeType | null;
  is_admin?: boolean;
  friendship_status: string;
}

export interface Note {
  note_id: string;
  user_id: string;
  author_name: string;
  author_username: string;
  author_avatar_url?: string | null;
  content: string;
  expires_at: string;
  created_at: string;
  is_friend?: boolean;
}

export interface MyNote {
  note_id: string;
  content: string;
  expires_at: string;
  created_at: string;
}

export interface ChatGroup {
  group_id: string;
  name: string;
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_by: string;
}

export interface ChatGroupMessage {
  message_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ChatGroupMember {
  user_id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_username: string;
  author_avatar_url: string | null;
}

export interface ReactionSummary {
  counts: Record<ReactionType, number>;
  mine: ReactionType | null;
}

export type NotificationType =
  | 'message'
  | 'group_message'
  | 'comment'
  | 'reaction'
  | 'friend_request'
  | 'friend_accept';

export type NotificationLinkType = 'conversation' | 'group' | 'post' | 'profile' | null;

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_id: string | null;
  link_type: NotificationLinkType;
  is_read: boolean;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  actor_badge?: BadgeType | null;
  actor_is_admin?: boolean;
}

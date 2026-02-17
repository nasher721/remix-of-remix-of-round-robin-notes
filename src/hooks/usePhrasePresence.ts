import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, User } from '@supabase/supabase-js';

export interface PhrasePresenceState {
  viewers: Array<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    lastSeen: Date;
    cursorPosition?: number;
  }>;
  editors: Array<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    cursorPosition: number;
    selection?: { start: number; end: number };
    startedEditing: Date;
  }>;
  viewerCount: number;
  isBeingEdited: boolean;
  currentEditorId: string | null;
}

export interface UsePhrasePresenceOptions {
  phraseId: string;
  onPresenceChange?: (state: PhrasePresenceState) => void;
  onEditStarted?: (userId: string, userName: string) => void;
  onEditEnded?: (userId: string, userName: string) => void;
  enabled?: boolean;
}

interface SupabasePresencePayload {
  userId: string;
  userName: string;
  avatarUrl?: string;
  status: 'viewing' | 'editing';
  cursorPosition?: number;
  selection?: { start: number; end: number };
  startedEditing?: string;
}

export function usePhrasePresence(options: UsePhrasePresenceOptions) {
  const { phraseId, onPresenceChange, onEditStarted, onEditEnded, enabled = true } = options;
  const { user } = useAuth();
  
  const [presenceState, setPresenceState] = useState<PhrasePresenceState>({
    viewers: [],
    editors: [],
    viewerCount: 0,
    isBeingEdited: false,
    currentEditorId: null,
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isEditingRef = useRef(false);

  /**
   * Start editing a phrase
   * Broadcasts cursor position and locks the phrase for others
   */
  const startEditing = useCallback(async (cursorPosition: number = 0) => {
    if (!channelRef.current || !user) return;
    
    isEditingRef.current = true;
    
    await channelRef.current.track({
      status: 'editing',
      userId: user.id,
      userName: (user.user_metadata?.full_name as string) || user.email || 'Anonymous',
      avatarUrl: user.user_metadata?.avatar_url as string,
      cursorPosition,
      startedEditing: new Date().toISOString(),
    });
    
    setPresenceState(prev => ({
      ...prev,
      isBeingEdited: true,
      currentEditorId: user.id,
    }));
  }, [user]);

  /**
   * Update cursor position while editing
   */
  const updateCursorPosition = useCallback(async (cursorPosition: number, selection?: { start: number; end: number }) => {
    if (!channelRef.current || !isEditingRef.current || !user) return;
    
    await channelRef.current.track({
      status: 'editing',
      userId: user.id,
      userName: (user.user_metadata?.full_name as string) || user.email || 'Anonymous',
      avatarUrl: user.user_metadata?.avatar_url as string,
      cursorPosition,
      selection,
      startedEditing: new Date().toISOString(),
    });
  }, [user]);

  /**
   * Stop editing a phrase
   */
  const stopEditing = useCallback(async () => {
    if (!channelRef.current || !user) return;
    
    isEditingRef.current = false;
    
    await channelRef.current.track({
      status: 'viewing',
      userId: user.id,
      userName: (user.user_metadata?.full_name as string) || user.email || 'Anonymous',
      avatarUrl: user.user_metadata?.avatar_url as string,
      cursorPosition: undefined,
      startedEditing: undefined,
    });
    
    setPresenceState(prev => ({
      ...prev,
      isBeingEdited: false,
      currentEditorId: null,
    }));
  }, [user]);

  // Set up the phrase-specific realtime channel
  useEffect(() => {
    if (!enabled || !phraseId) return;
    
    const channel = supabase.channel(`phrase:${phraseId}`, {
      config: {
        presence: { key: user?.id },
      },
    });
    
    channelRef.current = channel;
    
    // Handle presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      
      const viewers: PhrasePresenceState['viewers'] = [];
      const editors: PhrasePresenceState['editors'] = [];
      
      Object.values(state).forEach((presences: unknown) => {
        (presences as Array<Record<string, unknown>>).forEach((presence) => {
          const presenceStatus = presence.status as string;
          const presenceUserId = presence.userId as string;
          const presenceUserName = presence.userName as string;
          const presenceAvatarUrl = presence.avatarUrl as string | undefined;
          const presenceCursorPosition = presence.cursorPosition as number | undefined;
          const presenceSelection = presence.selection as { start: number; end: number } | undefined;
          
          const userBase = {
            userId: presenceUserId,
            userName: presenceUserName,
            avatarUrl: presenceAvatarUrl,
          };
          
          if (presenceStatus === 'editing') {
            const startedEditing = presence.startedEditing as string;
            editors.push({
              ...userBase,
              cursorPosition: presenceCursorPosition || 0,
              selection: presenceSelection,
              startedEditing: new Date(startedEditing),
            });
          } else {
            viewers.push({
              ...userBase,
              lastSeen: new Date(),
              cursorPosition: presenceCursorPosition,
            });
          }
        });
      });
      
      // Only keep non-editors in viewers (editors are already tracked)
      const viewerIds = new Set(editors.map(e => e.userId));
      const nonEditorViewers = viewers.filter(v => !viewerIds.has(v.userId));
      
      const newState: PhrasePresenceState = {
        viewers: nonEditorViewers,
        editors,
        viewerCount: Object.keys(state).length,
        isBeingEdited: editors.length > 0,
        currentEditorId: editors.length > 0 ? editors[0].userId : null,
      };
      
      setPresenceState(newState);
      onPresenceChange?.(newState);
      
      // Notify about edit start/end
      const previousState = presenceStateRef.current;
      if (previousState && editors.length > 0 && previousState.editors.length === 0) {
        // Someone started editing
        const newEditor = editors[0];
        if (newEditor.userId !== user?.id) {
          onEditStarted?.(newEditor.userId, newEditor.userName);
        }
      } else if (previousState && editors.length === 0 && previousState.editors.length > 0) {
        // Someone stopped editing
        const oldEditor = previousState.editors[0];
        if (oldEditor.userId !== user?.id) {
          onEditEnded?.(oldEditor.userId, oldEditor.userName);
        }
      }
      
      presenceStateRef.current = newState;
    });
    
    // Handle user joining
    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      (newPresences as Array<Record<string, unknown>>).forEach((presence) => {
        if (presence.userId !== user?.id) {
          // Another user joined viewing this phrase
        }
      });
    });
    
    // Handle user leaving
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      (leftPresences as Array<Record<string, unknown>>).forEach((presence) => {
        const presenceStatus = presence.status as string;
        const presenceUserId = presence.userId as string;
        const presenceUserName = presence.userName as string;
        if (presenceStatus === 'editing' && presenceUserId !== user?.id) {
          onEditEnded?.(presenceUserId, presenceUserName);
        }
      });
    });
    
    // Subscribe and track
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && user) {
        await channel.track({
          status: 'viewing',
          userId: user.id,
          userName: (user.user_metadata?.full_name as string) || user.email || 'Anonymous',
          avatarUrl: user.user_metadata?.avatar_url as string,
        });
      }
    });
    
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [phraseId, enabled, user?.id]);
  
  // Use ref to track previous state for change detection
  const presenceStateRef = useRef(presenceState);
  presenceStateRef.current = presenceState;

  return {
    presenceState,
    startEditing,
    updateCursorPosition,
    stopEditing,
    isEditing: isEditingRef.current,
  };
}

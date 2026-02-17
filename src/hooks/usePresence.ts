import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@supabase/supabase-js';

interface PresenceUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  lastSeen: number;
  currentPage?: string;
}

interface PresenceState {
  users: PresenceUser[];
  totalOnline: number;
}

/** Build the payload sent to Supabase presence tracking. */
function buildTrackPayload(user: User, page: string = 'dashboard') {
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
    avatar_url: user.user_metadata?.avatar_url || null,
    lastSeen: Date.now(),
    currentPage: page,
  };
}

/**
 * Hook for real-time presence tracking.
 * Tracks which users are currently online and their activity.
 */
export function usePresence(channelId: string = 'global') {
  const { user } = useAuth();
  const [presenceState, setPresenceState] = useState<PresenceState>({
    users: [],
    totalOnline: 0,
  });
  const [isConnected, setIsConnected] = useState(false);

  const channel = `presence-${channelId}`;

  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel(channel, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Handle presence sync
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: PresenceUser[] = [];

        Object.entries(state).forEach(([key, presences]) => {
          if (presences[0]) {
            const presence = presences[0] as unknown as PresenceUser;
            // Skip current user
            if (key === user.id) return;
            users.push({
              id: key,
              email: presence.email || '',
              name: presence.name,
              avatar_url: presence.avatar_url,
              lastSeen: presence.lastSeen || Date.now(),
              currentPage: presence.currentPage,
            });
          }
        });

        setPresenceState({
          users,
          totalOnline: users.length + 1, // +1 for current user
        });
        setIsConnected(true);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log('User joined:', key);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('User left:', key);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track(buildTrackPayload(user));
        }
      });

    // Update presence periodically to show activity
    const interval = setInterval(async () => {
      await presenceChannel.track(buildTrackPayload(user));
    }, 30000);

    return () => {
      clearInterval(interval);
      presenceChannel.untrack();
      presenceChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [user, channel]);

  const updatePage = useCallback(async (page: string) => {
    if (!user) return;

    const presenceChannel = supabase.channel(channel);
    await presenceChannel.track(buildTrackPayload(user, page));
  }, [user, channel]);

  return {
    ...presenceState,
    isConnected,
    updatePage,
  };
}

/**
 * Hook to track presence for a specific patient.
 */
export function usePatientPresence(patientId: string) {
  return usePresence(`patient-${patientId}`);
}


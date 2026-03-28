import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

export interface OnlineUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  lastSeen: number;
  currentPage?: string;
}

export interface PatientPresence {
  patientId: string;
  viewingUsers: OnlineUser[];
  editingUserId: string | null;
}

export interface TeamContextType {
  teamId: string | null;
  teamMembers: TeamMember[];
  currentUserRole: 'admin' | 'member' | 'viewer' | null;
  isTeamAdmin: boolean;
  isLoadingTeam: boolean;

  onlineUsers: OnlineUser[];
  totalOnline: number;
  isPresenceConnected: boolean;

  patientPresence: Map<string, PatientPresence>;
  getPatientViewers: (patientId: string) => OnlineUser[];
  isPatientBeingEdited: (patientId: string) => boolean;
  getPatientEditor: (patientId: string) => OnlineUser | null;

  joinPatientChannel: (patientId: string) => void;
  leavePatientChannel: (patientId: string) => void;
  setEditingPatient: (patientId: string | null) => void;
  refreshTeamMembers: () => Promise<void>;
}

const TeamContext = React.createContext<TeamContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TEAM_ID: 'rr_team_id',
} as const;

interface TeamProviderProps {
  children: React.ReactNode;
  initialTeamId?: string | null;
}

export const TeamProvider = ({ children, initialTeamId = null }: TeamProviderProps) => {
  const { user } = useAuth();

  const [teamId, setTeamId] = React.useState<string | null>(() => {
    if (initialTeamId) return initialTeamId;
    try {
      return localStorage.getItem(STORAGE_KEYS.TEAM_ID);
    } catch {
      return null;
    }
  });

  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = React.useState<'admin' | 'member' | 'viewer' | null>(null);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState(false);

  const [patientPresence, setPatientPresence] = React.useState<Map<string, PatientPresence>>(new Map());
  const [editingPatientId, setEditingPatientIdState] = React.useState<string | null>(null);

  const patientChannelsRef = React.useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());

  const { users: onlineUsers, totalOnline, isConnected: isPresenceConnected } = usePresence('global');

  React.useEffect(() => {
    if (teamId) {
      try {
        localStorage.setItem(STORAGE_KEYS.TEAM_ID, teamId);
      } catch {
        // Ignore storage errors
      }
    }
  }, [teamId]);

  const fetchTeamMembers = React.useCallback(async () => {
    if (!user || !teamId) {
      setTeamMembers([]);
      setCurrentUserRole(null);
      return;
    }

    setIsLoadingTeam(true);
    try {
      const { data: members, error } = await supabase
        .from('phrase_team_members')
        .select('user_id, role, created_at')
        .eq('team_id', teamId);

      if (error) {
        console.error('Failed to fetch team members:', error);
        setTeamMembers([]);
        return;
      }

      const memberIds = (members || []).map((m) => m.user_id);
      const mappedMembers: TeamMember[] = [];

      for (const m of members || []) {
        let memberInfo: TeamMember = {
          id: m.user_id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown',
          avatarUrl: user.user_metadata?.avatar_url || null,
          role: (m.role as 'admin' | 'member' | 'viewer') || 'member',
          joinedAt: m.created_at,
        };

        if (memberIds.length > 0) {
          try {
            const { data: authData } = await supabase.auth.admin.listUsers();
            const authUser = authData?.users.find((u) => u.id === m.user_id);
            if (authUser) {
              memberInfo = {
                id: m.user_id,
                email: authUser.email || memberInfo.email,
                name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || memberInfo.name,
                avatarUrl: authUser.user_metadata?.avatar_url || null,
                role: (m.role as 'admin' | 'member' | 'viewer') || 'member',
                joinedAt: m.created_at,
              };
            }
          } catch (error) {
            console.error('[TeamContext] Failed to list users (admin API unavailable in browser):', error);
          }
        }

        mappedMembers.push(memberInfo);
      }

      setTeamMembers(mappedMembers);

      const myMembership = mappedMembers.find((m) => m.id === user.id);
      setCurrentUserRole(myMembership?.role || null);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setTeamMembers([]);
    } finally {
      setIsLoadingTeam(false);
    }
  }, [user, teamId]);

  React.useEffect(() => {
    if (teamId) {
      void fetchTeamMembers();
    }
  }, [teamId, fetchTeamMembers]);

  const isTeamAdmin = currentUserRole === 'admin';

  const filteredOnlineUsers = React.useMemo(() => {
    if (!teamId) {
      return onlineUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        avatarUrl: u.avatar_url || null,
        lastSeen: u.lastSeen,
        currentPage: u.currentPage,
      }));
    }
    const teamMemberIds = new Set(teamMembers.map((m) => m.id));
    return onlineUsers
      .filter((u) => teamMemberIds.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        avatarUrl: u.avatar_url || null,
        lastSeen: u.lastSeen,
        currentPage: u.currentPage,
      }));
  }, [onlineUsers, teamMembers, teamId]);

  const getPatientViewers = React.useCallback(
    (patientId: string): OnlineUser[] => {
      const presence = patientPresence.get(patientId);
      if (!presence) return [];

      if (teamId) {
        const teamMemberIds = new Set(teamMembers.map((m) => m.id));
        return presence.viewingUsers.filter((u) => teamMemberIds.has(u.id));
      }

      return presence.viewingUsers;
    },
    [patientPresence, teamMembers, teamId]
  );

  const isPatientBeingEdited = React.useCallback(
    (patientId: string): boolean => {
      return editingPatientId === patientId;
    },
    [editingPatientId]
  );

  const getPatientEditor = React.useCallback(
    (patientId: string): OnlineUser | null => {
      const presence = patientPresence.get(patientId);
      if (!presence || !presence.editingUserId) return null;

      if (teamId) {
        const teamMemberIds = new Set(teamMembers.map((m) => m.id));
        if (!teamMemberIds.has(presence.editingUserId)) return null;
      }

      return presence.viewingUsers.find((u) => u.id === presence.editingUserId) || null;
    },
    [patientPresence, teamMembers, teamId]
  );

  const joinPatientChannel = React.useCallback(
    (patientId: string) => {
      if (!user || patientChannelsRef.current.has(patientId)) return;

      const channelName = `presence-patient-${patientId}`;
      const presenceChannel = supabase.channel(channelName, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const viewers: OnlineUser[] = [];

          Object.entries(state).forEach(([key, presences]) => {
            if (presences[0]) {
              const presence = presences[0] as unknown as OnlineUser & { currentPage?: string };
              if (key === user.id) return;

              viewers.push({
                id: key,
                email: presence.email || '',
                name: presence.name || presence.email?.split('@')[0] || 'Unknown',
                avatarUrl: presence.avatarUrl || null,
                lastSeen: presence.lastSeen || Date.now(),
                currentPage: presence.currentPage,
              });
            }
          });

          setPatientPresence((prev) => {
            const next = new Map(prev);
            const existing = next.get(patientId);
            next.set(patientId, {
              patientId,
              viewingUsers: viewers,
              editingUserId: existing?.editingUserId || null,
            });
            return next;
          });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
              avatarUrl: user.user_metadata?.avatar_url || null,
              lastSeen: Date.now(),
              currentPage: `patient-${patientId}`,
            });
          }
        });

      patientChannelsRef.current.set(patientId, presenceChannel);
    },
    [user]
  );

  const leavePatientChannel = React.useCallback(
    (patientId: string) => {
      const channel = patientChannelsRef.current.get(patientId);
      if (channel) {
        void channel.untrack();
        channel.unsubscribe();
        patientChannelsRef.current.delete(patientId);
      }

      setPatientPresence((prev) => {
        const next = new Map(prev);
        next.delete(patientId);
        return next;
      });
    },
    []
  );

  const setEditingPatient = React.useCallback(
    (patientId: string | null) => {
      if (editingPatientId && editingPatientId !== patientId) {
        const channel = patientChannelsRef.current.get(editingPatientId);
        if (channel && user) {
          void channel.track({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
            avatarUrl: user.user_metadata?.avatar_url || null,
            lastSeen: Date.now(),
            currentPage: `patient-${editingPatientId}`,
          });
        }
      }

      setEditingPatientIdState(patientId);

      if (patientId) {
        const channel = patientChannelsRef.current.get(patientId);
        if (channel && user) {
          void channel.track({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
            avatarUrl: user.user_metadata?.avatar_url || null,
            lastSeen: Date.now(),
            currentPage: `editing-patient-${patientId}`,
          });
        }
      }
    },
    [editingPatientId, user]
  );

  React.useEffect(() => {
    return () => {
      patientChannelsRef.current.forEach((channel) => {
        void channel.untrack();
        channel.unsubscribe();
      });
      patientChannelsRef.current.clear();
    };
  }, []);

  React.useEffect(() => {
    if (!user) {
      setTeamId(null);
      setTeamMembers([]);
      setCurrentUserRole(null);
      setPatientPresence(new Map());

      patientChannelsRef.current.forEach((channel) => {
        void channel.untrack();
        channel.unsubscribe();
      });
      patientChannelsRef.current.clear();
    }
  }, [user]);

  const value = React.useMemo<TeamContextType>(
    () => ({
      teamId,
      teamMembers,
      currentUserRole,
      isTeamAdmin,
      isLoadingTeam,
      onlineUsers: filteredOnlineUsers,
      totalOnline: filteredOnlineUsers.length,
      isPresenceConnected,
      patientPresence,
      getPatientViewers,
      isPatientBeingEdited,
      getPatientEditor,
      joinPatientChannel,
      leavePatientChannel,
      setEditingPatient,
      refreshTeamMembers: fetchTeamMembers,
    }),
    [
      teamId,
      teamMembers,
      currentUserRole,
      isTeamAdmin,
      isLoadingTeam,
      filteredOnlineUsers,
      isPresenceConnected,
      patientPresence,
      getPatientViewers,
      isPatientBeingEdited,
      getPatientEditor,
      joinPatientChannel,
      leavePatientChannel,
      setEditingPatient,
      fetchTeamMembers,
    ]
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeam = (): TeamContextType => {
  const context = React.useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

export async function getUserTeamId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('phrase_team_members')
      .select('team_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data.team_id;
  } catch {
    return null;
  }
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('phrase_team_members')
      .select('user_id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

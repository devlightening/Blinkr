import { acceptFriendRequest, blockUser, cancelFriendRequest, declineFriendRequest, removeFriend, sendFriendRequest, unblockUser } from './api';
import type { FriendAction } from './friends';
import type { AuthResponse, Relation } from './types';

type Refresh = { onAuthRefresh?: (auth: AuthResponse) => void; onSessionExpired?: () => void };

/** Runs one friend action and returns the relation the server now reports. */
export const runFriendAction = async (auth: AuthResponse, action: FriendAction, userId: string, refresh: Refresh = {}): Promise<Relation> => {
  const call = action === 'add' ? sendFriendRequest
    : action === 'accept' ? acceptFriendRequest
    : action === 'decline' ? declineFriendRequest
    : action === 'cancel' ? cancelFriendRequest
    : action === 'block' ? blockUser
    : action === 'unblock' ? unblockUser
    : removeFriend;
  return (await call(auth, userId, refresh)).relation;
};

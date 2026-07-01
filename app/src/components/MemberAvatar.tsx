import React, { useEffect, useState } from 'react';
import { Avatar, type AvatarProps } from './Avatar';
import { avatars as avatarsApi } from '@/api';

export type MemberAvatarProps = Omit<AvatarProps, 'source'> & {
  /** Storage path stored on the record's `avatar_url` (or null for initials). */
  avatarPath?: string | null;
};

/**
 * Avatar that renders a family member's uploaded photo when present,
 * resolving the private storage path to a short-lived signed URL, and
 * falling back to initials while loading or when no photo is set.
 */
export const MemberAvatar: React.FC<MemberAvatarProps> = ({ avatarPath, ...rest }) => {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!avatarPath) {
      setUri(null);
      return;
    }
    void avatarsApi.signedAvatarUrl(avatarPath).then((u) => {
      if (mounted) setUri(u);
    });
    return () => {
      mounted = false;
    };
  }, [avatarPath]);

  return <Avatar {...rest} source={uri ? { uri } : undefined} />;
};

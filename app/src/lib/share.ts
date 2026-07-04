import { Share } from 'react-native';

export type ShareInviteInput = {
  /** 6-digit invite code. */
  code: string;
  /** Fully-qualified https://cappy.closedose.com/join/{code} link. */
  link: string;
  familyName?: string;
  role?: 'caregiver' | 'guest';
};

/**
 * Open the OS share sheet with a caregiver/guest invite. Works with any
 * share target the user has (Messages, WhatsApp, Mail, AirDrop, copy…),
 * which is the "typical sharing options" Quick Share path.
 *
 * Returns true if the sheet was shown (not necessarily completed).
 */
export const shareInviteLink = async (input: ShareInviteInput): Promise<boolean> => {
  const family = input.familyName?.trim() || 'our family';
  const roleWord = input.role === 'guest' ? 'temporary guest access to' : 'a caregiver for';
  const message =
    `Join ${family} on Cappy so we can safely coordinate kids' medicine together. ` +
    `You'll have ${roleWord} ${family}.\n\n` +
    `Tap to join: ${input.link}\n\n` +
    `Or open Cappy and enter code ${input.code}.`;
  try {
    const result = await Share.share({ message, url: input.link });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
};

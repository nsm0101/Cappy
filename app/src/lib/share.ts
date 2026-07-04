import { Platform, Share } from 'react-native';

export type ShareInviteInput = {
  /** 6-digit invite code. */
  code: string;
  /** Fully-qualified https://cappy.closedose.com/join/{code} link. */
  link: string;
  familyName?: string;
  role?: 'caregiver' | 'guest';
};

/**
 * Built-in iOS share-sheet activities that are just noise for a one-line
 * invite link — social posting, print, save-to-photos, reading list,
 * contact card, markup, iBooks. Excluding them (rather than trying to
 * force AirDrop to the front, which iOS doesn't let a third-party app do)
 * leaves AirDrop, Messages, Mail and Copy as the visible options, which is
 * as close to an "AirDrop-first" sheet as the public API allows.
 * `Share.share`'s `excludedActivityTypes` option is iOS-only; ignored on
 * Android.
 */
const IOS_EXCLUDED_ACTIVITY_TYPES = [
  'com.apple.UIKit.activity.PostToFacebook',
  'com.apple.UIKit.activity.PostToTwitter',
  'com.apple.UIKit.activity.PostToWeibo',
  'com.apple.UIKit.activity.PostToTencentWeibo',
  'com.apple.UIKit.activity.PostToFlickr',
  'com.apple.UIKit.activity.PostToVimeo',
  'com.apple.UIKit.activity.Print',
  'com.apple.UIKit.activity.AssignToContact',
  'com.apple.UIKit.activity.SaveToCameraRoll',
  'com.apple.UIKit.activity.AddToReadingList',
  'com.apple.UIKit.activity.OpenInIBooks',
  'com.apple.UIKit.activity.MarkupAsPDF',
];

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
    const result = await Share.share(
      { message, url: input.link },
      Platform.OS === 'ios' ? { excludedActivityTypes: IOS_EXCLUDED_ACTIVITY_TYPES } : undefined,
    );
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
};

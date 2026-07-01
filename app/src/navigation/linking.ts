import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from './types';

const TAG_URL_HOST =
  process.env.EXPO_PUBLIC_TAG_URL_HOST ?? 'cappy.closedose.com';

/**
 * Universal-link + custom-scheme routing.
 *
 * An NFC tag tap resolves to `https://cappy.closedose.com/t/{UID}`.
 * That maps to the `Scan` screen with the UID delivered as the
 * `initialTagUid` route param, which ScanScreen auto-resolves.
 */
export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    `https://${TAG_URL_HOST}`,
    'cappy://',
  ],
  config: {
    screens: {
      App: {
        screens: {
          Scan: 't/:initialTagUid',
        },
      },
    },
  },
};

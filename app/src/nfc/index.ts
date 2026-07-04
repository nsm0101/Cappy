export {
  initNfc,
  scanOnce,
  writeUri,
  cancelNfcScan,
  parseTagUrl,
  isNfcSupported,
} from './nfcService';
export type { NfcScanError, NfcScanResult, NfcWriteResult } from './nfcService';

export {
  initNfc,
  scanOnce,
  writeUri,
  cancelNfcScan,
  parseTagUrl,
  isNfcSupported,
} from './nfcService';
export type {
  NfcScanError,
  NfcScanResult,
  NfcWriteResult,
  NfcWritePhase,
} from './nfcService';

export { isHceAvailable, startHceBroadcast } from './hceBroadcast';
export type {
  HceBroadcastPhase,
  HceBroadcastHandle,
  HceBroadcastResult,
} from './hceBroadcast';

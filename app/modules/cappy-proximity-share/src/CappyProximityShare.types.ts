export type ProximityPhase =
  | 'searching'
  | 'connected'
  | 'ranging'
  | 'sent'
  | 'received'
  | 'suspended'
  | 'disconnected'
  | 'stopped';

export type ProximityPhaseEvent = { phase: ProximityPhase };
export type ProximityRangeEvent = { distanceMeters: number };
export type ProximityReceiveEvent = { payload: string };
export type ProximityErrorEvent = { message: string };

export type CappyProximityShareModuleEvents = {
  onPhase: (event: ProximityPhaseEvent) => void;
  onRange: (event: ProximityRangeEvent) => void;
  onReceive: (event: ProximityReceiveEvent) => void;
  onError: (event: ProximityErrorEvent) => void;
};

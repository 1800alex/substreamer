import type {
  CastDeviceKind,
  CastProtocol,
  CastReceiverCapabilities,
} from 'react-native-queue-player';

/**
 * Normalised picker row payload. Mirrors `CastReceiver` from RNQP plus a few
 * derived UI fields (`isActive`, `isConnecting`, `lastError`) that the picker
 * layer tracks.
 */
/**
 * RNQP's protocol, plus `mpd` for Music Player Daemon servers (RNQP reports
 * them as `chromecast` pull-URL receivers with an `mpd:` id).
 */
export type RouteProtocol = CastProtocol | 'mpd';

/** A self-hosted Cast receiver's certificate awaiting the user's trust. */
export interface RouteTrust {
  /** SHA-256 of the certificate it presented (lowercase hex). */
  fingerprint: string;
  /** True when a different certificate was pinned for this receiver. */
  changed: boolean;
}

export interface RouteInfo {
  id: string;
  protocol: RouteProtocol;
  protocolVersion: string;
  name: string;
  modelName: string;
  iconHint: CastDeviceKind;
  capabilities: CastReceiverCapabilities;
  /** True for the row currently delivering audio. */
  isActive: boolean;
  /** True while a `connect(receiverId)` is in flight. */
  isConnecting: boolean;
  /** Last connect error code surfaced to the user (resets on next attempt). */
  lastError?: string;
  /** Set when connecting needs the user to trust the receiver's certificate. */
  trust?: RouteTrust;
}

/**
 * Discovery lifecycle state shown in the sheet header.
 *
 * `permission-pending` and `permission-denied` are deliberately separate. iOS only lists
 * an app under Settings > Privacy > Local Network once the app has ASKED, so telling an
 * un-asked user to go to Settings sends them to a screen where the app does not appear.
 */
export type DiscoveryState =
  | 'idle' | 'scanning' | 'permission-pending' | 'permission-denied' | 'error';

/** Theming tokens for the picker. Built from the app theme via useRoutePickerTheme. */
export interface RoutePickerTheme {
  background: string;
  surface: string;
  text: string;
  textSubtle: string;
  border: string;
  accent: string;
  activeIndicator: string;
  connectingIndicator: string;
  errorIndicator: string;
}

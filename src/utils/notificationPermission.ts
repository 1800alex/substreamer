import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

/**
 * Whether we may post a notification right now. Never shows a prompt, so it is the
 * only permission call safe to make from an AppState 'background' transition: on
 * Android the permission dialog brings a backgrounded app back to the front, and
 * dismissing it by switching away again does not count as a denial, so asking there
 * keeps yanking the user back for as long as the work runs.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/**
 * Ask for notification permission, but only while the app is in the foreground and
 * only if the OS will still show the dialog. Returns whether a prompt was shown, so
 * callers can limit themselves to one ask per session.
 */
export async function requestNotificationPermissionInForeground(): Promise<boolean> {
  if (AppState.currentState !== 'active') return false;
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  if (granted || !canAskAgain) return false;
  // The await above gives the user time to switch away; re-check before prompting.
  if (AppState.currentState !== 'active') return false;
  await Notifications.requestPermissionsAsync();
  return true;
}

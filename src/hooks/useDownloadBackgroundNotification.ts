import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { musicCacheStore } from '../store/musicCacheStore';
import {
  hasNotificationPermission,
  requestNotificationPermissionInForeground,
} from '../utils/notificationPermission';

const CHANNEL_ID = 'downloads';

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Downloads',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function hasActiveDownloads(queue: { status: string }[]): boolean {
  return queue.some((q) => q.status === 'queued' || q.status === 'downloading');
}

export function useDownloadBackgroundNotification() {
  const { t } = useTranslation();
  const notificationId = useRef<string | null>(null);
  const askedThisSession = useRef(false);

  // Starting a download is the user's own action, so that is when we ask for the
  // permission the background notification needs, at most once per session.
  useEffect(() => {
    return musicCacheStore.subscribe((state, prev) => {
      if (askedThisSession.current) return;
      if (!hasActiveDownloads(state.downloadQueue) || hasActiveDownloads(prev.downloadQueue)) return;
      requestNotificationPermissionInForeground()
        .then((asked) => { if (asked) askedThisSession.current = true; })
        .catch(() => { /* the notification is a nicety; never block downloads on it */ });
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const hasActive = hasActiveDownloads(musicCacheStore.getState().downloadQueue);

      if (next === 'background' && hasActive) {
        // Check only: a prompt from here would pull the app back to the foreground.
        if (!(await hasNotificationPermission())) return;

        notificationId.current = await Notifications.scheduleNotificationAsync({
          content: {
            title: t('downloadsInProgress'),
            body: t('downloadsInProgressBody'),
            ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
        });
      } else if (next === 'active' && notificationId.current) {
        await Notifications.dismissNotificationAsync(notificationId.current);
        notificationId.current = null;
      }
    });

    return () => sub.remove();
  }, [t]);
}

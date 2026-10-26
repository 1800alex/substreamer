# TODO

## Background notifications no longer steal focus (2026-10-26)

- [ ] Device check on Android 13+ with notification permission **not** granted:
  - start a download and switch to another app; Substreamer must stay in the background;
  - the permission prompt should appear once, when the download starts, while you are still in the app.
- [ ] Device check with permission granted: the "Downloads in progress" notification still appears after you switch away, and clears when you return.
- Root cause (from reading the code, not reproduced on a device): the three `use*BackgroundNotification` hooks called `requestPermissionsAsync()` on every switch to the background. On Android the dialog brings the app back to the front, and switching away dismisses it without counting as a deny, so it repeated. They now only check (`src/utils/notificationPermission.ts`). Only downloads prompt, from the foreground. Library sync and migration never prompt; they post only if permission was already granted. Covered by Jest only.

## Self-hosted Cast receivers + MPD (2026-10-24)

- [ ] Device test on Android: open the route picker and check that `Garage Cast`, `rpi-mpd-office Cast` and the three `Music Player @ …` MPD servers are listed. Then check that:
  - Connecting to a Cast receiver shows the trust panel with a fingerprint matching `receiver.py --fingerprint`.
  - Trust and connect plays, and Settings → Trusted Cast receivers then lists it.
  - An MPD server plays, pauses, seeks, advances to the next track, and reports a takeover when another client starts a song.
- [ ] Not checked on a phone:
  - the mDNS scan (Wi-Fi multicast lock, Android 16 local-network permission);
  - the shape of the Nitro rejection message;
  - MPD fetching the lease from the phone.
- Already checked (dev box, 2026-10-24):
  - RNQP compiles and all 11 `cast.direct` suites pass (`make test-rnqp`);
  - a real-LAN scan from the dev box found all five receivers;
  - a read-only `status` against the real MPD 0.24 on alex-desktop parsed correctly;
  - Jest passes.
- [ ] iOS has no direct-cast or MPD path in RNQP, so these receivers are Android-only.
- [ ] MPD passwords are not supported (a permission refusal is reported as a connect/media error).

## Playback speed while casting (2026-10-24)

- [ ] Device check: while casting (AirPlay, Cast, MPD) the player's speed button shows a dimmed `1x` and does nothing; after switching back to the phone it shows and applies the saved speed again. Only Jest covers this.
- [ ] If speed on genuine Chromecasts is ever wanted: RNQP's `ChromecastSession.setPlaybackRate` exists but nothing calls it on a rate change, and the button is now disabled for every cast route.

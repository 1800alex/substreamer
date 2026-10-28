# TODO

## MPD dies after a few songs; Cast play/pause icon flips (2026-10-28)

- [ ] Reproduce the MPD stall on the OnePlus (`ae182bfb`) with the diagnostic build while capturing `adb logcat -s MpdSession MediaLeaseServer`. The logs show each MPD status change (state/songid/error/elapsed), each load, and each lease fetch (range, upstream code/length, bytes proxied, failure + duration). Find out where it stops before changing behaviour.
- [ ] Read the rpi's MPD log for the same window (`journalctl -u mpd` on rpi-mpd-office; needs Alex's OK to ssh).
- [ ] Try Substreamer's battery usage set to "Unrestricted" on the OnePlus (it is not on the deviceidle whitelist). When MPD is the output, the phone makes no sound but must keep serving the lease for the whole track. A frozen app would stall MPD's fetch and let MPD drop the idle control connection. Unverified hypothesis.
- Seen 2026-10-28: office MPD (0.24.0) left with `state: stop`, no error, and our last song still queued. So `MpdSession.close()` never got its `stop`/`deleteid` through, most likely because the control connection was already gone.
- [ ] Known gap: `MpdSession` waits forever, without telling the app, if MPD stops before a poll ever saw our song play (`started` stays false, no `error`), or if MPD sits in `play` with a fetch that never progresses. Add a watchdog/error once the logs show which case happens.
- [ ] Device check for the icon fix: cast to `rpi-mpd-office Cast` for several tracks; the button must stay Pause the whole time. The fix: `TrackPlayer.emitStateIfChanged` ignores the parked local engine once the receiver has reported, matching `getState()`. Covered by `TrackPlayerCastStateTest`; which local event triggered it on the phone was not identified.
- [ ] Device check for the notification fix: while casting to MPD or a self-hosted Cast receiver, the notification and lock screen show the receiver's current song, play/pause state and progress, follow track changes, and their play/pause/seek control the receiver (not the phone). Cause: `LeasedQueuePlayer` had no `mediaSessionPlayer`, so the MediaSession stayed on the parked local player. Now `LeasedSessionPlayer` (Media3 `SimpleBasePlayer`) is the session player; covered by `LeasedSessionPlayerTest` only.
- Seen 2026-10-28: with the diagnostic build and the phone on USB (charging), MPD played about a dozen tracks without stalling.
- Pre-existing, unrelated: `EqualizerLegacyEngineTest` (19 tests) fails under `make test-rnqp FILTER='com.margelo.nitro.queueplayer.*'` with Robolectric "Requires newer sdk version #29 (current version is #27)". It fails the same way without this change.

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

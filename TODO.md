# TODO

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

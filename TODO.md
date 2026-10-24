# TODO

## Self-hosted Cast receivers: discovery + trust on first use (2026-10-24)

- [ ] Device test on Android: open the route picker and check that `Garage Cast` and `rpi-mpd-office Cast` are listed, connect to one, and check Settings → Trusted Cast receivers shows `SHA-256 <first 8 hex>…` matching `receiver.py --fingerprint`. Covered so far: RNQP compiles (Gradle `testReleaseUnitTest`, all 37 `cast.direct` tests pass), a real-LAN scan from the dev box (both receivers found), and Jest. Not checked: the scan running on a phone (Wi-Fi multicast lock, Android 16 local-network permission), and the shape of the Nitro rejection message on a real device.
- [ ] iOS has no direct-cast path in RNQP, so self-hosted receivers are Android-only.

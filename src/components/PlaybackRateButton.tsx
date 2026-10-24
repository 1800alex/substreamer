/**
 * PlaybackRateButton – text label showing the current playback speed.
 *
 * Displays the current rate (e.g. "1x") and opens the PlaybackSpeedSheet
 * picker on tap. Uses textPrimary at the default 1x rate, and the primary
 * accent colour when sped up / slowed.
 *
 * Disabled (shown as 1x, which is what plays) while casting: no cast route
 * changes speed. AirPlay's PCM sinks ignore playback parameters, and
 * Chromecast, self-hosted Cast and MPD receivers play at 1x. Pitch correction
 * only lives in the speed sheet, so it is unreachable too.
 */

import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCast } from 'react-native-queue-player';

import { PlaybackSpeedSheet } from './PlaybackSpeedSheet';
import { useTheme } from '../hooks/useTheme';
import { playbackSettingsStore } from '../store/playbackSettingsStore';

/** Format rate into a compact label: 1 → "1x", 0.75 → ".75x", 1.25 → "1.25x". */
function formatRate(rate: number): string {
  if (Number.isInteger(rate)) return `${rate}x`;
  if (rate < 1) return `${rate.toString().replace('0.', '.')}x`;
  return `${rate}x`;
}

export const PlaybackRateButton = memo(function PlaybackRateButton() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const storedRate = playbackSettingsStore((s) => s.playbackRate);
  const casting = useCast().route.castProtocol !== 'local';
  const playbackRate = casting ? 1 : storedRate;
  const [sheetVisible, setSheetVisible] = useState(false);

  const handlePress = useCallback(() => {
    setSheetVisible(true);
  }, []);

  const isDefault = playbackRate === 1;
  const labelColor = isDefault ? colors.textPrimary : colors.primary;

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={casting}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ disabled: casting }}
        accessibilityLabel={casting ? t('playbackSpeedUnavailableCasting') : t('playbackSpeedLabel', { rate: playbackRate })}
        style={({ pressed }) => [
          styles.container,
          casting && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[styles.label, { color: labelColor }]}
          allowFontScaling={false}
        >
          {formatRate(playbackRate)}
        </Text>
      </Pressable>

      <PlaybackSpeedSheet visible={sheetVisible && !casting} onClose={() => setSheetVisible(false)} />
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});

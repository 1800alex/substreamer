/**
 * SecondaryControlsGrid — the player's secondary controls row laid out as
 * equal-width slots spread edge to edge, used when the volume button is
 * shown: sleep timer, skip back, rate, volume, skip forward, bookmark. The
 * sleep-timer slot stays (empty) when that button is hidden so the bookmark
 * keeps its place; skip buttons drop out when hidden.
 */

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookmarkButton } from '../BookmarkButton';
import { PlaybackRateButton } from '../PlaybackRateButton';
import { SkipIntervalButton } from '../SkipIntervalButton';
import { SleepTimerButton } from '../SleepTimerButton';
import { VolumeButton } from '../VolumeButton';
import { playbackSettingsStore } from '../../store/playbackSettingsStore';

export const SecondaryControlsGrid = memo(function SecondaryControlsGrid() {
  const showSkipInterval = playbackSettingsStore((s) => s.showSkipIntervalButtons);
  const showSleepTimer = playbackSettingsStore((s) => s.showSleepTimerButton);

  return (
    <View style={styles.grid} testID="secondary-controls-grid">
      <View style={styles.slot}>{showSleepTimer && <SleepTimerButton />}</View>
      {showSkipInterval && (
        <View style={styles.slot}>
          <SkipIntervalButton direction="backward" size={32} />
        </View>
      )}
      <View style={styles.slot}>
        <PlaybackRateButton />
      </View>
      <View style={styles.slot}>
        <VolumeButton />
      </View>
      {showSkipInterval && (
        <View style={styles.slot}>
          <SkipIntervalButton direction="forward" size={32} />
        </View>
      )}
      <View style={styles.slot}>
        <BookmarkButton />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slot: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

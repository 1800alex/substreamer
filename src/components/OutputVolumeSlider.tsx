/**
 * OutputVolumeSlider — volume slider for whatever is playing: the cast
 * receiver while casting, the system media volume otherwise (see
 * useOutputVolume).
 * Used by the player's VolumeSheet and under the active row of the route
 * picker.
 */

import Ionicons from '@react-native-vector-icons/ionicons/static';
import Slider from '@react-native-community/slider';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useOutputVolume } from '../hooks/useOutputVolume';

export interface OutputVolumeSliderProps {
  accent: string;
  track: string;
  icon: string;
}

export const OutputVolumeSlider = memo(function OutputVolumeSlider({
  accent,
  track,
  icon,
}: OutputVolumeSliderProps) {
  const { t } = useTranslation();
  const { volume, setVolume } = useOutputVolume();

  return (
    <View style={styles.row}>
      <Ionicons name="volume-low" size={18} color={icon} />
      <Slider
        testID="output-volume-slider"
        accessibilityLabel={t('volume')}
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={volume}
        onValueChange={setVolume}
        onSlidingComplete={setVolume}
        minimumTrackTintColor={accent}
        maximumTrackTintColor={track}
        thumbTintColor={accent}
      />
      <Ionicons name="volume-high" size={18} color={icon} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1, height: 40 },
});

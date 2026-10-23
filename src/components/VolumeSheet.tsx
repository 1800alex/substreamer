/**
 * VolumeSheet — bottom sheet with a volume slider, opened from the player's
 * VolumeButton. Controls the cast receiver while casting (named in the
 * subtitle), otherwise the system media volume.
 */

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { BottomSheet } from './BottomSheet';
import { OutputVolumeSlider } from './OutputVolumeSlider';
import { useOutputVolume } from '../hooks/useOutputVolume';
import { useTheme } from '../hooks/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const VolumeSheet = memo(function VolumeSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { routeName } = useOutputVolume();

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="35%" scrollable={false}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('volume')}</Text>
      {routeName.length > 0 && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {routeName}
        </Text>
      )}
      <OutputVolumeSlider accent={colors.primary} track={colors.border} icon={colors.textSecondary} />
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', paddingHorizontal: 4, marginBottom: 4 },
  subtitle: { fontSize: 13, paddingHorizontal: 4, marginBottom: 10 },
});

/**
 * VolumeButton — player control that opens the VolumeSheet. Shown when the
 * "Show volume button" player setting is on.
 */

import Ionicons from '@react-native-vector-icons/ionicons/static';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { VolumeSheet } from './VolumeSheet';
import { useTheme } from '../hooks/useTheme';

export const VolumeButton = memo(function VolumeButton() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <>
      <Pressable
        testID="volume-button"
        onPress={() => setSheetVisible(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('volume')}
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      >
        <Ionicons name="volume-medium-outline" size={22} color={colors.textPrimary} />
      </Pressable>

      <VolumeSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});

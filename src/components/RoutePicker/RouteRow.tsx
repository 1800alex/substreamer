import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons/static';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { OutputVolumeSlider } from '../OutputVolumeSlider';
import {
  localRouteDisplayName,
  rowSubtitle,
  startCastingA11yLabel,
  stopCastingA11yLabel,
} from './copy';
import { iconForRoute } from './iconForRoute';
import { type RouteInfo, type RoutePickerTheme } from './types';

export interface RouteRowProps {
  route: RouteInfo;
  /** Fired on row tap. The sheet decides what a tap does (open the device
   *  detail, or switch back to this device); the row never connects. */
  onPress: (route: RouteInfo) => void;
  /** Replaces the derived protocol subtitle (used for the local row). */
  subtitleOverride?: string;
  theme: RoutePickerTheme;
}

/**
 * Single device row: icon + name + subtitle + trailing accessory (spinner /
 * check / error / chevron), plus a live volume slider under the active
 * receiver.
 */
export function RouteRow({ route, onPress, subtitleOverride, theme: t }: RouteRowProps) {
  const displayName =
    route.protocol === 'local'
      ? localRouteDisplayName()
      : route.name.length > 0
        ? route.name
        : localRouteDisplayName();

  return (
    <View>
      <Pressable
        testID={`route-row-${route.id || 'local'}`}
        onPress={() => onPress(route)}
        accessibilityRole="button"
        accessibilityLabel={
          route.isActive ? stopCastingA11yLabel(displayName) : startCastingA11yLabel(displayName)
        }
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: t.border },
          pressed && { backgroundColor: t.surface },
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: t.surface }]}>
          <MaterialCommunityIcons
            name={iconForRoute(route)}
            size={22}
            color={route.isActive ? t.accent : t.text}
          />
        </View>
        <View style={styles.labelStack}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={{ color: t.textSubtle, fontSize: 12 }} numberOfLines={1}>
            {subtitleOverride ?? rowSubtitle(route)}
          </Text>
        </View>
        <View style={styles.accessory}>
          {route.isConnecting ? (
            <ActivityIndicator color={t.connectingIndicator} />
          ) : route.isActive ? (
            <MaterialCommunityIcons name="check-circle" size={20} color={t.activeIndicator} />
          ) : route.lastError ? (
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={t.errorIndicator} />
          ) : (
            <MaterialCommunityIcons name="chevron-right" size={22} color={t.textSubtle} />
          )}
        </View>
      </Pressable>
      {route.isActive && route.protocol !== 'local' && route.capabilities.supportsRemoteVolume && (
        <View style={[styles.volumeRow, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
          <OutputVolumeSlider accent={t.accent} track={t.border} icon={t.textSubtle} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelStack: { flex: 1, gap: 2 },
  accessory: { width: 28, alignItems: 'center', justifyContent: 'center' },
  volumeRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

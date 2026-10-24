import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons/static';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OutputVolumeSlider } from '../OutputVolumeSlider';
import { getConnectVolume, rememberConnectVolume } from './connectVolume';
import { rowSubtitle, startCastingA11yLabel, stopCastingA11yLabel } from './copy';
import { iconForRoute } from './iconForRoute';
import { type RouteInfo, type RoutePickerTheme } from './types';

export interface RouteDetailProps {
  route: RouteInfo;
  /** Discovery no longer lists this receiver: shown, but can't be connected. */
  missing: boolean;
  /** `volume` is the connect volume (0..1), omitted for receivers without remote volume. */
  onConnect: (id: string, password: string | undefined, volume: number | undefined) => void;
  onDisconnect: () => void;
  onBack: () => void;
  theme: RoutePickerTheme;
}

/**
 * Second step of picking a receiver: the list only opens this view, and only
 * the button here connects, so a row that moved under a tap can't take over
 * playback. Holds the connect volume, the PIN/password entry for AirPlay
 * pairing (the host BottomSheet lifts itself above the keyboard), and the
 * certificate a self-hosted Cast receiver presented when it needs trusting.
 */
export function RouteDetail({ route, missing, onConnect, onDisconnect, onBack, theme: t }: RouteDetailProps) {
  const { t: tr } = useTranslation();
  const [volume, setVolume] = useState(() => getConnectVolume(route.id));
  // An auth-required error means a connect already asked for credentials.
  const [pinExpanded, setPinExpanded] = useState(route.lastError === 'cast_auth_required');
  const [pin, setPin] = useState('');
  const [pinFocused, setPinFocused] = useState(false);
  const [pinSubmitted, setPinSubmitted] = useState(false);

  const showVolume = route.capabilities.supportsRemoteVolume;
  const connectVolume = showVolume ? volume : undefined;

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    rememberConnectVolume(route.id, value);
  };

  const trust = route.isActive ? undefined : route.trust;

  const handleConnect = () => {
    if (trust) {
      onConnect(route.id, trust.fingerprint, connectVolume);
      return;
    }
    if (pinExpanded) {
      setPinSubmitted(true);
      onConnect(route.id, pin, connectVolume);
      return;
    }
    if (route.capabilities.requiresPairing) {
      // The receiver only shows its PIN once a connect asks for it
      // (/pair-pin-start); that first connect rejects by design.
      setPinExpanded(true);
    }
    onConnect(route.id, undefined, connectVolume);
  };

  const awaitingPin = pinExpanded && !pinSubmitted;
  const subtitle = missing ? tr('routeNoLongerFound') : rowSubtitle(route, { awaitingPin });
  const connectDisabled = missing || route.isConnecting || (pinExpanded && !route.trust && pin.length === 0);

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          testID="route-detail-back"
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={tr('routeBack')}
          hitSlop={8}
          style={styles.back}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={t.text} />
        </Pressable>
        <View style={[styles.iconBox, { backgroundColor: t.surface }]}>
          <MaterialCommunityIcons name={iconForRoute(route)} size={22} color={route.isActive ? t.accent : t.text} />
        </View>
        <View style={styles.labelStack}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
            {route.name}
          </Text>
          <Text style={{ color: missing ? t.errorIndicator : t.textSubtle, fontSize: 12 }} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      {showVolume && (
        <View style={styles.section}>
          {route.isActive ? (
            <OutputVolumeSlider accent={t.accent} track={t.border} icon={t.textSubtle} />
          ) : (
            <View style={styles.volumeRow}>
              <Ionicons name="volume-low" size={18} color={t.textSubtle} />
              <Slider
                testID="route-detail-volume"
                accessibilityLabel={tr('volume')}
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={volume}
                onValueChange={handleVolumeChange}
                minimumTrackTintColor={t.accent}
                maximumTrackTintColor={t.border}
                thumbTintColor={t.accent}
              />
              <Ionicons name="volume-high" size={18} color={t.textSubtle} />
            </View>
          )}
        </View>
      )}

      {trust && (
        <View testID="route-detail-trust" style={[styles.section, styles.trust]}>
          <Text style={{ color: trust.changed ? t.errorIndicator : t.text, fontSize: 15, fontWeight: '700' }}>
            {tr(trust.changed ? 'castTrustChangedTitle' : 'castTrustTitle')}
          </Text>
          <Text style={{ color: t.textSubtle, fontSize: 13, lineHeight: 18 }}>
            {tr(trust.changed ? 'castTrustChangedDescription' : 'castTrustDescription', { name: route.name })}
          </Text>
          <Text style={{ color: t.textSubtle, fontSize: 12, fontWeight: '600' }}>{tr('sha256Fingerprint')}</Text>
          <View style={[styles.fingerprintCard, { backgroundColor: t.background, borderColor: t.border }]}>
            {/* Grouped like `openssl x509 -fingerprint`, for comparing on the receiver. */}
            <Text testID="route-detail-fingerprint" selectable style={[styles.fingerprint, { color: t.text }]}>
              {groupFingerprint(trust.fingerprint)}
            </Text>
          </View>
        </View>
      )}

      {pinExpanded && !route.isActive && !trust && (
        <View style={styles.section}>
          <TextInput
            testID="route-detail-pin"
            value={pin}
            onChangeText={setPin}
            onFocus={() => setPinFocused(true)}
            onBlur={() => setPinFocused(false)}
            placeholder={tr('routePinOrPassword')}
            placeholderTextColor={t.textSubtle}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={[
              styles.pinInput,
              {
                color: t.text,
                backgroundColor: t.background,
                borderColor: pinFocused ? t.accent : t.border,
                borderWidth: pinFocused ? 1.5 : 1,
              },
            ]}
          />
        </View>
      )}

      <View style={styles.section}>
        {route.isActive ? (
          <Pressable
            testID="route-detail-disconnect"
            onPress={onDisconnect}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { borderColor: t.border, borderWidth: 1 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {stopCastingA11yLabel(route.name)}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            testID="route-detail-connect"
            onPress={handleConnect}
            disabled={connectDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: connectDisabled, busy: route.isConnecting }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: connectDisabled ? t.border : trust?.changed ? t.errorIndicator : t.accent },
              pressed && { opacity: 0.7 },
            ]}
          >
            {route.isConnecting ? (
              <ActivityIndicator testID="route-detail-connecting" color={t.background} />
            ) : (
              <Text style={{ color: t.background, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                {trust ? tr('castTrustConnect') : pinExpanded ? tr('routeConnect') : startCastingA11yLabel(route.name)}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** `ab12…` → `AB:12:…`. */
function groupFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/../g) ?? []).join(':');
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 8,
  },
  back: { width: 32, alignItems: 'center' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelStack: { flex: 1, gap: 2 },
  section: { paddingHorizontal: 16, paddingVertical: 8 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1, height: 40 },
  trust: { gap: 8 },
  fingerprintCard: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  fingerprint: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17 },
  pinInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  button: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});

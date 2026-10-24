import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { castReceiversStore } from '../../store/castReceiversStore';
import { settingsStyles } from '../../styles/settingsStyles';
import { SettingsSectionTitle } from './SettingsSectionTitle';

/**
 * Self-hosted Cast receivers (no Google device certificate) the user trusted
 * from the route picker, which shows the certificate and asks first (and asks
 * again when it changes). Forgetting one removes its saved certificate.
 */
export function CastReceiversCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pins = castReceiversStore((s) => s.pins);
  const forget = castReceiversStore((s) => s.forget);
  const names = Object.keys(pins).sort((a, b) => a.localeCompare(b));

  if (names.length === 0) return null;

  return (
    <View style={settingsStyles.section}>
      <SettingsSectionTitle>{t('castReceivers')}</SettingsSectionTitle>
      <View style={[settingsStyles.card, { backgroundColor: colors.card }]}>
        {names.map((name, i) => (
          <View key={name} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.textWrap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{name}</Text>
              <Text testID={`cast-receiver-pin-${i}`} style={[styles.hint, styles.mono, { color: colors.textSecondary }]}>
                {t('castReceiverPinned', { fingerprint: pins[name].slice(0, 8) })}
              </Text>
            </View>
            <Pressable
              testID={`cast-receiver-forget-${i}`}
              onPress={() => forget(name)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('castReceiverForget', { name })}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <Text style={[styles.hint, styles.footer, { color: colors.textSecondary }]}>{t('castReceiversHint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textWrap: { flex: 1 },
  label: { fontSize: 16 },
  hint: { fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: 'monospace' },
  footer: { padding: 16 },
});

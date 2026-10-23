import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { castReceiversStore, normalizeCastFingerprint } from '../../store/castReceiversStore';
import { settingsStyles } from '../../styles/settingsStyles';
import { SettingsSectionTitle } from './SettingsSectionTitle';

/**
 * Self-hosted Cast receivers (no Google device certificate). The user adds
 * each by address and the SHA-256 of its TLS certificate, read on the
 * receiver itself; Substreamer only connects when the certificate matches.
 */
export function CastReceiversCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const receivers = castReceiversStore((s) => s.receivers);
  const add = castReceiversStore((s) => s.add);
  const remove = castReceiversStore((s) => s.remove);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8009');
  const [fingerprint, setFingerprint] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const portNum = Number(port);
    if (!host.trim() || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setError(t('castReceiverAddressInvalid'));
      return;
    }
    if (!normalizeCastFingerprint(fingerprint)) {
      setError(t('castReceiverFingerprintInvalid'));
      return;
    }
    add({ name: name.trim() || host.trim(), host, port: portNum, fingerprint });
    setName('');
    setHost('');
    setPort('8009');
    setFingerprint('');
    setError(null);
  };

  const input = [styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.border }];

  return (
    <View style={settingsStyles.section}>
      <SettingsSectionTitle>{t('castReceivers')}</SettingsSectionTitle>
      <View style={[settingsStyles.card, { backgroundColor: colors.card }]}>
        {receivers.map((r, i) => (
          <View key={r.id} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.textWrap}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{r.name}</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{`${r.host}:${r.port}`}</Text>
            </View>
            <Pressable
              testID={`cast-receiver-remove-${i}`}
              onPress={() => remove(r.id)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('castReceiverRemove', { name: r.name })}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <View style={styles.form}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('castReceiversHint')}</Text>
          <TextInput testID="cast-receiver-name" value={name} onChangeText={setName}
            placeholder={t('castReceiverName')} placeholderTextColor={colors.textSecondary} style={input} />
          <View style={styles.addressRow}>
            <TextInput testID="cast-receiver-host" value={host} onChangeText={setHost}
              placeholder={t('castReceiverHost')} placeholderTextColor={colors.textSecondary}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[input, styles.host]} />
            <TextInput testID="cast-receiver-port" value={port} onChangeText={setPort}
              placeholder={t('castReceiverPort')} placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad" style={[input, styles.port]} />
          </View>
          <TextInput testID="cast-receiver-fingerprint" value={fingerprint} onChangeText={setFingerprint}
            placeholder={t('castReceiverFingerprint')} placeholderTextColor={colors.textSecondary}
            autoCapitalize="none" autoCorrect={false} multiline style={[input, styles.fingerprint]} />
          {error != null && (
            <Text testID="cast-receiver-error" style={[styles.hint, { color: colors.red }]}>{error}</Text>
          )}
          <Pressable
            testID="cast-receiver-add"
            onPress={handleAdd}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={styles.addLabel}>{t('castReceiverAdd')}</Text>
          </Pressable>
        </View>
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
  form: { padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  addressRow: { flexDirection: 'row', gap: 8 },
  host: { flex: 1 },
  port: { width: 88 },
  fingerprint: { fontFamily: 'monospace', fontSize: 13, minHeight: 56 },
  addButton: { borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  addLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
  pressed: { opacity: 0.7 },
});

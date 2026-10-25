// The once-per-release card for people who already have a roll (lib/whatsNew.ts).

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { tr } from '../lib/i18n';
import { whatsNew } from '../lib/whatsNew';
import { C, MONO } from '../ui/theme';

export default function WhatsNew({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <Text style={s.kicker}>ROLLCAM · NEW</Text>
          <Text style={s.title}>{tr('새로 생긴 것', "What's new", '新しくなったこと')}</Text>
          {whatsNew().map((n) => (
            <View key={n.title} style={s.row}>
              <Text style={s.icon}>{n.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{n.title}</Text>
                <Text style={s.body}>{n.body}</Text>
              </View>
            </View>
          ))}
          <Pressable onPress={onClose} style={s.ok} accessibilityRole="button">
            <Text style={s.okText}>{tr('확인', 'Got it', 'OK')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,7,6,0.88)', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 22, borderWidth: 1, borderColor: C.edge },
  kicker: { color: C.safelight, fontFamily: MONO, fontSize: 11, letterSpacing: 3 },
  title: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 6, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 9 },
  icon: { color: C.safelight, fontSize: 16, width: 22, textAlign: 'center', marginTop: 1 },
  name: { color: C.text, fontSize: 14, fontWeight: '700' },
  body: { color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  ok: { marginTop: 14, backgroundColor: C.safelight, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  okText: { color: C.bg, fontWeight: '700', fontSize: 14 },
});

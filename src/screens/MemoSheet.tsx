// "오늘의 한 줄": a small sheet over today's print to write one line next to
// the photo. Only today's line can be written (lib/memo.ts).

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAPSULE_MAX, capsuleDate } from '../lib/capsule';
import { MEMO_MAX, memoLeft, memoPrompt, normalizeMemo } from '../lib/memo';
import { C, MONO } from '../ui/theme';
import { tr } from '../lib/i18n';

type Props = { visible: boolean; day: string; film: string; memo: string; capsule: string; onSave: (memo: string, capsule: string) => void; onClose: () => void };

export default function MemoSheet({ visible, day, film, memo, capsule, onSave, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* mounted per open so the field starts from the saved line */}
      {visible ? <Editor day={day} film={film} memo={memo} capsule={capsule} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

function Editor({ day, film, memo, capsule, onSave, onClose }: Omit<Props, 'visible'>) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(memo);
  const [letter, setLetter] = useState(capsule);
  // the sealed line is folded away until asked for, or when there is one
  const [sealOpen, setSealOpen] = useState(!!capsule);
  const left = memoLeft(text);
  const letterLeft = memoLeft(letter, CAPSULE_MAX);
  const save = () => onSave(normalizeMemo(text), normalizeMemo(letter, CAPSULE_MAX));

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={s.fill} onPress={onClose} accessibilityLabel={tr('닫기', 'Close', '閉じる')} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.title}>{tr('오늘의 한 줄', 'A line for today', '今日の一行')}</Text>
        <Text style={s.note}>{tr('사진 옆에 남는 한 줄이에요. 자정이 지나면 인화와 함께 고정돼요.', 'One line kept with the photo. It sets with the print at midnight.', '写真のそばに残る一行です。0時を過ぎるとプリントと一緒に固定されます。')}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={sealOpen ? undefined : save}
          autoFocus
          placeholder={memoPrompt(film)}
          placeholderTextColor={C.faint}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          maxLength={MEMO_MAX * 2}
          accessibilityLabel={tr(`오늘의 한 줄, ${MEMO_MAX}자까지`, `A line for today, up to ${MEMO_MAX} characters`, `今日の一行、${MEMO_MAX}文字まで`)}
          style={s.input}
        />
        {sealOpen ? (
          <>
            <Text style={s.sealHead}>{tr('✉ 1년 뒤의 나에게', '✉ To you, a year from now', '✉ 1年後の自分へ')}</Text>
            <Text style={s.note}>{tr(`${capsuleDate(day)} 아침에 도착해요. 그때까지는 봉인돼서 나도 못 봐요.`, `Arrives the morning of ${capsuleDate(day)}. Sealed until then, even from you.`, `${capsuleDate(day)}の朝に届きます。それまでは封をされて自分でも読めません。`)}</Text>
            <TextInput
              value={letter}
              onChangeText={setLetter}
              onSubmitEditing={save}
              placeholder={tr('내년의 나에게 한마디', 'A word for next year', '来年の自分にひとこと')}
              placeholderTextColor={C.faint}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              maxLength={CAPSULE_MAX * 2}
              accessibilityLabel={tr(`1년 뒤의 나에게, ${CAPSULE_MAX}자까지`, `To next year, up to ${CAPSULE_MAX} characters`, `1年後の自分へ、${CAPSULE_MAX}文字まで`)}
              style={s.input}
            />
            {letterLeft < 0 ? <Text style={[s.count, { color: C.safelight, marginTop: 6 }]}>{tr(`${-letterLeft}자 넘었어요 · 앞 ${CAPSULE_MAX}자만 남아요`, `${-letterLeft} over · only the first ${CAPSULE_MAX} are kept`, `${-letterLeft}文字オーバー · 最初の${CAPSULE_MAX}文字だけ残ります`)}</Text> : null}
          </>
        ) : (
          <Pressable onPress={() => setSealOpen(true)} hitSlop={8} style={s.sealAsk} accessibilityRole="button" accessibilityLabel={tr('1년 뒤의 나에게 편지 쓰기', 'Write a letter to next year', '1年後の自分へ手紙を書く')}>
            <Text style={s.sealAskText}>{tr('✉ 1년 뒤의 나에게 한 줄 봉인하기', '✉ Seal a line for a year from now', '✉ 1年後の自分へ一行を封じる')}</Text>
          </Pressable>
        )}
        <View style={s.row}>
          <Text style={[s.count, left < 0 && { color: C.safelight }]}>{left < 0 ? tr(`${-left}자 넘었어요 · 앞 ${MEMO_MAX}자만 남아요`, `${-left} over · only the first ${MEMO_MAX} are kept`, `${-left}文字オーバー · 最初の${MEMO_MAX}文字だけ残ります`) : tr(`${left}자 남음`, `${left} left`, `あと${left}文字`)}</Text>
          <View style={s.btns}>
            {memo || capsule ? (
              <Pressable onPress={() => onSave('', '')} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('한 줄과 편지 지우기', 'Clear the line and the letter', '一行と手紙を消す')}>
                <Text style={s.clear}>{tr('지우기', 'Clear', '消す')}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={save} style={s.save} accessibilityRole="button">
              <Text style={s.saveText}>{tr('남기기', 'Keep', '残す')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18, borderTopWidth: 1, borderColor: C.edge },
  title: { color: C.text, fontSize: 17, fontWeight: '700' },
  note: { color: C.dim, fontSize: 12, marginTop: 4, lineHeight: 17 },
  input: { color: C.text, fontSize: 16, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: C.edge, backgroundColor: C.bg },
  sealHead: { color: C.safelight, fontSize: 14, fontWeight: '700', marginTop: 18 },
  sealAsk: { marginTop: 14, alignSelf: 'flex-start' },
  sealAskText: { color: C.safelight, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  count: { color: C.dim, fontFamily: MONO, fontSize: 11.5, flexShrink: 1, paddingRight: 10 },
  btns: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  clear: { color: C.dim, fontSize: 13 },
  save: { backgroundColor: C.safelight, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  saveText: { color: C.bg, fontWeight: '700', fontSize: 13 },
});

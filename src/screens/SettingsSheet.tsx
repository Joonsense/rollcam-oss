import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backupDue, backupLine, shotsSince, sizeLabel } from '../lib/backup';
import { HOUR_CHOICES, REMIND_HOUR, pickedHour, reminderHour } from '../lib/remind';
import { STAMP_COLORS, STAMP_ORDER, readStamp, type StampColor } from '../lib/stampColor';
import { stampText } from '../lib/develop';
import { lastPlace } from '../lib/conditions';
import { exportZip, markExported, restoreZip } from '../lib/exportData';
import { galleryNote } from '../lib/gallery';
import { galleryOn, gallerySupported, onGallery, syncGallery, type GalleryState } from '../lib/galleryCopy';
import { normalizeBirthday } from '../lib/film';
import { planReminders } from '../lib/reminders';
import { allShots, getSetting, photoFiles, setSetting } from '../lib/store';
import { tr, type Lang } from '../lib/i18n';
import { langSetting, saveLang } from '../lib/lang';
import { C, MONO } from '../ui/theme';

function Row({ title, note, warn, children }: { title: string; note?: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {note ? <Text style={[s.rowNote, warn && { color: C.safelight }]}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const LANGS: { v: '' | Lang; label: string }[] = [
  { v: '', label: '' },
  { v: 'ko', label: '한국어' },
  { v: 'en', label: 'English' },
  { v: 'ja', label: '日本語' },
];

export default function SettingsSheet({ visible, onClose, onRestored, onLang }: { visible: boolean; onClose: () => void; onRestored: () => void; onLang: (l: Lang) => void }) {
  const insets = useSafeAreaInsets();
  const [stamp, setStamp] = useState(() => getSetting('stamp', '1') === '1');
  const [remind, setRemind] = useState(() => getSetting('remind', '1') === '1');
  const [hourPick, setHourPick] = useState(() => getSetting('remindHour', ''));
  const autoHour = useMemo(() => reminderHour(allShots(), new Date()), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const remindAt = pickedHour(hourPick, autoHour);
  const [lastCall, setLastCall] = useState(() => getSetting('lastCall', '0') === '1');
  const toggleLastCall = (v: boolean) => {
    setLastCall(v);
    setSetting('lastCall', v ? '1' : '0');
    planReminders(v);
  };
  const pickHour = (h: string) => {
    setHourPick(h);
    setSetting('remindHour', h);
    planReminders(false);
  };
  const [golden, setGolden] = useState(() => getSetting('golden', '0') === '1');
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [loc, setLoc] = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // a big roll takes a while either way: 'N/M' beside the spinner
  const [ioRun, setIoRun] = useState<{ done: number; total: number } | null>(null);
  const ioNote = ioRun && ioRun.total > 20 ? `${ioRun.done}/${ioRun.total}` : null;
  // re-read after an export or a restore
  const [backupRun, setBackupRun] = useState(0);
  // what the zip will weigh: every print on the phone, added up once the sheet is open
  const [rollBytes, setRollBytes] = useState<number | null>(null);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      let bytes = 0;
      for (const f of photoFiles()) {
        try {
          bytes += f.size ?? 0;
        } catch {}
      }
      setRollBytes(bytes);
    }, 350); // after the sheet has slid up
    return () => clearTimeout(t);
  }, [visible, backupRun]);
  const backup = useMemo(() => {
    const raw = getSetting('exportedAt', '');
    const at = raw ? Number(raw) : null;
    const all = allShots();
    const since = shotsSince(all, at);
    const size = all.length && rollBytes !== null ? ` · ${tr(`${all.length}장`, `${all.length} ${all.length === 1 ? 'photo' : 'photos'}`, `${all.length}枚`)} ${sizeLabel(rollBytes)}` : '';
    return { line: `${backupLine(at, since, new Date())}${size}`, due: backupDue(since) };
  }, [visible, backupRun, rollBytes]); // eslint-disable-line react-hooks/exhaustive-deps
  const [msg, setMsg] = useState<string | null>(null);
  // the share sheet can't tell a save from a cancel: the export counts once the user says it was saved
  const [unsaved, setUnsaved] = useState<number | null>(null);
  const [birthday, setBirthday] = useState(() => getSetting('birthday', ''));
  const [bdayError, setBdayError] = useState(false);
  const [langPick, setLangPick] = useState(langSetting);

  useEffect(() => {
    if (!visible) return;
    Location.getForegroundPermissionsAsync().then((p) => setLoc(p.granted ? 'granted' : p.canAskAgain ? 'unknown' : 'denied'));
  }, [visible]);
  // reminders on here but notifications not allowed for the app (Android 13+ may
  // still say "can ask again" after one refusal); re-read when back from settings
  useEffect(() => {
    if (!visible) return;
    const read = () => {
      Notifications.getPermissionsAsync()
        // the app asks at the first shot; before that, not allowed yet is not blocked
        .then((p) => setNotifBlocked(!p.granted && (!p.canAskAgain || allShots().length > 0)))
        .catch(() => {});
    };
    read();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && read());
    return () => sub.remove();
  }, [visible]);

  const close = () => {
    setMsg(null);
    setUnsaved(null);
    onClose();
  };
  const [stampColor, setStampColor] = useState<StampColor>(() => readStamp(getSetting('stampColor', '')));
  const pickStamp = (c: StampColor) => {
    setStampColor(c);
    setSetting('stampColor', c);
  };
  const [grid, setGrid] = useState(() => getSetting('grid', '0') === '1');
  const toggleGrid = (v: boolean) => {
    setGrid(v);
    setSetting('grid', v ? '1' : '0');
  };
  // "아침에 현상": new prints wait at the lab until 7 the next morning (lib/lab.ts)
  const [lab, setLab] = useState(() => getSetting('lab', '0') === '1');
  const toggleLab = (v: boolean) => {
    setLab(v);
    setSetting('lab', v ? '1' : '0');
  };
  const [gallery, setGallery] = useState(galleryOn);
  const [galleryRun, setGalleryRun] = useState<GalleryState | null>(null);
  useEffect(() => (visible ? onGallery(setGalleryRun) : undefined), [visible]);
  const toggleGallery = (v: boolean) => {
    setGallery(v);
    setSetting('gallery', v ? '1' : '0');
    // the roll so far goes in too, oldest first, behind a progress note
    if (v) syncGallery().catch(() => {});
  };
  const toggleStamp = (v: boolean) => {
    setStamp(v);
    setSetting('stamp', v ? '1' : '0');
  };
  const toggleRemind = (v: boolean) => {
    setRemind(v);
    setSetting('remind', v ? '1' : '0');
    planReminders(v);
  };
  const toggleGolden = (v: boolean) => {
    setGolden(v);
    setSetting('golden', v ? '1' : '0');
    planReminders(v);
  };
  const saveBirthday = () => {
    const v = normalizeBirthday(birthday);
    if (v === null) return setBdayError(true);
    setBdayError(false);
    setBirthday(v);
    setSetting('birthday', v);
  };
  const pickLang = (v: '' | Lang) => {
    setLangPick(v);
    onLang(saveLang(v));
  };
  const askLocation = async () => {
    const cur = await Location.getForegroundPermissionsAsync();
    if (!cur.granted && cur.canAskAgain) {
      const r = await Location.requestForegroundPermissionsAsync();
      setLoc(r.granted ? 'granted' : 'denied');
    } else Linking.openSettings();
  };
  const doExport = async () => {
    setExporting(true);
    setMsg(null);
    try {
      const { count: n, at } = await exportZip((done, total) => setIoRun({ done, total }));
      setMsg(tr(`${n}장을 묶었어요`, `Packed ${n} ${n === 1 ? 'photo' : 'photos'}`, `${n}枚をまとめました`));
      setUnsaved(at);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
      setIoRun(null);
    }
  };

  const doRestore = async () => {
    setRestoring(true);
    setMsg(null);
    try {
      const line = await restoreZip((done, total) => setIoRun({ done, total }));
      if (line) {
        setMsg(line);
        syncGallery().catch(() => {}); // restored days join the album when it's on
        setBackupRun((r) => r + 1);
        onRestored();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(false);
      setIoRun(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.scrim} onPress={close} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.grab} />
        {/* the rows outgrew short phones: the sheet scrolls under its handle */}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>{tr('설정', 'Settings', '設定')}</Text>

          <Row title={tr('날짜 도장', 'Date stamp', '日付スタンプ')} note={tr('사진 오른쪽 아래 LED 날짜, 다음 사진부터', 'The LED date in the bottom right, from your next photo', '写真の右下のLED日付、次の写真から')}>
            <Switch value={stamp} onValueChange={toggleStamp} trackColor={{ true: C.safelight, false: C.faint }} thumbColor={C.text} />
          </Row>
          {stamp ? (
            <View style={s.stampRow} accessibilityRole="radiogroup">
              {STAMP_ORDER.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => pickStamp(c)}
                  style={[s.stampChip, stampColor === c && s.stampOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: stampColor === c }}
                  accessibilityLabel={c === 'orange' ? tr('주황', 'Orange', 'オレンジ') : c === 'red' ? tr('빨강', 'Red', '赤') : tr('노랑', 'Yellow', '黄色')}
                >
                  <Text style={[s.stampText, { color: STAMP_COLORS[c].ink, textShadowColor: STAMP_COLORS[c].halo }]}>{stampText(new Date())}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Row title={tr('구도 격자', 'Grid', 'グリッド')} note={tr('뷰파인더에 3분할 선', 'Rule-of-thirds lines in the viewfinder', 'ファインダーに三分割線')}>
            <Switch value={grid} onValueChange={toggleGrid} trackColor={{ true: C.safelight, false: C.faint }} thumbColor={C.text} />
          </Row>
          <Row title={tr('아침에 현상', 'Develop overnight', '朝に現像')} note={tr('필름 이름은 바로, 사진은 다음 날 아침 7시에 봐요. 다음 사진부터', 'See the film name right away and the photo at 7 the next morning. From your next photo', 'フィルム名はすぐ、写真は翌朝7時に。次の写真から')}>
            <Switch value={lab} onValueChange={toggleLab} trackColor={{ true: C.safelight, false: C.faint }} thumbColor={C.text} />
          </Row>
          <Row
            title={tr('저녁 알림', 'Evening reminder', '夕方のお知らせ')}
            note={tr(`그날 아직 안 찍었을 때만 한 번 · ${remindAt}시${hourPick || remindAt === REMIND_HOUR ? '' : ' (평소 찍는 시간 뒤)'}`, `Once, only on days you haven't shot yet · ${remindAt}:00${hourPick || remindAt === REMIND_HOUR ? '' : ' (after when you usually shoot)'}`, `その日まだ撮っていないときだけ一度 · ${remindAt}時${hourPick || remindAt === REMIND_HOUR ? '' : '(いつも撮る時間のあと)'}`)}
          >
            <Switch value={remind} onValueChange={toggleRemind} trackColor={{ true: C.safelight, false: C.faint }} thumbColor={C.text} />
          </Row>
          {remind ? (
            <View style={s.stampRow} accessibilityRole="radiogroup">
              {HOUR_CHOICES.map((h) => (
                <Pressable key={h || 'auto'} onPress={() => pickHour(h)} style={[s.stampChip, hourPick === h && s.stampOn]} accessibilityRole="radio" accessibilityState={{ selected: hourPick === h }}>
                  <Text style={s.hourText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{h ? tr(`${h}시`, `${h}:00`, `${h}時`) : tr('자동', 'Auto', '自動')}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {remind ? (
            <Row title={tr('자정 전 한 번 더', 'One more before midnight', '0時前にもう一度')} note={tr('그날 아직 안 찍었으면 밤 10시에 한 번 더', "At 10 pm if today's still empty", 'まだ撮っていなければ夜10時にもう一度')}>
              <Switch value={lastCall} onValueChange={toggleLastCall} trackColor={{ true: C.safelight, false: C.faint }} thumbColor={C.text} />
            </Row>
          ) : null}
          {remind && notifBlocked ? (
            <Pressable onPress={() => Linking.openSettings()} style={s.blocked} accessibilityRole="button">
              <Text style={s.blockedText}>{tr('이 앱 알림이 허용되지 않아 알림이 오지 않아요 · 눌러서 설정 열기', 'Notifications aren\'t allowed for this app, so no reminders arrive · tap to open settings', 'このアプリの通知が許可されていないため、お知らせが届きません · タップで設定を開く')}</Text>
            </Pressable>
          ) : null}
          {remind ? (
            <Row title={tr('해 질 녘에 알리기', 'Remind me before sunset', '日没前に知らせる')} note={tr('저녁 알림 대신, 해 지기 한두 시간 전에 곧 Golden Roll 이 감긴다고 알려요', 'Instead of the evening reminder, a heads-up an hour or two before sunset that Golden Roll is about to load', '夕方のお知らせの代わりに、日没の1〜2時間前に Golden Roll がもうすぐ入ると知らせます')}>
              <Switch value={golden} onValueChange={toggleGolden} trackColor={{ true: C.safelight, false: C.faint }} thumbColor={C.text} />
            </Row>
          ) : null}
          <Row title={tr('생일', 'Birthday', '誕生日')} note={bdayError ? tr('날짜를 다시 확인해 주세요 (예: 5/3)', 'Check the date (month/day, e.g. 5/3)', '日付をもう一度確認してください(例: 5/3)') : tr('그날은 Party Flash 필름이 감겨요', 'Party Flash loads that day', 'その日は Party Flash フィルムが入ります')}>
            <TextInput
              value={birthday}
              onChangeText={(t) => {
                setBirthday(t);
                setBdayError(false);
              }}
              onBlur={saveBirthday}
              onSubmitEditing={saveBirthday}
              placeholder="MM-DD"
              placeholderTextColor={C.faint}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              maxLength={8}
              accessibilityLabel={tr('생일, 월과 일', 'Birthday, month and day', '誕生日、月と日')}
              style={[s.input, bdayError && { borderColor: C.safelight }]}
            />
          </Row>
          <Row
            title={tr('위치', 'Location', '位置情報')}
            note={
              loc === 'granted'
                ? tr('켜짐 · 날씨를 볼 때 도시 단위 대략 위치(약 10km)만 날씨 서비스로 보내요', 'On · only a city-level location (about 10 km) goes to the weather service', 'オン · 天気を見るとき、市区町村単位のおおよその位置(約10km)だけを天気サービスに送ります')
                : lastPlace()
                  ? tr('꺼짐 · 마지막으로 알던 도시의 날씨로 필름을 골라요', 'Off · the film uses the weather of the last city we knew', 'オフ · 最後にわかっていた街の天気でフィルムを選びます')
                  : tr('꺼짐 · 날씨 대신 시간과 해 뜨고 지는 때로만 필름을 골라요', 'Off · the film is picked from the time and the sun only', 'オフ · 天気の代わりに時刻と日の出・日の入りだけでフィルムを選びます')
            }
          >
            {loc === 'granted' ? (
              <Text style={s.ok}>{tr('켜짐', 'On', 'オン')}</Text>
            ) : (
              <Pressable onPress={askLocation} style={s.btn}>
                <Text style={s.btnText}>{loc === 'denied' ? tr('설정 열기', 'Open settings', '設定を開く') : tr('켜기', 'Turn on', 'オンにする')}</Text>
              </Pressable>
            )}
          </Row>
          {gallerySupported() ? (
            <Row title={tr('갤러리에도 저장', 'Save to gallery too', 'ギャラリーにも保存')} note={galleryNote(gallery, galleryRun?.running ? galleryRun : null, galleryRun && !galleryRun.running ? galleryRun.failed : 0)} warn={gallery && !!galleryRun?.failed && !galleryRun.running}>
              <Switch value={gallery} onValueChange={toggleGallery} trackColor={{ true: C.safelight, false: C.faint }} thumbColor={C.text} />
            </Row>
          ) : null}
          <Row title={tr('데이터 내보내기', 'Export data', 'データの書き出し')} note={backup.line} warn={backup.due}>
            <Pressable onPress={doExport} disabled={exporting || restoring} style={s.btn}>
              {exporting ? ioNote ? <Text style={s.btnText}>{ioNote}</Text> : <ActivityIndicator color={C.bg} /> : <Text style={s.btnText}>{tr('내보내기', 'Export', '書き出し')}</Text>}
            </Pressable>
          </Row>
          <Row title={tr('롤 가져오기', 'Restore roll', 'ロールを取り込む')} note={tr('내보낸 zip 으로 새 기기에 롤을 되돌려요. 이미 찍은 날은 이 기기 사진이 남아요', "Bring a roll back from an exported zip. Days already shot keep this phone's photo", '書き出したzipで新しい端末にロールを戻します。撮影済みの日はこの端末の写真が残ります')}>
            <Pressable onPress={doRestore} disabled={exporting || restoring} style={[s.btn, s.btnLine]} accessibilityRole="button" accessibilityLabel={tr('내보낸 zip 에서 롤 가져오기', 'Restore the roll from an exported zip', '書き出したzipからロールを取り込む')}>
              {restoring ? ioNote ? <Text style={[s.btnText, { color: C.text }]}>{ioNote}</Text> : <ActivityIndicator color={C.text} /> : <Text style={[s.btnText, { color: C.text }]}>{tr('가져오기', 'Restore', '取り込む')}</Text>}
            </Pressable>
          </Row>
          <View style={s.row}>
            <Text style={[s.rowTitle, { flex: 1 }]}>{tr('언어', 'Language', '言語')}</Text>
            <View style={s.seg} accessibilityRole="radiogroup">
              {LANGS.map((o) => (
                <Pressable key={o.v} onPress={() => pickLang(o.v)} style={[s.segItem, langPick === o.v && s.segOn]} hitSlop={4} accessibilityRole="radio" accessibilityState={{ checked: langPick === o.v }} accessibilityLabel={o.v ? o.label : tr('자동, 휴대폰 언어', "Auto, the phone's language", '自動、端末の言語')}>
                  <Text style={[s.segText, langPick === o.v && s.segTextOn]}>{o.v ? o.label : tr('자동', 'Auto', '自動')}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {msg ? <Text style={s.msg}>{msg}</Text> : null}
          {unsaved !== null ? (
            <View style={s.saved}>
              <Text style={[s.rowNote, { flex: 1, marginTop: 0 }]}>{tr('zip 을 드라이브나 파일에 저장했나요? 저장했다면 알려 주세요', 'Did you save the zip to Drive or Files? Let us know once it is saved', 'zipをドライブやファイルに保存しましたか?保存したら教えてください')}</Text>
              <Pressable
                onPress={() => {
                  markExported(unsaved);
                  setUnsaved(null);
                  setMsg(null);
                  setBackupRun((r) => r + 1);
                }}
                style={[s.btn, s.btnLine]}
                accessibilityRole="button"
              >
                <Text style={[s.btnText, { color: C.text }]}>{tr('저장했어요', 'Saved', '保存しました')}</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={s.foot}>{tr('사진은 이 기기에만 저장됩니다 · 계정 없음 · 구독 없음', 'Photos stay on this phone · no account · no subscription', '写真はこの端末にだけ保存 · アカウントなし · サブスクなし')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 10, borderTopWidth: 1, borderColor: C.edge },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.faint, marginBottom: 14 },
  title: { color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.edge },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  rowNote: { color: C.dim, fontSize: 12, marginTop: 3, lineHeight: 17 },
  ok: { color: C.safelight, fontFamily: MONO, fontSize: 13 },
  input: { color: C.text, fontFamily: MONO, fontSize: 15, minWidth: 84, textAlign: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.edge },
  btn: { backgroundColor: C.text, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, minWidth: 84, alignItems: 'center' },
  btnText: { color: C.bg, fontWeight: '700', fontSize: 13 },
  btnLine: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.edge },
  stampRow: { flexDirection: 'row', gap: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.edge },
  stampChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: '#0B0A09', borderWidth: 1, borderColor: C.edge },
  stampOn: { borderColor: C.text },
  hourText: { color: C.text, fontSize: 12.5, fontWeight: '600' },
  stampText: { fontFamily: MONO, fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(255,120,30,0.4)', textShadowRadius: 4 },
  blocked: { paddingVertical: 8 },
  blockedText: { color: C.safelight, fontSize: 12, lineHeight: 17 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  msg: { color: C.safelight, fontSize: 13, marginTop: 12 },
  seg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: C.edge, padding: 2 },
  segItem: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  segOn: { backgroundColor: C.text },
  segText: { color: C.dim, fontSize: 12, fontWeight: '600' },
  segTextOn: { color: C.bg },
  foot: { color: C.faint, fontSize: 11, textAlign: 'center', marginTop: 18 },
});

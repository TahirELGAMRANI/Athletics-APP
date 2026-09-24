import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWide } from '@/lib/hooks';
import { colors, radius, shadow, space } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = Ionicons;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'caption' | 'label';
const variants: Record<Variant, TextStyle> = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  h2: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
};

export function Txt({
  v = 'body',
  color = colors.text,
  style,
  children,
  numberOfLines,
  selectable,
}: {
  v?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  return (
    <Text numberOfLines={numberOfLines} selectable={selectable} style={[variants[v], { color }, style]}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------
export function Row({ children, gap = space.sm, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const body = [styles.card, padded && { padding: space.lg }, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...body, pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={body}>{children}</View>;
}

export function Grid({ children, min = 280, gap = space.md }: { children: ReactNode; min?: number; gap?: number }) {
  const wide = useIsWide();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, marginHorizontal: 0 }}>
      {Array.isArray(children)
        ? children.flat().filter(Boolean).map((c, i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: wide ? min : '100%', minWidth: wide ? min : undefined }}>
              {c}
            </View>
          ))
        : children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons & inputs
// ---------------------------------------------------------------------------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light';
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void | Promise<unknown>;
  variant?: BtnVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [busy, setBusy] = useState(false);
  const palette: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brand, fg: colors.white },
    secondary: { bg: colors.brandSoft, fg: colors.brandDark },
    ghost: { bg: 'transparent', fg: colors.brand, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    light: { bg: 'rgba(255,255,255,0.16)', fg: colors.white },
  };
  const p = palette[variant];
  const isLoading = loading || busy;
  return (
    <Pressable
      disabled={disabled || isLoading}
      onPress={async () => {
        if (!onPress) return;
        const r = onPress();
        if (r && typeof (r as Promise<unknown>).then === 'function') {
          setBusy(true);
          try {
            await r;
          } finally {
            setBusy(false);
          }
        }
      }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: p.bg, borderColor: p.border ?? p.bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {isLoading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={p.fg} /> : null}
          <Text style={{ color: p.fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.text, bg = colors.card, size = 20 }: { icon: IconName; onPress: () => void; color?: string; bg?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  secure,
  keyboardType,
  autoCapitalize,
  hint,
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Txt v="label" color={colors.muted}>{label}</Txt> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? (secure || keyboardType === 'email-address' ? 'none' : 'sentences')}
        autoCorrect={!(secure || keyboardType === 'email-address')}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[
          styles.input,
          multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
          focus && { borderColor: colors.brand, backgroundColor: colors.white },
        ]}
      />
      {hint ? <Txt v="caption" color={colors.faint}>{hint}</Txt> : null}
    </View>
  );
}

export type Option<T extends string = string> = { value: T; label: string; icon?: IconName };

export function Chips<T extends string>({
  options,
  value,
  onChange,
  scroll = true,
  label,
}: {
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  scroll?: boolean;
  label?: string;
}) {
  const content = options.map((o) => {
    const active = o.value === value;
    return (
      <Pressable
        key={o.value}
        onPress={() => onChange(o.value)}
        style={[styles.chip, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
        {o.icon ? <Ionicons name={o.icon} size={14} color={active ? colors.white : colors.brand} /> : null}
        <Text style={{ color: active ? colors.white : colors.text, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt v="label" color={colors.muted}>{label}</Txt> : null}
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {content}
        </ScrollView>
      ) : (
        <Row wrap gap={8}>
          {content}
        </Row>
      )}
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View style={[styles.checkbox, value && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
        {value ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
      </View>
      <Txt v="small">{label}</Txt>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'brand';
const tones: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: '#EEF1EF', fg: colors.muted },
  brand: { bg: colors.brandSoft, fg: colors.brandDark },
};

export function Badge({ text, tone = 'neutral', icon }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} /> : null}
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export function Stat({ label, value, icon, tone = 'brand', sub }: { label: string; value: string | number; icon: IconName; tone?: Tone; sub?: string }) {
  const t = tones[tone];
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <Txt v="caption" color={colors.muted}>{label}</Txt>
          <Txt v="h1">{value}</Txt>
          {sub ? <Txt v="caption" color={colors.faint}>{sub}</Txt> : null}
        </View>
        <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
          <Ionicons name={icon} size={20} color={t.fg} />
        </View>
      </Row>
    </Card>
  );
}

export function Avatar({ name, size = 40, number, tone = 'brand' }: { name: string; size?: number; number?: number | null; tone?: 'brand' | 'light' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  const bg = tone === 'brand' ? colors.brand : colors.brandSoft;
  const fg = tone === 'brand' ? colors.white : colors.brandDark;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: size * 0.36 }}>{number != null ? `#${number}` : initials}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, subtitle }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm }}>
      <View style={{ flex: 1 }}>
        <Txt v="h2">{title}</Txt>
        {subtitle ? <Txt v="small" color={colors.muted}>{subtitle}</Txt> : null}
      </View>
      {action}
    </Row>
  );
}

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const inner = (
    <View style={[styles.listRow, !last && styles.listDivider]}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="h3" numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt v="small" color={colors.muted} numberOfLines={2}>{subtitle}</Txt> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: colors.brandTint }}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

export function Empty({ icon = 'leaf-outline', title, subtitle, action }: { icon?: IconName; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.statIcon, { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={26} color={colors.brand} />
      </View>
      <Txt v="h3" style={{ textAlign: 'center' }}>{title}</Txt>
      {subtitle ? <Txt v="small" color={colors.muted} style={{ textAlign: 'center', maxWidth: 360 }}>{subtitle}</Txt> : null}
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ backgroundColor: colors.dangerSoft, borderColor: '#F6C9C9' }}>
      <Row>
        <Ionicons name="alert-circle" size={20} color={colors.danger} />
        <Txt v="small" color={colors.danger} style={{ flex: 1 }}>{message}</Txt>
        {onRetry ? <Button small variant="ghost" title="Retry" onPress={onRetry} /> : null}
      </Row>
    </Card>
  );
}

/** Horizontal-scrolling data table that stays readable on phones. */
export function Table({
  columns,
  rows,
  onRowPress,
}: {
  columns: { key: string; label: string; width?: number; align?: 'left' | 'right' | 'center' }[];
  rows: Record<string, ReactNode>[];
  onRowPress?: (index: number) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ minWidth: '100%' }}>
        <View style={[styles.tr, { backgroundColor: colors.brandDark, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm }]}>
          {columns.map((c) => (
            <View key={c.key} style={[styles.td, { width: c.width ?? 120 }]}>
              <Text style={{ color: colors.white, fontWeight: '700', fontSize: 12, textAlign: c.align ?? 'left', letterSpacing: 0.4 }}>{c.label.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        {rows.map((r, i) => (
          <Pressable
            key={i}
            disabled={!onRowPress}
            onPress={() => onRowPress?.(i)}
            style={({ pressed }) => [styles.tr, { backgroundColor: pressed ? colors.brandSoft : i % 2 ? colors.brandTint : colors.white }]}>
            {columns.map((c) => (
              <View key={c.key} style={[styles.td, { width: c.width ?? 120 }]}>
                {typeof r[c.key] === 'string' || typeof r[c.key] === 'number' ? (
                  <Text style={{ fontSize: 13, color: colors.text, textAlign: c.align ?? 'left' }}>{r[c.key]}</Text>
                ) : (
                  r[c.key] ?? <Text style={{ color: colors.faint }}>—</Text>
                )}
              </View>
            ))}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Screen scaffolding
// ---------------------------------------------------------------------------
export function Screen({
  title,
  subtitle,
  back,
  actions,
  children,
  onRefresh,
  hero,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  hero?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: wide ? 48 : 110 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined}>
      {hero ?? (
        <View style={{ paddingTop: (wide ? space.xl : insets.top + space.md), paddingHorizontal: wide ? space.xxl : space.lg }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Row style={{ flex: 1, alignItems: 'flex-start' }} gap={space.md}>
              {back ? (
                <IconButton icon="arrow-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Txt v={wide ? 'display' : 'h1'}>{title}</Txt>
                {subtitle ? <Txt v="small" color={colors.muted} style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
              </View>
            </Row>
            {actions ? <Row>{actions}</Row> : null}
          </Row>
        </View>
      )}
      <View style={{ paddingHorizontal: wide ? space.xxl : space.lg, paddingTop: space.md, maxWidth: 1280, width: '100%', gap: space.md }}>
        {children}
      </View>
    </ScrollView>
  );
}

/** Modal form: bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={[styles.backdrop, wide && { justifyContent: 'center', alignItems: 'center' }]} onPress={onClose}>
          <Pressable
            onPress={() => {}}
            style={[styles.sheet, wide ? styles.dialog : { paddingBottom: insets.bottom + space.lg }]}>
            <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
              <Txt v="h2" style={{ flex: 1 }}>{title}</Txt>
              <IconButton icon="close" onPress={onClose} bg={colors.bg} />
            </Row>
            <ScrollView style={{ maxHeight: wide ? 560 : 520 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={{ marginTop: space.md }}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  btnSmall: { height: 34, paddingHorizontal: 12, borderRadius: radius.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.brandTint,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg },
  listDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl },
  tr: { flexDirection: 'row' },
  td: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 28, 16, 0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl },
  dialog: { borderRadius: radius.xl, width: 560, maxWidth: '94%' },
});

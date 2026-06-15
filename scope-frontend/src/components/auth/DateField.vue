<template>
  <div class="date-field" :class="{ 'is-open': open }">
    <label class="date-field__label" :for="inputId">{{ label }}</label>

    <div
      ref="shellRef"
      class="date-field__shell"
      :class="{ 'has-error': Boolean(error), 'is-focused': open }"
      @click="handleShellClick"
    >
      <ScopeIcon class="date-field__icon" name="calendar" :label="`${label} icon`" />

      <input
        :id="inputId"
        ref="inputRef"
        class="date-field__input"
        type="text"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :value="displayValue"
        :aria-invalid="Boolean(error)"
        :aria-describedby="describedBy"
        aria-haspopup="dialog"
        spellcheck="false"
        @keydown="handleInputKeydown"
        @input="handleInputEvent"
        @blur="handleInputBlur"
      />

      <button
        type="button"
        class="date-field__toggle"
        :aria-label="open ? 'Close calendar' : 'Open calendar'"
        :aria-expanded="open"
        tabindex="-1"
        @click.stop="togglePopover"
      >
        <ScopeIcon name="chevron-down" :label="open ? 'Close calendar' : 'Open calendar'" />
      </button>
    </div>

    <Transition name="date-popover">
      <div
        v-if="open"
        ref="popoverRef"
        class="date-field__popover"
        role="dialog"
        :aria-label="`${label} calendar`"
        @click.stop
      >
        <header class="date-popover__header" @mousedown="onHeaderMouseDown">
          <button
            type="button"
            class="date-popover__nav"
            aria-label="Previous month"
            :disabled="!canGoPrev"
            @click="stepMonth(-1)"
          >
            <ScopeIcon name="arrow-left" label="Previous month" />
          </button>

          <div class="date-popover__title">
            <div class="date-popover__dropdown" :class="{ 'is-raised': monthMenuOpen }">
              <button
                type="button"
                class="date-popover__trigger"
                :class="{ 'is-open': monthMenuOpen }"
                aria-label="Month"
                aria-haspopup="listbox"
                :aria-expanded="monthMenuOpen"
                @click="toggleMonthMenu"
              >
                <span class="date-popover__trigger-text">{{ monthNames[viewMonth] }}</span>
                <ScopeIcon class="date-popover__trigger-caret" name="chevron-down" label="" />
              </button>
              <ul v-show="monthMenuOpen" class="date-popover__list" role="listbox" :aria-label="`${label} month`">
                <li v-for="(name, index) in monthNames" :key="name" role="none">
                  <button
                    type="button"
                    class="date-popover__list-item"
                    :class="{ 'is-active': viewMonth === index }"
                    role="option"
                    :aria-selected="viewMonth === index"
                    @click="selectMonth(index)"
                  >
                    {{ name }}
                  </button>
                </li>
              </ul>
            </div>

            <div class="date-popover__dropdown" :class="{ 'is-raised': yearMenuOpen }">
              <button
                type="button"
                class="date-popover__trigger date-popover__trigger--year"
                :class="{ 'is-open': yearMenuOpen }"
                aria-label="Year"
                aria-haspopup="listbox"
                :aria-expanded="yearMenuOpen"
                @click="toggleYearMenu"
              >
                <span class="date-popover__trigger-text">{{ viewYear }}</span>
                <ScopeIcon class="date-popover__trigger-caret" name="chevron-down" label="" />
              </button>
              <ul v-show="yearMenuOpen" class="date-popover__list date-popover__list--year" role="listbox" :aria-label="`${label} year`">
                <li v-for="y in yearOptions" :key="y" role="none">
                  <button
                    type="button"
                    class="date-popover__list-item"
                    :class="{ 'is-active': viewYear === y }"
                    role="option"
                    :aria-selected="viewYear === y"
                    @click="selectYear(y)"
                  >
                    {{ y }}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            class="date-popover__nav"
            aria-label="Next month"
            :disabled="!canGoNext"
            @click="stepMonth(1)"
          >
            <ScopeIcon name="arrow-right" label="Next month" />
          </button>
        </header>

        <div class="date-popover__weekdays" aria-hidden="true">
          <span v-for="day in weekdayLabels" :key="day">{{ day }}</span>
        </div>

        <div class="date-popover__grid" role="grid">
          <button
            v-for="cell in calendarCells"
            :key="cell.key"
            type="button"
            class="date-popover__day"
            :class="{
              'is-outside': !cell.inMonth,
              'is-today': cell.isToday,
              'is-selected': cell.isSelected,
            }"
            :aria-pressed="cell.isSelected"
            :aria-label="cell.label"
            role="gridcell"
            @click="selectDate(cell.iso)"
          >
            {{ cell.day }}
          </button>
        </div>

        <footer class="date-popover__footer">
          <button type="button" class="date-popover__ghost" @click="jumpToToday">
            Today
          </button>
          <button type="button" class="date-popover__ghost" @click="clearValue">
            Clear
          </button>
          <button type="button" class="date-popover__primary" @click="closePopover">
            Done
          </button>
        </footer>
      </div>
    </Transition>

    <small
      :id="messageId"
      class="date-field__message"
      :class="{
        'is-error': messageHasError,
        'is-empty': !messageText,
      }"
      :role="messageHasError ? 'alert' : undefined"
      :aria-hidden="messageText ? undefined : 'true'"
    >{{ messageText || '\u00a0' }}</small>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    placeholder?: string;
    autocomplete?: string;
    error?: string;
    help?: string;
    showMessage?: boolean;
    preferHelpWhenError?: boolean;
    inputmode?: string;
    maxlength?: number;
    /* Optional space-separated element ids (e.g. page-level hint below a form row). */
    extraDescribedBy?: string;
  }>(),
  {
    placeholder: 'Select a date',
    autocomplete: 'off',
    error: '',
    help: '',
    showMessage: true,
    preferHelpWhenError: false,
    inputmode: 'numeric',
    maxlength: 10,
    extraDescribedBy: '',
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const generatedId = useId();
const inputId = computed(() => `date-field-${generatedId}`);
const errorId = computed(() => `date-field-error-${generatedId}`);
const helpId = computed(() => `date-field-help-${generatedId}`);
const messageText = computed(() => {
  if (props.error && props.preferHelpWhenError && props.help) return props.help;
  if (props.showMessage && props.error) return props.error;
  return props.help || '';
});
const messageHasError = computed(() => Boolean(props.error && messageText.value && (props.showMessage || props.preferHelpWhenError)));
const messageId = computed(() => (messageHasError.value ? errorId.value : helpId.value));
const describedBy = computed(() => {
  const ids: string[] = [];
  if (messageText.value) ids.push(messageId.value);
  if (props.extraDescribedBy) {
    for (const id of props.extraDescribedBy.split(/\s+/).filter(Boolean)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.length ? ids.join(' ') : undefined;
});

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
// Short labels match the US week-start (Sunday). Keeps the birthday picker
// compact without needing locale detection for the auth flows.
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Accept either ISO (`YYYY-MM-DD`) or a Date from the picker and coerce
// into an ISO string. Returns an empty string when the value is unset so
// callers can treat that as "no date selected".
function toIso(value: Date | null): string {
  if (!value) return '';
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIso(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseDateParts(monthStr: string, dayStr: string, yearStr: string): Date | null {
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatCompactDateDraft(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const sanitized = trimmed.replace(/[^\d/-]/g, '');
  if (!sanitized) return '';

  if (/^\d{4}-/.test(sanitized)) {
    return sanitized.slice(0, 10);
  }

  if (/^\d{1,2}[/-]\d{0,2}(?:[/-]\d{0,4})?$/.test(sanitized)) {
    return sanitized.slice(0, 10);
  }

  const digits = sanitized.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoDate = parseIso(trimmed);
  if (isoDate) {
    return isoDate;
  }

  const compactMatch = /^(\d{2})(\d{2})(\d{4})$/.exec(trimmed);
  if (compactMatch) {
    const [, monthStr, dayStr, yearStr] = compactMatch;
    return parseDateParts(monthStr, dayStr, yearStr);
  }

  const usMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (!usMatch) {
    return null;
  }

  const [, monthStr, dayStr, yearStr] = usMatch;
  return parseDateParts(monthStr, dayStr, yearStr);
}

const today = new Date();
const selected = computed(() => parseIso(props.modelValue));

/*
 * When the picker first opens we show the current month/year so the UI
 * feels "live". Once the user actually selects a date the watcher below
 * snaps the view back to whatever they picked, which is the expected
 * behavior on return visits.
 */
const viewYear = ref((selected.value ?? today).getFullYear());
const viewMonth = ref((selected.value ?? today).getMonth());

watch(
  () => props.modelValue,
  () => {
    const next = selected.value;
    if (next) {
      viewYear.value = next.getFullYear();
      viewMonth.value = next.getMonth();
    }
  },
);

const open = ref(false);
const shellRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

const displayFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const isEditingInput = ref(false);
const draftValue = ref('');

const formattedSelectedValue = computed(() => {
  const current = selected.value;
  return current ? displayFormatter.format(current) : '';
});

const displayValue = computed(() => (isEditingInput.value ? draftValue.value : formattedSelectedValue.value));

watch(
  () => props.modelValue,
  () => {
    if (!isEditingInput.value) {
      draftValue.value = formattedSelectedValue.value;
    }
  },
  { immediate: true },
);

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Calendar bounds for navigation only — any day can be selected; age
// rules are enforced on submit by the parent validator.
const MIN_CAL_YEAR = 1900;

const maxCalendarYear = computed(() => today.getFullYear() + 1);

// Build the 6x7 grid so the popover height stays stable regardless of
// which month is in view.
type CalendarCell = {
  key: string;
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  label: string;
};

const calendarCells = computed<CalendarCell[]>(() => {
  const year = viewYear.value;
  const month = viewMonth.value;
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const cells: CalendarCell[] = [];
  const selectedDate = selected.value;

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const inMonth = date.getMonth() === month;
    const iso = toIso(date);
    cells.push({
      key: iso,
      iso,
      day: date.getDate(),
      inMonth,
      isToday: isSameDay(date, today),
      isSelected: Boolean(selectedDate && isSameDay(date, selectedDate)),
      label: displayFormatter.format(date),
    });
  }

  return cells;
});

const yearOptions = computed(() => {
  const years: number[] = [];
  for (let y = maxCalendarYear.value; y >= MIN_CAL_YEAR; y -= 1) {
    years.push(y);
  }
  return years;
});

const canGoPrev = computed(() => {
  if (viewYear.value > MIN_CAL_YEAR) return true;
  return viewYear.value === MIN_CAL_YEAR && viewMonth.value > 0;
});

const canGoNext = computed(() => {
  const cap = maxCalendarYear.value;
  if (viewYear.value < cap) return true;
  return viewYear.value === cap && viewMonth.value < 11;
});

const monthMenuOpen = ref(false);
const yearMenuOpen = ref(false);

function closePickerMenus() {
  monthMenuOpen.value = false;
  yearMenuOpen.value = false;
}

function onHeaderMouseDown(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (!t.closest?.('.date-popover__dropdown')) {
    closePickerMenus();
  }
}

function toggleMonthMenu() {
  yearMenuOpen.value = false;
  monthMenuOpen.value = !monthMenuOpen.value;
}

function toggleYearMenu() {
  monthMenuOpen.value = false;
  yearMenuOpen.value = !yearMenuOpen.value;
}

function selectMonth(index: number) {
  if (index >= 0 && index < 12) {
    viewMonth.value = index;
  }
  monthMenuOpen.value = false;
}

function selectYear(y: number) {
  if (!Number.isNaN(y)) {
    viewYear.value = y;
  }
  yearMenuOpen.value = false;
}

function stepMonth(delta: number) {
  closePickerMenus();
  const next = new Date(viewYear.value, viewMonth.value + delta, 1);
  viewYear.value = next.getFullYear();
  viewMonth.value = next.getMonth();
}

function selectDate(iso: string) {
  closePickerMenus();
  emit('update:modelValue', iso);
  closePopover();
}

function jumpToToday() {
  selectDate(toIso(today));
}

function clearValue() {
  emit('update:modelValue', '');
  closePopover();
}

function openPopover() {
  if (open.value) return;
  open.value = true;
}

function closePopover() {
  if (!open.value) return;
  open.value = false;
  nextTick(() => {
    inputRef.value?.focus({ preventScroll: true });
  });
}

function togglePopover() {
  if (open.value) {
    closePopover();
  } else {
    openPopover();
  }
}

function handleShellClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('.date-field__toggle')) return;
  isEditingInput.value = true;
  draftValue.value = props.modelValue || draftValue.value;
  openPopover();
  inputRef.value?.focus({ preventScroll: true });
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    closePopover();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
    if (event.key === 'Enter') {
      const parsed = parseDateInput(draftValue.value);
      if (parsed) {
        const iso = toIso(parsed);
        emit('update:modelValue', iso);
        viewYear.value = parsed.getFullYear();
        viewMonth.value = parsed.getMonth();
        draftValue.value = iso;
      }
    }
    event.preventDefault();
    openPopover();
  }
}

function handleInputEvent(event: Event) {
  const input = event.target as HTMLInputElement;
  const raw = input.value;
  const nextDraft = formatCompactDateDraft(raw);
  if (input.value !== nextDraft) {
    input.value = nextDraft;
  }
  isEditingInput.value = true;
  draftValue.value = nextDraft;

  if (!nextDraft) {
    emit('update:modelValue', '');
    return;
  }

  const parsed = parseDateInput(nextDraft);
  if (parsed) {
    const iso = toIso(parsed);
    emit('update:modelValue', iso);
    viewYear.value = parsed.getFullYear();
    viewMonth.value = parsed.getMonth();
  }
}

function handleInputBlur() {
  const parsed = parseDateInput(draftValue.value);
  if (draftValue.value && parsed) {
    const iso = toIso(parsed);
    emit('update:modelValue', iso);
    draftValue.value = iso;
    viewYear.value = parsed.getFullYear();
    viewMonth.value = parsed.getMonth();
  }

  isEditingInput.value = false;
  draftValue.value = formattedSelectedValue.value;
}

function handleOutsideClick(event: MouseEvent) {
  const target = event.target as Node | null;
  if (!target) return;
  if (shellRef.value?.contains(target)) return;
  if (popoverRef.value?.contains(target)) return;
  closePopover();
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    closePopover();
  }
}

watch(open, (next) => {
  if (typeof window === 'undefined') return;
  if (!next) {
    closePickerMenus();
  }
  if (next) {
    window.addEventListener('mousedown', handleOutsideClick, true);
    window.addEventListener('keydown', handleEscape);
  } else {
    window.removeEventListener('mousedown', handleOutsideClick, true);
    window.removeEventListener('keydown', handleEscape);
  }
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('mousedown', handleOutsideClick, true);
  window.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.date-field {
  position: relative;
  display: grid;
  gap: var(--space-2);
  grid-template-rows: auto auto minmax(1.05rem, auto);
  align-content: start;
}

.date-field__label {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.date-field__shell {
  position: relative;
  display: grid;
  grid-template-columns: 1.1rem minmax(10ch, 1fr) 1.65rem;
  align-items: center;
  gap: 0.6rem;
  padding: 0 0.85rem;
  min-height: 3.2rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--input-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 84%, transparent), color-mix(in srgb, var(--bg-tertiary) 76%, transparent)),
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 58%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent),
    0 0.75rem 1.5rem color-mix(in srgb, var(--bg-primary) 10%, transparent);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast),
    background var(--transition-fast);
}

.date-field__shell:hover,
.date-field__shell.is-focused,
.date-field__shell:focus-within {
  border-color: color-mix(in srgb, var(--accent-teal) 46%, var(--border));
  box-shadow:
    0 0 0 0.2rem color-mix(in srgb, var(--accent-teal) 18%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 16%, transparent);
  transform: translateY(-1px);
}

.date-field__shell.has-error {
  border-color: color-mix(in srgb, var(--danger) 54%, var(--border));
}

.date-field__icon {
  width: 1.1rem;
  height: 1.1rem;
  color: color-mix(in srgb, var(--accent-teal) 62%, var(--text-secondary));
}

.date-field__input {
  width: 100%;
  min-width: 0;
  padding: 0.85rem 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  line-height: 1.2;
  cursor: text;
  caret-color: var(--accent-teal);
}

.date-field__input::placeholder {
  color: var(--input-placeholder);
}

.date-field__input:focus {
  outline: none;
}

.date-field__toggle {
  display: inline-grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.date-field__toggle :deep(.scope-icon) {
  width: 0.94rem;
  height: 0.94rem;
  transition: transform var(--transition-fast);
}

.date-field.is-open .date-field__toggle :deep(.scope-icon) {
  transform: rotate(-180deg);
}

.date-field__toggle:hover,
.date-field__toggle:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
  outline: none;
}

.date-field__message {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
}

.date-field__message.is-error {
  color: var(--danger);
  font-weight: var(--font-weight-medium);
}

.date-field__message.is-empty {
  visibility: hidden;
  pointer-events: none;
}

.date-field__popover {
  position: absolute;
  top: calc(100% - 2.2rem);
  left: 50%;
  width: min(20rem, calc(100vw - 2rem));
  max-height: min(22.5rem, calc(100dvh - 2rem));
  box-sizing: border-box;
  z-index: 80;
  display: grid;
  gap: 0.72rem;
  padding: 0.85rem;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 26%, var(--border));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-secondary) 96%, var(--text-primary) 4%),
      color-mix(in srgb, var(--bg-tertiary) 98%, var(--bg-primary) 2%)
    );
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow:
    0 1.5rem 3rem color-mix(in srgb, var(--bg-primary) 48%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 12%, transparent);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  transform: translateX(-50%);
}

.date-popover__header {
  display: grid;
  grid-template-columns: 2.18rem minmax(0, 1fr) 2.18rem;
  align-items: center;
  gap: 0.45rem;
}

.date-popover__title {
  display: grid;
  grid-template-columns: minmax(6.4rem, 1.15fr) minmax(5rem, 0.85fr);
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  border-radius: var(--radius-lg);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 92%, var(--text-primary) 3%),
      color-mix(in srgb, var(--bg-primary) 86%, var(--bg-secondary) 14%)
    );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent),
    0 0.75rem 1.4rem color-mix(in srgb, var(--bg-primary) 16%, transparent);
}

.date-popover__dropdown {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.date-popover__dropdown + .date-popover__dropdown {
  border-left: 1px solid color-mix(in srgb, var(--glass-border) 76%, transparent);
}

.date-popover__dropdown.is-raised {
  z-index: 4;
}

.date-popover__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  min-width: 0;
  max-width: none;
  min-height: 2.3rem;
  padding: 0.3rem 0.55rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    box-shadow var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.date-popover__dropdown:first-child .date-popover__trigger {
  border-radius: calc(var(--radius-lg) - 1px) 0 0 calc(var(--radius-lg) - 1px);
}

.date-popover__dropdown:last-child .date-popover__trigger {
  border-radius: 0 calc(var(--radius-lg) - 1px) calc(var(--radius-lg) - 1px) 0;
}

.date-popover__trigger--year {
  min-width: 0;
}

.date-popover__trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-popover__trigger :deep(.date-popover__trigger-caret) {
  width: 0.85rem;
  height: 0.85rem;
  flex-shrink: 0;
  opacity: 0.8;
  transition: transform var(--transition-fast);
}

.date-popover__trigger.is-open :deep(.date-popover__trigger-caret) {
  transform: rotate(-180deg);
}

.date-popover__trigger:hover,
.date-popover__trigger:focus-visible {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  outline: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.date-popover__trigger.is-open {
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-primary));
  color: var(--accent-teal);
}

.date-popover__list {
  position: absolute;
  top: calc(100% + 0.3rem);
  left: 0;
  z-index: 3;
  min-width: max(100%, 8.5rem);
  max-width: min(12rem, calc(100vw - 2rem));
  max-height: 10.5rem;
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-secondary) 98%, var(--text-primary) 2%),
      color-mix(in srgb, var(--bg-tertiary) 98%, var(--bg-primary) 2%)
    );
  box-shadow:
    0 0.75rem 1.75rem color-mix(in srgb, var(--bg-primary) 45%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 8%, transparent);
  overflow-y: auto;
  overflow-x: hidden;
}

.date-popover__list--year {
  right: 0;
  left: auto;
  min-width: max(100%, 5.25rem);
  max-height: 11rem;
}

.date-popover__list li {
  margin: 0;
  padding: 0;
}

.date-popover__list-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2.45rem;
  margin: 0;
  padding: 0.45rem 0.9rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-small);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.date-popover__list-item:hover,
.date-popover__list-item:focus-visible {
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
  outline: none;
}

.date-popover__list-item.is-active {
  background: color-mix(in srgb, var(--accent-teal) 24%, var(--bg-secondary));
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.date-popover__nav {
  display: inline-grid;
  place-items: center;
  width: 2.18rem;
  height: 2.18rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  border-radius: var(--radius-full);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 88%, var(--text-primary) 4%),
      color-mix(in srgb, var(--bg-primary) 92%, transparent)
    );
  color: var(--text-primary);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent),
    0 0.75rem 1.25rem color-mix(in srgb, var(--bg-primary) 14%, transparent);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.date-popover__nav :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.date-popover__nav:hover:not(:disabled),
.date-popover__nav:focus-visible {
  color: var(--accent-teal);
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-primary));
  outline: none;
}

.date-popover__nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.date-popover__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.1rem;
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
}

.date-popover__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.16rem;
}

.date-popover__day {
  display: inline-grid;
  place-items: center;
  height: 1.92rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-small);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.date-popover__day.is-outside {
  color: color-mix(in srgb, var(--text-muted) 80%, transparent);
}

.date-popover__day:hover:not(.is-selected),
.date-popover__day:focus-visible {
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent-teal) 26%, transparent);
  color: var(--text-primary);
  outline: none;
  transform: translateY(-1px);
}

.date-popover__day.is-today:not(.is-selected) {
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--border));
  color: var(--accent-teal);
}

.date-popover__day.is-selected {
  background: linear-gradient(135deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal) 78%, var(--accent-gold) 12%));
  border-color: transparent;
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  box-shadow: 0 0.4rem 1rem color-mix(in srgb, var(--accent-teal) 36%, transparent);
}

.date-popover__footer {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding-top: 0.55rem;
  border-top: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.date-popover__ghost,
.date-popover__primary {
  border: 0;
  border-radius: var(--radius-full);
  padding: 0.45rem 0.85rem;
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.date-popover__ghost {
  background: transparent;
  color: var(--text-secondary);
}

.date-popover__ghost:hover:not(:disabled),
.date-popover__ghost:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 10%, transparent);
  outline: none;
}

.date-popover__ghost:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.date-popover__primary {
  margin-left: auto;
  background: linear-gradient(135deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal) 78%, var(--accent-gold) 12%));
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  box-shadow: 0 0.4rem 1rem color-mix(in srgb, var(--accent-teal) 36%, transparent);
}

.date-popover__primary:hover,
.date-popover__primary:focus-visible {
  transform: translateY(-1px);
  outline: none;
}

.date-popover-enter-active,
.date-popover-leave-active {
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);
}

.date-popover-enter-from,
.date-popover-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

@media (max-width: 760px) {
  .date-field__popover {
    left: 0;
    right: 0;
    width: auto;
    max-height: min(22rem, calc(100dvh - 1.5rem));
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .date-field__shell,
  .date-popover__day,
  .date-popover__nav,
  .date-popover__ghost,
  .date-popover__primary,
  .date-popover-enter-active,
  .date-popover-leave-active {
    transition: none;
  }
}
</style>

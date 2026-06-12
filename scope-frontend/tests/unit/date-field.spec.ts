import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DateField from '@/components/auth/DateField.vue';

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mountDateField(props: Partial<InstanceType<typeof DateField>['$props']> = {}) {
  const wrapperRef: { current?: VueWrapper } = {};
  const wrapper = mount(DateField, {
    attachTo: document.body,
    props: {
      modelValue: '',
      label: 'Birthday',
      ...props,
      'onUpdate:modelValue': async (value: string) => {
        await wrapperRef.current?.setProps({ modelValue: value });
      },
    },
    global: {
      stubs: {
        ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
        Transition: { props: ['name'], template: '<slot />' },
      },
    },
  });
  wrapperRef.current = wrapper;
  return wrapper;
}

describe('DateField', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('formats typed US dates into ISO model updates and restores readable display on blur', async () => {
    const wrapper = mountDateField({
      placeholder: 'MM/DD/YYYY',
      autocomplete: 'bday',
    });

    const input = wrapper.get('input');
    await input.setValue('02/03/2001');
    await flushPromises();

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2001-02-03']);
    expect(input.element.value).toBe('02/03/2001');

    await input.trigger('blur');
    await flushPromises();

    expect(input.element.value).toContain('2001');
    expect(input.element.value).toContain('Feb');
    expect(input.element.value).toContain('3');
  });

  it('opens the calendar from keyboard, ignores malformed typed dates, and closes on escape', async () => {
    const wrapper = mountDateField();
    const input = wrapper.get('input');

    await input.setValue('99/99/2001');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.find('.date-field__popover').exists()).toBe(true);

    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.find('.date-field__popover').exists()).toBe(false);

    wrapper.unmount();
  });

  it('selects month, year, and day from the popover calendar', async () => {
    const wrapper = mountDateField({
      modelValue: '2000-02-15',
    });

    await wrapper.get('.date-field__toggle').trigger('click');
    await flushPromises();

    expect(wrapper.get('.date-popover__title').text()).toContain('February');
    expect(wrapper.get('.date-popover__title').text()).toContain('2000');

    await wrapper.get('button[aria-label="Month"]').trigger('click');
    await flushPromises();
    await wrapper.findAll('.date-popover__list-item').find((button) => button.text() === 'March')?.trigger('click');
    await flushPromises();

    await wrapper.get('button[aria-label="Year"]').trigger('click');
    await flushPromises();
    await wrapper.findAll('.date-popover__list-item').find((button) => button.text() === '1999')?.trigger('click');
    await flushPromises();

    const marchFifteenth = wrapper
      .findAll('.date-popover__day')
      .find((button) => button.text() === '15' && !button.classes().includes('is-outside'));
    expect(marchFifteenth).toBeTruthy();
    await marchFifteenth?.trigger('click');
    await flushPromises();

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['1999-03-15']);
    expect(wrapper.find('.date-field__popover').exists()).toBe(false);
    expect(wrapper.get('input').element.value).toContain('1999');

    wrapper.unmount();
  });

  it('supports today, clear, done, outside click, and shell focus flows', async () => {
    const wrapper = mountDateField({
      modelValue: '2000-02-15',
    });
    const todayIso = formatIsoDate(new Date());

    await wrapper.get('.date-field__shell').trigger('click');
    await flushPromises();

    expect(wrapper.find('.date-field__popover').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('input').element);

    await wrapper.get('.date-popover__ghost').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([todayIso]);

    await wrapper.get('.date-field__toggle').trigger('click');
    await flushPromises();
    await wrapper.findAll('.date-popover__ghost')[1]?.trigger('click');
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['']);

    await wrapper.get('.date-field__toggle').trigger('click');
    await flushPromises();
    await wrapper.get('.date-popover__primary').trigger('click');
    await flushPromises();
    expect(wrapper.find('.date-field__popover').exists()).toBe(false);

    await wrapper.get('.date-field__toggle').trigger('click');
    await flushPromises();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('.date-field__popover').exists()).toBe(false);

    wrapper.unmount();
  });

  it('handles ISO typing, calendar boundaries, month stepping, and global escape', async () => {
    const nextYear = new Date().getFullYear() + 1;
    const wrapper = mountDateField({
      modelValue: '2001-02-03',
    });
    const input = wrapper.get('input');

    await input.setValue('2001-02-04');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2001-02-04']);

    await input.setValue('');
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['']);

    await input.setValue('2001-02-31');
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['']);

    await input.setValue('not-date');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();
    expect(wrapper.find('.date-field__popover').exists()).toBe(true);

    await wrapper.get('button[aria-label="Month"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('button[aria-label="Month"]').attributes('aria-expanded')).toBe('true');

    await wrapper.get('button[aria-label="Previous month"]').trigger('mousedown');
    await flushPromises();
    expect(wrapper.get('button[aria-label="Month"]').attributes('aria-expanded')).toBe('false');

    await wrapper.get('button[aria-label="Previous month"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('.date-popover__title').text()).toContain('January');

    await wrapper.get('button[aria-label="Next month"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('.date-popover__title').text()).toContain('February');

    await wrapper.get('.date-field__toggle').trigger('click');
    await flushPromises();
    expect(wrapper.find('.date-field__popover').exists()).toBe(false);

    await wrapper.setProps({ modelValue: '1900-01-15' });
    await wrapper.get('.date-field__toggle').trigger('click');
    await flushPromises();
    expect(wrapper.get('button[aria-label="Previous month"]').attributes('disabled')).toBeDefined();

    await wrapper.setProps({ modelValue: `${nextYear}-12-15` });
    await flushPromises();
    expect(wrapper.get('button[aria-label="Next month"]').attributes('disabled')).toBeDefined();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('.date-field__popover').exists()).toBe(false);

    wrapper.unmount();
  });

  it('inserts slashes for compact birthday digits and emits ISO once complete', async () => {
    const wrapper = mountDateField({
      placeholder: 'MM/DD/YYYY',
      autocomplete: 'bday',
    });

    const input = wrapper.get('input');
    await input.setValue('04302004');
    await flushPromises();

    expect(input.element.value).toBe('04/30/2004');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2004-04-30']);

    const validUpdateCount = wrapper.emitted('update:modelValue')?.length;
    await input.setValue('04 31 2004');
    await flushPromises();

    expect(input.element.value).toBe('04/31/2004');
    expect(wrapper.emitted('update:modelValue')?.length).toBe(validUpdateCount);

    wrapper.unmount();
  });

  it('keeps helper/error messaging wired through aria-describedby', () => {
    const wrapper = mountDateField({
      modelValue: '',
      error: 'Birthday is required.',
      help: 'You must be 13 or older to use Scope.',
      preferHelpWhenError: true,
      extraDescribedBy: 'register-row-help register-row-help',
    });

    const message = wrapper.get('.date-field__message');
    const describedBy = wrapper.get('input').attributes('aria-describedby');

    expect(message.text()).toBe('You must be 13 or older to use Scope.');
    expect(message.classes()).toContain('is-error');
    expect(message.attributes('role')).toBe('alert');
    expect(describedBy).toContain(message.attributes('id'));
    expect(describedBy?.match(/register-row-help/g)).toHaveLength(1);

    wrapper.unmount();
  });

  it('keeps date formatting helpers and picker guard branches stable', async () => {
    const wrapper = mountDateField({
      modelValue: '2001-02-03',
      error: 'Birthday is required.',
      help: 'You must be 13 or older to use Scope.',
      showMessage: true,
      preferHelpWhenError: false,
    });
    const coverage = (wrapper.vm as any).__coverage;

    expect(coverage.messageText.value).toBe('Birthday is required.');
    expect(coverage.messageHasError.value).toBe(true);
    expect(coverage.formatCompactDateDraft('')).toBe('');
    expect(coverage.formatCompactDateDraft('letters only')).toBe('');
    expect(coverage.formatCompactDateDraft('12')).toBe('12');
    expect(coverage.formatCompactDateDraft('1231')).toBe('12/31');
    expect(coverage.formatCompactDateDraft('2026-05-10-extra')).toBe('2026-05-10');
    expect(coverage.parseDateInput('')).toBeNull();
    expect(coverage.parseDateInput('01022000')).toEqual(new Date(2000, 0, 2));
    expect(coverage.parseDateInput('bad-date')).toBeNull();

    coverage.monthMenuOpen.value = true;
    coverage.selectMonth(-1);
    expect(coverage.monthMenuOpen.value).toBe(false);

    coverage.yearMenuOpen.value = true;
    coverage.selectYear(Number.NaN);
    expect(coverage.yearMenuOpen.value).toBe(false);

    coverage.open.value = false;
    coverage.closePopover();
    expect(coverage.open.value).toBe(false);

    coverage.openPopover();
    await flushPromises();
    expect(coverage.open.value).toBe(true);
    coverage.closePopover();
    await flushPromises();
    expect(coverage.open.value).toBe(false);

    wrapper.unmount();
  });
});

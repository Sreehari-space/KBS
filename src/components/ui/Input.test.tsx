// @vitest-environment jsdom
/**
 * A width passed to `Input` has to survive.
 *
 * This one shipped: the onboarding "add your fastest sellers" rows put the
 * item name on `flex-1` and the price on `w-24`, and the price silently came
 * out at 100% because `Input` hardcoded `w-full` and Tailwind emits `.w-full`
 * after `.w-24`. The name box was left 26px wide — not disabled, not hidden,
 * just too narrow to see a placeholder in or aim a thumb at, so the first
 * thing a new shopkeeper did on the first screen was fail.
 *
 * jsdom has no stylesheet, so this cannot measure the layout; it asserts the
 * class list instead, which is where the conflict is decided.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Input, Select } from './index';

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/).filter(Boolean);

describe('Input width', () => {
  it('is full width when the caller asks for nothing', () => {
    render(<Input placeholder="name" />);
    expect(classes(screen.getByPlaceholderText('name'))).toContain('w-full');
  });

  it('drops its own w-full when the caller brings a width', () => {
    render(<Input placeholder="price" className="w-24 tnum" />);
    const cls = classes(screen.getByPlaceholderText('price'));
    expect(cls).toContain('w-24');
    expect(cls).not.toContain('w-full');
    // The rest of the styling must survive the swap.
    expect(cls).toContain('rounded-xl');
    expect(cls).toContain('tnum');
  });

  it('leaves fractional and arbitrary widths alone too', () => {
    render(<Input placeholder="half" className="w-1/2" />);
    expect(classes(screen.getByPlaceholderText('half'))).not.toContain('w-full');
  });

  it('keeps full width alongside min-w and max-w, which do not conflict', () => {
    render(<Input placeholder="bounded" className="min-w-0 max-w-sm" />);
    const cls = classes(screen.getByPlaceholderText('bounded'));
    expect(cls).toContain('w-full');
    expect(cls).toContain('min-w-0');
  });

  it('applies the same rule to Select', () => {
    render(
      <Select aria-label="unit" className="w-32">
        <option>kg</option>
      </Select>,
    );
    const cls = classes(screen.getByLabelText('unit'));
    expect(cls).toContain('w-32');
    expect(cls).not.toContain('w-full');
  });
});

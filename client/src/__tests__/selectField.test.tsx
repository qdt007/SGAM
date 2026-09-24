import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SelectField, STATUS_OPTIONS } from '../components/ui/SelectField';

/**
 * The status filter on the project page is this component, so a click on an
 * option must reach onChange — otherwise filtering silently does nothing.
 */
describe('SelectField', () => {
  const options = [{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS];

  /** The trigger is a button; the list items carry role="option". */
  const trigger = () => screen.getByRole('button', { expanded: false }) ?? screen.getAllByRole('button')[0];
  const option = (label: string) => screen.getByRole('option', { name: label });

  it('shows the option matching the current value on the trigger', () => {
    render(React.createElement(SelectField, { value: '', onChange: () => {}, options }));
    expect(screen.getAllByRole('button')[0].textContent).toContain('All statuses');
  });

  it('emits the chosen value', () => {
    const onChange = vi.fn();
    render(React.createElement(SelectField, { value: '', onChange, options }));

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(option('Done'));

    expect(onChange).toHaveBeenCalledWith('DONE');
  });

  it('emits the empty value when clearing back to "All statuses"', () => {
    const onChange = vi.fn();
    render(React.createElement(SelectField, { value: 'DONE', onChange, options }));

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(option('All statuses'));

    expect(onChange).toHaveBeenCalledWith('');
  });
});

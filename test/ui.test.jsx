import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Gallery } from '../src/App.jsx';
import { loadSite } from '../api/_site.js';

describe('Gallery', () => {
  it('renders collections and filters templates', () => {
    const site = loadSite();
    render(<Gallery site={site} />);
    expect(screen.getByText('Morning Operating System')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /All templates/ }));
    fireEvent.change(screen.getByLabelText('Search templates'), { target: { value: 'cold email surgeon' } });
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#/run/cold-email-surgeon']);
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreditsContent from '../dialogs/CreditsContent';
import { MoreMenu } from '../panels/Settings';
import { initMockStore, renderUi } from '../testUtils';
import { SupportLink } from './SupportLink';

describe('support links', () => {
  it('top bar pill links the support page in the UI language', async () => {
    await initMockStore('de');
    renderUi(<SupportLink />);
    expect(screen.getByRole('link', { name: 'Den Atlas unterstützen' })).toHaveAttribute(
      'href',
      '/de/support',
    );
  });

  it('is the last item of the phone menu', async () => {
    await initMockStore();
    renderUi(<MoreMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.at(-1)).toHaveAccessibleName('Support the atlas');
    expect(items.at(-1)).toHaveAttribute('href', '/support');
  });

  it('closes the About dialog with a line that links the support page', async () => {
    await initMockStore();
    renderUi(<CreditsContent />);
    const link = screen.getByRole('link', { name: 'support it' });
    expect(link).toHaveAttribute('href', '/support');
    expect(link.closest('p')).toHaveTextContent(
      'learnanatomy.org is free and ad-free. If it helps you study, you can support it.',
    );
  });
});

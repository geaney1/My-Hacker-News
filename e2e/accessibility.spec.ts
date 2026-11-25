import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createUserAndLogIn, submitStory, uniqueName } from './helpers';

/** The WCAG 2.0, 2.1 and 2.2 rules at levels A and AA (which includes colour contrast), and axe's best-practice rules. */
const wcagAa = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Checks the page as it is now, and describes each problem so a failure says what to fix. */
async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcagAa).analyze();
  const described = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map(
          (node) =>
            `   ${node.target.join(' ')}  ${node.failureSummary?.replace(/\s+/g, ' ') ?? ''}`,
        )
        .join('\n'),
  );
  expect(described, described.join('\n')).toEqual([]);
}

/**
 * WCAG 1.4.11: the edge of a text box, select or text area is what shows where it is, so it needs
 * 3:1 against what is behind it. Axe does not test this, so it is measured here: the colour of
 * each field's border against the colours of its nearest background (every colour of a gradient).
 */
async function fieldBorderContrasts(page: Page) {
  return page.evaluate(() => {
    const parse = (color: string) => (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 4).map(Number);
    const luminance = ([red, green, blue]: number[]) => {
      const [redLevel, greenLevel, blueLevel] = [red, green, blue].map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * redLevel + 0.7152 * greenLevel + 0.0722 * blueLevel;
    };
    const ratio = (first: number[], second: number[]) => {
      const [lighter, darker] = [luminance(first), luminance(second)].sort(
        (left, right) => right - left,
      );
      return (lighter + 0.05) / (darker + 0.05);
    };

    /** The colours behind an element: the first ancestor with a colour or a gradient. */
    const backgroundsBehind = (element: Element) => {
      for (let node = element.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== 'none') {
          const colors = style.backgroundImage.match(/rgba?\([^)]*\)/g);
          if (colors) return colors.map(parse);
        }
        const color = parse(style.backgroundColor);
        if (color.length >= 3 && (color[3] ?? 1) > 0) return [color];
      }
      return [[255, 255, 255]];
    };

    const fields = Array.from(
      document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea, select'),
    );
    return fields
      .filter((field) => (field as HTMLElement).offsetParent !== null)
      .map((field) => {
        const border = parse(getComputedStyle(field).borderTopColor);
        const worst = Math.min(
          ...backgroundsBehind(field).map((background) => ratio(border, background)),
        );
        return {
          field: field.id || field.tagName.toLowerCase(),
          ratio: Math.round(worst * 100) / 100,
        };
      });
  });
}

type HoverResult = { element: string; ratio: number; needed: number };

/**
 * Hovers every link and enabled button that can be reached on the page, and measures the contrast
 * of its text against its background while the mouse is over it (WCAG 1.4.3: 4.5:1, or 3:1 for
 * large text). Elements behind an open dialog cannot be hovered and are left out. It waits for the
 * hover transitions to finish, so the colours measured are the final ones.
 */
async function hoverContrasts(page: Page) {
  // With a dialog open only what is in it can be reached; the page behind it cannot.
  const scope =
    (await page.locator('dialog[open]').count()) > 0 ? page.locator('dialog[open]') : page;
  // (Not the skip link: it is off the screen until it has the keyboard focus, so a mouse cannot reach it.)
  const elements = scope.locator('a:visible:not(.skip-link), button:enabled:visible');
  const count = await elements.count();
  const results: HoverResult[] = [];

  for (let index = 0; index < count; index++) {
    const element = elements.nth(index);
    try {
      await element.hover({ timeout: 1500 });
      // Lets the hover transitions (0.15s) finish, so the colours measured are the final ones.
      await page.waitForTimeout(250);
    } catch {
      continue; // Behind a dialog, or covered: nobody can hover it.
    }
    results.push(
      await element.evaluate((node) => {
        const parse = (color: string) =>
          (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 4).map(Number);
        const luminance = ([red, green, blue]: number[]) => {
          const [redLevel, greenLevel, blueLevel] = [red, green, blue].map((channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * redLevel + 0.7152 * greenLevel + 0.0722 * blueLevel;
        };
        const ratio = (first: number[], second: number[]) => {
          const [lighter, darker] = [luminance(first), luminance(second)].sort(
            (left, right) => right - left,
          );
          return (lighter + 0.05) / (darker + 0.05);
        };

        /** The colours behind the text: the element's own background, or the first ancestor's. */
        const backgrounds = () => {
          for (let current: Element | null = node; current; current = current.parentElement) {
            const style = getComputedStyle(current);
            if (style.backgroundImage !== 'none') {
              const colors = style.backgroundImage.match(/rgba?\([^)]*\)/g);
              if (colors) return colors.map(parse);
            }
            const color = parse(style.backgroundColor);
            if (color.length >= 3 && (color[3] ?? 1) > 0) return [color];
          }
          return [[255, 255, 255]];
        };

        const style = getComputedStyle(node);
        let text = parse(style.color).slice(0, 3);
        let behind = backgrounds().map((color) => color.slice(0, 3));
        // A brightness filter (the avatar's hover) lightens the text and its background alike.
        const brightness = /brightness\(([\d.]+)\)/.exec(style.filter)?.[1];
        if (brightness) {
          const lighten = (color: number[]) =>
            color.map((channel) => Math.min(255, channel * Number(brightness)));
          text = lighten(text);
          behind = behind.map(lighten);
        }

        const size = parseFloat(style.fontSize);
        const bold = Number(style.fontWeight) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const label =
          node.getAttribute('aria-label') ||
          (node.textContent ?? '').replace(/\s+/g, ' ').trim() ||
          node.tagName.toLowerCase();
        return {
          element: label.slice(0, 40),
          ratio: Math.round(Math.min(...behind.map((color) => ratio(text, color))) * 100) / 100,
          needed: large ? 3 : 4.5,
        };
      }),
    );
  }
  return results;
}

/** Checks that elements with these names were among those hovered, so the test is not passing on nothing. */
function expectHovered(results: HoverResult[], names: string[]) {
  for (const name of names) {
    expect(
      results.some((result) => result.element.includes(name)),
      name + ' was not hovered',
    ).toBe(true);
  }
}

/** Fails, naming each element, if any hovered text is too faint (or could not be measured). */
function expectHoverReadable(results: HoverResult[]) {
  expect(results.length, 'nothing was hovered').toBeGreaterThan(0);
  const faint = results.filter((result) => !(result.ratio >= result.needed));
  expect(faint, JSON.stringify(faint)).toEqual([]);
}

// Every check runs on both themes: the dark one has its own colours, so it has to pass on its own.
for (const theme of ['light', 'dark'] as const) {
  test.describe(`accessibility (WCAG A and AA, including colour contrast), ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        (chosen) => localStorage.setItem('hacker-news.theme', chosen),
        theme,
      );
    });

    test('the theme is the one chosen', async ({ page }) => {
      await page.goto('/top');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });

    test('the edge of every form field has 3:1 contrast, as WCAG 1.4.11 asks', async ({ page }) => {
      const username = uniqueName('edge');
      await createUserAndLogIn(page, username);

      const found: { field: string; ratio: number }[] = [];

      await page.goto('/top');
      await expect(page.locator('article.story').first()).toBeVisible();
      found.push(...(await fieldBorderContrasts(page)));

      await page.getByRole('link', { name: 'Submit', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Submit a story' })).toBeVisible();
      found.push(...(await fieldBorderContrasts(page)));

      await page.goto('/item/101');
      await expect(page.getByLabel('Add a comment')).toBeVisible();
      found.push(...(await fieldBorderContrasts(page)));

      await page.goto('/top');
      await page.getByRole('link', { name: `Profile for ${username}` }).click();
      await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();
      found.push(...(await fieldBorderContrasts(page)));

      // The search box, the filter, the dialog's fields and the comment box were all measured.
      expect(found.map((entry) => entry.field)).toEqual(
        expect.arrayContaining([
          'search',
          'min-score',
          'story-title',
          'new-comment',
          'email',
          'showdead',
        ]),
      );
      // `!(ratio >= 3)` also catches a ratio that could not be worked out (NaN).
      const tooFaint = found.filter((entry) => !(entry.ratio >= 3));
      expect(tooFaint, JSON.stringify(tooFaint)).toEqual([]);
      for (const entry of found) {
        expect(Number.isFinite(entry.ratio), `${entry.field} was not measured`).toBe(true);
      }
    });

    test('the text stays readable while the mouse is over links and buttons', async ({ page }) => {
      // Logged out: the lists, the cards, the side menu, the paging bar and the Log In button.
      await page.goto('/top');
      await expect(page.locator('article.story').first()).toBeVisible();
      const lists = await hoverContrasts(page);
      expectHoverReadable(lists);
      expectHovered(lists, ['Log In', 'Top', 'Fake top story']);

      await page.goto('/item/101');
      await expect(page.getByText('A comment from Hacker News')).toBeVisible();
      expectHoverReadable(await hoverContrasts(page));

      await page.goto('/user/hnauthor');
      await expect(page.getByText('Karma')).toBeVisible();
      expectHoverReadable(await hoverContrasts(page));

      // Logged in: the avatar and Log Out buttons, the fold buttons, and the dialogs.
      const username = uniqueName('hov');
      await createUserAndLogIn(page, username);
      await page.goto('/top');
      await expect(page.locator('article.story').first()).toBeVisible();
      const loggedIn = await hoverContrasts(page);
      expectHoverReadable(loggedIn);
      expectHovered(loggedIn, ['Log Out', `Profile for ${username}`]);

      await page.goto('/item/101');
      await expect(page.getByLabel('Add a comment')).toBeVisible();
      await page.getByLabel('Add a comment').fill('Hover over me');
      const thread = await hoverContrasts(page);
      expectHoverReadable(thread);
      expectHovered(thread, ['Add comment', 'Collapse comment by hncommenter']);

      await page.getByRole('link', { name: 'Submit', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Submit a story' })).toBeVisible();
      expectHoverReadable(await hoverContrasts(page));

      await page.goto('/top');
      await page.getByRole('link', { name: `Profile for ${username}` }).click();
      await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();
      // Update is turned off while the profile is loading, and a button that is off cannot be hovered.
      await expect(
        page.getByRole('dialog', { name: 'Profile' }).getByRole('button', { name: 'Update' }),
      ).toBeEnabled();
      const profile = await hoverContrasts(page);
      expectHoverReadable(profile);
      expectHovered(profile, ['Update', 'Change password']);
    });

    test('the story lists', async ({ page }) => {
      await page.goto('/top');
      await expect(page.locator('article.story').first()).toBeVisible();
      await expectNoViolations(page);

      await page.getByRole('link', { name: 'Ask', exact: true }).click();
      await expect(page.locator('article.story').first()).toBeVisible();
      await expectNoViolations(page);
    });

    test('a story and its comments', async ({ page }) => {
      await page.goto('/item/101');
      await expect(page.getByText('A comment from Hacker News')).toBeVisible();
      await expectNoViolations(page);
    });

    test('a user page', async ({ page }) => {
      await page.goto('/user/hnauthor');
      await expect(page.getByText('Karma')).toBeVisible();
      await expectNoViolations(page);
    });

    test('the log-in and create-user dialogs, with errors showing', async ({ page }) => {
      await page.goto('/log-in');
      await expect(page.getByRole('dialog', { name: 'Log in' })).toBeVisible();
      await expectNoViolations(page);

      await page.goto('/create-user');
      await page.getByLabel('Username').fill('a');
      await page.getByLabel('Username').blur();
      await expect(page.getByRole('dialog', { name: 'Create a new user' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('the dialogs and pages for a logged-in user', async ({ page }) => {
      const username = uniqueName('axe');
      await createUserAndLogIn(page, username);
      await expect(page.locator('article.story').first()).toBeVisible();
      await expectNoViolations(page);

      await page.getByRole('link', { name: 'Submit', exact: true }).click();
      const submit = page.getByRole('dialog', { name: 'Submit a story' });
      await expect(submit).toBeVisible();
      await submit.getByLabel('Link').fill('example.com');
      await submit.getByLabel('Link').blur();
      await expect(submit.getByText('Enter a full web address')).toBeVisible();
      await expectNoViolations(page);
      await submit.getByRole('link', { name: 'Close' }).click();

      await page.getByRole('link', { name: `Profile for ${username}` }).click();
      await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('a story submitted in the app, with a comment', async ({ page }) => {
      await createUserAndLogIn(page, uniqueName('axe'));
      await submitStory(page, { title: 'Accessible story', link: 'https://example.com/a11y' });
      await page.getByRole('link', { name: 'New', exact: true }).click();
      await page
        .locator('article.story', { hasText: 'Accessible story' })
        .getByRole('link', { name: '0 comments' })
        .click();
      await page.getByLabel('Add a comment').fill('A comment');
      await page.getByRole('button', { name: 'Add comment' }).click();
      await expect(page.getByText('A comment', { exact: true })).toBeVisible();
      await expectNoViolations(page);
    });
  });
}

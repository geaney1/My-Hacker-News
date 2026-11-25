import { Component, computed, effect, input, output, signal } from '@angular/core';
import { form, FormField, max, min, validate } from '@angular/forms/signals';
import { GoToPageModel } from '../../models/go-to-page-model';
import { PaginationItem } from '../../models/pagination-item';

/** Previous/next buttons, numbered pages and a "go to page" box. */
@Component({
  selector: 'app-pagination',
  imports: [FormField],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  /**
   * Clears the "go to page" box whenever this value changes, e.g. when another list is chosen.
   * The box is also cleared whenever the page changes.
   */
  readonly resetKey = input<unknown>();
  readonly pageChange = output<number>();

  /** Page numbers around the current page, always including the first and last. */
  protected readonly items = computed<PaginationItem[]>(() => {
    const current = this.page();
    const last = this.totalPages();
    const visible = new Set([1, last, current - 1, current, current + 1]);
    const pages = [...visible]
      .filter((page) => page >= 1 && page <= last)
      .sort((earlier, later) => earlier - later);

    const items: PaginationItem[] = [];
    pages.forEach((page, index) => {
      if (index > 0 && page - pages[index - 1] > 1) {
        items.push({ kind: 'gap', key: `gap-after-${pages[index - 1]}` });
      }
      items.push({ kind: 'page', page });
    });
    return items;
  });

  protected readonly goToPageModel = signal<GoToPageModel>({ page: null });
  protected readonly goToPageForm = form(this.goToPageModel, (schemaPath) => {
    const message = () => `Enter a page from 1 to ${this.totalPages()}`;
    min(schemaPath.page, 1, { message });
    max(schemaPath.page, () => this.totalPages(), { message });
    validate(schemaPath.page, ({ value }) =>
      value() !== null && !Number.isInteger(value())
        ? { kind: 'notWhole', message: message() }
        : undefined,
    );
  });

  /** The reason the typed page number can't be used, or `undefined` when it is fine or empty. */
  protected readonly goToPageError = computed(() => {
    const state = this.goToPageForm.page();
    return state.value() === null ? undefined : state.errors()[0]?.message;
  });

  constructor() {
    // Start with an empty box after any change of page or list.
    effect(() => {
      this.page();
      this.resetKey();
      this.goToPageModel.set({ page: null });
    });
  }

  protected select(page: number) {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }

  protected onGoToPage(event: Event) {
    event.preventDefault();
    const { page } = this.goToPageModel();
    // A number outside 1..totalPages is never accepted: the error under the box says why.
    if (page === null || this.goToPageForm.page().invalid()) {
      return;
    }
    this.select(page);
    this.goToPageModel.set({ page: null });
  }
}

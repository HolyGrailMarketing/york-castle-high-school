import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type { Book, BookCopy, BookCondition, CopyLabel } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import BarcodeLabel from '../components/library/BarcodeLabel';
import { useToast } from '../hooks/useToast';
import './LibraryBooks.css';

const CONDITIONS: BookCondition[] = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const YEAR_GROUPS = [7, 8, 9, 10, 11, 12, 13];

// The server refuses more than this in one call. The page loops for bigger
// orders rather than making the user click Add Copies five times.
const MAX_PER_REQUEST = 500;

const money = (amount: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(amount);

const errorText = (error: unknown, fallback: string) =>
  (error as { error?: string })?.error || (error as Error)?.message || fallback;

const blankBook = {
  title: '', author: '', publisher: '', edition: '', isbn: '', subject: '',
  yearGroups: [] as number[], replacementCost: '', rentalFee: '', notes: '',
};

const LibraryBooks = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', subject: '', yearGroup: '' });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [copies, setCopies] = useState<Record<string, BookCopy[]>>({});
  const [copiesLoading, setCopiesLoading] = useState(false);

  const [bookModal, setBookModal] = useState<{ open: boolean; editing: Book | null }>({ open: false, editing: null });
  const [bookForm, setBookForm] = useState(blankBook);
  const [copyModal, setCopyModal] = useState<Book | null>(null);
  const [copyForm, setCopyForm] = useState({ count: '40', condition: 'NEW' as BookCondition, acquiredAt: '' });
  const [labels, setLabels] = useState<CopyLabel[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchBooks(); }, [filters.subject, filters.yearGroup]);
  useEffect(() => { void apiService.getSubjects().then((d) => setSubjects(d.subjects)).catch(() => setSubjects([])); }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const data = await apiService.getBooks({
        q: filters.q || undefined,
        subject: filters.subject || undefined,
        yearGroup: filters.yearGroup ? Number(filters.yearGroup) : undefined,
      });
      setBooks(data.books || []);
    } catch (error) {
      showToast(errorText(error, 'Could not load the textbook list'), 'error');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => books.reduce(
    (acc, b) => ({
      titles: acc.titles + 1,
      copies: acc.copies + (b.copies?.total ?? 0),
      out: acc.out + (b.copies?.ON_LOAN ?? 0),
      value: acc.value + (b.copies?.total ?? 0) * b.replacementCost,
    }),
    { titles: 0, copies: 0, out: 0, value: 0 }
  ), [books]);

  const toggleCopies = async (book: Book) => {
    if (expanded === book.id) { setExpanded(null); return; }
    setExpanded(book.id);
    if (copies[book.id]) return;
    setCopiesLoading(true);
    try {
      const data = await apiService.getBookCopies(book.id);
      setCopies((prev) => ({ ...prev, [book.id]: data.copies }));
    } catch (error) {
      showToast(errorText(error, 'Could not load the copies'), 'error');
    } finally {
      setCopiesLoading(false);
    }
  };

  const refreshCopies = async (bookId: string) => {
    const data = await apiService.getBookCopies(bookId);
    setCopies((prev) => ({ ...prev, [bookId]: data.copies }));
  };

  // --- titles ---------------------------------------------------------------

  const openNewBook = () => { setBookForm(blankBook); setBookModal({ open: true, editing: null }); };

  const openEditBook = (book: Book) => {
    setBookForm({
      title: book.title, author: book.author ?? '', publisher: book.publisher ?? '',
      edition: book.edition ?? '', isbn: book.isbn ?? '', subject: book.subject,
      yearGroups: book.yearGroups, replacementCost: String(book.replacementCost),
      rentalFee: String(book.rentalFee), notes: book.notes ?? '',
    });
    setBookModal({ open: true, editing: book });
  };

  const submitBook = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...bookForm,
        replacementCost: Number(bookForm.replacementCost),
        rentalFee: Number(bookForm.rentalFee || 0),
      };
      if (bookModal.editing) {
        await apiService.updateBook(bookModal.editing.id, payload);
        showToast('Textbook updated', 'success');
      } else {
        await apiService.createBook(payload);
        showToast('Textbook added. Now add the copies you have.', 'success');
      }
      setBookModal({ open: false, editing: null });
      await fetchBooks();
    } catch (error) {
      showToast(errorText(error, 'Could not save the textbook'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const retireBook = async (book: Book) => {
    if (!window.confirm(
      `Retire "${book.title}"?\n\nIt stops being offered, but its copies and their loan history are kept.`
    )) return;
    try {
      const result = await apiService.retireBook(book.id);
      showToast(result.message, 'success');
      await fetchBooks();
    } catch (error) {
      showToast(errorText(error, 'Could not retire the title'), 'error');
    }
  };

  // --- copies ---------------------------------------------------------------

  const submitCopies = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!copyModal) return;
    const wanted = Number(copyForm.count);
    if (!Number.isInteger(wanted) || wanted < 1) {
      showToast('Enter how many copies to add', 'error');
      return;
    }

    setSubmitting(true);
    const collected: CopyLabel[] = [];
    let added = 0;
    try {
      // The server caps each call, so a large order is sent as several calls
      // with the progress shown. Each one is committed on its own: if the
      // fourth fails, the first three copies still exist and are labelled.
      while (added < wanted) {
        const batch = Math.min(MAX_PER_REQUEST, wanted - added);
        setProgress(wanted > MAX_PER_REQUEST ? `Adding ${added + 1}-${added + batch} of ${wanted}...` : null);
        const result = await apiService.generateCopies(copyModal.id, {
          count: batch,
          condition: copyForm.condition,
          acquiredAt: copyForm.acquiredAt || undefined,
        });
        const sheet = await apiService.getCopyLabels({ batchId: result.batchId });
        collected.push(...sheet.labels);
        added += batch;
      }
      showToast(`Added ${added} cop${added === 1 ? 'y' : 'ies'} of ${copyModal.title}.`, 'success');
      setCopyModal(null);
      setLabels(collected);
      await fetchBooks();
      if (copies[copyModal.id]) await refreshCopies(copyModal.id);
    } catch (error) {
      showToast(
        added > 0
          ? `Added ${added} of ${wanted} before failing: ${errorText(error, 'unknown error')}`
          : errorText(error, 'Could not add the copies'),
        'error'
      );
      if (added > 0) await fetchBooks();
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  const withdrawCopy = async (copy: BookCopy) => {
    const reason = window.prompt(
      `Withdraw ${copy.barcode}?\n\nIt keeps its history but can never be scanned out again.\nWhy is it being withdrawn?`
    );
    if (reason === null) return;
    if (!reason.trim()) { showToast('A reason is needed to withdraw a copy', 'error'); return; }
    try {
      await apiService.updateCopy(copy.id, { status: 'WITHDRAWN', withdrawnReason: reason.trim() });
      showToast(`${copy.barcode} withdrawn`, 'success');
      await Promise.all([refreshCopies(copy.bookId), fetchBooks()]);
    } catch (error) {
      showToast(errorText(error, 'Could not withdraw the copy'), 'error');
    }
  };

  const changeCondition = async (copy: BookCopy, condition: BookCondition) => {
    try {
      await apiService.updateCopy(copy.id, { condition });
      await refreshCopies(copy.bookId);
    } catch (error) {
      showToast(errorText(error, 'Could not change the condition'), 'error');
    }
  };

  const reprintLabels = async (book: Book) => {
    try {
      const list = copies[book.id] ?? (await apiService.getBookCopies(book.id)).copies;
      const sheet = await apiService.getCopyLabels({ ids: list.map((c) => c.id) });
      setLabels(sheet.labels);
    } catch (error) {
      showToast(errorText(error, 'Could not build the label sheet'), 'error');
    }
  };

  const downloadCsv = async () => {
    try {
      const blob = await apiService.exportCopiesCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `textbook-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(errorText(error, 'Could not export the inventory'), 'error');
    }
  };

  // --- render ---------------------------------------------------------------

  return (
    <div className="lib-books-page">
      <PageHelp pageKey="library/books" />

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}

      <div className="page-header">
        <h1>Textbooks</h1>
        <div className="lib-header-actions">
          <button className="btn-secondary" onClick={downloadCsv}>Export CSV</button>
          <button className="btn-primary" onClick={openNewBook}>Add Textbook</button>
        </div>
      </div>

      <p className="page-intro">
        Every title the school lends, and every physical copy of it. Each copy has its own{' '}
        <Hint term="copy-barcode">barcode</Hint>, which is how the school knows which one a
        particular student has and what condition that one was in.
      </p>

      <div className="lib-summary">
        <div><strong>{totals.titles}</strong><span>titles</span></div>
        <div><strong>{totals.copies}</strong><span>copies</span></div>
        <div><strong>{totals.out}</strong><span>with students</span></div>
        <div><strong>{money(totals.value)}</strong><span>replacement value</span></div>
      </div>

      <form
        className="lib-filters"
        onSubmit={(e) => { e.preventDefault(); void fetchBooks(); }}
      >
        <input
          type="search"
          placeholder="Search title, author or ISBN"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          aria-label="Search textbooks"
        />
        <select value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })} aria-label="Subject">
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.yearGroup} onChange={(e) => setFilters({ ...filters, yearGroup: e.target.value })} aria-label="Year group">
          <option value="">All years</option>
          {YEAR_GROUPS.map((y) => <option key={y} value={y}>Grade {y}</option>)}
        </select>
        <button type="submit" className="btn-secondary">Search</button>
      </form>

      {loading ? (
        <p className="lib-loading">Loading textbooks...</p>
      ) : books.length === 0 ? (
        <div className="empty-state">
          <p>No textbooks match. Add a title first, then add the copies you have of it.</p>
        </div>
      ) : (
        <table className="data-table data-table--stack lib-books-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Years</th>
              <th>Copies</th>
              <th>Out</th>
              <th>Replacement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              // Fragment carries the key: the shorthand <> cannot, and the row
              // pair is what the list is made of.
              <Fragment key={book.id}>
                <tr className={book.isActive ? '' : 'lib-retired'}>
                  <td data-label="Title">
                    <button className="lib-title-button" onClick={() => toggleCopies(book)}>
                      {expanded === book.id ? '▾' : '▸'} {book.title}
                    </button>
                    {!book.isActive && <span className="lib-badge lib-badge--retired">Retired</span>}
                    {book.author && <span className="lib-author">{book.author}</span>}
                  </td>
                  <td data-label="Subject">{book.subject}</td>
                  <td data-label="Years">{book.yearGroups.join(', ') || '—'}</td>
                  <td data-label="Copies">{book.copies?.total ?? 0}</td>
                  <td data-label="Out">{book.copies?.ON_LOAN ?? 0}</td>
                  <td data-label="Replacement">{money(book.replacementCost)}</td>
                  <td data-label="Actions" className="col-actions">
                    <button className="btn-download" onClick={() => setCopyModal(book)}>Add Copies</button>
                    <button className="btn-download" onClick={() => openEditBook(book)}>Edit</button>
                    {book.isActive && <button className="btn-delete" onClick={() => retireBook(book)}>Retire</button>}
                  </td>
                </tr>
                {expanded === book.id && (
                  <tr className="lib-copies-row">
                    <td colSpan={7}>
                      {copiesLoading && !copies[book.id] ? (
                        <p className="lib-loading">Loading copies...</p>
                      ) : (copies[book.id] ?? []).length === 0 ? (
                        <p className="lib-empty-copies">
                          No copies yet. Use <strong>Add Copies</strong> to create them and print their barcode labels.
                        </p>
                      ) : (
                        <>
                          <div className="lib-copies-toolbar">
                            <span>{copies[book.id].length} copies</span>
                            <button className="btn-secondary" onClick={() => reprintLabels(book)}>Print Labels</button>
                          </div>
                          <table className="lib-copies-table">
                            <thead>
                              <tr>
                                <th>Barcode</th>
                                <th>No.</th>
                                <th><Hint term="condition-grade">Condition</Hint></th>
                                <th>Status</th>
                                <th>Held by</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {copies[book.id].map((copy) => (
                                <tr key={copy.id} className={copy.status === 'WITHDRAWN' ? 'lib-copy--withdrawn' : ''}>
                                  <td><code>{copy.barcode}</code></td>
                                  <td>{copy.copyNumber}</td>
                                  <td>
                                    <select
                                      value={copy.condition}
                                      onChange={(e) => changeCondition(copy, e.target.value as BookCondition)}
                                      disabled={copy.status === 'WITHDRAWN'}
                                      aria-label={`Condition of ${copy.barcode}`}
                                    >
                                      {CONDITIONS.map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
                                    </select>
                                  </td>
                                  <td>
                                    <span className={`lib-status lib-status--${copy.status.toLowerCase()}`}>
                                      {copy.status.replace('_', ' ').toLowerCase()}
                                    </span>
                                    {copy.status === 'WITHDRAWN' && copy.withdrawnReason && (
                                      <span className="lib-withdrawn-reason">{copy.withdrawnReason}</span>
                                    )}
                                  </td>
                                  <td>
                                    {copy.currentLoan
                                      ? `${copy.currentLoan.student.name} (${copy.currentLoan.student.formClass ?? '—'})`
                                      : '—'}
                                  </td>
                                  <td>
                                    {copy.status !== 'WITHDRAWN' && (
                                      <button className="btn-delete" onClick={() => withdrawCopy(copy)}>Withdraw</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* Add / edit a title */}
      <Modal
        isOpen={bookModal.open}
        onClose={() => setBookModal({ open: false, editing: null })}
        title={bookModal.editing ? 'Edit Textbook' : 'Add Textbook'}
      >
        <form onSubmit={submitBook}>
          <div className="form-group">
            <label>Title</label>
            <input value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} required />
          </div>
          <div className="lib-form-row">
            <div className="form-group">
              <label>Subject</label>
              <input list="lib-subjects" value={bookForm.subject} onChange={(e) => setBookForm({ ...bookForm, subject: e.target.value })} required />
              <datalist id="lib-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="form-group">
              <label>Author</label>
              <input value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Year groups</label>
            <div className="lib-year-picker">
              {YEAR_GROUPS.map((year) => (
                <label key={year} className={bookForm.yearGroups.includes(year) ? 'is-on' : ''}>
                  <input
                    type="checkbox"
                    checked={bookForm.yearGroups.includes(year)}
                    onChange={(e) => setBookForm({
                      ...bookForm,
                      yearGroups: e.target.checked
                        ? [...bookForm.yearGroups, year].sort((a, b) => a - b)
                        : bookForm.yearGroups.filter((y) => y !== year),
                    })}
                  />
                  {year}
                </label>
              ))}
            </div>
            <span className="field-hint">Tick every year that uses this book. A book can serve more than one.</span>
          </div>
          <div className="lib-form-row">
            <div className="form-group">
              <label>Replacement cost (JMD)</label>
              <input
                type="number" min="0" step="1" required
                value={bookForm.replacementCost}
                onChange={(e) => setBookForm({ ...bookForm, replacementCost: e.target.value })}
              />
              <span className="field-hint">What a student is charged if this book is lost. Required.</span>
            </div>
            <div className="form-group">
              <label><Hint term="rental-fee">Rental fee</Hint> per term (JMD)</label>
              <input
                type="number" min="0" step="1"
                value={bookForm.rentalFee}
                onChange={(e) => setBookForm({ ...bookForm, rentalFee: e.target.value })}
              />
              <span className="field-hint">Leave at 0 if this book is lent free.</span>
            </div>
          </div>
          <div className="lib-form-row">
            <div className="form-group">
              <label>ISBN</label>
              <input value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} />
              <span className="field-hint">The publisher's number. Optional, but it must be unique if given.</span>
            </div>
            <div className="form-group">
              <label>Edition</label>
              <input value={bookForm.edition} onChange={(e) => setBookForm({ ...bookForm, edition: e.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setBookModal({ open: false, editing: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : bookModal.editing ? 'Save' : 'Add Textbook'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add copies */}
      <Modal isOpen={copyModal !== null} onClose={() => setCopyModal(null)} title={`Add Copies — ${copyModal?.title ?? ''}`}>
        <form onSubmit={submitCopies}>
          <div className="form-group">
            <label>How many copies?</label>
            <input
              type="number" min="1" step="1" required autoFocus
              value={copyForm.count}
              onChange={(e) => setCopyForm({ ...copyForm, count: e.target.value })}
            />
            <span className="field-hint">
              Each copy gets its own barcode, in order. More than {MAX_PER_REQUEST} is sent in
              several goes, and the sheet at the end covers all of them.
            </span>
          </div>
          <div className="lib-form-row">
            <div className="form-group">
              <label>Condition</label>
              <select value={copyForm.condition} onChange={(e) => setCopyForm({ ...copyForm, condition: e.target.value as BookCondition })}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Acquired</label>
              <input type="date" value={copyForm.acquiredAt} onChange={(e) => setCopyForm({ ...copyForm, acquiredAt: e.target.value })} />
              <span className="field-hint">Defaults to today.</span>
            </div>
          </div>
          {progress && <p className="lib-progress">{progress}</p>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setCopyModal(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Copies'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Label sheet. Printed by the browser - see the @media print rules. */}
      {labels && (
        <div className="lib-labels-overlay" role="dialog" aria-label="Barcode labels">
          <div className="lib-labels-bar">
            <span>{labels.length} labels</span>
            <button className="btn-primary" onClick={() => window.print()}>Print</button>
            <button className="btn-secondary" onClick={() => setLabels(null)}>Close</button>
          </div>
          <div className="lib-labels-sheet">
            {labels.map((label) => (
              <BarcodeLabel key={label.barcode} label={label} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryBooks;

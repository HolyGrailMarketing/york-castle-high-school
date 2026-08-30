import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import type {
  TimetableClash, TimetableLesson, TimetableStaffPayload, TimetableVersion,
} from '../types';
import './Timetable.css';

/**
 * The school timetable.
 *
 * Three groupings of the same week - by class, by teacher, by room. The teacher
 * and room views are the reason this is behind a login: a teacher's week
 * includes their lunch duty, and "where is this member of staff at every moment"
 * is not something the public page shows.
 *
 * Teachers can read all three. Only ADMIN and STAFF can move anything, and only
 * in a draft - the published version is what students are reading, so it is
 * changed by publishing a new draft rather than by editing in place.
 */

type View = 'class' | 'teacher' | 'room';

const EDIT_ROLES = ['ADMIN', 'STAFF'];

const clock = (t?: string) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  return `${hour % 12 || 12}:${m}${hour < 12 ? 'am' : 'pm'}`;
};

/**
 * Which teacher in the timetable is the person signed in?
 *
 * The timetable spells teachers the way FET does - "Gordon M" - and the portal
 * stores "Marcia Gordon", so this matches on surname plus first initial. It
 * answers only when exactly one teacher fits; a guess that lands on a colleague
 * is worse than no shortcut at all.
 */
const ownTeacherKey = (fullName: string | undefined, teachers: string[]) => {
  if (!fullName) return null;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const surname = parts[parts.length - 1].toLowerCase();
  const initial = parts[0][0].toLowerCase();
  const hits = teachers.filter((t) => {
    const bits = t.trim().split(/\s+/);
    if (bits.length < 2) return false;
    return bits[0].toLowerCase() === surname
      && bits[bits.length - 1][0].toLowerCase() === initial;
  });
  return hits.length === 1 ? hits[0] : null;
};

const Timetable = () => {
  const { user } = useAuth();
  const { toasts, showToast, removeToast } = useToast();
  const mayEdit = EDIT_ROLES.includes(user?.role ?? '');

  const [data, setData] = useState<TimetableStaffPayload | null>(null);
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [versionId, setVersionId] = useState<string>('');
  const [view, setView] = useState<View>('class');
  const [subject, setSubject] = useState<string>('');   // which class/teacher/room
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);         // first load only
  const [refreshing, setRefreshing] = useState(false);  // every load after that
  const [busy, setBusy] = useState(false);              // a write is in flight
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);

  // Click-to-move: the lesson waiting to be placed. This is not a fallback for
  // dragging - it is the keyboard and touch path, and it is quicker than
  // dragging across a wide grid.
  const [picked, setPicked] = useState<TimetableLesson | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const loaded = useRef(false);

  // Only a draft is editable. The published version is the timetable students
  // are reading; the server refuses to write to it, and the page should not
  // offer to.
  const isDraft = data?.version.status === 'DRAFT';
  const canEdit = mayEdit && isDraft && !busy;

  const load = useCallback(async (id?: string, quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const payload = await apiService.getStaffTimetable(id ? { versionId: id } : undefined);
      setData(payload);
      setVersionId(payload.version.id);
    } catch (e: any) {
      setError(e?.message || 'Could not load the timetable');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loaded.current = true;
    }
  }, []);

  const loadVersions = useCallback(() => {
    if (!mayEdit) return;
    apiService.getTimetableVersions()
      .then((r) => setVersions(r.versions))
      .catch(() => { /* the picker just stays empty */ });
  }, [mayEdit]);

  useEffect(() => { load(); loadVersions(); }, [load, loadVersions]);

  // The options for whichever grouping is selected.
  const options = useMemo(() => {
    if (!data) return [];
    if (view === 'class') return data.years.flatMap((y) => y.groups);
    if (view === 'teacher') return Object.keys(data.teachers).sort();
    return Object.keys(data.rooms).sort();
  }, [data, view]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const myKey = useMemo(
    () => (data ? ownTeacherKey(user?.name, Object.keys(data.teachers)) : null),
    [data, user?.name],
  );

  useEffect(() => {
    if (options.length && !options.includes(subject)) setSubject(options[0]);
  }, [options, subject]);

  // A lesson in hand belongs to the grid it was picked up from. Changing
  // version, view or subject puts it out of context, and it must not survive
  // into a version that cannot be edited at all.
  useEffect(() => { setPicked(null); setHover(null); }, [versionId, view, subject]);
  useEffect(() => { if (!canEdit) setPicked(null); }, [canEdit]);

  // Escape cancels a pending move - the banner tells the user it will.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicked(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lessons: TimetableLesson[] = useMemo(() => {
    if (!data || !subject) return [];
    const src = view === 'class' ? data.lessons : view === 'teacher' ? data.teachers : data.rooms;
    return src[subject] ?? [];
  }, [data, view, subject]);

  // Index by slot, and mark the slots a multi-period lesson runs into so nothing
  // is drawn on top of it.
  const { bySlot, covered } = useMemo(() => {
    const slot: Record<string, TimetableLesson> = {};
    const cover: Record<string, true> = {};
    const order = data?.periods.map((p) => p.id) ?? [];
    for (const l of lessons) {
      slot[`${l.d}|${l.p}`] = l;
      const i = order.indexOf(l.p);
      for (let k = 1; k < (l.n || 1); k += 1) {
        if (order[i + k]) cover[`${l.d}|${order[i + k]}`] = true;
      }
    }
    return { bySlot: slot, covered: cover };
  }, [lessons, data]);

  /**
   * A pre-flight hint, not a verdict.
   *
   * The authoritative check is findClashes() on the server, which runs over the
   * whole version and is the same function the importer and the build
   * verification use. This deliberately does not reimplement it - a second copy
   * of the clash rules is exactly the drift that file warns about. It answers a
   * narrower question from the payload already on screen: at this slot, is one
   * of *this lesson's own* teachers, classes or rooms already busy? That covers
   * the mistakes people actually make while dragging, and anything it misses the
   * server still refuses.
   */
  const conflictAt = useCallback((lesson: TimetableLesson, dayIndex: number, periodId: string) => {
    if (!data) return null;
    const at = (list: TimetableLesson[] | undefined) => (list ?? []).find((l) => {
      if (l === lesson || l.i === lesson.i) return false;
      if (l.d !== dayIndex) return false;
      const order = data.periods.map((p) => p.id);
      const from = order.indexOf(l.p);
      const span = order.slice(from, from + (l.n || 1));
      return span.includes(periodId);
    });
    for (const t of lesson.w ?? []) if (at(data.teachers[t])) return `${t} is already teaching then`;
    for (const g of lesson.g ?? []) {
      const clash = at(data.lessons[g]);
      if (clash) return `${g} already has ${clash.t} then`;
    }
    if (lesson.r && at(data.rooms[lesson.r])) return `${lesson.r} is already in use then`;
    return null;
  }, [data]);

  // Cells in the grid on screen that are part of a reported clash, so the
  // problem is visible where it happens and not only in the list underneath.
  const clashKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!data) return keys;
    for (const c of clashes) {
      const here = (c.kind === 'teacher' && view === 'teacher' && c.who === subject)
        || (c.kind === 'group' && view === 'class' && c.who === subject)
        || (c.kind === 'room' && view === 'room' && c.who === subject);
      if (!here || !c.periodId) continue;
      const di = data.days.indexOf(c.day);
      if (di >= 0) keys.add(`${di}|${c.periodId}`);
    }
    return keys;
  }, [clashes, data, view, subject]);

  /**
   * Go to a clash. The kind says which grouping it belongs to and `who` is the
   * key within it, so a teacher clash switches to that teacher's week - without
   * this, choosing a clash in a class you were not looking at did nothing
   * visible.
   */
  const jumpToClash = useCallback((c: TimetableClash) => {
    if (!data) return;
    const di = data.days.indexOf(c.day);
    if (di < 0 || !c.periodId) return;
    const go = (v: View, who: string, pool: Record<string, unknown>) => {
      if (pool[who]) { setView(v); setSubject(who); setSearch(''); }
    };
    if (c.kind === 'teacher') go('teacher', c.who, data.teachers);
    else if (c.kind === 'group') go('class', c.who, data.lessons);
    else if (c.kind === 'room') go('room', c.who, data.rooms);
    setHighlight(`${di}|${c.periodId}`);
  }, [data]);

  // Bring the cell we just jumped to on screen. Deferred a frame: jumping to a
  // clash usually changes the view as well, and scrolling before that grid has
  // painted either finds the old cell or is discarded by the re-render.
  useEffect(() => {
    if (!highlight) return;
    const id = requestAnimationFrame(() => {
      document.querySelector(`[data-slot="${highlight}"]`)?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [highlight, view, subject]);

  const period = useCallback(
    (id: string) => data?.periods.find((p) => p.id === id),
    [data],
  );

  const afterWrite = async (message: string, res: { clashes?: TimetableClash[] }) => {
    showToast(message, 'success');
    setClashes(res.clashes ?? []);
    await load(versionId, true);   // quiet: the grid stays on screen
    loadVersions();
  };

  const failed = (e: any, fallback: string) => {
    showToast(e?.message || fallback, 'error');
    setClashes(e?.clashes ?? []);
  };

  const move = async (lesson: TimetableLesson, dayIndex: number, periodId: string) => {
    if (!data || !canEdit) return;
    if (!lesson.i) {
      showToast('That lesson has no placement to move.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await apiService.moveTimetablePlacement(lesson.i, {
        day: data.days[dayIndex], periodKey: periodId,
      });
      await afterWrite(`Moved to ${data.days[dayIndex]}, ${period(periodId)?.label ?? periodId}.`, res);
    } catch (e: any) {
      failed(e, 'That move was refused');
    } finally {
      setBusy(false);
      setPicked(null);
    }
  };

  /** Dropping onto an occupied slot exchanges the two lessons. */
  const swap = async (lesson: TimetableLesson, target: TimetableLesson) => {
    if (!data || !canEdit) return;
    if (!lesson.i || !target.i) {
      showToast('One of those lessons has no placement to move.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await apiService.swapTimetablePlacements(lesson.i, target.i);
      await afterWrite(`Swapped ${lesson.t} with ${target.t}.`, res);
    } catch (e: any) {
      failed(e, 'That swap was refused');
    } finally {
      setBusy(false);
      setPicked(null);
    }
  };

  /** Move or swap, depending on what is already in the target slot. */
  const place = (dayIndex: number, periodId: string, target?: TimetableLesson) => {
    if (!picked || !canEdit) return;
    if (target && target.i === picked.i) { setPicked(null); return; }
    if (target) swap(picked, target); else move(picked, dayIndex, periodId);
  };

  const validate = async () => {
    if (!versionId) return;
    setBusy(true);
    try {
      const r = await apiService.validateTimetableVersion(versionId);
      setClashes(r.clashes);
      showToast(
        r.ok ? `No clashes across ${r.placements} placements.` : `${r.clashes.length} clash(es) found.`,
        r.ok ? 'success' : 'warning',
      );
    } catch (e: any) {
      failed(e, 'Could not check for clashes');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!versionId || !data) return;
    if (!window.confirm(
      `Publish "${data.version.label}"?\n\n`
      + 'It becomes the official timetable and whichever version is published now '
      + 'is archived. The public website updates on the next deploy, not immediately.',
    )) return;
    setBusy(true);
    try {
      const r = await apiService.publishTimetableVersion(versionId);
      showToast(r.message, 'success');
      await load(versionId, true);
      loadVersions();
    } catch (e: any) {
      failed(e, 'Could not publish');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="timetable-page"><p>Loading the timetable…</p></div>;
  if (error) {
    return (
      <div className="timetable-page">
        <PageHelp pageKey="timetable" />
        <div className="tt-banner error">
          {error}
          <button className="tt-btn tt-btn-inline" onClick={() => load()}>Try again</button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const label = view === 'class' ? 'Class' : view === 'teacher' ? 'Teacher' : 'Room';

  return (
    <div className="timetable-page">
      <PageHelp pageKey="timetable" />
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}

      <div className="tt-header">
        <h1>Timetable</h1>
        {mayEdit && (
          <button className="tt-btn tt-btn-primary" onClick={() => setDraftOpen(true)} disabled={busy}>
            New draft
          </button>
        )}
      </div>

      <p className="tt-hint">
        {data.schoolYear} · {data.version.label} ·{' '}
        <span className={`tt-status tt-status-${data.version.status.toLowerCase()}`}>
          {data.version.status}
        </span>
        <Hint term="timetable-version" />
        {!mayEdit && ' · read-only'}
        {refreshing && <span className="tt-refreshing"> · saving…</span>}
      </p>

      <div className="tt-toolbar">
        <div className="tt-field">
          <label htmlFor="tt-view">View</label>
          <select id="tt-view" value={view} onChange={(e) => { setView(e.target.value as View); setSearch(''); }}>
            <option value="class">By class</option>
            <option value="teacher">By teacher</option>
            <option value="room">By room</option>
          </select>
        </div>
        <div className="tt-field">
          <label htmlFor="tt-subject">
            {label}
            {view === 'class' && <Hint term="timetable-undivided" />}
          </label>
          <select id="tt-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {shown.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="tt-field">
          <label htmlFor="tt-search">Find a {label.toLowerCase()}</label>
          <input
            id="tt-search"
            type="search"
            value={search}
            placeholder={`Type part of a ${label.toLowerCase()}`}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {myKey && (
          <button
            className="tt-btn"
            onClick={() => { setView('teacher'); setSearch(''); setSubject(myKey); }}
          >
            My timetable
          </button>
        )}

        {mayEdit && versions.length > 0 && (
          <div className="tt-field">
            <label htmlFor="tt-version">Version</label>
            <select id="tt-version" value={versionId} onChange={(e) => load(e.target.value)} disabled={busy}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.schoolYear} · {v.label} — {v.status}
                  {v._count ? ` (${v._count.activities} lessons)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="tt-spacer" />
        {mayEdit && (
          <button className="tt-btn" onClick={validate} disabled={busy}>Check for clashes</button>
        )}
        {user?.role === 'ADMIN' && data.version.status === 'DRAFT' && (
          <button className="tt-btn tt-btn-primary" onClick={publish} disabled={busy}>Publish</button>
        )}
      </div>

      {mayEdit && data.version.status === 'PUBLISHED' && (
        <div className="tt-banner warn">
          <strong>This is the published timetable.</strong> It is what students and
          parents are reading, so it cannot be edited directly. Choose <em>New draft</em>{' '}
          to make changes, then publish the draft when it is right.
        </div>
      )}
      {mayEdit && data.version.status === 'ARCHIVED' && (
        <div className="tt-banner info">
          This version has been archived and is kept for reference only.
        </div>
      )}
      {picked && canEdit && (
        <div className="tt-banner info" role="status">
          Moving <strong>{picked.t}</strong> — choose an empty slot to place it, an
          occupied one to swap the two, or press Escape to cancel.
        </div>
      )}

      {data.periods.length === 0 ? (
        <div className="tt-banner warn">
          <strong>This version has no lessons in it.</strong> It was created empty, and
          lessons cannot be added here — this page moves existing lessons between slots.
          Make a draft that copies an existing timetable, or import one from FET.
        </div>
      ) : (
      <div className="tt-scroll">
        <table className="tt-grid">
          <thead>
            <tr>
              <th className="tt-time">Time</th>
              {data.days.map((d) => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.periods.map((p) => {
              // A non-teaching period is normally drawn as a single band across
              // the week - but staff commitments do land in them: the CPS
              // meetings sit in the 8:00 registration slot. If this subject has
              // anything here, or a double period runs through it, draw real
              // cells so nothing is silently hidden.
              const hasHere = data.days.some((_, di) => bySlot[`${di}|${p.id}`] || covered[`${di}|${p.id}`]);
              const nonClass = p.kind !== 'class' && !hasHere;
              return (
                <tr key={p.id} className={nonClass ? 'tt-row-nonclass' : undefined}>
                  <th className="tt-time">
                    <b>{p.label}</b>
                    {p.start && <span>{clock(p.start)} – {clock(p.end)}</span>}
                    {p.lunchSitting && (
                      <span className="tt-sitting">
                        {p.lunchSitting === 1 ? '1st' : '2nd'} lunch sitting
                      </span>
                    )}
                  </th>
                  {nonClass
                    ? <td colSpan={data.days.length}>{p.label}</td>
                    : data.days.map((day, di) => {
                      const key = `${di}|${p.id}`;
                      // No cell for the far half of a double period: the first
                      // half's rowSpan already occupies this position, and a
                      // second <td> here would push the row past the number of
                      // columns. It is still reachable - that area belongs to
                      // the spanning lesson's own cell, so dropping on it (or
                      // tabbing to the lesson and pressing Enter) swaps with
                      // the double period, which is the only sensible outcome
                      // when the slot is already taken.
                      if (covered[key]) return null;
                      const lesson = bySlot[key];
                      const conflict = picked && picked !== lesson && !lesson
                        ? conflictAt(picked, di, p.id) : null;
                      const wrongKind = picked && !picked.duty && p.kind !== 'class'
                        ? `${p.label} is not a teaching period` : null;
                      const blocked = conflict || wrongKind;
                      const isHovered = hover === key;
                      const flagged = highlight === key;
                      return (
                        <td
                          key={key}
                          data-slot={key}
                          rowSpan={lesson?.n && lesson.n > 1 ? lesson.n : undefined}
                          className={[
                            'tt-slot',
                            picked && canEdit && !blocked ? 'tt-target' : '',
                            picked && canEdit && blocked ? 'tt-blocked' : '',
                            isHovered && picked && canEdit && !blocked ? 'tt-drop' : '',
                            isHovered && picked && canEdit && blocked ? 'tt-invalid' : '',
                            flagged ? 'tt-flagged' : '',
                            clashKeys.has(key) ? 'tt-clashing' : '',
                          ].filter(Boolean).join(' ')}
                          title={blocked && picked ? blocked : undefined}
                          onDragOver={(e) => {
                            if (!canEdit || !picked) return;
                            e.preventDefault();
                            // Only on a real change: dragover fires continuously,
                            // and setting state each time re-renders the grid.
                            if (hover !== key) setHover(key);
                          }}
                          onDragLeave={() => { if (hover === key) setHover(null); }}
                          onDrop={(e) => {
                            e.preventDefault(); setHover(null);
                            place(di, p.id, lesson);
                          }}
                          onClick={() => { if (!lesson) place(di, p.id); }}
                          onKeyDown={(e) => {
                            if (!canEdit || !picked || lesson) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              place(di, p.id);
                            }
                          }}
                          // An empty slot only becomes focusable once something
                          // is in hand, so tabbing the grid normally is not a
                          // walk through 40 empty cells.
                          tabIndex={canEdit && picked && !lesson ? 0 : undefined}
                          role={canEdit && picked && !lesson ? 'button' : undefined}
                          aria-label={canEdit && picked && !lesson
                            ? `Place ${picked.t} in ${day}, ${p.label}${blocked ? ` — ${blocked}` : ''}`
                            : undefined}
                        >
                          {lesson && (
                            <div
                              className={[
                                'tt-lesson',
                                lesson.duty ? 'tt-duty' : '',
                                picked === lesson ? 'tt-picked' : '',
                              ].filter(Boolean).join(' ')}
                              draggable={canEdit}
                              onDragStart={() => setPicked(lesson)}
                              onDragEnd={() => { setPicked(null); setHover(null); }}
                              onClick={(e) => {
                                if (!canEdit) return;
                                e.stopPropagation();
                                if (picked && picked !== lesson) place(di, p.id, lesson);
                                else setPicked(picked === lesson ? null : lesson);
                              }}
                              onKeyDown={(e) => {
                                if (!canEdit) return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (picked && picked !== lesson) place(di, p.id, lesson);
                                  else setPicked(picked === lesson ? null : lesson);
                                }
                              }}
                              tabIndex={canEdit ? 0 : -1}
                              role={canEdit ? 'button' : undefined}
                              aria-pressed={canEdit ? picked === lesson : undefined}
                              title={lesson.duty ? 'Lunch duty' : undefined}
                            >
                              <b>{lesson.t}</b>
                              {lesson.o?.length ? <div className="tt-meta">{lesson.o.join(' · ')}</div> : null}
                              {view !== 'teacher' && lesson.w?.length
                                ? <div className="tt-meta">{lesson.w.join(' · ')}</div> : null}
                              {view !== 'class' && lesson.g?.length
                                ? <div className="tt-meta">{lesson.g.join(', ')}</div> : null}
                              {lesson.r && <span className="tt-room">{lesson.r}</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <p className="tt-legend">
        <span className="tt-key tt-key-duty" /> Duty<Hint term="timetable-duty" />
        <span className="tt-key tt-key-lesson" /> Lesson
        <span className="tt-legend-term">Pool<Hint term="timetable-pool" /></span>
        <span className="tt-legend-term">CPS<Hint term="timetable-cps" /></span>
        <span className="tt-legend-term">Lunch sittings<Hint term="timetable-lunch-sitting" /></span>
      </p>

      <p className="tt-hint">
        {!mayEdit
          ? 'Read-only. Ask an administrator to make changes.'
          : isDraft
            ? 'Drag a lesson to another slot, or click it and then click where it should go. '
              + 'Dropping it on another lesson swaps the two. A move that would double-book '
              + 'a teacher, a class or a room is refused with the reason.'
            : 'This version cannot be edited. Make a draft to change the timetable.'}
      </p>

      {clashes.length > 0 && (
        <div className="tt-clashes">
          <h3>Clashes</h3>
          <p className="tt-hint">Choose one to jump to it in the grid.</p>
          <ul>
            {clashes.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="tt-clash-link"
                  onClick={() => jumpToClash(c)}
                >
                  <strong>{c.kind === 'fit' ? 'does not fit' : c.kind}</strong> {c.who} — {c.day}, {c.period}
                  {' ('}{c.activities.map((a) => a.subject).join(' / ')}{')'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal isOpen={draftOpen} onClose={() => setDraftOpen(false)} title="New draft" size="small">
        <NewDraftForm
          schoolYear={data.schoolYear}
          versions={versions}
          defaultCloneFrom={versionId}
          onCancel={() => setDraftOpen(false)}
          onCreated={async (id, message) => {
            setDraftOpen(false);
            showToast(message, 'success');
            loadVersions();
            await load(id);
          }}
          onError={(m) => showToast(m, 'error')}
        />
      </Modal>
    </div>
  );
};

/**
 * Making a draft is how any change to the timetable starts, so the form says
 * what a draft is for rather than just naming its fields.
 */
const NewDraftForm = ({
  schoolYear, versions, defaultCloneFrom, onCancel, onCreated, onError,
}: {
  schoolYear: string;
  versions: TimetableVersion[];
  defaultCloneFrom: string;
  onCancel: () => void;
  onCreated: (id: string, message: string) => void;
  onError: (message: string) => void;
}) => {
  const [year, setYear] = useState(schoolYear);
  const [label, setLabel] = useState('');
  const [cloneFrom, setCloneFrom] = useState(defaultCloneFrom);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!year.trim() || !label.trim() || !cloneFrom) return;
    setSaving(true);
    try {
      const r = await apiService.createTimetableVersion({
        schoolYear: year.trim(), label: label.trim(), cloneFrom,
      });
      onCreated(r.version.id, `Draft "${r.version.label}" created.`);
    } catch (e: any) {
      onError(e?.message || 'Could not create the draft');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="tt-form">
      <p className="field-hint">
        A draft is a private copy of the timetable. Changes to it are not visible to
        students or parents until it is published.
      </p>

      <label htmlFor="tt-draft-year">School year</label>
      <input id="tt-draft-year" value={year} onChange={(e) => setYear(e.target.value)} required />

      <label htmlFor="tt-draft-label">Name</label>
      <input
        id="tt-draft-label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Term 2 revision"
        required
      />
      <p className="field-hint">Something you will recognise in the version list.</p>

      <label htmlFor="tt-draft-clone">Copy lessons from</label>
      <select id="tt-draft-clone" value={cloneFrom} onChange={(e) => setCloneFrom(e.target.value)} required>
        {versions.map((v) => (
          <option key={v.id} value={v.id}>{v.schoolYear} · {v.label} — {v.status}</option>
        ))}
      </select>
      <p className="field-hint">
        Almost always the current timetable — you then change the few lessons that move.
        Copying a large timetable can take a moment. There is no "start empty" option
        because this page moves lessons between slots; it cannot invent them. A timetable
        built from scratch has to be imported from FET.
      </p>

      <div className="tt-form-actions">
        <button type="button" className="tt-btn" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="tt-btn tt-btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create draft'}
        </button>
      </div>
    </form>
  );
};

export default Timetable;

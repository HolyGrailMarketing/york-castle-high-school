import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
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
 * Teachers can read all three. Only ADMIN and STAFF can move anything.
 */

type View = 'class' | 'teacher' | 'room';

const EDIT_ROLES = ['ADMIN', 'STAFF'];

const clock = (t?: string) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  return `${hour % 12 || 12}:${m}${hour < 12 ? 'am' : 'pm'}`;
};

const Timetable = () => {
  const { user } = useAuth();
  const canEdit = EDIT_ROLES.includes(user?.role ?? '');

  const [data, setData] = useState<TimetableStaffPayload | null>(null);
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [versionId, setVersionId] = useState<string>('');
  const [view, setView] = useState<View>('class');
  const [subject, setSubject] = useState<string>('');   // which class/teacher/room
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: string; text: string } | null>(null);
  const [clashes, setClashes] = useState<TimetableClash[]>([]);

  // Click-to-move: the lesson waiting to be placed. This is not a fallback for
  // dragging - it is the keyboard and touch path, and it is quicker than
  // dragging across a wide grid.
  const [picked, setPicked] = useState<TimetableLesson | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const load = useCallback(async (id?: string) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiService.getStaffTimetable(id ? { versionId: id } : undefined);
      setData(payload);
      setVersionId(payload.version.id);
    } catch (e: any) {
      setError(e?.message || 'Could not load the timetable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (canEdit) {
      apiService.getTimetableVersions()
        .then((r) => setVersions(r.versions))
        .catch(() => { /* the picker just stays empty */ });
    }
  }, [load, canEdit]);

  // The options for whichever grouping is selected.
  const options = useMemo(() => {
    if (!data) return [];
    if (view === 'class') return data.years.flatMap((y) => y.groups);
    if (view === 'teacher') return Object.keys(data.teachers).sort();
    return Object.keys(data.rooms).sort();
  }, [data, view]);

  useEffect(() => {
    if (options.length && !options.includes(subject)) setSubject(options[0]);
  }, [options, subject]);

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

  const move = async (lesson: TimetableLesson, dayIndex: number, periodId: string) => {
    if (!data || !canEdit) return;
    if (!lesson.i) {
      setNotice({ kind: 'error', text: 'That lesson has no placement to move.' });
      return;
    }
    setNotice({ kind: 'info', text: 'Moving…' });
    try {
      const res = await apiService.moveTimetablePlacement(lesson.i, {
        day: data.days[dayIndex], periodKey: periodId,
      });
      setNotice({ kind: 'ok', text: `Moved to ${data.days[dayIndex]}, ${periodId}.` });
      setClashes(res.clashes ?? []);
      await load(versionId);
    } catch (e: any) {
      setNotice({ kind: 'error', text: e?.message || 'That move was refused' });
      setClashes(e?.clashes ?? []);
    } finally {
      setPicked(null);
    }
  };

  const validate = async () => {
    if (!versionId) return;
    const r = await apiService.validateTimetableVersion(versionId);
    setClashes(r.clashes);
    setNotice(r.ok
      ? { kind: 'ok', text: `No clashes across ${r.placements} placements.` }
      : { kind: 'warn', text: `${r.clashes.length} clash(es) found.` });
  };

  const publish = async () => {
    if (!versionId) return;
    if (!window.confirm('Publish this version? The website updates on the next deploy.')) return;
    try {
      const r = await apiService.publishTimetableVersion(versionId);
      setNotice({ kind: 'ok', text: r.message });
      await load(versionId);
    } catch (e: any) {
      setNotice({ kind: 'error', text: e?.message || 'Could not publish' });
      setClashes(e?.clashes ?? []);
    }
  };

  if (loading) return <div className="page"><p>Loading the timetable…</p></div>;
  if (error) return <div className="page"><div className="tt-banner error">{error}</div></div>;
  if (!data) return null;

  return (
    <div className="page">
      <h1>Timetable</h1>
      <p className="tt-hint">
        {data.schoolYear} · {data.version.label} · {data.version.status}
        {!canEdit && ' · read-only'}
      </p>

      <div className="tt-toolbar">
        <div className="tt-field">
          <label htmlFor="tt-view">View</label>
          <select id="tt-view" value={view} onChange={(e) => setView(e.target.value as View)}>
            <option value="class">By class</option>
            <option value="teacher">By teacher</option>
            <option value="room">By room</option>
          </select>
        </div>
        <div className="tt-field">
          <label htmlFor="tt-subject">
            {view === 'class' ? 'Class' : view === 'teacher' ? 'Teacher' : 'Room'}
          </label>
          <select id="tt-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {canEdit && versions.length > 0 && (
          <div className="tt-field">
            <label htmlFor="tt-version">Version</label>
            <select id="tt-version" value={versionId} onChange={(e) => load(e.target.value)}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{v.label} — {v.status}</option>
              ))}
            </select>
          </div>
        )}

        <div className="tt-spacer" />
        {canEdit && <button className="btn" onClick={validate}>Check for clashes</button>}
        {user?.role === 'ADMIN' && data.version.status !== 'PUBLISHED' && (
          <button className="btn btn-primary" onClick={publish}>Publish</button>
        )}
      </div>

      {notice && <div className={`tt-banner ${notice.kind}`}>{notice.text}</div>}
      {picked && (
        <div className="tt-banner info">
          Moving <strong>{picked.t}</strong> — click an empty slot to place it, or press Escape to cancel.
        </div>
      )}

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
              // anything here, draw real cells so it is not silently hidden.
              const hasHere = data.days.some((_, di) => bySlot[`${di}|${p.id}`]);
              const nonClass = p.kind !== 'class' && !hasHere;
              return (
                <tr key={p.id} className={nonClass ? 'tt-row-nonclass' : undefined}>
                  <th className="tt-time">
                    <b>{p.label}</b>
                    {p.start && <span>{clock(p.start)} – {clock(p.end)}</span>}
                  </th>
                  {nonClass
                    ? <td colSpan={data.days.length}>{p.label}</td>
                    : data.days.map((day, di) => {
                      const key = `${di}|${p.id}`;
                      if (covered[key]) return null;
                      const lesson = bySlot[key];
                      const isTarget = picked && !lesson;
                      return (
                        <td
                          key={key}
                          rowSpan={lesson?.n && lesson.n > 1 ? lesson.n : undefined}
                          className={[
                            'tt-slot',
                            hover === key && isTarget ? 'tt-drop' : '',
                            hover === key && picked && lesson ? 'tt-invalid' : '',
                          ].filter(Boolean).join(' ')}
                          onDragOver={(e) => { if (canEdit) { e.preventDefault(); setHover(key); } }}
                          onDragLeave={() => setHover(null)}
                          onDrop={(e) => {
                            e.preventDefault(); setHover(null);
                            if (canEdit && picked) move(picked, di, p.id);
                          }}
                          onClick={() => { if (canEdit && picked && !lesson) move(picked, di, p.id); }}
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
                                setPicked(picked === lesson ? null : lesson);
                              }}
                              onKeyDown={(e) => {
                                if (!canEdit) return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setPicked(picked === lesson ? null : lesson);
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

      <p className="tt-hint">
        {canEdit
          ? 'Drag a lesson to another slot, or click it and then click where it should go. A move that would double-book a teacher, a class or a room is refused with the reason.'
          : 'Read-only. Ask an administrator to make changes.'}
      </p>

      {clashes.length > 0 && (
        <div className="tt-clashes">
          <h3>Clashes</h3>
          <ul>
            {clashes.map((c, i) => (
              <li key={i}>
                <strong>{c.kind}</strong> {c.who} — {c.day}, {c.period}
                {' ('}{c.activities.map((a) => a.subject).join(' / ')}{')'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Timetable;

import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type { BooklistEntry } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import './Booklist.css';

// The grades the website has always listed. Free text is still allowed so an
// admin isn't blocked if the school adds one.
const GRADE_OPTIONS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Sixth Form'];

// Default the school-year field to the academic year we're currently in
// (September rollover), so the common case needs no typing.
const currentSchoolYear = (): string => {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
};

const Booklist = () => {
  const [entries, setEntries] = useState<BooklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ schoolYear: currentSchoolYear(), gradeLabel: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const data = await apiService.getBooklistEntries();
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Failed to fetch booklist:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // The website shows the newest year that has published entries. Surface that
  // here so an admin can see at a glance what visitors are actually getting.
  const liveSchoolYear = useMemo(() => {
    const published = entries.filter((entry) => entry.isPublished).map((entry) => entry.schoolYear);
    return published.sort().reverse()[0] || null;
  }, [entries]);

  const groupedByYear = useMemo(() => {
    const groups = new Map<string, BooklistEntry[]>();
    for (const entry of entries) {
      const group = groups.get(entry.schoolYear) || [];
      group.push(entry);
      groups.set(entry.schoolYear, group);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const handleOpenModal = () => {
    setFormData({ schoolYear: liveSchoolYear || currentSchoolYear(), gradeLabel: '' });
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please choose a booklist file to upload', 'warning');
      return;
    }

    const replacing = entries.some(
      (entry) => entry.schoolYear === formData.schoolYear && entry.gradeLabel === formData.gradeLabel
    );

    setSubmitting(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      uploadData.append('schoolYear', formData.schoolYear.trim());
      uploadData.append('gradeLabel', formData.gradeLabel.trim());

      await apiService.uploadBooklistEntry(uploadData);
      showToast(
        replacing
          ? `${formData.gradeLabel} booklist replaced successfully!`
          : `${formData.gradeLabel} booklist uploaded successfully!`,
        'success'
      );
      handleCloseModal();
      fetchEntries();
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Failed to upload booklist', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublished = async (entry: BooklistEntry) => {
    try {
      await apiService.updateBooklistEntry(entry.id, { isPublished: !entry.isPublished });
      showToast(
        entry.isPublished
          ? `${entry.gradeLabel} hidden from the website`
          : `${entry.gradeLabel} is now live on the website`,
        'success'
      );
      fetchEntries();
    } catch (error) {
      showToast('Failed to update booklist entry', 'error');
    }
  };

  const handleDelete = async (entry: BooklistEntry) => {
    if (
      window.confirm(
        `Delete the ${entry.gradeLabel} booklist for ${entry.schoolYear}? This removes it from the website and deletes the file.`
      )
    ) {
      try {
        await apiService.deleteBooklistEntry(entry.id);
        showToast('Booklist entry deleted successfully!', 'success');
        fetchEntries();
      } catch (error) {
        showToast('Failed to delete booklist entry', 'error');
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading booklist...</div>;
  }

  return (
    <div className="booklist-page">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}

      <div className="page-header">
        <h1>Booklist</h1>
        <button className="btn-primary" onClick={handleOpenModal}>Upload Booklist</button>
      </div>

      <p className="page-intro">
        These files are what visitors download from the booklist page on the website.
        {liveSchoolYear
          ? ` The site is currently showing ${liveSchoolYear}.`
          : ' Nothing is published yet, so the site is showing its built-in fallback links.'}
        {' '}Uploading a grade that already exists replaces its file.
      </p>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>No booklists uploaded yet. Upload one for each grade to publish it on the website.</p>
        </div>
      ) : (
        groupedByYear.map(([schoolYear, yearEntries]) => (
          <section key={schoolYear} className="booklist-year">
            <h2>
              {schoolYear}
              {schoolYear === liveSchoolYear && <span className="live-badge">Live on website</span>}
            </h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>File</th>
                  <th>Size</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {yearEntries.map((entry) => (
                  <tr key={entry.id} className={entry.isPublished ? '' : 'row-unpublished'}>
                    <td>{entry.gradeLabel}</td>
                    <td>
                      <a href={entry.fileUrl} target="_blank" rel="noopener noreferrer">{entry.fileName}</a>
                    </td>
                    <td>{entry.fileSize ? `${(entry.fileSize / 1024).toFixed(0)} KB` : '—'}</td>
                    <td>{new Date(entry.updatedAt).toLocaleDateString()}</td>
                    <td>{entry.isPublished ? 'Published' : 'Hidden'}</td>
                    <td>
                      <button onClick={() => handleTogglePublished(entry)} className="btn-download">
                        {entry.isPublished ? 'Hide' : 'Publish'}
                      </button>
                      <button onClick={() => handleDelete(entry)} className="btn-delete">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Upload Booklist">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>School Year</label>
            <input
              type="text"
              value={formData.schoolYear}
              onChange={(e) => setFormData({ ...formData, schoolYear: e.target.value })}
              placeholder="2025-2026"
              required
            />
            <span className="field-hint">This is the year shown in the heading on the website.</span>
          </div>
          <div className="form-group">
            <label>Grade</label>
            <input
              type="text"
              list="booklist-grade-options"
              value={formData.gradeLabel}
              onChange={(e) => setFormData({ ...formData, gradeLabel: e.target.value })}
              placeholder="Grade 7"
              required
            />
            <datalist id="booklist-grade-options">
              {GRADE_OPTIONS.map((grade) => (
                <option key={grade} value={grade} />
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label>File</label>
            <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" required />
            {selectedFile && <p className="file-info">Selected: {selectedFile.name}</p>}
            <span className="field-hint">PDF or Word document, up to 10 MB.</span>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleCloseModal} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Booklist;

import { useEffect, useState, useRef } from 'react';
import { apiService } from '../services/api';
import type { Document } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import './Documents.css';

const Documents = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', category: '', description: '', isPublic: true });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await apiService.getDocuments();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setFormData({ title: '', category: '', description: '', isPublic: true });
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
      showToast('Please select a file to upload', 'warning');
      return;
    }

    try {
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      uploadData.append('title', formData.title);
      uploadData.append('category', formData.category);
      uploadData.append('description', formData.description);
      uploadData.append('isPublic', String(formData.isPublic));

      await apiService.uploadDocument(uploadData);
      showToast('Document uploaded successfully!', 'success');
      handleCloseModal();
      fetchDocuments();
    } catch (error) {
      showToast('Failed to upload document', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await apiService.deleteDocument(id);
        showToast('Document deleted successfully!', 'success');
        fetchDocuments();
      } catch (error) {
        showToast('Failed to delete document', 'error');
      }
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      showToast(`Downloading ${fileName}...`, 'info');
      await apiService.downloadDocument(id);
    } catch (error) {
      showToast('Failed to download document', 'error');
    }
  };

  if (loading) {
    return <div className="loading">Loading documents...</div>;
  }

  return (
    <div className="documents-page">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}

      <div className="page-header">
        <h1>Documents</h1>
        <button className="btn-primary" onClick={handleOpenModal}>Upload Document</button>
      </div>

      <div className="documents-list">
        {documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents uploaded yet. Upload your first document!</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>File Name</th>
                <th>Size</th>
                <th>Downloads</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.title}</td>
                  <td>{doc.category || 'Uncategorized'}</td>
                  <td>{doc.fileName}</td>
                  <td>{doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : 'N/A'}</td>
                  <td>{doc.downloadCount || 0}</td>
                  <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => handleDownload(doc.id, doc.fileName)} className="btn-download">Download</button>
                    <button onClick={() => handleDelete(doc.id)} className="btn-delete">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Upload Document">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="">Select Category</option>
              <option value="Forms">Forms</option>
              <option value="Policies">Policies</option>
              <option value="Reports">Reports</option>
              <option value="Curriculum">Curriculum</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>File</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              required
            />
            {selectedFile && <p className="file-info">Selected: {selectedFile.name}</p>}
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              />
              {' '}Public Document
            </label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleCloseModal} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Upload</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Documents;


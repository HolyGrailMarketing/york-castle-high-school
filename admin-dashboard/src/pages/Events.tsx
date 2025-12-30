import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Event } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import './Events.css';

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    isPublic: true,
  });
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await apiService.getEvents({});
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description || '',
        startDate: event.startDate?.split('T')[0] || '',
        endDate: event.endDate?.split('T')[0] || '',
        location: event.location || '',
        isPublic: event.isPublic ?? true,
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        location: '',
        isPublic: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await apiService.updateEvent(editingEvent.id, formData);
        showToast('Event updated successfully!', 'success');
      } else {
        await apiService.createEvent(formData);
        showToast('Event created successfully!', 'success');
      }
      handleCloseModal();
      fetchEvents();
    } catch (error) {
      showToast('Failed to save event', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await apiService.deleteEvent(id);
        showToast('Event deleted successfully!', 'success');
        fetchEvents();
      } catch (error) {
        showToast('Failed to delete event', 'error');
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading events...</div>;
  }

  return (
    <div className="events-page">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}

      <div className="page-header">
        <h1>Events</h1>
        <button className="btn-primary" onClick={() => handleOpenModal()}>New Event</button>
      </div>

      <div className="events-list">
        {events.length === 0 ? (
          <div className="empty-state">
            <p>No events scheduled. Create your first event!</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="event-card">
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <div className="event-meta">
                <span>📅 {new Date(event.startDate).toLocaleDateString()}</span>
                {event.location && <span>📍 {event.location}</span>}
                <span className={event.isPublic ? 'public' : 'private'}>
                  {event.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="event-actions">
                <button onClick={() => handleOpenModal(event)} className="btn-edit">Edit</button>
                <button onClick={() => handleDelete(event.id)} className="btn-delete">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingEvent ? 'Edit Event' : 'New Event'}>
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
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              />
              {' '}Public Event
            </label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleCloseModal} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingEvent ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Events;


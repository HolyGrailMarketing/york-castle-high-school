import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { BlogPost } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import './BlogPosts.css';
import PageHelp from '../components/PageHelp';

const BlogPosts = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', excerpt: '', published: false });
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await apiService.getBlogPosts({});
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (post?: BlogPost) => {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || '',
        published: post.published,
      });
    } else {
      setEditingPost(null);
      setFormData({ title: '', content: '', excerpt: '', published: false });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPost(null);
    setFormData({ title: '', content: '', excerpt: '', published: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPost) {
        await apiService.updateBlogPost(editingPost.id, formData);
        showToast('Blog post updated successfully!', 'success');
      } else {
        await apiService.createBlogPost(formData);
        showToast('Blog post created successfully!', 'success');
      }
      handleCloseModal();
      fetchPosts();
    } catch (error) {
      showToast('Failed to save blog post', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await apiService.deleteBlogPost(id);
        showToast('Blog post deleted successfully!', 'success');
        fetchPosts();
      } catch (error) {
        showToast('Failed to delete blog post', 'error');
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading blog posts...</div>;
  }

  return (
    <div className="blog-posts-page">
      <PageHelp pageKey="blog" />
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
      
      <div className="page-header">
        <h1>Blog Posts</h1>
        <button className="btn-primary" onClick={() => handleOpenModal()}>New Post</button>
      </div>

      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="empty-state">
            <p>No blog posts yet. Create your first post!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="post-card">
              <h3>{post.title}</h3>
              <p className="post-excerpt">{post.excerpt || post.content?.substring(0, 150) || ''}...</p>
              <div className="post-meta">
                <span>By {post.author?.name || 'Unknown'}</span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                <span className={post.published ? 'published' : 'draft'}>
                  {post.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="post-actions">
                <button onClick={() => handleOpenModal(post)} className="btn-edit">Edit</button>
                <button onClick={() => handleDelete(post.id)} className="btn-delete">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingPost ? 'Edit Post' : 'New Post'} size="large">
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
            <label>Excerpt</label>
            <input
              type="text"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              placeholder="Brief summary..."
            />
          </div>
          <div className="form-group">
            <label>Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={10}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.published}
                onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
              />
              {' '}Published
            </label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleCloseModal} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">{editingPost ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BlogPosts;


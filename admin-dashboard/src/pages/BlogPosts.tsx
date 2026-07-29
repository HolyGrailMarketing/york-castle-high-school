import { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import type { BlogPost } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { SITE_IMAGES } from '../constants/siteImages';
import './BlogPosts.css';

const emptyForm = {
  title: '',
  content: '',
  excerpt: '',
  featuredImage: '',
  published: false,
};

/**
 * The admin is served from /admin/, so a repo-relative path like
 * "images/foo.webp" would resolve to /admin/images/foo.webp and 404.
 */
const resolvePreview = (value: string) =>
  /^https?:\/\//i.test(value) ? value : '/' + value.replace(/^\/+/, '');

const BlogPosts = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    fetchPosts();
    // Storage is optional; the path/URL field works either way.
    apiService
      .getUploadConfig()
      .then((cfg) => setUploadEnabled(Boolean(cfg?.enabled)))
      .catch(() => setUploadEnabled(false));
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
    setPreviewFailed(false);
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || '',
        featuredImage: post.featuredImage || '',
        published: post.published,
      });
    } else {
      setEditingPost(null);
      setFormData(emptyForm);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPost(null);
    setFormData(emptyForm);
    setPreviewFailed(false);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so re-picking the same file fires onChange again.
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const { url } = await apiService.uploadImage(body);
      setPreviewFailed(false);
      setFormData((prev) => ({ ...prev, featuredImage: url }));
      showToast('Image uploaded', 'success');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
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
              {post.featuredImage ? (
                <img
                  src={resolvePreview(post.featuredImage)}
                  alt=""
                  className="post-card-thumb"
                  loading="lazy"
                />
              ) : (
                <div className="post-card-thumb post-card-thumb-empty">No image</div>
              )}
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
            <label>Featured image</label>
            <div className="featured-image-row">
              <input
                type="text"
                list="site-images"
                value={formData.featuredImage}
                onChange={(e) => {
                  setPreviewFailed(false);
                  setFormData({ ...formData, featuredImage: e.target.value });
                }}
                placeholder="images/IMG_0813.webp or https://..."
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelected}
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={!uploadEnabled || uploading}
              >
                {uploading ? 'Uploading…' : 'Upload…'}
              </button>
              {formData.featuredImage && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setFormData({ ...formData, featuredImage: '' })}
                >
                  Clear
                </button>
              )}
            </div>
            <datalist id="site-images">
              {SITE_IMAGES.map((img) => (
                <option key={img.path} value={img.path}>{img.label}</option>
              ))}
            </datalist>
            {!uploadEnabled && (
              <p className="upload-hint">
                Image upload isn’t configured yet — pick one of the school photos above,
                or paste a full image URL.
              </p>
            )}
            {formData.featuredImage && !previewFailed && (
              <img
                src={resolvePreview(formData.featuredImage)}
                alt=""
                className="featured-preview"
                onError={() => setPreviewFailed(true)}
              />
            )}
            {formData.featuredImage && previewFailed && (
              <p className="upload-hint upload-hint-error">
                That image couldn’t be loaded. Check the path or URL.
              </p>
            )}
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

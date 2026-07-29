/**
 * Renders blog posts from the API into the public site.
 *
 * Populates whichever containers are present on the page:
 *   #homepage-news     - featured post + short list on the homepage
 *   #blog-posts        - the full listing on blog.html
 *   #blog-post-detail  - a single post on detail_blog.html (?slug=... or ?id=...)
 */
(function () {
  var API_BASE_URL = window.API_BASE_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api');

  /* A real school photograph, used when a post has no image of its own. */
  var FALLBACK_IMAGE = 'images/IMG_0814.webp';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function postUrl(post) {
    return 'detail_blog.html?slug=' + encodeURIComponent(post.slug || post.id);
  }

  function postImage(post) {
    return escapeHtml(post.featuredImage || FALLBACK_IMAGE);
  }

  function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function request(endpoint) {
    return fetch(API_BASE_URL + endpoint, { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed: ' + response.status);
        return response.json();
      });
  }

  /* ---------- homepage: one featured post + a short list ---------- */

  function renderHomepage(container, posts) {
    if (!posts.length) {
      container.innerHTML = '';
      return;
    }

    var featured = posts[0];
    var rest = posts.slice(1, 3);

    var html = '' +
      '<a href="' + postUrl(featured) + '" class="news-featured">' +
        '<img src="' + postImage(featured) + '" alt="' + escapeHtml(featured.title) + '">' +
        '<div class="news-featured-content">' +
          '<div class="news-date">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>' +
              '<line x1="16" y1="2" x2="16" y2="6"></line>' +
              '<line x1="8" y1="2" x2="8" y2="6"></line>' +
              '<line x1="3" y1="10" x2="21" y2="10"></line>' +
            '</svg>' +
            (formatDate(featured.publishedAt) || 'Featured') +
          '</div>' +
          '<h3>' + escapeHtml(featured.title) + '</h3>' +
          (featured.excerpt ? '<p>' + escapeHtml(featured.excerpt) + '</p>' : '') +
        '</div>' +
      '</a>';

    if (rest.length) {
      html += '<div class="news-list">' + rest.map(function (post) {
        return '' +
          '<a href="' + postUrl(post) + '" class="news-item">' +
            '<img src="' + postImage(post) + '" alt="' + escapeHtml(post.title) + '" ' +
                 'class="news-item-image" loading="lazy" decoding="async">' +
            '<div class="news-item-content">' +
              '<h4>' + escapeHtml(post.title) + '</h4>' +
              '<div class="news-date">' + escapeHtml(formatDate(post.publishedAt)) + '</div>' +
            '</div>' +
          '</a>';
      }).join('') + '</div>';
    }

    container.innerHTML = html;
  }

  /* ---------- blog.html: featured post + card grid ---------- */

  function heroCard(post) {
    return '' +
      '<a href="' + postUrl(post) + '" class="blog-hero-card">' +
        // The LCP element - loaded eagerly and given priority.
        '<img src="' + postImage(post) + '" alt="' + escapeHtml(post.title) + '" ' +
             'fetchpriority="high" decoding="async">' +
        '<div class="blog-hero-content">' +
          '<div class="blog-card-meta">' + escapeHtml(formatDate(post.publishedAt)) + '</div>' +
          '<h2>' + escapeHtml(post.title) + '</h2>' +
          (post.excerpt ? '<p>' + escapeHtml(post.excerpt) + '</p>' : '') +
        '</div>' +
      '</a>';
  }

  function gridCard(post) {
    var url = postUrl(post);
    return '' +
      '<div role="listitem">' +
        '<div class="blog-card">' +
          '<a href="' + url + '" class="blog-card-media" tabindex="-1" aria-hidden="true">' +
            '<img src="' + postImage(post) + '" alt="" loading="lazy" decoding="async">' +
          '</a>' +
          '<div class="blog-card-body">' +
            '<div class="blog-card-meta">' + escapeHtml(formatDate(post.publishedAt)) + '</div>' +
            '<h3 class="blog-card-title">' +
              '<a href="' + url + '">' + escapeHtml(post.title) + '</a>' +
            '</h3>' +
            (post.excerpt
              ? '<p class="blog-card-summary">' + escapeHtml(post.excerpt) + '</p>'
              : '') +
            '<span class="blog-card-more">Read more &rarr;</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* A compact strip of cards, for pages whose main subject is something else. */
  function renderNewsStrip(container, posts) {
    if (!posts.length) {
      container.innerHTML =
        '<p class="blog-empty">No news has been published yet.</p>';
      return;
    }

    container.innerHTML =
      '<div role="list" class="blog-grid">' +
      posts.slice(0, 3).map(gridCard).join('') +
      '</div>';
  }

  function renderListing(container, posts) {
    if (!posts.length) {
      container.innerHTML =
        '<p class="blog-empty">No news has been published yet. Please check back soon.</p>';
      return;
    }

    var html = heroCard(posts[0]);

    if (posts.length > 1) {
      html += '<div role="list" class="blog-grid">' +
        posts.slice(1).map(gridCard).join('') +
        '</div>';
    }

    container.innerHTML = html;
  }

  /* ---------- detail_blog.html: a single post ---------- */

  function setMeta(selector, value) {
    var tag = document.querySelector(selector);
    if (tag) tag.setAttribute('content', value);
  }

  /* og:image and twitter:image must be absolute URLs. */
  function absoluteUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path, window.location.href).href;
  }

  function renderDetail(container, post) {
    // The title, byline and body sit in separate sections of the page, so
    // these are looked up document-wide rather than inside the container.
    var titleEl = document.querySelector('.blog-title-wrapper .heading-48') ||
                  document.querySelector('.blog-title-wrapper h1');
    if (titleEl) titleEl.textContent = post.title;

    var image = post.featuredImage || FALLBACK_IMAGE;

    var heroImg = document.getElementById('blog-hero-image');
    if (heroImg) {
      heroImg.src = image;
      heroImg.alt = '';
    }

    // content is authored HTML from the admin editor, not visitor input
    container.innerHTML = post.content || '';

    var dateEl = document.querySelector('.blog-post-date-title');
    if (dateEl) dateEl.textContent = formatDate(post.publishedAt);

    var authorName = (post.author && post.author.name) || '';
    if (authorName) {
      document.querySelectorAll('.blog-post-author-link, .blog-author-title-link')
        .forEach(function (el) { el.innerHTML = '<strong>' + escapeHtml(authorName) + '</strong>'; });
    }

    // Keep the tab title and share previews in step with the post
    document.title = post.title + ' | York Castle High School';
    if (post.excerpt) {
      setMeta('meta[name="description"]', post.excerpt);
      setMeta('meta[property="og:description"]', post.excerpt);
      setMeta('meta[property="twitter:description"]', post.excerpt);
    }
    setMeta('meta[property="og:title"]', post.title);
    setMeta('meta[property="twitter:title"]', post.title);
    setMeta('meta[property="og:image"]', absoluteUrl(image));
    setMeta('meta[property="twitter:image"]', absoluteUrl(image));
    setMeta('meta[property="og:url"]', window.location.href);
  }

  function loadDetail(container) {
    var params = new URLSearchParams(window.location.search);
    var key = params.get('slug') || params.get('id');

    if (!key) {
      container.innerHTML = '<p>Post not found. <a href="blog.html">Back to news</a></p>';
      return;
    }

    request('/blog/' + encodeURIComponent(key))
      .then(function (data) {
        if (!data || !data.post) throw new Error('Missing post');
        renderDetail(container, data.post);
      })
      .catch(function (error) {
        console.error('Failed to load blog post:', error);
        container.innerHTML =
          '<p>Sorry, this post could not be loaded. <a href="blog.html">Back to news</a></p>';
      });
  }

  function load() {
    var homepage = document.getElementById('homepage-news');
    var listing = document.getElementById('blog-posts');
    var strip = document.getElementById('latest-news');
    var detail = document.getElementById('blog-post-detail');

    if (detail) loadDetail(detail);

    if (!homepage && !listing && !strip) return;

    request('/blog?limit=' + (listing ? 30 : 3))
      .then(function (data) {
        var posts = (data && data.posts) || [];
        if (homepage) renderHomepage(homepage, posts);
        if (listing) renderListing(listing, posts);
        if (strip) renderNewsStrip(strip, posts);
      })
      .catch(function (error) {
        console.error('Failed to load blog posts:', error);
        var target = listing || strip;
        if (target) {
          target.innerHTML =
            '<p class="blog-empty">News is unavailable right now.</p>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

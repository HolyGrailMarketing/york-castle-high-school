/**
 * Renders school events from the API into the public site.
 *
 * Populates two containers when present on the page:
 *   #upcoming-events   - the compact "Upcoming Events" widget on the homepage
 *   #calendar-events   - the full listing on calendar.html
 */
(function () {
  var API_BASE_URL = window.API_BASE_URL ||
    (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api');

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /*
   * Event dates come from a date picker, so they are calendar dates stored at
   * UTC midnight rather than real instants. Formatting them in the visitor's
   * zone shifts them a day west of UTC - in Jamaica (UTC-5) every event
   * displayed one day early. All event date formatting is therefore pinned
   * to UTC.
   */
  var DATE_OPTS = {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  };

  function sameUtcDay(a, b) {
    return a.getUTCFullYear() === b.getUTCFullYear() &&
           a.getUTCMonth() === b.getUTCMonth() &&
           a.getUTCDate() === b.getUTCDate();
  }

  function formatFullDate(event) {
    var start = new Date(event.startDate);
    var text = start.toLocaleDateString('en-GB', DATE_OPTS);

    if (event.endDate) {
      var end = new Date(event.endDate);
      if (!sameUtcDay(end, start)) {
        text += ' &ndash; ' + end.toLocaleDateString('en-GB', DATE_OPTS);
      }
    }
    return text;
  }

  function renderWidget(container, events) {
    if (!events.length) {
      container.innerHTML =
        '<p class="events-empty">No upcoming events right now. Check back soon.</p>';
      return;
    }

    container.innerHTML = events.slice(0, 3).map(function (event) {
      var start = new Date(event.startDate);
      return '' +
        '<div class="event-item">' +
          '<div class="event-date-box">' +
            '<span class="day">' + start.getUTCDate() + '</span>' +
            '<span class="month">' + MONTHS[start.getUTCMonth()] + '</span>' +
          '</div>' +
          '<div class="event-details">' +
            '<h4>' + escapeHtml(event.title) + '</h4>' +
            (event.description ? '<p>' + escapeHtml(event.description) + '</p>' : '') +
          '</div>' +
        '</div>';
    }).join('');
  }

  var CALENDAR_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>' +
      '<line x1="16" y1="2" x2="16" y2="6"></line>' +
      '<line x1="8" y1="2" x2="8" y2="6"></line>' +
      '<line x1="3" y1="10" x2="21" y2="10"></line>' +
    '</svg>';

  var PIN_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>' +
      '<circle cx="12" cy="10" r="3"></circle>' +
    '</svg>';

  function isToday(date) {
    return sameUtcDay(date, new Date());
  }

  function eventCard(event) {
    var start = new Date(event.startDate);

    return '' +
      '<article class="event-card' + (isToday(start) ? ' is-today' : '') + '">' +
        '<div class="event-card-date">' +
          '<span class="event-card-day">' + start.getUTCDate() + '</span>' +
          '<span class="event-card-month">' + MONTHS[start.getUTCMonth()] + '</span>' +
          '<span class="event-card-year">' + start.getUTCFullYear() + '</span>' +
        '</div>' +
        '<div class="event-card-body">' +
          '<h3 class="event-card-title">' + escapeHtml(event.title) + '</h3>' +
          '<div class="event-card-meta">' +
            CALENDAR_ICON +
            '<span>' + formatFullDate(event) + '</span>' +
            (event.location
              ? '<span class="event-card-location">' + PIN_ICON +
                escapeHtml(event.location) + '</span>'
              : '') +
          '</div>' +
          (event.description
            ? '<p class="event-card-desc">' + escapeHtml(event.description) + '</p>'
            : '') +
        '</div>' +
      '</article>';
  }

  function renderCalendar(container, events) {
    if (!events.length) {
      container.innerHTML =
        '<div class="calendar-empty">' +
          '<p>No events are scheduled at the moment.</p>' +
          '<p>Term dates and school events are posted here as they are confirmed.</p>' +
        '</div>';
      return;
    }

    container.innerHTML =
      '<div class="event-grid">' + events.map(eventCard).join('') + '</div>';
  }

  function loadEvents() {
    var widget = document.getElementById('upcoming-events');
    var calendar = document.getElementById('calendar-events');

    if (!widget && !calendar) return;

    // Only future events, soonest first (the API already sorts by startDate).
    var now = new Date();
    var since = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
    ));

    var url = API_BASE_URL + '/events?limit=50&startDate=' +
      encodeURIComponent(since.toISOString());

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Request failed: ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var events = (data && data.events) || [];
        if (widget) renderWidget(widget, events);
        if (calendar) renderCalendar(calendar, events);
      })
      .catch(function (error) {
        console.error('Failed to load events:', error);
        var message = '<p class="events-empty">Events are unavailable right now.</p>';
        if (widget) widget.innerHTML = message;
        if (calendar) {
          calendar.innerHTML =
            '<div class="calendar-empty"><p>Events are unavailable right now. ' +
            'Please try again shortly.</p></div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEvents);
  } else {
    loadEvents();
  }
})();

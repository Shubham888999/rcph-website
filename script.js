window.addEventListener('DOMContentLoaded', () => {
  // HTML includes
  document.querySelectorAll('[data-include]').forEach(async el => {
    const url = el.getAttribute('data-include');
    const resp = await fetch(url);
    if (resp.ok) {
      el.outerHTML = await resp.text();
    }
  });

  // After the fragments load, initialize calendar & gallery
  setTimeout(() => {
    initCalendar();
    autoScrollGallery();
  }, 100);
});

function initCalendar() {
  const calEl = document.getElementById('rcph-calendar');
  if (!calEl) return;
  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [
      { title: 'Induction Ceremony', start: '2025-08-09', description: 'Induction of new Rotaract members.', time:'5:00 PM', venue:'MIT Auditorium' },
      { title: 'Tree Plantation Drive', start: '2025-08-15', description:'Join us at Taljai Forest…', time:'7:00 AM', venue:'Taljai Forest' }
    ],
    headerToolbar: { left:'prev,next today', center:'title', right:'dayGridMonth,listMonth' },
    eventClick: info => {
      document.getElementById('eventTitle').textContent       = info.event.title;
      document.getElementById('eventDescription').textContent = info.event.extendedProps.description;
      document.getElementById('eventDate').textContent        = info.event.start.toDateString();
      document.getElementById('eventTime').textContent        = info.event.extendedProps.time;
      document.getElementById('eventVenue').textContent       = info.event.extendedProps.venue;
      document.getElementById('eventModal').style.display     = 'block';
    }
  });
  calendar.render();

  // Modal close
  document.querySelector('.close-btn').onclick = () => {
    document.getElementById('eventModal').style.display = 'none';
  };
  window.addEventListener('click', e => {
    if (e.target.id === 'eventModal') e.target.style.display = 'none';
  });
}

function autoScrollGallery() {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  const speed = 1;
  (function loop() {
    if (track.scrollWidth > track.clientWidth) {
      track.scrollLeft = (track.scrollLeft + speed) % track.scrollWidth;
    }
    requestAnimationFrame(loop);
  })();
}

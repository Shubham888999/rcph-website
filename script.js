console.log("Welcome to RCPH Website");

document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('rcph-calendar');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [
      {
        title: 'Induction Ceremony',
        start: '2025-08-09',
        description: 'Induction of new Rotaract members.',
        time: '5:00 PM',
        venue: 'MIT Auditorium'
      },
      {
        title: 'Tree Plantation Drive',
        start: '2025-08-15',
        description: 'Join us at Taljai Forest for a green start to Independence Day!',
        time: '7:00 AM',
        venue: 'Taljai Forest'
      }
    ],
    eventClick: function (info) {
      // Fill modal with event info
      document.getElementById('eventTitle').textContent = info.event.title;
      document.getElementById('eventDescription').textContent = info.event.extendedProps.description || 'No description provided.';
      document.getElementById('eventDate').textContent = info.event.start.toDateString();
      document.getElementById('eventTime').textContent = info.event.extendedProps.time || 'To be announced';
      document.getElementById('eventVenue').textContent = info.event.extendedProps.venue || 'TBA';

      // Show modal
      document.getElementById('eventModal').style.display = 'block';
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    }
  });

  calendar.render();

  // Modal close button
  document.querySelector('.close-btn').onclick = function () {
    document.getElementById('eventModal').style.display = 'none';
  };

  // Close modal on outside click
  window.onclick = function (e) {
    if (e.target === document.getElementById('eventModal')) {
      document.getElementById('eventModal').style.display = 'none';
    }
  };
});

function scrollGallery(direction) {
  const track = document.getElementById('carouselTrack');
  const scrollAmount = 320; // image width + gap

  if (direction === 'left') {
    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  } else {
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }
}

function autoScrollGallery() {
  const track = document.getElementById("carouselTrack");
  let scrollSpeed = 1; // pixels per frame

  function scrollStep() {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth) {
      track.scrollLeft = 0; // loop back
    } else {
      track.scrollLeft += scrollSpeed;
    }
    requestAnimationFrame(scrollStep);
  }

  scrollStep();
}

// Start scrolling on page load
window.addEventListener("DOMContentLoaded", autoScrollGallery);
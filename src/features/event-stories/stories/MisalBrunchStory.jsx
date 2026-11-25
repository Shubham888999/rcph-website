import { storyOrganisers } from "../clubOfficers";
import "../../../styles/components/event-misal.css";

const MEDIA = "/media/event-stories/misal-brunch-2026";

const moments = [
  { title: "Pune on a plate", text: "Celebrating the city's iconic culinary culture through its beloved Misal Pav, and its rich food traditions." },
  { title: "Interdistrict bonds", text: "Meaningful interactions with the delegates from RID 3191, Bangalore, over a shared meal." },
  { title: "Fellowship", text: "Warm hospitality, cultural exchange and memorable moments that made it a highlight of their visit." },
];

const conductedBy = storyOrganisers("misal-brunch-2026", ["harshal"]);

export default function MisalBrunchStory() {
  return (
    <div className="ms">
      <section className="ms-hero" aria-labelledby="ms-title">
        <p className="ms-kicker">International Service · Club Service · Samyati 4.0</p>
        <h1 id="ms-title">
          <span className="ms-title__marathi" lang="mr">मिसळ</span>
          <span className="ms-title__english">Misal Brunch</span>
        </h1>
        <p className="ms-tag">Welcome to Pune, RID 3191</p>
        <p className="ms-lede">
          The delegates from RID 3191, Bangalore, enjoyed a Misal Brunch during Samyati 4.0, celebrating Pune&apos;s
          iconic culinary culture through its beloved Misal Pav.
        </p>
      </section>

      <section className="ms-photo" aria-label="Group photo">
        <figure>
          <img
            src={`${MEDIA}/group-photo.webp`}
            srcSet={`${MEDIA}/group-photo-600.webp 600w, ${MEDIA}/group-photo.webp 1200w`}
            sizes="(max-width: 40rem) 100vw, 30rem"
            width="1200"
            height="1600"
            loading="lazy"
            decoding="async"
            alt="RCPH members and RID 3191 delegates standing together outside Pune Misal House"
          />
          <figcaption>Misal Brunch · 19 September 2026</figcaption>
        </figure>
        <ul className="ms-moments">
          {moments.map((moment) => <li key={moment.title}><h3>{moment.title}</h3><p>{moment.text}</p></li>)}
        </ul>
      </section>

      <section className="ms-credits" aria-label="Organisers">
        <p className="ms-credits__label">Conducted by</p>
        <ul>
          {conductedBy.map((person) => <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>)}
        </ul>
      </section>
    </div>
  );
}

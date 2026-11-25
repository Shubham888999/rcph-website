// Titles shown under organisers' names on every event page. Change a title here and every page updates.
export const clubOfficers = Object.freeze({
  aneesh: { name: "Rtr. Aneesh Ladkat", role: "Rotary Rotaract Relations Officer · Immediate Past President" },
  harshal: { name: "Rtr. Harshal Nikam", role: "Club Service Director" },
  shivani: { name: "Rtr. Shivani Kulkarni", role: "Co-Club Service Director" },
  soumitra: { name: "Rtr. Soumitra Lokur", role: "Co-Community Service Director" },
  tanishka: { name: "Rtr. Tanishka Patekar", role: "Diversity, Equity & Inclusion Director" },
  ira: { name: "Rtr. Ira Lad", role: "Professional Development Director" },
});

export function officers(...keys) {
  return keys.map((key) => {
    const officer = clubOfficers[key];
    if (!officer) throw new Error(`Unknown club officer: ${key}`);
    return officer;
  });
}

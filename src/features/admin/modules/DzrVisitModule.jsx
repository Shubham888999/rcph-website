import AdminModuleHeader from "../AdminModuleHeader";
import { formatInr, normalizeAttendance } from "../shared/adminModel";

const PANELS = [
  ["President", "https://drive.google.com/drive/folders/1gLXYLCWpwzdGvqXkkIB3pS-XTxnuEcGh"],
  ["Secretary", "https://drive.google.com/drive/folders/18wSpLNYEbVa-YviF6sXceUDIpQE9I3DS"],
  ["Treasurer", "https://drive.google.com/drive/folders/1ek-3FlNvHrV6UNQNOtLcPD9wfyvaPmf6"],
  ["Vice President", "https://drive.google.com/drive/folders/1pAQEmBj5-vgezW0rmmwk_cl9nDM3p5oL"],
  ["PDD", "https://drive.google.com/drive/folders/1Xjc674mVaS32_tcjk6qwIy0bmKEq3ohc"],
  ["CSD", "https://drive.google.com/drive/folders/1inWE_8jY-5IeYuUwxqWESUg13y2FaLxX"],
  ["CMD", "https://drive.google.com/drive/folders/1ipASvE2Ofo0ooB95vkfijzVdvMsxhD9W"],
  ["ISD", "https://drive.google.com/drive/folders/1AKs9OXl7KxJH7xBM-DTwSHTKu1ksGga7"],
  ["DEI", "https://drive.google.com/drive/folders/1oCrrQlQoLCqx9r1bHf77x6_2KMigvpGm"],
  ["RRRO", "https://drive.google.com/drive/folders/1reUsO_v-bstbWclzz9nhQRNU2TRWEZOi"],
  ["PRO", "https://drive.google.com/drive/folders/1RyxIxEzPFXUUSKGRSeeEC1dbyJFsPlzM"],
  ["Editor", "https://drive.google.com/drive/folders/1D2jJ-WhseW1FFKSHRWqkWinQld72TnMy"],
  ["Sports Representative", "https://drive.google.com/drive/folders/1gtf_4b1luVTT9KeQvtxgOJRWc6oPM79N"],
  ["CWD", "https://drive.google.com/drive/folders/1zcsHKoJQWPbdOs9rhlLzBqSwfVcghSHr"],
  ["WRWC", "https://drive.google.com/drive/folders/1MGpLmgPoL4l7CNusZ4al3Hg5wZE3s5dN"],
  ["SAA", "https://drive.google.com/drive/folders/11UgbLjgQnXs5DfbKOrkxqpzFRIXc9E_7"],
];

export default function DzrVisitModule({ data }) {
  const events = data.events.filter((event) => !event.archived);
  const avenueCounts = events.reduce((map, event) => { (event.avenue.length ? event.avenue : ["Other"]).forEach((avenue) => { map[avenue] = (map[avenue] || 0) + 1; }); return map; }, {});
  const income = data.treasury.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = data.treasury.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  return <>
    <AdminModuleHeader title="DRR Visit Dashboard" description="View-only club records and the complete production BOD document showcase." />
    <section className="admin-panel"><h3>Welcome, District Officials</h3><p>PHF. DRR. Dwijesh Nashikkar · DGEPS. Atharva Patil · PHF. DZR. Rtr. Shreya Khatavkar · AZR. Rtr. Akshay Tangade · Rtr. Atharva Shinkar</p></section>
    <section className="admin-metric-grid"><Metric label="Member strength" value={data.members.length} /><Metric label="Total events" value={events.length} /><Metric label="Treasury income" value={formatInr(income)} /><Metric label="Treasury expense" value={formatInr(expense)} /><Metric label="Treasury net" value={formatInr(income - expense)} />{Object.entries(avenueCounts).map(([avenue, count]) => <Metric key={avenue} label={`${avenue} events`} value={count} />)}</section>
    <section className="admin-panel"><h3>BOD panels</h3><div className="admin-card-grid">{PANELS.map(([name, url], index) => <article className="admin-record-card" key={name}><h4>{index + 1}. {name}</h4><a href={url} target="_blank" rel="noopener noreferrer">Open Drive folder</a></article>)}</div></section>
    <ReadOnlyAttendance title="Member attendance" members={data.members} events={events} attendance={data.attendance} />
    <ReadOnlyAttendance title="BOD attendance" members={data.bodMembers} events={data.bodMeetings.filter((item) => !item.archived)} attendance={data.bodAttendance} />
    <section className="admin-panel"><h3>Fines</h3><div className="admin-table-wrap"><table><caption>View-only fine records</caption><thead><tr><th>Member</th><th>Amount</th><th>Reason</th><th>Event</th><th>Date</th></tr></thead><tbody>{data.fines.map((fine) => <tr key={fine.id}><td>{fine.memberName}</td><td>{formatInr(fine.amount)}</td><td>{fine.reason}</td><td>{fine.eventName}</td><td>{fine.date}</td></tr>)}</tbody></table></div></section>
    <section className="admin-panel"><h3>Treasury</h3><div className="admin-table-wrap"><table><caption>View-only treasury ledger</caption><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Avenue</th><th>Amount</th><th>Paid by</th><th>Paid to</th></tr></thead><tbody>{data.treasury.map((item) => <tr key={item.id}><td>{item.date}</td><td>{item.title}</td><td>{item.type}</td><td>{item.avenue || "—"}</td><td>{formatInr(item.amount)}</td><td>{item.paidBy || "—"}</td><td>{item.paidTo || "—"}</td></tr>)}</tbody></table></div></section>
  </>;
}

function Metric({ label, value }) { return <article className="admin-metric"><span>{label}</span><strong>{value}</strong></article>; }
function ReadOnlyAttendance({ title, members, events, attendance }) { return <section className="admin-panel"><h3>{title}</h3><div className="admin-table-wrap"><table><caption>{title}, view only</caption><thead><tr><th>Member</th>{events.map((event) => <th key={event.id}>{event.name}</th>)}</tr></thead><tbody>{members.map((member) => <tr key={member.id}><th>{member.name}</th>{events.map((event) => { const value = normalizeAttendance(attendance[member.id]?.[event.id]); return <td key={event.id}>{value === true ? "Present" : value === false ? "Absent" : "NA"}</td>; })}</tr>)}</tbody></table></div></section>; }

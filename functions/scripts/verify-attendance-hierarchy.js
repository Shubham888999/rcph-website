'use strict';
const assert = require('node:assert/strict');
const { POSITION_HIERARCHY, createAttendanceHierarchyRanker } = require('../lib/attendance-hierarchy');
const { buildVisitDashboardAttendance } = require('../lib/visit-dashboards');
const doc = (id, data) => ({ id, data });
const members = [
 doc('gbm', {name:'Amy Member'}),
 doc('sec', {name:'Zoe Secretary', email:'sec@example.com'}),
 doc('vp', {name:'Vice President', position:'VP'}),
 doc('pres', {name:'Zed President', positionKeys:['president']}),
 doc('joint', {name:'Joint Director',position:'Co-CSD / PDD'}),
 doc('prospect', {name:'Aaron Prospect',role:'prospect',position:'President'}),
];
const users = [doc('pres',{positionKeys:['president'],email:'private@example.com'})];
const bodMembers = [doc('different-document',{name:'Zoe Secretary',email:'SEC@EXAMPLE.COM',position:'Secretary'}),...members.filter(m=>m.id!=='sec')];
const events=[doc('e',{name:'Event',date:'2026-10-01'})];
const attendance=members.map((m,i)=>doc(m.id,{e:i%2===0}));
const input={members,users,events,attendance,bodMembers,bodMeetings:events,bodAttendance:attendance,districtEvents:events,districtAttendance:attendance};
const original=JSON.stringify(input);
const views=buildVisitDashboardAttendance(input);
for(const key of ['club','bod','district']){
 assert.deepEqual(views[key].rows.map(r=>r.name),['Zed President','Zoe Secretary','Vice President','Joint Director','Amy Member','Aaron Prospect']);
 assert.equal(views[key].rows.at(-1).isProspect,true);
 assert.equal(views[key].rows.find(r=>r.name==='Zed President').cells.e,'absent');
 assert.ok(!JSON.stringify(views[key]).includes('@'));
 assert.ok(views[key].rows.every(r=>!('rank' in r)&&!('positionKeys' in r)&&!('email' in r)));
}
assert.equal(JSON.stringify(input),original);
const rank=createAttendanceHierarchyRanker({bodMembers:[doc('same',{position:'President',active:false})]});
assert.equal(rank(doc('same',{name:'Member'})).rank,1000);
assert.equal(rank(doc('x',{position:'SAA | PRO'})).rank,POSITION_HIERARCHY.indexOf('pro'));
console.log('All three visit attendance tabs preserve committee hierarchy, prospect flags, attendance cells and safe payloads.');

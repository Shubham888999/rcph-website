'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildVisitDashboardAttendance } = require('../lib/visit-dashboards');
const doc = (id, data) => ({id, data});
const events = ['p','a','n','x','missing'].map(id => doc(id, {name:id,date:'2026-10-01',type:'clubEvent'}));
const members = [doc('person',{name:'Test Member',active:true})];
const attendance = [doc('person',{p:true,a:false,n:'NA',x:'NULL'})];
const result = buildVisitDashboardAttendance({ members,events,attendance,bodMembers:members,bodMeetings:events,bodAttendance:attendance,districtEvents:events,districtAttendance:attendance });
for (const key of ['club','bod','district']) {
  const row = result[key].rows[0];
  assert.equal(row.cells.x,'null');
  assert.equal(row.cells.n,'na');
  assert.equal(row.cells.missing,'unknown');
  assert.equal(row.eligibleCount,2);
  assert.equal(row.attendanceRate,50);
}
// Exercise the production member-dashboard adapters without loading Firebase.
const source = fs.readFileSync(require.resolve('../index.js'),'utf8');
const label = source.slice(source.indexOf('function attendanceLabel('),source.indexOf('\nfunction attendanceMonth('));
const event = source.slice(source.indexOf('function safeEventForDashboard('),source.indexOf('\nexports.createUserProfileAfterSignup'));
const context = {normalizeAvenuesForStats: value => value || []};
vm.createContext(context);
vm.runInContext(label+'\n'+event,context);
assert.equal(context.safeEventForDashboard({id:'e'},'NULL').value,'NULL');
assert.equal(context.safeEventForDashboard({id:'e'},'NULL').label,'NULL');
assert.equal(context.safeEventForDashboard({id:'e'},'NA').label,'NA');
const summarySource = source.slice(source.indexOf('function summarizeAttendanceForEvents('),source.indexOf('function safeEventForDashboard('));
Object.assign(context,{attendanceMonth:()=> '2026-10',percentage:(p,n)=>n?Math.round(p/n*100):0});
vm.runInContext(summarySource,context);
const summary = context.summarizeAttendanceForEvents({p:true,a:false,n:'NA',x:'NULL'},['p','a','n','x'].map(id=>({id})));
assert.equal(summary.totalCounted,2);
assert.equal(summary.percentage,50);
assert.equal(summary.na,2);
console.log('Null attendance stays distinct in all visit tabs and member-dashboard records; only Present/Absent count.');

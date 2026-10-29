import test from 'node:test';
import assert from 'node:assert/strict';
import {filterVisitAttendance,normalizeVisitDashboardData} from './visitDashboardModel.js';
test('prospects are opt-in in all visit tabs and every displayed percentage is recalculated',()=>{
 const view={columns:[{eventId:'e',title:'Event',attendedCount:2,eligibleCount:3,attendanceRate:67}],rows:[
 {personId:'pres',name:'President',cells:{e:'present'}},
 {personId:'member',name:'Member',cells:{e:'absent'}},
 {personId:'prospect',name:'Prospect',isProspect:true,cells:{e:'present'}},
 ],summary:{totalPeople:3,averageAttendanceRate:67}};
 const attendance=normalizeVisitDashboardData({attendance:{club:view,bod:view,district:view}}).attendance;
 const snapshot=JSON.stringify(attendance);
 const filtered=filterVisitAttendance(attendance);
 for(const key of ['club','bod','district']){
 assert.deepEqual(filtered[key].rows.map(r=>r.personId),['pres','member']);
 assert.equal(filtered[key].summary.totalPeople,2);
 assert.equal(filtered[key].summary.averageAttendanceRate,50);
 assert.equal(filtered[key].columns[0].attendanceRate,50);
 assert.equal(filtered[key].columns[0].eligibleCount,2);
 assert.equal(filterVisitAttendance(attendance,true)[key].rows.length,3);
 }
 assert.equal(JSON.stringify(attendance),snapshot);
});
test('legacy Prospect role text is recognized and empty filtered views stay valid',()=>{
 const view={columns:[{eventId:'e',title:'Event'}],rows:[{personId:'p',name:'Prospect',roleOrPosition:'Prospect',cells:{e:'present'}}]};
 const attendance=normalizeVisitDashboardData({attendance:{club:view}}).attendance;
 const filtered=filterVisitAttendance(attendance);
 assert.equal(filtered.club.rows.length,0);
 assert.equal(filtered.club.summary.totalPeople,0);
 assert.equal(filtered.club.columns[0].attendanceRate,null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createAdminCache } from "./adminCache.js";
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
test("same UID and module share request",async()=>{let calls=0;const c=createAdminCache(async()=>++calls);assert.equal(await c.get({uid:"u",module:"m"}),1);assert.equal(await c.get({uid:"u",module:"m"}),1)});
test("modules and UIDs never share cache",async()=>{let calls=0;const c=createAdminCache(async()=>++calls);await c.get({uid:"u1",module:"a"});await c.get({uid:"u1",module:"b"});await c.get({uid:"u2",module:"a"});assert.equal(calls,3)});
test("refresh replaces request and old failure cannot clear new",async()=>{const old=deferred(),fresh=deferred();let calls=0;const c=createAdminCache(()=>++calls===1?old.promise:fresh.promise);const a=c.get({uid:"u",module:"m"});const b=c.get({uid:"u",module:"m",refresh:true});old.reject(new Error("old"));await assert.rejects(a);fresh.resolve("fresh");assert.equal(await b,"fresh");assert.equal(await c.get({uid:"u",module:"m"}),"fresh")});
test("current failure clears and clear invalidates selected UID",async()=>{let calls=0;const c=createAdminCache(async()=>{calls++;if(calls===1)throw new Error("x");return calls});await assert.rejects(c.get({uid:"u",module:"m"}));assert.equal(await c.get({uid:"u",module:"m"}),2);c.clear("u");assert.equal(await c.get({uid:"u",module:"m"}),3)});
test("missing identity rejects without request",async()=>{let calls=0;const c=createAdminCache(async()=>calls++);await assert.rejects(c.get({uid:"",module:"m"}));assert.equal(calls,0)});

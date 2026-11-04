import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Explicit target only. A fresh cookie jar isolates all synthetic data from existing visitors.
const target=process.argv[2]||process.env.SITE_URL;
if(!target)throw Error('Usage: node scripts/verify-owner-schedule.mjs https://your-site.example');
const origin=new URL(target).origin;
if(!['https:','http:'].includes(new URL(origin).protocol))throw Error('Use an HTTP(S) Site URL.');
const cookies=new Map();let initialized=false;let calls=0;let cleaning=false;
const deadline=Date.now()+120000;
async function api(path,method='GET',body,extra={}){
 if(!cleaning&&(++calls>80||Date.now()>deadline))throw Error('Smoke-test request/time bound exceeded.');
 const response=await fetch(`${origin}/api/booking/${path}`,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Cookie:[...cookies].map(([key,value])=>`${key}=${value}`).join('; '),...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'}),...extra},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});
 for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0];const index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1));}
 const data=response.status===204?null:await response.json();return{status:response.status,data};
}
const addDays=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const today=`${parts.year}-${parts.month}-${parts.day}`;const date=addDays(today,7);const secondDate=addDays(date,2);
const event={date,startTime:'12:00',durationHours:2,guestCount:30,notes:'Synthetic opening-hours verification only',location:{label:'Oslo demo testpunkt',coordinates:{longitude:10.7522,latitude:59.9139},source:'preset'}};
const base='owner/businesses/1/trucks/1';
const regular={openingHours:Array.from({length:7},(_,weekday)=>({weekday,startMinute:0,endMinute:1440})),closedDates:[],dateOverrides:[],vacationRanges:[],minimumNoticeHours:0,maximumAdvanceDays:null};
let itemId;
async function quote(details=event){const draftId=randomUUID();assert.equal((await api('drafts','POST',{draftId})).status,200);const headers={'x-draft-id':draftId};const result=await api('quotes','POST',{foodtruckId:'1',event:details,quantities:{[itemId]:3}},headers);return{...result,headers};}
async function rejected(details,reason){const result=await quote(details);assert.equal(result.status,409,`Expected rejection: ${reason}`);assert.ok(result.data.error.details.reasons.includes(reason),`Expected reason: ${reason}`);}
async function schedule(value){assert.equal((await api(`${base}/booking-settings/schedule`,'PUT',value)).status,200,'Save schedule');}
async function create(details,name){const priced=await quote(details);assert.equal(priced.status,201,'Create quote');const result=await api('requests','POST',{quoteId:priced.data.data.quoteId,contact:{name,email:'schedule-smoke@example.invalid',phone:'00000000',customerType:'private'}},{...priced.headers,'idempotency-key':randomUUID()});assert.equal(result.status,201,'Create request');return result.data.data;}
try{
 assert.equal((await api('demo/session','POST')).status,200);initialized=true;
 assert.equal((await api(`${base}/overview`)).status,401,'Owner view is protected before demo login');
 assert.equal((await api('owner/login','POST')).status,200);
 const catalogue=await api('catalogue');itemId=catalogue.data.trucks.find(x=>x.id==='1').menu[0].id;
 const otherBefore=(await api('owner/businesses/1/trucks/2/booking-settings')).data.data;
 const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
 await schedule({...regular,openingHours:[{weekday,startMinute:1320,endMinute:1560}]});
 const overnight={...event,startTime:'22:30'};assert.equal((await quote(overnight)).status,201,'Overnight service is allowed');
 await schedule({...regular,closedDates:[date]});await rejected(event,'CLOSED_DATE');
 await schedule({...regular,dateOverrides:[{date,closed:false,intervals:[{startMinute:600,endMinute:720}],label:'Testunntak'}]});await rejected(event,'OUTSIDE_OPENING_HOURS');
 assert.equal((await quote({...event,startTime:'10:30',durationHours:1})).status,201,'Custom exception hours permit service');
 await schedule({...regular,vacationRanges:[{from:date,to:secondDate,label:'Testferie'}]});await rejected({...event,date:secondDate},'VACATION');
 await schedule({...regular,minimumNoticeHours:8760});await rejected(event,'MINIMUM_NOTICE');
 await schedule({...regular,maximumAdvanceDays:1});await rejected(event,'MAXIMUM_ADVANCE');
 await schedule({...regular,closedDates:[addDays(date,90)]});
 assert.equal((await api(`${base}/booking-settings`,'PATCH',{fixedFeeMinor:250000,cuisine:'Testkjøkken'})).status,200);
 let saved=(await api(`${base}/booking-settings`)).data.data;assert.deepEqual(saved.closedDates,[addDays(date,90)]);assert.equal(saved.fixedFeeMinor,250000);
 await schedule(regular);saved=(await api(`${base}/booking-settings`)).data.data;assert.equal(saved.fixedFeeMinor,250000);assert.equal(saved.cuisine,'Testkjøkken');
 assert.deepEqual((await api('owner/businesses/1/trucks/2/booking-settings')).data.data,otherBefore,'Other truck settings are unchanged');
 const accepted=await create(event,'Schedule Smoke Alfa');const pending=await create({...event,date:secondDate},'Schedule Smoke Beta');
 assert.equal((await api(`${base}/bookings/${accepted.id}/accept`,'POST')).status,200);
 const changed={...regular,closedDates:[date,secondDate]};
 const preview=await api(`${base}/schedule-preview`,'POST',{month:date.slice(0,7),schedule:changed});assert.equal(preview.status,200);assert.ok(preview.data.data.conflicts.some(x=>x.bookingId===accepted.id));
 await schedule(changed);assert.equal((await api(`${base}/bookings/${accepted.id}`)).data.data.status,'ACCEPTED','Schedule changes preserve accepted reservations');
 const refused=await api(`${base}/bookings/${pending.id}/accept`,'POST');assert.equal(refused.status,409);assert.ok(refused.data.error.details.reasons.includes('CLOSED_DATE'));
 const overview=(await api(`${base}/overview`)).data.data;assert.deepEqual(overview.counts,{PENDING:1,ACCEPTED:1,DECLINED:0,CANCELLED:0});assert.equal(overview.totalQuotedMinor,accepted.quote.totalMinor+pending.quote.totalMinor);assert.equal(overview.acceptedQuotedMinor,accepted.quote.totalMinor);
 const inbox=(await api(`${base}/bookings?q=Smoke%20Beta&page=1&limit=1`)).data;assert.equal(inbox.pagination.total,1);assert.equal(inbox.data[0].id,pending.id);
 console.log('PASS: hosted isolated schedule persistence, overnight hours, closures, exceptions, vacation, notice/horizon, acceptance recheck, preview, overview/search and independent saves.');
}finally{
 cleaning=true;
 if(initialized){const reset=await api('demo/reset','POST');assert.equal(reset.status,200,'Reset only the synthetic test sandbox');assert.equal((await api('demo/requests')).data.data.length,0);console.log('Synthetic sandbox reset; existing visitor data was never accessed.');}
}

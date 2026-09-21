import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessUser } from '../lib/access-auth.mjs';
const pair = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify']);
const jwk = {...await crypto.subtle.exportKey('jwk', pair.publicKey), kid:'test'};
const env = {ACCESS_TEAM_DOMAIN:'https://test.cloudflareaccess.com',ACCESS_AUD:'app',ADMIN_EMAIL:'owner@example.com',ADMIN_OWNER_ID:'existing-owner'};
const payload = {iss:env.ACCESS_TEAM_DOMAIN,aud:['app'],exp:Date.now()/1000+3600,iat:Date.now()/1000,sub:'subject',email:'owner@example.com'};
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(claims=payload) {
 const body = `${b64({alg:'RS256',kid:'test'})}.${b64(claims)}`;
 return `${body}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(body))).toString('base64url')}`;
}
const fetchKeys = async()=>Response.json({keys:[jwk]});
const verify = async(t, settings=env)=>verifyAccessUser(new Headers({'cf-access-jwt-assertion':t}),settings,fetchKeys);
test('verified administrator keeps migrated owner id', async()=> assert.equal((await verify(await token())).userId,'existing-owner'));
test('cookie works on API paths', async()=> assert.ok(await verifyAccessUser(new Headers({cookie:`CF_Authorization=${await token()}`}), env,fetchKeys)));
test('forged identity headers rejected',async()=>assert.equal(await verifyAccessUser(new Headers({'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'}),env,fetchKeys),null));
test('missing settings fail closed',async()=>assert.equal(await verify(await token(),{...env,ADMIN_EMAIL:''}),null));
for (const [name, changes] of Object.entries({expired:{exp:0},wrongAudience:{aud:['other']},wrongIssuer:{iss:'https://evil.example'},otherUser:{email:'other@example.com'},future:{nbf:Date.now()/1000+999},noExpiry:{exp:undefined}})) {
 test(name,async()=>assert.equal(await verify(await token({...payload,...changes})),null));
}
test('tampering fails signature',async()=>{const parts=(await token()).split('.');parts[1]=b64({...payload,sub:'tampered'});assert.equal(await verify(parts.join('.')),null);});

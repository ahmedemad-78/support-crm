import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/supabase/environment.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} }; new Function('module', 'exports', compiled)(loaded, loaded.exports);
const { assertPreviewBackend, PREVIEW_PROJECT_REF, PRODUCTION_PROJECT_REF, previewDeliveryBlocked } = loaded.exports;
const url = `https://${PREVIEW_PROJECT_REF}.supabase.co`;
const jwt = (ref, role = 'anon') => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ref, role})).toString('base64url')}.signature`;

test('accepts only the isolated preview backend and correct key audience', () => {
  assert.doesNotThrow(() => assertPreviewBackend(url, 'sb_publishable_fixture'));
  assert.doesNotThrow(() => assertPreviewBackend(url, jwt(PREVIEW_PROJECT_REF)));
  assert.doesNotThrow(() => assertPreviewBackend(url, 'sb_secret_fixture', 'secret'));
  assert.doesNotThrow(() => assertPreviewBackend(url, jwt(PREVIEW_PROJECT_REF, 'service_role'), 'secret'));
  for (const bad of [undefined, `https://${PRODUCTION_PROJECT_REF}.supabase.co`, url + '.evil.test', url + '/rest/v1', url + '?test=1', url.replace('https:', 'http:'), 'https://user:pass@' + PREVIEW_PROJECT_REF + '.supabase.co']) {
    assert.throws(() => assertPreviewBackend(bad, 'sb_publishable_fixture'));
  }
  for (const bad of [undefined, '', 'placeholder', jwt(PRODUCTION_PROJECT_REF), jwt(PREVIEW_PROJECT_REF, 'service_role'), 'sb_secret_fixture']) {
    assert.throws(() => assertPreviewBackend(url, bad));
  }
  assert.throws(() => assertPreviewBackend(url, 'sb_publishable_fixture', 'secret'));
});

test('preview disables integration and mail paths including subroutes', () => {
  for (const path of ['/api/n8n', '/api/n8n/tickets', '/api/integrations/events', '/api/email/dispatch']) assert.equal(previewDeliveryBlocked(path), true);
  for (const path of ['/tickets', '/login', '/api/email-settings', '/api/n8n-other']) assert.equal(previewDeliveryBlocked(path), false);
});

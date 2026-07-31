'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const functionsSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

function bodyOfFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is defined`);

  const paramsOpen = source.indexOf("(", start);
  assert.notEqual(
    paramsOpen,
    -1,
    `${name} parameters are defined`,
  );

  let paramsDepth = 0;
  let paramsClose = -1;

  for (
    let index = paramsOpen;
    index < source.length;
    index += 1
  ) {
    if (source[index] === "(") paramsDepth += 1;

    if (source[index] === ")") {
      paramsDepth -= 1;

      if (paramsDepth === 0) {
        paramsClose = index;
        break;
      }
    }
  }

  assert.notEqual(
    paramsClose,
    -1,
    `${name} parameters are closed`,
  );

  const open = source.indexOf("{", paramsClose);
  assert.notEqual(open, -1, `${name} body is defined`);

  let depth = 0;

  for (
    let index = open;
    index < source.length;
    index += 1
  ) {
    if (source[index] === "{") depth += 1;

    if (source[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }

  throw new Error(`${name} body not found`);
}

test('trusted access recognizes SAA and Co-SAA active assignments', () => {
  const authorityBody = bodyOfFunction(functionsSource, 'getAuthorityContext');
  const accessBody = functionsSource.slice(functionsSource.indexOf('exports.getMyAccess = onCall'), functionsSource.indexOf('exports.getProspectManagementData = onCall'));

  assert.match(functionsSource, /SERGEANT_AT_ARMS_POSITION_KEYS = Object\.freeze\(\['saa', 'co-saa'\]\)/);
  assert.match(authorityBody, /SERGEANT_AT_ARMS_POSITION_KEYS\.some\(positionKey => metadata\.positionKeys\.includes\(positionKey\)\)/);
  assert.match(authorityBody, /hasActiveAnyPositionAssignment/);
  assert.match(accessBody, /db\.collection\('bodPositionAssignments'\)\.doc\(`saa_\$\{uid\}`\)\.get\(\)/);
  assert.match(accessBody, /db\.collection\('bodPositionAssignments'\)\.doc\(`co-saa_\$\{uid\}`\)\.get\(\)/);
  assert.match(accessBody, /coSaaAssignmentSnap/);
});

test('SAA delegated authority is not unrestricted callable admin authority', () => {
  const unrestrictedBody = bodyOfFunction(functionsSource, 'hasUnrestrictedAdminAuthority');
  const assertBody = bodyOfFunction(functionsSource, 'assertAdminOrPresidentAuthority');
  const syncBody = bodyOfFunction(functionsSource, 'rolePositionSyncAuthority');

  assert.match(unrestrictedBody, /authority\.role === 'admin'/);
  assert.match(unrestrictedBody, /authority\.role === 'president'/);
  assert.match(unrestrictedBody, /hasPresidentAuthority === true/);
  assert.doesNotMatch(unrestrictedBody, /hasSergeantAtArmsPosition/);
  assert.match(assertBody, /hasUnrestrictedAdminAuthority\(authority\)/);
  assert.match(syncBody, /actorHasAdminPanelAuthority: hasUnrestrictedAdminAuthority\(authority\)/);
});

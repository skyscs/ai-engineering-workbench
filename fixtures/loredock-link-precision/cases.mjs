// Frozen normalized subject examples; no repository oracle enters product retrieval.
const sample = (id, kind, terms, from, to, accept, reason) => ({ id, kind, terms, from, to, accept, reason });
export const precisionCases = [
  sample('p01', 'http-target', ['cedar'], { path: '/dispatch/cedar' }, { path: '/dispatch/cedar' }, true, 'A literal route subject matches.'),
  sample('p02', 'http-target', ['cedar'], { path: '/dispatch/oak', description: 'Cedar shares this file' }, { path: '/dispatch/oak' }, false, 'Unrelated prose cannot anchor another route.'),
  sample('p03', 'http-target', ['workspace'], { path: '/dispatch/oak', headerNames: '["X-Workspace-Key"]' }, { path: '/dispatch/oak' }, false, 'Header carriers alone are not the route subject.'),
  sample('p04', 'contract-match', ['ember'], { name: 'EmberRaised', fields: '{"eventKey":"string"}' }, { name: 'EmberRaised', fields: '{"eventKey":"string"}' }, true, 'A contract name is a subject.'),
  sample('p05', 'contract-match', ['workspace'], { name: 'EmberRaised', fields: '{"workspaceKey":"string"}' }, { name: 'EmberRaised', fields: '{"workspaceKey":"string"}' }, true, 'A field name is a subject.'),
  sample('p06', 'contract-match', ['string'], { name: 'EmberRaised', fields: '{"workspaceKey":"string"}' }, { name: 'EmberRaised', fields: '{"workspaceKey":"string"}' }, false, 'A generic field type is not a subject.'),
  sample('p07', 'contract-difference', ['workspace'], { name: 'EmberRaised', fields: '{"workspaceKey":"string"}' }, { name: 'EmberRaised', fields: '{"accountKey":"string"}' }, true, 'A removed field can identify a comparison without proving a runtime conflict.'),
  sample('p08', 'setting-match', ['cedar'], { value: 'cedar' }, { value: 'cedar' }, false, 'Equal configuration does not establish a component relationship.'),
  sample('p09', 'setting-difference', ['workspace'], { value: 'workspace' }, { value: 'account' }, false, 'Different configuration does not establish a component relationship.'),
  sample('p10', 'event-delivery', ['ember'], { payloadType: 'EmberRaised' }, { handlerClass: 'Inbox' }, true, 'A publisher payload type identifies an event subject.'),
  sample('p11', 'event-delivery', ['ember'], { payloadType: 'QuartzSettled', topicExpression: '"ember.raised"' }, { handlerClass: 'Inbox' }, false, 'A topic expression alone is excluded by this deliberately narrow proposal.'),
  sample('p12', 'http-target', [], { path: '/dispatch/cedar' }, { path: '/dispatch/cedar' }, false, 'No distinctive terms means no subject affinity.'),
  sample('p13', 'calls', ['cedar'], { path: '/dispatch/cedar' }, { path: '/dispatch/cedar' }, false, 'Unsupported edge kinds are not admitted.'),
  sample('p14', 'http-target', ['cedar'], { path: '/dispatch/oak', sourceName: 'cedar' }, { path: '/dispatch/oak' }, false, 'Display names are not subject evidence.'),
  sample('p15', 'http-target', ['cedar'], { path: '/dispatch/CEDAR-v2' }, { path: '/dispatch/CEDAR-v2' }, true, 'Production normalization retains whole-token case-insensitive matches.'),
  sample('p16', 'http-target', ['cedar'], { path: '/dispatch/cedarwood' }, { path: '/dispatch/cedarwood' }, false, 'Substring overlap is insufficient.'),
];

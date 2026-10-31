// Frozen syntax profiles; these strings are parsed, never executed.
const module = body => `define(['dojo/request'], function(request) { return ${body}; });`;
const entry = (id, source, names, paths) => ({ id, source, names, paths });
export const dojoExportCases = [
  entry('d01', module("function original() { return request.post('/cedar'); }"), ['original'], ['/cedar']),
  entry('d02', module("{ reserve: function(data) { return request.post('/cedar', {data:data}); }, cancel: function(id) { return request.delete('/cedar'); } }"), ['reserve','cancel'], ['/cedar','/cedar']),
  entry('d03', "define(['dojo/request'], function(http) { return { 'send': function() { return http.put('/ember', {headers:{'X-Workspace-Key':'synthetic'}}); } }; });", ['send'], ['/ember']),
  entry('d04', module("{ reserve: function() { function hidden() { request.post('/hidden'); } return request.get('/visible'); } }"), ['reserve'], ['/visible']),
  entry('d05', module("{ ...other, reserve: function() { return request.post('/cedar'); } }"), [], []),
  entry('d06', module("{ reserve: function() { return request.post('/cedar'); }, 'reserve': function() { return request.get('/oak'); } }"), [], []),
  entry('d07', module("{ get reserve() { return function() { request.post('/cedar'); }; } }"), [], []),
  entry('d08', module("{ ['reserve']: function() { return request.post('/cedar'); } }"), [], []),
  entry('d09', module("{ __proto__: function() { return request.post('/cedar'); } }"), [], []),
  entry('d10', module("{ reserve: function(request) { return request.post('/cedar'); } }"), [], []),
  entry('d11', module("{ reserve: function() { request = fake; return request.post('/cedar'); } }"), [], []),
  entry('d12', "define(['custom/request'], function(request) { return { reserve: function() { return request.post('/cedar'); } }; });", [], []),
  entry('d13', module("{ reserve() { return request.post('/cedar'); } }"), [], []),
  entry('d14', module("{ label: 'Cedar', reserve: function() { return request.post('/cedar'); } }"), [], []),
  entry('d15', "define(['dojo/request'], async function(request) { return { reserve: function() { return request.post('/cedar'); } }; });", [], []),
  entry('d16', "define(['dojo/request'], function*(request) { return { reserve: function() { return request.post('/cedar'); } }; });", [], []),
  entry('d17', "define(['dojo/request'], function(...request) { return { reserve: function() { return request.post('/cedar'); } }; });", [], []),
  entry('d18', "define(['dojo/request'], function(request = fake) { return { reserve: function() { return request.post('/cedar'); } }; });", [], []),
  entry('d19', module("{ reserve: async function() { return request.post('/cedar'); } }"), [], []),
  entry('d20', module("{ reserve: function*() { return request.post('/cedar'); } }"), [], []),
  entry('d21', module("{ reserve: function() { return request.post(target); } }"), ['reserve'], []),
  entry('d22', "define([], function() { return function(name) { require(['plugins/' + name], function(plugin) { plugin.open(); }); }; });", [], []),
  entry('d23', module("{ reserve: function() { eval('request = fake'); return request.post('/cedar'); } }"), [], []),
  entry('d24', module("{ reserve: function() { with (other) { request.post('/cedar'); } } }"), [], []),
];

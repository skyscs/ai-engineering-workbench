if (process.argv[2] === 'hang') setInterval(() => {}, 1000);
else { console.error('Deliberate independent qualification child failure.'); process.exitCode = 7; }

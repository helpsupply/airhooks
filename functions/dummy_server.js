var http = require('http');

http.createServer((req, res) => {
	let body = [];
	req.on('data', (chunk) => {
		body.push(chunk);
	}).on('end', () => {
		body = Buffer.concat(body).toString();
		console.log(JSON.stringify(JSON.parse(body), null, 2));
	});
	res.write('OK');
	res.end();
}).listen(8888);

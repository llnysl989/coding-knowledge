const http = require("http");

const port = 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      message: "Hello Docker",
      path: req.url,
      time: new Date().toISOString()
    })
  );
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
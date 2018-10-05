const express = require('express'); // importing express library
const app = express();
const router = express.Router();
const bodyParser = require('body-parser'); // importing body-parser module
const nanpscript = require('./nanp-script.js');
const Excel = require('exceljs');
const workbook = new Excel.Workbook();
const multer = require('multer');


var http = require('http');
var server = new http.createServer(app);
var port = process.env.PORT || 3000; //assigning port

const WebSocket = require('ws');
const wss = new WebSocket.Server({
	server:server
});

app.use(bodyParser.urlencoded({
	extended: true,limit: '50mb'
}));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/'));
app.use(express.static(__dirname + '/uploads'));

app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

//serving html files
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
})

var input_filename;
var numbersArray;

//function to update the xl file with regions
var readXlsxFile = function (file, callback) {
	numbersArray = [];
	workbook.xlsx.readFile(file)
		.then(function () {
			let workbook_Sheet1 = workbook.getWorksheet("Sheet1");
			workbook_Sheet1.getColumn(1).eachCell(function (cell, rowNumber) {
				if (rowNumber !== 1) {
					numbersArray.push(workbook_Sheet1.getRow(rowNumber).getCell(1).value);
					if (numbersArray.length == workbook_Sheet1.actualRowCount) {
						nanpscript.readFile().then(function () {
							var regions = nanpscript.compareNumber(numbersArray);
							regions[0] = 'Region';
							workbook_Sheet1.getColumn(2).header = regions;
							workbook_Sheet1.getColumn(2).key = 'Region'
							workbook_Sheet1.getRow(rowNumber).commit();
							workbook.xlsx.writeFile(file)
								.then(function () {
									callback('File updating is done');
								});
						});
					}
				} else {
					numbersArray.push('Region');
				}
			});
		});
}

//listening for incoming messages and sending messages through web sockets
wss.on('connection', function connection(ws) {
	ws.on('message', function incoming(message) {
		console.log('on message');
		readXlsxFile(input_filename, function (response) {
			console.log('done sending');
			ws.send(input_filename);
		})
	});
});

//multer diskstorage to store the file at particular location
var storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, './uploads');
	},
	filename: function (req, file, callback) {
		callback(null, file.originalname);
	}
});

//using multer to get the file from form upload
var upload = multer({
	storage: storage
}).single('userfile');

//REST Endpoint for uploading the file
app.post('/api/file',function(req,res){
	upload(req, res, function (err) {
		if (err) {
			console.log(err);
			return res.end("Error uploading file.");
		} else {
			input_filename = req.file.destination + "/" + req.file.originalname;
			res.end("File is uploaded");
		}
	});
})


server.listen(port, function (req, res) {
	console.log('Server is listening on port ' + port);
});
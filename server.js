var http = require("http")
var express = require("express");
var ws = require("ws");

var Web3 = require("web3");
var TestRPC = require("ethereumjs-testrpc");

var fs = require("fs");
var solc = require("solc");


var app = express();
var server = http.createServer(app);
var wss = new ws.Server({server});

var clients = {};

var web3 = new Web3();
web3.setProvider(TestRPC.provider({"seed" : 42}));

var accounts;
var free = 0;
web3.eth.getAccounts((err,result) => {accounts = result;});

var contracts = [];

app.get("/", function(req,res) {
    res.send("OK");
});

app.post("/mediate", function(req,res) {
    //poisci prave ws-je
    //ws.send() // cela struktura, in posebi spremenjen
});

function incoming(ws,message) {
    data = JSON.parse(message);

    //razresi connect, new, accept, (mogoce mediate)
    switch(data.request) {
        case "connect":
            connect(ws,data);
            break;
        case "new":
            new_bet(ws,data);
            break;
        case "accept":
            accept_bet(ws,data);
            break;
    }
}
function connect(ws,req) {
    clients[req.id] = ws;

    // poisci my bets
    // poisci vse bets
    //ws.send() // vrni celo strukturo
}
function new_bet(ws,req) {
    var source = fs.readFileSync("./contracts/BetContract.sol","utf8");
    var compiledContract = solc.compile(source,0);
    let abi = compiledContract.contracts['BetContract'].interface;
    let bytecode = compiledContract.contracts['BetContract'].bytecode;
    let gasEstimate = web3.eth.estimateGas({data: bytecode});
    let MyContract = web3.eth.contract(JSON.parse(abi));

    var myContractReturned = MyContract.new(req.homeTeam,req.awayTeam,
                                            req.bettingOn,req.quota,
                                            req.mediator,
        {
            from : req.id,
            data : bytecode,
            gas : gasEstimate
        },
        function(err,myContract) {
            if(!err) {
                // NOTE: The callback will fire twice!
                // Once the contract has the transactionHash property set and once its deployed on an address.

                // e.g. check tx hash on the first call (transaction send)
                if(!myContract.address) {
                    //console.log(myContract.transactionHash) // The hash of the transaction, which deploys the contract
                // check address on the second call (contract deployed)
                } else {
                    //console.log(myContract.address) // the contract address
                    console.log(myContract);
                    contracts.push(myContract.address);
                }

                // Note that the returned "myContractReturned" === "myContract",
                // so the returned "myContractReturned" object will also get the address set.
            }
        });
    
    //TODO wss.clients.forEach() // pushaj nov bet vsem clientom
}
function accept_bet(ws,req) {
    console.log(contracts);
    // poisci ws od ownerja
    //ws.send() //pushaj accept ownerju
}

wss.on("connection", function connection(ws,req) {
    ws.on("message", message => incoming(ws,message));
});

server.listen(1337);

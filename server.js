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
web3.eth.getAccounts((err,result) => {accounts = result;console.log(accounts)});

var contracts = [];

var BetContract;
var bytecode;
var gasEstimate;

(function init() {
    var source = fs.readFileSync("./contracts/BetContract.sol","utf8");
    var compiledContract = solc.compile(source,1);
    var abi = compiledContract.contracts['BetContract'].interface;
    bytecode = compiledContract.contracts['BetContract'].bytecode;
    web3.eth.estimateGas({data: bytecode}, function(err,est) {
        gasEstimate = 1.5 * est;
    });
    BetContract = web3.eth.contract(JSON.parse(abi));
})();


app.get("/", function(req,res) {
    res.send("OK");
});

app.post("/mediate", function(req,res) {
    //poisci prave ws-je
    //ws.send() // cela struktura, in posebi spremenjen
});

function generate_response(id, mediated, result, callback) {
    var res = {};
    res.mediated = {"mediated" : mediated , "result" : result};
    console.log(id);
    web3.eth.getBalance(id,function(err,balance) {
        res.balance = balance;
        var address = contracts[0];
        var betContract = BetContract.at(address);
        console.log(betContract.proposer);
        var proposer = betContract.proposer;
        res.proposer = proposer;
        callback(res);
    });
};

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
        case "test":
            test(ws,data);
            break;
    }
};

function test(ws,req) {
    generate_response(req.id,undefined,undefined,console.log);
};

function connect(ws,req) {
    clients[req.id] = ws;

    // poisci my bets
    // poisci vse bets
    //ws.send() // vrni celo strukturo
};

function new_bet(ws,req) {
    var betContractReturned = BetContract.new(req.homeTeam,req.awayTeam,
                                              req.bettingOn,req.quota,
                                              req.mediator,
        {from : req.id, data : bytecode, gas : gasEstimate},
        function(err,betContract) {
            if(!err) {
                // NOTE: The callback will fire twice!
                // Once the contract has the transactionHash property set and once its deployed on an address.

                // e.g. check tx hash on the first call (transaction send)
                if(!betContract.address) {
                    //console.log(myContract.transactionHash) // The hash of the transaction, which deploys the contract
                // check address on the second call (contract deployed)
                } else {
                    //console.log(myContract.address) // the contract address
                    console.log(betContract);
                    contracts.push(betContract.address);
                }
                // Note that the returned "myContractReturned" === "myContract",
                // so the returned "myContractReturned" object will also get the address set.
            } else {
                console.log(err);
            }
        });
    
    //TODO wss.clients.forEach() // pushaj nov bet vsem clientom
};

function accept_bet(ws,req) {
    // poisci ws od ownerja
    //ws.send() //pushaj accept ownerju
};

wss.on("connection", function connection(ws,req) {
    ws.on("message", message => incoming(ws,message));
});

server.listen(1337);

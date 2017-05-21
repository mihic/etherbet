var http = require("http")
var express = require("express");
var WebSocket = require("ws");

var Web3 = require("web3");
var TestRPC = require("ethereumjs-testrpc");

var fs = require("fs");
var solc = require("solc");


var app = express();
var server = http.createServer(app);
var wss = new WebSocket.Server({server});

var clients = [];
var client_ws = {};

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


function generate_response(id,mediated,result,ws) {
    var res = {};
    res.mediated = {"mediated" : mediated, "result" : result},
    web3.eth.getBalance(id, function(err,balance) {
        res.balance = balance;
        generate_contracts(res,id,ws);
    });
}
function generate_contracts(res,id,ws) {
    var num = contracts.length;
    res.my_bets = [];
    res.bets = [];
    generate_contracts_rec(res,id,num-1,ws);
}
function generate_contracts_rec(res,id,num,ws) {
    if(num < 0) {
        ws.send(JSON.stringify(res));
    } else {
        var contract_res = {};
        var betContract = BetContract.at(contracts[num]);
        betContract.proposer(function(err,proposer) {
            contract_res.proposer = proposer;
            betContract.mediator(function(err,mediator) {
                contract_res.mediator = mediator;
                betContract.quota(function(err,quota) {
                    contract_res.quota = parseFloat(quota.toString()) / 1000;
                    if(id === proposer) {
                        contract_res.quota = (1 / (1-contract_res.quota)) + 1;
                    }
                    betContract.bettingOn(function(err,bettingOn) {
                        contract_res.bettingOn = bettingOn.toString();
                        betContract.homeTeam(function(err,homeTeam) {
                            contract_res.homeTeam = homeTeam;
                            betContract.awayTeam(function(err,awayTeam) {
                                contract_res.awayTeam = awayTeam;
                                betContract.betPool(function(err,available) {
                                    contract_res.available = available.toString();
                                    betContract.getBetAmmount(id,function(err,betAmount) {
                                        contract_res.betAmount = betAmount.toString();
                                        betContract.result(function(err,result) {
                                            contract_res.result = result.toString();
                                            if(id === proposer || betAmount != 0) {
                                                res.my_bets.push(contract_res);
                                            } else {
                                                res.bets.push(contract_res);
                                            }
                                            generate_contracts_rec(res,id,num-1,ws);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }
}

function incoming(ws,message) {
    console.log(message);
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
        case "mediate":
            mediate(ws,data);
            break;
        case "test":
            test(ws,data);
            break;
    }
};

function test(ws,req) {
    generate_response(req.id,undefined,undefined,ws);
};

function connect(ws,req) {
    clients.push(req.id);
    client_ws[req.id] = ws;
    generate_response(req.id,undefined,undefined,ws);
};

function new_bet(ws,req) {
    var betContractReturned = BetContract.new(req.homeTeam,req.awayTeam,
                                              req.bettingOn,(1 / (req.quota-1) + 1) * 1000,
                                              req.mediator,
        {from : req.id, data : bytecode, gas : gasEstimate, value : req.amount},
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
                    //console.log(betContract);
                    contracts.push(betContract.address);

                    // PUSH
                    for(var i=0; i<clients.length; ++i) {
                        generate_response(clients[i],undefined,undefined,client_ws[clients[i]]);
                    }
                }
                // Note that the returned "myContractReturned" === "myContract",
                // so the returned "myContractReturned" object will also get the address set.
            } else {
                console.log(err);
            }
        });
};

function accept_bet(ws,req) {
    var betContract = BetContract.at(contracts[0]);
    betContract.bet(
        {
            "from" : req.id,
            "value" : req.amount
        },
        function(err) {
            if(err) {
                console.log(err);
            }
        });

    // PUSH
    for(var i=0; i<clients.length; ++i) {
        generate_response(clients[i],undefined,undefined,client_ws[clients[i]]);
    }
};

function mediate(ws,req) {
    var address = req.address;
    var result = req.result;
    var betContract = BetContract.at(address);
    betContract.mediate(result, {from:req.id}, function(err) {
        // push push push
        for(var i=0; i<clients.length; ++i) {
            generate_response(clients[i],address,result,client_ws[clients[i]]);
        }
    });
}

wss.on("connection", function connection(ws,req) {
    ws.on("message", message => incoming(ws,message));
});

server.listen(1337);

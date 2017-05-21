pragma solidity ^0.4.6;
contract BetContract {
  // state
  address public mediator;
  address public proposer;
  uint public quota;
  uint public bettingOn;
  uint public created;
  mapping(address => uint) public otherBets;
  address[] public otherAddrs;
  bool public canceled;
  uint public betPool;
  string public homeTeam;
  string public awayTeam;
  //constructor
  function BetContract(string homeTeam_, string awayTeam_, uint bettingOn_, 
                            uint quota_, address mediator_) 
                            payable {
    mediator = mediator_;
    homeTeam = homeTeam_;
    awayTeam = awayTeam_;
    bettingOn = bettingOn_;
    quota = quota_;
    created = now;
    canceled = false;
    betPool = msg.value;
    proposer = msg.sender;
  }
  //modifiers
  modifier onlyMediator {
    if(msg.sender != mediator){
      throw;
    }
    _;
  }
  modifier onlyProposer {
    if (msg.sender != proposer){
      throw;
    }
    _;
  }
  modifier active {
    if(canceled){
      throw;
    }  
    _;
  }

  function getBetAmmount(address user) constant returns(uint a){
    a = otherBets[user];
  }


  function bet() payable active{
    address newGuy = address(msg.sender);
    uint betSize = msg.value * quota / 1000;
    if(betSize<=0 || betSize>betPool){
     throw;
    }
    betPool -= betSize;
    if (otherBets[newGuy]==0){
      otherAddrs.push(newGuy);
    }
    otherBets[newGuy] += betSize;
  }
  function cancel() onlyProposer { 
    canceled = true;
  }

  function mediate(uint result) onlyMediator {
    if (result!=bettingOn){
      //Izplacaj theOtherGuys
      for (uint i = 0; i < otherAddrs.length; i++){
        if (!otherAddrs[i].send(otherBets[otherAddrs[i]])){
          throw;
        }
      }
    }
    selfdestruct(proposer);
  }
}
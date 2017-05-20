pragma solidity ^0.4.6;
contract ContractTemplate {
  // state
  address mediator;
  address proposer;
  uint quota;
  uint bettingOn;
  uint created;
  mapping(address => uint) otherBets;
  address[] otherAddrs;
  bool canceled;
  uint private betPool;
  string homeTeam;
  string awayTeam;
  //constructor
  function ContractTemplate(string homeTeam_, string awayTeam_, uint bettingOn_, 
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


  function bet() payable active{
    address newGuy = msg.sender;
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
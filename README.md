# Liquidity Pool (Solidity Smart Contract w/ Hardhat)

- this is my personal implementation of decnetralized exchange using Liquidy Pool and Swaps inspired by Uniswap V2 (reference)[https://uniswap.org/blog/uniswap-v2].
- The main difference is that my code is only meant to swap ETH with one Token (called `SPC`), while in Uniswap, it is possible to Swap with any number of combinations. Also, uniswap has flash swaps (for trading bots) while I opted to leave this out to reduce complexity a bit.
- generally speaking I made the logic more verbose so it's easier to understand for me and for auditors so keep in mind that I preferred readability over gas savings.
- I did my best to simplify uniswap concepts by writing out the constant product formulas, geometric mean, etc in an easy to read way

## Main Commands (to see tests)

- `npm i`
- `npx hardhat compile`
- `npx hardhat test`

## Overview

- in order for a decentralized exchange to work like Uniswap, we need a set of users to add/remove funds liquidity pool. They are incentivized with fees from trades (aka `swaps`).
- when Liquidty Providers add liquidity, they get LP tokens to keep track of their contribution. When they want to cash in on fees from transactions and back their funds, they remove liquidty by burning tokens.
- Once there is any liquidty, people can execute trades using `swap` method
- The functionality is split into 2 contracts `Router.sol` and `LiquidityPool.sol` as was done in Uniswap. Router is supposed to be the one that interfaces with end users. It ensures that users don't un-necessarily lose money during trades. LiquidityPool is a low level contract that keeps track of the state of luqidity and funds

## Technical Implementation

### Router.sol (Router Contract)

for all of these functions, user needs to approve the router to send over SPC funds via ERC20 `approve` function

- `addLiquidity` - adds liquidity. eth sent is a constant param. while `spcMin`, `spcMax` are used adjust the SPC token that should be send to LP contract to limit losses. I also used `spcMin` & `spcMax` to simplifiy the logic and not have to refund eth back to user as it seemed more messy
  - i transfer spc in the router method and sent eth via the `mint` LP method
- `removeLiquidity` - uses liquidity token to remove liquidity. and has min spc and eth params to ensure users gets back at a rate that they are comfortable. if refunding eth and spc meet minimum requirements, then I transfer the lp token to LP contract and call the `burn` method
- `swap` - allows to swap one asset at a time, either SPC or ETH for one another
  - if swapping ETH for SPC, eth is required to be sent it and `_spcMinOut` needs to be defined
    - if meets requirements I transfer ETH to LP via `swap` method
  - if swapping SPC for ETH, `_spcIn` is required to be sent it and `_ethMinOut` needs to be defined
    - if meets requirements I transfer spc before executing LP `swap` method
  - i added a bunch of checks to make sure mins are met (refer to comments in code)

### Live Contract References:

Liquidty Pool Address: [0x5435f9b702a33eF6AF73803bda083dE117471e94](https://goerli.etherscan.io/address/0x5435f9b702a33eF6AF73803bda083dE117471e94)
const routerAddress = [0x772057Eb52bE4D69D589212aA4C2D59FbE275E95](https://goerli.etherscan.io/address/0x772057Eb52bE4D69D589212aA4C2D59FbE275E95)
const spcAddress = [0x48E155918808A0F26B962402B7c2566F14DdE545](https://goerli.etherscan.io/address/0x48E155918808A0F26B962402B7c2566F14DdE545)

### LiquidityPool.sol (LP Contract)

- all these are low level calls meant to be sent by router
- I added warlock to limit re-entrancy attacks and generally enforced users not to send wacky numbers and did my best to prevent from users trying to mess up the liquidity numbers by having a good amount of `require` checks in many places

- `mint`
  - on first `mint` event uses geometric mean
  - in subsequent executions, keeps the ratio of SPC to ETH while depositing them and issuing LP tokens to the `_to` address
  - updates the reserve values
- `burn`
  - checks the balance of LP tokens sent to LP contract. and sends corresponding SPC and SPC to `_to` address
  - burns the LP tokens out of circulation
  - updates the reserve values
- `swap`
  - takes 1% fee on all trades
  - uses constant product formula
  - checks with `_ethIn` if eth is sent in. if yes, assumes you're swapping ETH for SPC
  - if SPC for ETH, checks LP balance of SPC and compares to reserve
  - after calculations, reserves are updated and spc/eth is sent out to the `_to` address

### Front-end

- make sure to use Goerli test network
- in order to be able to deposit and withdraw, you need to click on the 2 `appprove spc` and `approve lp` buttons
- withdraw function was added to the ICO assignment. it is called: `withdrawFunds`. Reference: https://github.com/0xMacro/student.andriy-kulak/blob/ea655f5d911c3b1dc2910b916cc10d841f24d782/ico/contracts/SpaceCoinICO.sol#L247-L259
  - because I only had like 2.3 ETH on goerli network, I couldn't add much to the pool
- I didn't have time to implement buying of SPCs directly from ICO into the front-end (but that wasn't really part of the spec anyway)
- I added images and addresses that I am using for the contracts

#### Commands for Frontend

- `cd frontend-2`
- `npm install`
- `npm start`
- fe should be available on `http://localhost:1234/`

### Test Coverage

- I spent a lot of time covering the important test cases of business
- There are some less important `require` checks that are not tested like for money and eth transfers. I didn't have time to test those and I wasnt' sure how to fail a transfer or an eth trasaction very easily. and I didn't test all branches on sqrRoot method since I copied it from uniswap

#### Deploy Script

- `npx hardhat run --network goerli scripts/deploy.ts --show-stack-traces`

#### Updated Settings I use Personally

- this repo is configured with hardhat template with prettier, eslint, vscode config, tsconfig. These are mostly pre-defined by hardhat template and make it very easy to start working and deploy contracts

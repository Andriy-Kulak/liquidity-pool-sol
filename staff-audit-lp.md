https://github.com/0xMacro/student.Andriy-Kulak/tree/65526d1475ef9d8b994d058cd861ba96d82db4d7/lp

Audited By: Diana

# General Comments

You did an excellent job of making your code unique and not overlapping with Uniswap too much. I especially liked how you decided to make SPC the only moving variable in `addLiquidity` to avoid sending refunds.


# Design Exercise

Cool idea of staking the LP tokens to receive reward tokens!


# Issues

**[Technical Mistake-1]** Router’s add liquidity function does not account for feeOnTransfer tokens such as SPC

As of now,
You calculate optimal expectedSpcOut as per the current ratio of the pool.
You transfer SPC and ETH
Now, if tax is on for token SPC:
The amount received on the pool contract is less than what you had calculated.
The pool contract will calculate LP shares to be minted based on this addedSpcPostTax and _addedETH.
Now, as we take minimum
You get shares as per this decreased amount: addedSpcPostTax
Hence, losing the equivalent portion to the tax in terms of the amount of ETH to the pool.

This also affects maintaining the correct ratio in the pool.

Consider transferring the SPC + an extra 2% to the pool in `addLiquidity`.

**[Extra feature-1]** Reentrancy guard not necessary for `mint`

You include a nonReentrant modifier in your `mint` function. I admire your caution and curiosity about guarding against reentrancy!

However, this function does not call out to any external contracts, so reentrancy is not possible.

Consider removing it to save on gas costs

**[Q-1]** Needless setting of storage variables' initial values

Setting `isExecuting` to false on line 43 LiquidityPool.sol is not needed (and wastes gas) because boolean values have a default value of false that gets set upon declaration.

Consider not setting initial values for storage variables that would otherwise be equal to their default values.


**[Q-2]** Public function only called externally

The functions `mint` is declared public when it could be `external` as it is never called from within the contract. Consider using `external` instead to reduce contract size a little and make the intended usage clearer.

**[Q-3]** Do not commit the `.env` file to git 

If you commit `.env` to git, then it’s possible you will commit private keys or API tokens to a public repo. There are automated bots attackers have set up to automatically scan new GitHub repos for `.env` files, and you may compromise your entire protocol this way. You are allowed to make this mistake exactly once.

Consider not commiting your .env file.

**[Q-4]** `swap` bug that will not account for extra ETH in reserves

When ETH is being `swap`'d into SPC, it takes into the msg.value but not the balance on the contract. This is not great as it will allow some ETH to be locked into the contract if backdoor'd into it. However as reserves never check or sync the balance on the contract, this seems to be OK.

# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 1 |
| Vulnerability              | - |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | 1 |

Total: 2

Great job!

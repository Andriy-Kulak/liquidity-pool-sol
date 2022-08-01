//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LiquidityPool is ERC20 {
    address public addressSPC;
    uint256 public reserveSPC;
    uint256 public reserveETH;
    uint256 public constant INIT_TOKENS_TO_BURN = 10**3;
    /// @notice - eqiuvalent to 1%
    uint256 public constant LP_FEE = 1;

    event Mint(
        address to,
        uint256 lpTokenAmount,
        uint256 addedETH,
        uint256 addedSpcPostTax
    );

    event Refund(
        address to,
        uint256 refundingEth,
        uint256 refundingSPC,
        uint256 lpTokensBurnt
    );

    enum SwapType {
        ETH_TO_SPC,
        SPC_TO_ETH
    }

    event Swap(
        address to,
        uint256 amountIn,
        uint256 amountOut,
        SwapType swapType
    );

    constructor(address _addressSPC) ERC20("GoodGame", "GG") {
        addressSPC = _addressSPC;
    }

    bool private isExecuting = false;
    modifier warlock() {
        require(isExecuting == false, "RE_ENTRANCY_GUARD");
        isExecuting = true;
        _;
        isExecuting = false;
    }

    /// @notice low level call. use router!!!
    /// @dev this should do appropriate checks, add liquidity to token, eth or both and mint LP tokens
    function mint(address _to) public payable warlock returns (bool) {
        uint256 _addedETH = msg.value;

        uint256 totalLpTokens = totalSupply();

        /// @dev the router is transfering spc here and we are calculating addedSpc with balance in case there is tax on transfer
        uint256 latestSpcBalance = ERC20(addressSPC).balanceOf(address(this));
        uint256 addedSpcPostTax = latestSpcBalance - reserveSPC;
        require(_addedETH > 0 || addedSpcPostTax > 0, "MUST_ADD_TO_LP");

        uint256 lpTokenAmount;

        /// @notice geometric mean formula
        /// @dev if first liquidity event
        if (totalLpTokens == 0) {
            require(
                _addedETH > 0 && addedSpcPostTax > 0,
                "FIRST_LP_NEEDS_FUNDS"
            );
            lpTokenAmount = sqrt(
                _addedETH * addedSpcPostTax - INIT_TOKENS_TO_BURN
            );
            _mint(address(1), INIT_TOKENS_TO_BURN);
        } else {
            /// @dev subsequent lp events
            lpTokenAmount = min(
                ((_addedETH * totalLpTokens) / reserveETH),
                ((addedSpcPostTax * totalLpTokens) / reserveSPC)
            );
        }

        /// @dev update reserves to new values
        reserveETH += msg.value;
        reserveSPC += addedSpcPostTax;

        _mint(_to, lpTokenAmount);
        emit Mint(_to, lpTokenAmount, _addedETH, addedSpcPostTax);
        return true;
    }

    /// @notice low level call. use router!!!
    /// @dev this should do appropriate checks, remove liquidity, send spc/eth and burn LP tokens
    function burn(address _to) external warlock returns (bool) {
        /// @dev get balance of lp tokens sent here by the router. this is the amount we will burn.
        uint256 receivedLpTokens = balanceOf(address(this));

        /// @dev don't go further unless we have tokens to burn
        require(receivedLpTokens > 0, "MUST_BE_GREATER_THAN_0");

        uint256 totalLpTokens = totalSupply();

        /// @dev calc refund amounts
        uint256 refundingETH = (receivedLpTokens * reserveETH) / totalLpTokens;
        uint256 refundingSPC = (receivedLpTokens * reserveSPC) / totalLpTokens;

        /// @dev these should never get to zero (possible I guess if lp is super low but at that point, the amounts are super small)
        require(refundingETH > 0 && refundingSPC > 0, "LIQUIDITY_REFUND_ERROR");

        /// @dev remove lp tokens from circulation
        _burn(address(this), receivedLpTokens);

        /// @dev update reserves
        reserveETH -= refundingETH;
        reserveSPC -= refundingSPC;

        /// @dev transfer spc to `to` address
        bool success = ERC20(addressSPC).transfer(_to, refundingSPC);
        require(success, "FAILED_TRANSFER");

        /// @dev updated all the state. now can send funds to `to` address
        (bool success2, ) = payable(_to).call{value: refundingETH}("");
        require(success2, "REFUND_ETH_FAILED");
        emit Refund(_to, refundingETH, refundingSPC, receivedLpTokens);
        return true;
    }

    /// @notice low level call. use router!!!
    function swap(address _to) external payable warlock returns (uint256) {
        /// @dev below prevents swap before first `addLiquidity` event
        require(totalSupply() > 0, "NEED_LIQUIDITY");

        uint256 _ethIn = msg.value;
        uint256 x; /// @dev the value we are calculating
        uint256 y; /// @dev the eth/spc we are swapping with
        uint256 k = reserveSPC * reserveETH;
        uint256 swapResult;

        /// @dev similar to swap in router, I decided to slip the logic into if/else statement for readability's sake so it's relatively easily to understand what is happening

        ///@dev swaping ETH for SPC
        if (_ethIn > 0) {
            require(_ethIn <= reserveETH, "INSUFFICIENT_LIQUIDITY");
            y = _ethIn + reserveETH;
            /// @dev x = SPC in the k formula
            /// reference: x = k / y; => was original w/o fees. below takes into account 1% lp fee
            x = k / (y - ((_ethIn * LP_FEE) / 100));

            uint256 spcTransfer = reserveSPC - x;
            swapResult = spcTransfer;

            /// @dev update our reserve numbers
            reserveSPC = x;
            reserveETH += _ethIn;

            bool success = ERC20(addressSPC).transfer(_to, spcTransfer);
            require(success, "SPC_TRANSFER_FAILED");
            emit Swap(_to, _ethIn, spcTransfer, SwapType.SPC_TO_ETH);
        } else {
            /// @dev swaping SPC for ETH

            /// @dev spc has to be transferred at the router level in order to swap.
            /// @dev here we are getting the latest balance & getting the difference as the _spcInPostTax
            uint256 latestSpcBalance = ERC20(addressSPC).balanceOf(
                address(this)
            );

            uint256 _spcInPostTax = latestSpcBalance - reserveSPC;
            require(_spcInPostTax > 0, "NEED_ONE_ASSET_TO_SWAP");

            y = _spcInPostTax + reserveSPC;
            /// @dev x = ETH in the k formula
            /// reference: x = k / y; => was original w/o fees. below takes into account 1% lp fee
            x = k / (y - ((_spcInPostTax * LP_FEE) / 100));
            uint256 ethTransfer = reserveETH - x;

            swapResult = ethTransfer;

            /// @dev update reserve state
            reserveSPC += _spcInPostTax;
            reserveETH = x;

            /// @dev transfer eth to `to` address
            (bool success2, ) = payable(_to).call{value: ethTransfer}("");
            require(success2, "ETH_TRANSFER_FAILED");
            emit Swap(_to, _spcInPostTax, ethTransfer, SwapType.ETH_TO_SPC);
        }

        /// @dev reserves have already been updates so this the newK
        uint256 newK = reserveETH * reserveSPC;

        /// @dev new k should be greater than (b/c of lp fee) or equal to old k
        require(newK >= k, "K_FORMULA");

        return swapResult;
    }

    /// @notice min of 2 values
    function min(uint256 _a, uint256 _b) private pure returns (uint256) {
        if (_a > _b) {
            return _b;
        } else {
            return _a;
        }
    }

    /// @dev copied from: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/math/Math.sol
    function sqrt(uint256 a) private pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 result = 1;
        uint256 x = a;
        if (x >> 128 > 0) {
            x >>= 128;
            result <<= 64;
        }
        if (x >> 64 > 0) {
            x >>= 64;
            result <<= 32;
        }
        if (x >> 32 > 0) {
            x >>= 32;
            result <<= 16;
        }
        if (x >> 16 > 0) {
            x >>= 16;
            result <<= 8;
        }
        if (x >> 8 > 0) {
            x >>= 8;
            result <<= 4;
        }
        if (x >> 4 > 0) {
            x >>= 4;
            result <<= 2;
        }
        if (x >> 2 > 0) {
            result <<= 1;
        }

        // At this point `result` is an estimation with one bit of precision. We know the true value is a uint128,
        // since it is the square root of a uint256. Newton's method converges quadratically (precision doubles at
        // every iteration). We thus need at most 7 iteration to turn our partial result with one bit of precision
        // into the expected uint128 result.
        unchecked {
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            return min(result, a / result);
        }
    }
}

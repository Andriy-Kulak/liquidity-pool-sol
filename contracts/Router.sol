//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "./LiquidityPool.sol";

contract Router {
    address private lpAddress;
    address private spcAddress;
    LiquidityPool private liqPool;

    event AddLiquidity(address to, uint256 actualEth, uint256 actualSpc);
    event RemoveLiquidity(address to, uint256 lpTokens);

    constructor(address _lpAddress, address _spcAddress) {
        lpAddress = _lpAddress;
        spcAddress = _spcAddress;
        liqPool = LiquidityPool(_lpAddress);
    }

    function getLpReserves() private view returns (uint256, uint256) {
        return (liqPool.reserveETH(), liqPool.reserveSPC());
    }

    /// @notice adds liquidity.
    /// @dev LPs are incentivized to provide the balance of tokens that is most similar to the current ratio. otherwise they will loose LP tokens. this methods helps limit un-necessary losses
    /// @dev the main difference between this method and what uniswap has are the following:
    /// - eth here is a constant defined as `actualETH` so I don't have to possibly refund it in the end
    /// - spc is the moving variable bound by  `_minSPC` & `_maxSPC`. if result moves out of these bounds, I reject the call.
    /// - In my opinion it's a lot easier to reason when worrying about 1 moving variable (SPC) instead of 2 (SPC & ETH). Also, I don't have to worry about refunding eth which is cleaner
    function addLiquidity(
        address _to,
        uint256 _desiredSPC,
        uint256 _minSPC,
        uint256 _maxSPC
    ) external payable {
        uint256 actualSPC;

        /// @dev constant so we don't have to refund
        uint256 actualETH = msg.value;

        require(actualETH > 0 && _desiredSPC > 0, "MIN_VALS_REQUIRED");

        (uint256 _reserveETH, uint256 _reserveSPC) = getLpReserves();

        /// @dev for first LP event, minSPC & maxSPC don't matter because no ratio is set yet
        if (_reserveETH == 0 && _reserveSPC == 0) {
            actualSPC = _desiredSPC;
        } else {
            require(
                _reserveETH > 0 && _reserveSPC > 0,
                "MIN_LIQUIDITY_REQUIRED"
            );

            /// @dev to prevent any funny business
            require(_minSPC < _desiredSPC, "MIN_MUST_BE_SMALLER");
            require(_desiredSPC < _maxSPC, "MAX_MUST_BE_GREATER");

            /// @dev expected spc needed from lp mint method in order to maintain ratio
            uint256 expectedSpcOut = (actualETH * _reserveSPC) / _reserveETH;

            require(expectedSpcOut >= _minSPC, "EXPECTED_SPC_LESS_THAN_MIN");
            require(expectedSpcOut <= _maxSPC, "EXPECTED_SPC_MORE_THAN_MAX");

            actualSPC = expectedSpcOut;
        }

        /// @dev we are sending SPC to lp address to safely complete add liquidity
        bool success = ERC20(spcAddress).transferFrom(
            msg.sender,
            lpAddress,
            actualSPC
        );

        require(success, "SPC_TRANSFER_FAILED");

        bool success2 = liqPool.mint{value: actualETH}(_to);

        require(success2, "ROUTER_MINT_FAILED");
        emit AddLiquidity(_to, actualETH, actualSPC);
    }

    /// @notice prevents un-necessary losses when burning lp tokens
    function removeLiquidity(
        address _to,
        uint256 _minETH,
        uint256 _minSPC,
        uint256 _liquidity
    ) external {
        require(_minETH > 0 || _minSPC > 0, "MUST_HAVE_MINS");

        /// @dev getting params from lp contract
        uint256 lpTotalSupply = liqPool.totalSupply();
        (uint256 reserveETH, uint256 reserveSPC) = getLpReserves();

        /// @dev confirming if min requirements are met
        uint256 refundingETH = (_liquidity * reserveETH) / lpTotalSupply;
        uint256 refundingSPC = (_liquidity * reserveSPC) / lpTotalSupply;
        require(
            refundingETH >= _minETH && refundingSPC >= _minSPC,
            "MIN_REQUIREMENTS_NOT_MET"
        );

        /// @dev transfering liq tokens to LP contract to be burnt
        bool success = ERC20(address(liqPool)).transferFrom(
            msg.sender,
            address(liqPool),
            _liquidity
        );
        require(success, "LIQ_TRANSFER_FAILED");

        /// @dev 🔥🔥🔥 and get some eth and spc back
        bool success2 = liqPool.burn(_to);
        require(success2, "ROUTER_MINT_FAILED");
        emit RemoveLiquidity(_to, _liquidity);
    }

    /// @notice swap ETH <> SPC. provide either eth & _spcMinOut, or _spcIn & _ethMinOut
    /// @dev I am preventing swapping both ETH & SPC at the same time b/c it's makes logic more complex
    function swap(
        address _to,
        uint256 _spcIn,
        uint256 _ethMinOut,
        uint256 _spcMinOut
    ) external payable {
        uint256 _ethIn = msg.value;
        (uint256 _reserveETH, uint256 _reserveSPC) = getLpReserves();
        uint256 k = _reserveSPC * _reserveETH;

        /// @dev prevents swapping typically if LP doesn't have first `addLiquidity` event
        require(k > 0, "INSUFFICIENT_LIQUIDITY");

        /// @dev below could have probably been combined into one logic in a real production setting & to save gas but instead of if/else
        /// but I kept the 2 scenarios separate so it's easier to read and comprehend for my own sake & for auditors
        /// for instance when swapping eth for spc, we are sending eth to swap lp method.
        /// when swapping spc for eth, we need to transfer spc to lp contract before lp swap

        if (_ethIn > 0) {
            require(_spcIn == 0, "CAN_ONLY_SWAP_ONE_ASSET");
            require(_spcMinOut > 0, "SPC_MIN_OUT_REQUIRED");

            /// @dev this may look complex at first but is in fact same formula from lp swap function for calculating expected `amountOut`
            uint256 y = _ethIn + _reserveETH;
            uint256 amountOut = _reserveSPC -
                k /
                (y - ((_ethIn * liqPool.LP_FEE()) / 100));

            /// @dev prevent swap if min not met
            require(amountOut >= _spcMinOut, "OUTPUT_LESS_THAN_MIN");

            liqPool.swap{value: _ethIn}(_to);
        } else {
            require(_spcIn > 0 && _ethMinOut > 0, "ETH_OR_SPC_PARAMS_REQURED");

            /// @dev this may look complex at first but is in fact same formula from lp swap function for calculating expected `amountOut`
            uint256 y = _spcIn + _reserveSPC;
            uint256 amountOut = _reserveETH -
                k /
                (y - ((_spcIn * liqPool.LP_FEE()) / 100));

            /// @dev prevent swap if min not met
            require(amountOut >= _ethMinOut, "OUTPUT_LESS_THAN_MIN");

            /// @dev if user wants to swap SPC, we are transferring them to LP to execute the swap.
            /// main reason is that if SPC tax is on. then we want the swap function to calculate spc received post tax
            bool success = ERC20(spcAddress).transferFrom(
                msg.sender,
                lpAddress,
                _spcIn
            );

            require(success, "SPC_TRANSFER_FAILED");

            liqPool.swap{value: 0}(_to);
        }
    }
}

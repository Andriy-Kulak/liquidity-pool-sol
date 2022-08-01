//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

// mimick of SPC in testing
contract TestScToken is ERC20 {
    /// @notice our token has 18 decimals per default ERC20. initial supply is 500k tokens
    /// @dev relevant to req: 1 and 1a
    uint256 public constant MINT_LIMIT = 500 * 1000 * 10**18;

    address public admin;
    address public treasury;
    bool public isTaxable;

    constructor(address _admin, address _treasury) ERC20("Space Coin", "SCO") {
        admin = _admin;
        treasury = _treasury;
        isTaxable = false;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "SpaceCoinToken: ONLY_ADMIN");
        _;
    }

    /// @notice transfer with an ability to tax 2% to treasury
    /// @dev relevant to 3f
    function transfer(address to, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        address owner = _msgSender();

        _safeTranfer(owner, to, amount);
        return true;
    }

    /// @notice transferFrom with an ability to tax 2% to treasury
    /// @dev relevant to 3f
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _safeTranfer(from, to, amount);
        return true;
    }

    /// @dev this is the same as ERC20's _tranfer but including the tax implemantion
    function _safeTranfer(
        address from,
        address to,
        uint256 amount
    ) private returns (bool) {
        if (isTaxable == true) {
            /// @dev updated all state before transfer. relevant to req: 1b
            uint256 amountToTreasury = (amount * 2) / 100;
            uint256 amountToTransfer = amount - amountToTreasury;

            _transfer(from, treasury, amountToTreasury);
            _transfer(from, to, amountToTransfer);
        } else {
            _transfer(from, to, amount);
        }
        return true;
    }

    /// @dev this is FOR TESTING ONLY. I am allowing easy mint of tokens to random addresses
    /// @dev DO NOT DEPLOY to mainet
    function safeMint(address _to, uint256 _amount) external {
        require(
            _amount + totalSupply() <= MINT_LIMIT,
            "SpaceCoinToken: MAX_TOKEN_LIMIT"
        );

        _mint(_to, _amount);
    }

    /// @notice provides ability to add/remove 2% treasury tax for all transfers
    function toggleTaxStatus() external onlyAdmin returns (bool) {
        isTaxable = !isTaxable;
        return isTaxable;
    }
}

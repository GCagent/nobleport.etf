// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./interfaces/INoblePortEcosystem.sol";

/**
 * @title NBPT Token Contract — Module 1
 * @notice ERC-20 governance token on Arbitrum L2 with transfer hooks
 * @dev Implements voting delegation, snapshots, and pluggable transfer hooks
 */
contract NBPTToken is IGovernanceToken {
    string public constant name = "NoblePort Token";
    string public constant symbol = "NBPT";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Governance
    mapping(address => address) public delegates;
    mapping(address => uint256) private _votingPower;
    uint256 private _snapshotCounter;

    // Snapshots
    struct Snapshot {
        uint256 id;
        uint256 timestamp;
        uint256 totalSupply;
    }
    mapping(uint256 => Snapshot) public snapshots;
    mapping(uint256 => mapping(address => uint256)) public snapshotBalances;

    // Transfer hooks
    ITransferHook[] private _hooks;
    mapping(address => bool) public registeredHooks;

    // Access control
    address public owner;
    address public pendingOwner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event SnapshotCreated(uint256 indexed id, uint256 timestamp);
    event HookRegistered(address indexed hook);
    event HookRemoved(address indexed hook);

    modifier onlyOwner() {
        require(msg.sender == owner, "NBPT: not owner");
        _;
    }

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    // ─── ERC-20 Core ────────────────────────────────────────

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "NBPT: insufficient allowance");
        allowance[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "NBPT: transfer from zero");
        require(to != address(0), "NBPT: transfer to zero");
        require(balanceOf[from] >= amount, "NBPT: insufficient balance");

        // Execute pre-transfer hooks
        for (uint256 i = 0; i < _hooks.length; i++) {
            require(_hooks[i].beforeTransfer(from, to, amount), "NBPT: hook rejected");
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        // Update voting power
        _updateVotingPower(from);
        _updateVotingPower(to);

        // Execute post-transfer hooks
        for (uint256 i = 0; i < _hooks.length; i++) {
            _hooks[i].afterTransfer(from, to, amount);
        }

        emit Transfer(from, to, amount);
    }

    // ─── Governance ─────────────────────────────────────────

    function delegate(address delegatee) external override {
        address oldDelegate = delegates[msg.sender];
        delegates[msg.sender] = delegatee;
        _updateVotingPower(oldDelegate);
        _updateVotingPower(delegatee);
        emit DelegateChanged(msg.sender, oldDelegate, delegatee);
    }

    function getVotingPower(address account) external view override returns (uint256) {
        return _votingPower[account];
    }

    function snapshot() external override onlyOwner returns (uint256 snapshotId) {
        _snapshotCounter++;
        snapshotId = _snapshotCounter;
        snapshots[snapshotId] = Snapshot({
            id: snapshotId,
            timestamp: block.timestamp,
            totalSupply: totalSupply
        });
        emit SnapshotCreated(snapshotId, block.timestamp);
    }

    function _updateVotingPower(address account) internal {
        if (account == address(0)) return;
        address delegatee = delegates[account];
        if (delegatee == address(0)) {
            _votingPower[account] = balanceOf[account];
        } else {
            _votingPower[delegatee] = balanceOf[account] + balanceOf[delegatee];
        }
    }

    // ─── Hook Management ────────────────────────────────────

    function registerHook(address hook) external onlyOwner {
        require(!registeredHooks[hook], "NBPT: hook exists");
        _hooks.push(ITransferHook(hook));
        registeredHooks[hook] = true;
        emit HookRegistered(hook);
    }

    function removeHook(uint256 index) external onlyOwner {
        require(index < _hooks.length, "NBPT: invalid index");
        address hookAddr = address(_hooks[index]);
        _hooks[index] = _hooks[_hooks.length - 1];
        _hooks.pop();
        registeredHooks[hookAddr] = false;
        emit HookRemoved(hookAddr);
    }

    // ─── Minting (Governance-controlled) ────────────────────

    function mint(address to, uint256 amount) external onlyOwner {
        totalSupply += amount;
        balanceOf[to] += amount;
        _updateVotingPower(to);
        emit Transfer(address(0), to, amount);
    }

    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "NBPT: insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        _updateVotingPower(msg.sender);
        emit Transfer(msg.sender, address(0), amount);
    }
}

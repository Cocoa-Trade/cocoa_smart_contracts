// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Escrow is ReentrancyGuard, Pausable {
    // Состояния сделки
    enum State { AWAITING_REGISTRATION, AWAITING_DEPOSIT, DEPOSITED, RELEASED, REFUNDED }

    // Переменные состояния
    address public arbiter;
    address public depositor;
    address public beneficiary;
    uint256 public depositAmount;
    State public currentState;
    uint256 public depositTime;

    // Константы
    uint256 public constant TIMEOUT = 30 days;
    uint256 public constant MINIMUM_DEPOSIT = 0.01 ether;

    // События
    event DepositorRegistered(address indexed depositor);
    event BeneficiaryRegistered(address indexed beneficiary);
    event Deposited(address indexed depositor, uint256 amount, uint256 timestamp);
    event Released(address indexed beneficiary, uint256 amount, uint256 timestamp);
    event Refunded(address indexed depositor, uint256 amount, uint256 timestamp);

    // Модификаторы
    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter can perform this action");
        _;
    }

    modifier onlyDepositor() {
        require(msg.sender == depositor, "Only depositor can perform this action");
        _;
    }

    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "Only beneficiary can perform this action");
        _;
    }

    modifier inState(State state) {
        require(currentState == state, "Invalid state for this action");
        _;
    }

    // Конструктор: Арбитр разворачивает контракт
    constructor() {
        arbiter = msg.sender;
        currentState = State.AWAITING_REGISTRATION;
    }

    // Регистрация депонента (покупателя)
    function registerDepositor() external inState(State.AWAITING_REGISTRATION) {
        require(depositor == address(0), "Depositor already registered");
        require(msg.sender != arbiter, "Arbiter cannot be depositor");
        require(msg.sender != beneficiary, "Beneficiary cannot be depositor");

        depositor = msg.sender;
        emit DepositorRegistered(msg.sender);

        // Если оба зарегистрированы, переходим в следующий статус
        if (beneficiary != address(0)) {
            currentState = State.AWAITING_DEPOSIT;
        }
    }

    // Регистрация бенефициара (поставщика)
    function registerBeneficiary() external inState(State.AWAITING_REGISTRATION) {
        require(beneficiary == address(0), "Beneficiary already registered");
        require(msg.sender != arbiter, "Arbiter cannot be beneficiary");
        require(msg.sender != depositor, "Depositor cannot be beneficiary");

        beneficiary = msg.sender;
        emit BeneficiaryRegistered(msg.sender);

        // Если оба зарегистрированы, переходим в следующий статус
        if (depositor != address(0)) {
            currentState = State.AWAITING_DEPOSIT;
        }
    }

    // Внесение депозита
    function deposit() external payable onlyDepositor inState(State.AWAITING_DEPOSIT) nonReentrant whenNotPaused {
        require(msg.value >= MINIMUM_DEPOSIT, "Deposit amount must be greater than minimum");

        depositAmount = msg.value;
        depositTime = block.timestamp;
        currentState = State.DEPOSITED;

        emit Deposited(msg.sender, msg.value, block.timestamp);
    }

    // Выплата средств поставщику
    function releaseFunds() external onlyArbiter inState(State.DEPOSITED) nonReentrant whenNotPaused {
        currentState = State.RELEASED;

        (bool success, ) = payable(beneficiary).call{value: depositAmount}("");
        require(success, "Funds transfer failed");

        emit Released(beneficiary, depositAmount, block.timestamp);
    }

    // Возврат средств покупателю
    function refund() external onlyArbiter inState(State.DEPOSITED) nonReentrant whenNotPaused {
        currentState = State.REFUNDED;

        (bool success, ) = payable(depositor).call{value: depositAmount}("");
        require(success, "Refund transfer failed");

        emit Refunded(depositor, depositAmount, block.timestamp);
    }

    // Автоматический возврат по таймауту
    function refundAfterTimeout() external onlyDepositor inState(State.DEPOSITED) nonReentrant whenNotPaused {
        require(block.timestamp > depositTime + TIMEOUT, "Timeout period has not elapsed");

        currentState = State.REFUNDED;

        (bool success, ) = payable(depositor).call{value: depositAmount}("");
        require(success, "Refund transfer failed");

        emit Refunded(depositor, depositAmount, block.timestamp);
    }

    // Пауза контракта
    function pause() external onlyArbiter {
        _pause();
    }

    // Снятие паузы
    function unpause() external onlyArbiter {
        _unpause();
    }

    // Получение текущего состояния контракта
    function getContractState() external view returns (
        address _arbiter,
        address _depositor,
        address _beneficiary,
        uint256 _depositAmount,
        State _currentState,
        uint256 _depositTime,
        uint256 _timeoutTime
    ) {
        return (
            arbiter,
            depositor,
            beneficiary,
            depositAmount,
            currentState,
            depositTime,
            depositTime + TIMEOUT
        );
    }
}

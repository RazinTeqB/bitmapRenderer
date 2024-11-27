// State variables
let powerState = false;
let mode = "OFF";
let buttonPressStart = null;
let buttonPressInterval = null;
let lastMode = "STEP";
let lastDeviceValue = 0;
let buttonHeld = false;
let poweredOn = false;
let btlePending = false;
let revertPending = false;
let deviceValue = 0;
let scrollWheelRotation = 0;
let btleWheelRotation = 0;
let usbCharge = false;
let inMount = false;
let batteryVoltage = 3.7;
let batteryInterval = null;
let locked = false;
let lastClickTime = 0;
let isPoweringOff = false;
let poweringOffStep = -1;
// delay for double click to prevent actions overlap
let isDoubleClick = false;
let singleClickTimeout = null;
let singleClickUpTimeout = null;

// Constants
const LONG_PRESS_DURATION = 1000;
const SUPER_LONG_PRESS_DURATION = 5000;
const DOUBLE_CLICK_INTERVAL = 200;
const MAX_DEVICE_VALUE = 240;
const STEP_VALUES = [
    0, // 0.6 ND
    12,
    16,
    24,
    32,
    36, // 0.6 + fractions
    48, // 0.9 ND
    60,
    64,
    72,
    80,
    84, // 0.9 + fractions
    96, // 1.2 ND
    108,
    112,
    120,
    128,
    132, // 1.2 + fractions
    144, // 1.5 ND
    156,
    160,
    168,
    176,
    180, // 1.5 + fractions
    192, // 1.8 ND
    204,
    208,
    216,
    224,
    228, // 1.8 + fractions
    240, // 2.1 ND
];
const MAJOR_STEP_INCREMENT = 48;
const STEPS_PER_REVOLUTION = 16;
const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 64;
const MAX_BATTERY_VOLTAGE = 4.2;
const MIN_BATTERY_VOLTAGE = 3.0;
const BATTERY_CHANGE_RATE = 1 / 60;

// Power Off step duration.
const POWER_OFF_STEPS = 4;
const POWER_OFF_STEP_DURATION = (SUPER_LONG_PRESS_DURATION - LONG_PRESS_DURATION) / POWER_OFF_STEPS;

// Major step display values
const majorSteps = [0.6, 0.9, 1.2, 1.5, 1.8, 2.1];

// Get HTML elements
const canvas = document.getElementById("uiCanvas");
const button = document.getElementById("button");
const scrollWheel = document.getElementById("scrollWheel");
const btleWheel = document.getElementById("btleWheel");
const modeDisplay = document.getElementById("modeDisplay");
const deviceValueDisplay = document.getElementById("deviceValueDisplay");
const displayValue = document.getElementById("displayValue");
const usbChargeToggle = document.getElementById("usbChargeToggle");
const inMountToggle = document.getElementById("inMountToggle");
const batteryVoltageInput = document.getElementById("batteryVoltageInput");
const scrollWheelIndicator = document.getElementById("scrollWheelIndicator");
const btleWheelIndicator = document.getElementById("btleWheelIndicator");

function updateUI() {
    modeDisplay.textContent = mode;
    deviceValueDisplay.textContent = deviceValue;
    // console.log(mode);
    if (
        powerState &&
        (mode === "STEP" ||
            mode === "FINE" ||
            mode === "BTLE" ||
            btlePending ||
            revertPending)
    ) {
        if (mode === "STEP") {
            displayValue.textContent =
                majorSteps[Math.floor(deviceValue / MAJOR_STEP_INCREMENT)];
        } else {
            const majorIndex = Math.floor(deviceValue / MAJOR_STEP_INCREMENT);
            const minorValue = deviceValue % MAJOR_STEP_INCREMENT;
            displayValue.textContent = `${majorSteps[majorIndex]} (Minor: ${minorValue})`;
        }
    } else {
        displayValue.textContent = "---";
    }

    usbChargeToggle.textContent = `USB Charge: ${usbCharge ? "ON" : "OFF"}`;
    inMountToggle.textContent = `In Mount: ${inMount ? "ON" : "OFF"}`;

    BitmapRenderer.renderBitmap("uiCanvas", mode, deviceValue);
}

function findNearestStepValue(currentValue) {
    let nearestValue = STEP_VALUES[0];
    let minDifference = Math.abs(currentValue - STEP_VALUES[0]);

    for (let stepValue of STEP_VALUES) {
        let difference = Math.abs(currentValue - stepValue);
        if (difference < minDifference) {
            minDifference = difference;
            nearestValue = stepValue;
        }
    }
    return nearestValue;
}

function handlePowerOn() {
    if (!inMount) return;
    powerState = true;
    mode = lastMode;
    deviceValue = lastDeviceValue;
    poweredOn = true;
    BitmapRenderer.startBatteryUpdates();
    updateUI();
}

function handlePowerOff() {
    if (mode !== "BTLE") {
        lastMode = mode;
        lastDeviceValue = deviceValue;
    }
    powerState = false;
    mode = "OFF";
    poweredOn = false;
    locked = false;
    isPoweringOff = false;
    poweringOffStep = -1;
    BitmapRenderer.stopBatteryUpdates();
    updateUI();
}

function updateBatteryVoltage() {
    if (usbCharge) {
        batteryVoltage = Math.min(
            batteryVoltage + BATTERY_CHANGE_RATE,
            MAX_BATTERY_VOLTAGE
        );
    } else if (powerState) {
        batteryVoltage = Math.max(
            batteryVoltage - BATTERY_CHANGE_RATE,
            MIN_BATTERY_VOLTAGE
        );
        if (batteryVoltage <= MIN_BATTERY_VOLTAGE) {
            handlePowerOff();
        }
    }
    batteryVoltageInput.value = batteryVoltage.toFixed(2);
}

function animateWheel(indicator, rotation) {
    const rotationAngle = rotation * (360 / STEPS_PER_REVOLUTION);
    indicator.style.transform = `rotate(${rotationAngle}deg)`;
}

function handleScrollWheel(event, isBTLE = false) {
    if (!inMount || locked) return;
    event.preventDefault();

    const rotation = event.deltaY < 0 ? -1 : 1;

    if (isBTLE) {
        btleWheelRotation =
            (btleWheelRotation + rotation + STEPS_PER_REVOLUTION) %
            STEPS_PER_REVOLUTION;
        animateWheel(btleWheelIndicator, btleWheelRotation);
    } else {
        scrollWheelRotation =
            (scrollWheelRotation + rotation + STEPS_PER_REVOLUTION) %
            STEPS_PER_REVOLUTION;
        animateWheel(scrollWheelIndicator, scrollWheelRotation);
    }

    if (powerState) {
        if (mode === "BTLE" && isBTLE) {
            deviceValue = Math.max(
                0,
                Math.min(MAX_DEVICE_VALUE, deviceValue - rotation)
            );
        } else if (mode === "STEP" && !isBTLE) {
            const currentStepIndex = STEP_VALUES.indexOf(deviceValue);
            let newStepIndex = currentStepIndex - rotation;
            newStepIndex = Math.max(
                0,
                Math.min(newStepIndex, STEP_VALUES.length - 1)
            );
            deviceValue = STEP_VALUES[newStepIndex];
        } else if (mode === "FINE" && !isBTLE) {
            deviceValue = Math.max(
                0,
                Math.min(MAX_DEVICE_VALUE, deviceValue - rotation)
            );
        }
    }

    updateUI();
}

/**
 * Show powering off indicator when button press duration
 * is between long press duration and very long press duration.
 * 
 * @param {Number} step - between 0 to 3
 * @returns void
 */
function handlePowerOffIndicator(step)
{
    isPoweringOff = true;
    poweringOffStep = step;
    updateUI();
}

button.addEventListener("mousedown", () => {
    if (!inMount) return;

    const clickTime = Date.now();
    if (clickTime - lastClickTime < DOUBLE_CLICK_INTERVAL && powerState) {
        singleClickTimeout && clearTimeout(singleClickTimeout);
        singleClickUpTimeout && clearTimeout(singleClickUpTimeout);
        isDoubleClick = true;
        locked = !locked;
        updateUI();
        return;
    }
    lastClickTime = clickTime;

    buttonPressStart = Date.now();
    buttonHeld = true;
    poweredOn = false;
    btlePending = false;
    revertPending = false;
    isDoubleClick = false;
    let lastStep = -1;

    singleClickTimeout = setTimeout(() => {
        isDoubleClick = false;
        buttonPressInterval = setInterval(() => {
            const pressDuration = Date.now() - buttonPressStart;
            //setTimeout(function () {console.log("sleep done");}, 5000);
            if (
                mode === "OFF" &&
                pressDuration >= LONG_PRESS_DURATION &&
                buttonHeld
            ) {
                // console.log(mode);
                handlePowerOn();
                clearInterval(buttonPressInterval);
            } else if (
                (mode === "STEP" || mode === "FINE") &&
                buttonHeld &&
                !locked
            ) {
                if (
                    pressDuration >= LONG_PRESS_DURATION &&
                    pressDuration < SUPER_LONG_PRESS_DURATION
                ) {
                    if (!btlePending) {
                        btlePending = true;
                        BitmapRenderer.renderBitmap(
                            "uiCanvas",
                            "BTLEq",
                            deviceValue
                        );
                    } else {
                        // offset of 500 to allow BTLEq (white bar for mode switch)
                        // for smoother transition,
                        const currentStep = Math.floor((pressDuration - LONG_PRESS_DURATION - 500) / POWER_OFF_STEP_DURATION);
                        if (currentStep >= 0 && currentStep < POWER_OFF_STEPS && currentStep !== lastStep) {
                            handlePowerOffIndicator(currentStep);
                            lastStep = currentStep;
                        }
                    }
                } else if (pressDuration >= SUPER_LONG_PRESS_DURATION) {
                    btlePending = false;
                    handlePowerOff();
                    clearInterval(buttonPressInterval);
                }
            } else if (mode === "BTLE" && buttonHeld && !locked) {
                if (
                    pressDuration >= LONG_PRESS_DURATION &&
                    pressDuration < SUPER_LONG_PRESS_DURATION
                ) {
                    if (!revertPending) {
                        revertPending = true;
                        BitmapRenderer.renderBitmap(
                            "uiCanvas",
                            "BTLEq",
                            deviceValue
                        );
                    } else {
                        // offset of 500 to allow BTLEq (white bar for mode switch)
                        // for smoother transition,
                        const currentStep = Math.floor((pressDuration - LONG_PRESS_DURATION - 500) / POWER_OFF_STEP_DURATION);
                        if (currentStep >= 0 && currentStep < POWER_OFF_STEPS && currentStep !== lastStep) {
                            handlePowerOffIndicator(currentStep);
                            lastStep = currentStep;
                        }
                    }
                } else if (pressDuration >= SUPER_LONG_PRESS_DURATION) {
                    revertPending = false;
                    handlePowerOff();
                    clearInterval(buttonPressInterval);
                }
            }
        }, 50);
    }, DOUBLE_CLICK_INTERVAL);
});

button.addEventListener("mouseup", () => {
    if (!inMount) return;

    if (isDoubleClick) {
        singleClickTimeout && clearTimeout(singleClickTimeout);
        singleClickUpTimeout && clearTimeout(singleClickUpTimeout);
        return;
    }

    isDoubleClick = false;
    singleClickUpTimeout = setTimeout(() => {
        const pressDuration = Date.now() - buttonPressStart;
        clearInterval(buttonPressInterval);
        buttonHeld = false;

        isPoweringOff = false;
        poweringOffStep = -1;

        if (poweredOn) {
            poweredOn = false;
            return;
        }

        if (!locked) {
            if ((mode === "STEP" || mode === "FINE") && btlePending) {
                if (
                    pressDuration >= LONG_PRESS_DURATION &&
                    pressDuration < SUPER_LONG_PRESS_DURATION
                ) {
                    mode = "BTLE";
                    updateUI();
                }
            } else if (mode === "BTLE" && revertPending) {
                if (
                    pressDuration >= LONG_PRESS_DURATION &&
                    pressDuration < SUPER_LONG_PRESS_DURATION
                ) {
                    mode = lastMode;
                    if (mode === "STEP") {
                        deviceValue = findNearestStepValue(deviceValue);
                    }
                    updateUI();
                }
            } else if (pressDuration < LONG_PRESS_DURATION) {
                if (mode === "STEP" || mode === "FINE") {
                    if (mode === "FINE") {
                        // When switching from FINE to STEP
                        deviceValue = findNearestStepValue(deviceValue);
                    }
                    mode = mode === "STEP" ? "FINE" : "STEP";
                    lastMode = mode;
                    updateUI();
                }
            }
        }

        buttonPressStart = null;
        btlePending = false;
        revertPending = false;
    }, DOUBLE_CLICK_INTERVAL)
});

scrollWheel.addEventListener("wheel", (event) => handleScrollWheel(event));
btleWheel.addEventListener("wheel", (event) => handleScrollWheel(event, true));

usbChargeToggle.addEventListener("click", () => {
    usbCharge = !usbCharge;
    updateUI();
});

inMountToggle.addEventListener("click", () => {
    inMount = !inMount;
    if (!inMount && powerState) {
        handlePowerOff();
    }
    updateUI();
});

batteryVoltageInput.addEventListener("input", (event) => {
    batteryVoltage = parseFloat(event.target.value) || 0.0;
    updateUI();
});

batteryInterval = setInterval(updateBatteryVoltage, 1000);
BitmapRenderer.startBatteryUpdates();
updateUI();

```js
for (let i = 1; i <= POWER_OFF_STEPS; i++) {
    const stepTime = LONG_PRESS_DURATION + i * POWER_OFF_STEP_DURATION;
    if (pressDuration >= stepTime && pressDuration < stepTime + POWER_OFF_STEPS) {
        console.log("%cpressDuration", "color:#00ff00;font-size:30px;font-weight:bold;");
        console.log({ pressDuration, stepTime });
        // showIndicator(i - 1);
    }
}
```

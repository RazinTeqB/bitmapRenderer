const BitmapRenderer = {
    imageCache: {},
    batteryUpdateInterval: null,

    loadImage: function (src) {
        if (!this.imageCache[src]) {
            this.imageCache[src] = new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = src;
            });
        }
        return this.imageCache[src];
    },

    startBatteryUpdates: function () {
        if (!this.batteryUpdateInterval) {
            this.batteryUpdateInterval = setInterval(() => {
                this.renderBitmap("uiCanvas", mode, deviceValue);
            }, 2000);
        }
    },

    stopBatteryUpdates: function () {
        if (this.batteryUpdateInterval) {
            clearInterval(this.batteryUpdateInterval);
            this.batteryUpdateInterval = null;
        }
    },

    calculateSoC: function (voltage) {
        if (voltage <= MIN_BATTERY_VOLTAGE) return 0;
        if (voltage >= MAX_BATTERY_VOLTAGE) return 100;
        return (
            ((voltage - MIN_BATTERY_VOLTAGE) /
                (MAX_BATTERY_VOLTAGE - MIN_BATTERY_VOLTAGE)) *
            100
        );
    },

    getBatteryImage: function (voltage) {
        const soc = this.calculateSoC(voltage);
        const level = Math.max(1, Math.min(10, Math.ceil(soc / 10)));
        return `bitmaps/battery/bat${level.toString().padStart(2, "0")}.bmp`;
    },

    getNDImage: function (deviceValue, isStepMode) {
        if (isStepMode) {
            // For step mode, map the STEP_VALUES index to a two-digit number
            const stepIndex = STEP_VALUES.indexOf(deviceValue);
            return `bitmaps/ndstep/ndstep${stepIndex
                .toString()
                .padStart(2, "0")}.bmp`;
        } else {
            // For fine mode, use the device value directly, padded to 3 digits
            return `bitmaps/ndfine/ndfine${deviceValue
                .toString()
                .padStart(3, "0")}.bmp`;
        }
    },

    getScaleImage: function (deviceValue, isStepMode) {
        if (isStepMode) {
            // The repeating pattern for scale markers
            const SCALE_VALUES = [0, 12, 16, 24, 32, 36];
            const baseValue = deviceValue % 48; // Get position within each major step

            // Find the closest scale value that's not larger than our baseValue
            let scaleValue = 0;
            for (let value of SCALE_VALUES) {
                if (value <= baseValue) {
                    scaleValue = value;
                } else {
                    break;
                }
            }

            return `bitmaps/scale/scale${scaleValue
                .toString()
                .padStart(2, "0")}.bmp`;
        } else {
            // For subscale, wrap around every 48 values
            const subscaleValue = deviceValue % 48;
            return `bitmaps/subscale/subscale${subscaleValue
                .toString()
                .padStart(2, "0")}.bmp`;
        }
    },

    renderBitmap: async function (canvasId, mode, deviceValue) {
        const canvas = document.getElementById(canvasId);
        const duplicateCanvas = document.getElementById("uiCanvasDuplicate");
        const context = canvas.getContext("2d");
        const duplicateContext = duplicateCanvas.getContext("2d");
        context.imageSmoothingEnabled = false;
        duplicateContext.imageSmoothingEnabled = false;

        // Create an off-screen canvas
        const offScreenCanvas = document.createElement("canvas");
        offScreenCanvas.width = canvas.width;
        offScreenCanvas.height = canvas.height;
        const offScreenContext = offScreenCanvas.getContext("2d");
        offScreenContext.imageSmoothingEnabled = false;

        const SCALE = 10;
        offScreenContext.clearRect(
            0,
            0,
            offScreenCanvas.width,
            offScreenCanvas.height
        );

        if (powerState) {
            const batteryImg = await this.loadImage(
                this.getBatteryImage(batteryVoltage)
            );
            offScreenContext.drawImage(
                batteryImg,
                0,
                0,
                batteryImg.width * SCALE,
                batteryImg.height * SCALE
            );

            const isStepMode = mode === "STEP";
            const [ndImg, scaleImg] = await Promise.all([
                this.loadImage(this.getNDImage(deviceValue, isStepMode)),
                this.loadImage(this.getScaleImage(deviceValue, isStepMode)),
            ]);

            offScreenContext.drawImage(
                ndImg,
                0,
                7 * SCALE,
                ndImg.width * SCALE,
                ndImg.height * SCALE
            );
            offScreenContext.drawImage(
                scaleImg,
                25 * SCALE,
                0,
                scaleImg.width * SCALE,
                scaleImg.height * SCALE
            );

            const lockImg = await this.loadImage(
                `bitmaps/lock/lock${locked ? "1" : "0"}.bmp`
            );
            offScreenContext.drawImage(
                lockImg,
                12 * SCALE,
                43 * SCALE,
                lockImg.width * SCALE,
                lockImg.height * SCALE
            );

            if (isPoweringOff === true && poweringOffStep >= 0) {
                const shutDownImg = await this.loadImage(
                    `bitmaps/shutdown/shutdown${poweringOffStep.toString().padStart(2, "0")}.bmp`
                );
                offScreenContext.drawImage(
                    shutDownImg,
                    0,
                    51 * SCALE,
                    shutDownImg.width * SCALE,
                    shutDownImg.height * SCALE
                );
            } else {
                const modeImg = await this.loadImage(
                    `bitmaps/mode/mode_${mode.toLowerCase()}.bmp`
                );
                offScreenContext.drawImage(
                    modeImg,
                    0,
                    51 * SCALE,
                    modeImg.width * SCALE,
                    modeImg.height * SCALE
                );
            }
        }

        if (usbCharge) {
            const chargeImg = await this.loadImage("bitmaps/charge/charge.bmp");
            offScreenContext.drawImage(
                chargeImg,
                15 * SCALE,
                0,
                chargeImg.width * SCALE,
                chargeImg.height * SCALE
            );
        }

        // Draw the off-screen canvas onto the visible canvases
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(offScreenCanvas, 0, 0);

        // Scale down and draw on the duplicate canvas
        duplicateContext.clearRect(
            0,
            0,
            duplicateCanvas.width,
            duplicateCanvas.height
        );
        duplicateContext.drawImage(
            offScreenCanvas,
            0,
            0,
            duplicateCanvas.width,
            duplicateCanvas.height
        );
    },
};
